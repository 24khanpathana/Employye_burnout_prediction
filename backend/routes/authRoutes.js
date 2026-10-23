import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { randomInt } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { getStore, persistStore, createRegistrationRequest, findEmployeeByEmail, findEmployeeByEmployeeId, adminLoginFallback, employeeLoginFallback } from '../services/store.js';

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

router.post('/admin/login', loginLimiter, async (req, res) => {
  const { adminId, password } = req.body;
  const admin = await adminLoginFallback(adminId, password);

  if (!admin) {
    return res.status(401).json({ message: 'Invalid admin credentials' });
  }

  const token = jwt.sign({ userId: admin.id, role: 'ADMIN', adminId: admin.adminId }, jwtSecret(), { expiresIn: '7d' });
  return res.json({ token, user: { id: admin.id, adminId: admin.adminId, email: admin.email, name: admin.name, role: 'ADMIN' } });
});

router.post('/employee/login', loginLimiter, async (req, res) => {
  const { employeeId, password } = req.body;
  const employee = await employeeLoginFallback(employeeId, password);

  if (!employee) {
    return res.status(401).json({ message: 'Invalid employee credentials or account pending' });
  }

  const token = jwt.sign({ userId: employee.id, role: 'EMPLOYEE', employeeId: employee.employeeId }, jwtSecret(), { expiresIn: '7d' });
  return res.json({ token, user: { id: employee.id, employeeId: employee.employeeId, name: employee.fullName, email: employee.email, role: 'EMPLOYEE' } });
});

router.post('/register', async (req, res) => {
  const { employeeId, fullName, email, password, confirmPassword, position, department, gender, age, educationLevel, joiningDate, countryCode, country, phoneNumber, monthlySalary } = req.body;

  if (![employeeId, fullName, email, password, position, department].every((value) => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ message: 'Required fields missing' });
  }

  const normalizedEmployeeId = employeeId.trim();
  const normalizedName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPosition = position.trim();
  const normalizedDepartment = department.trim();
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must contain at least 8 characters.' });
  }

  const existingEmployee = await findEmployeeByEmail(normalizedEmail) || await findEmployeeByEmployeeId(normalizedEmployeeId);
  const store = await getStore();
  if (existingEmployee || store.registrations.some((request) =>
    String(request.employeeId || '').toLowerCase() === normalizedEmployeeId.toLowerCase()
    || String(request.email || '').toLowerCase() === normalizedEmail
  )) {
    return res.status(409).json({ message: 'Employee ID or email already exists' });
  }

  const hashed = await bcrypt.hash(password, 12);

  const request = await createRegistrationRequest({
    employeeId: normalizedEmployeeId,
    fullName: normalizedName,
    email: normalizedEmail,
    position: normalizedPosition,
    department: normalizedDepartment,
    passwordHash: hashed,
    status: 'PENDING',
    gender,
    age,
    educationLevel,
    joiningDate,
    countryCode,
    country,
    phoneNumber,
    monthlySalary
  });

  return res.status(201).json({ message: 'Registration submitted successfully. Waiting for admin approval.' });
});

router.post('/forgot-password', otpLimiter, async (req, res) => {
  const { emailOrEmployeeId } = req.body;
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return res.status(503).json({ message: 'Password reset email is not configured. Contact your administrator.' });
  }
  const store = await getStore();
  const account = typeof emailOrEmployeeId === 'string'
    ? await findEmployeeByEmail(emailOrEmployeeId) || await findEmployeeByEmployeeId(emailOrEmployeeId)
      || store.admins.find((admin) => admin.email.toLowerCase() === emailOrEmployeeId.toLowerCase()
        || admin.adminId.toLowerCase() === emailOrEmployeeId.toLowerCase())
    : null;
  if (!account || !account.email) {
    return res.json({ message: 'If an approved account matches those details, a reset code will be sent.' });
  }

  const otp = String(randomInt(100000, 1000000));
  const otpHash = await bcrypt.hash(otp, 12);
  const accountType = account.role === 'ADMIN' || account.adminId ? 'ADMIN' : 'EMPLOYEE';
  const otpKey = account.email.toLowerCase();
  store.otpStore[otpKey] = {
    otpHash,
    accountType,
    accountId: account.id,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    used: false
  };
  await persistStore(store);
  try {
    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'BurnoutGuard' },
      to: [{ email: account.email, name: account.fullName || account.name }],
      subject: 'BurnoutGuard password reset code',
      htmlContent: `<p>Your password reset code is <strong>${otp}</strong>.</p><p>This code expires in 10 minutes. If you did not request a reset, ignore this email.</p>`
    }, {
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      timeout: 10000
    });
  } catch (error) {
    delete store.otpStore[otpKey];
    await persistStore(store);
    console.error('Brevo password reset email failed:', error.message);
    return res.status(502).json({ message: 'Unable to send the password reset code. Please try again later.' });
  }

  return res.json({ message: 'If an approved account matches those details, a reset code will be sent.' });
});

router.post('/verify-otp', otpLimiter, async (req, res) => {
  const { email, otp } = req.body;
  const store = await getStore();
  const otpKey = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const otpRecord = store.otpStore[otpKey];

  if (!otpRecord || otpRecord.used || otpRecord.attempts >= 5 || Date.now() > otpRecord.expiresAt) {
    return res.status(400).json({ message: 'OTP expired or invalid' });
  }

  const valid = await bcrypt.compare(otp, otpRecord.otpHash);
  if (!valid) {
    otpRecord.attempts += 1;
    await persistStore(store);
    return res.status(400).json({ message: 'OTP is invalid' });
  }

  otpRecord.verified = true;
  await persistStore(store);
  return res.json({ message: 'OTP verified successfully' });
});

router.post('/reset-password', otpLimiter, async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  if (!email || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'Please provide matching passwords' });
  }

  const store = await getStore();
  const otpKey = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const otpRecord = store.otpStore[otpKey];
  if (!otpRecord || !otpRecord.verified || otpRecord.used || Date.now() > otpRecord.expiresAt) {
    return res.status(400).json({ message: 'Verify a current reset code before changing the password.' });
  }

  const account = otpRecord.accountType === 'ADMIN'
    ? store.admins.find((admin) => admin.id === otpRecord.accountId)
    : store.employees.find((employee) => employee.id === otpRecord.accountId);
  if (!account) return res.status(404).json({ message: 'Account not found.' });
  account.passwordHash = await bcrypt.hash(newPassword, 12);
  account.updatedAt = new Date().toISOString();
  otpRecord.used = true;
  await persistStore(store);

  return res.json({ message: 'Password reset successfully' });
});

export default router;

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be configured in production.');
  return 'dev-secret';
}
