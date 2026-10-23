import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../server.js';
import { getStore } from '../services/store.js';

test('verified OTP resets a password once and rejects expired or reused codes', async () => {
  const store = await getStore();
  const admin = store.admins[0];
  const email = admin.email.toLowerCase();
  store.otpStore[email] = {
    otpHash: await bcrypt.hash('482913', 4),
    accountType: 'ADMIN',
    accountId: admin.id,
    expiresAt: Date.now() + 60_000,
    attempts: 0,
    used: false
  };

  const verified = await request(app).post('/api/auth/verify-otp').send({ email, otp: '482913' });
  assert.equal(verified.status, 200);
  const reset = await request(app).post('/api/auth/reset-password').send({
    email,
    newPassword: 'new-secure-admin-password',
    confirmPassword: 'new-secure-admin-password'
  });
  assert.equal(reset.status, 200);
  const login = await request(app).post('/api/auth/admin/login').send({
    adminId: admin.adminId,
    password: 'new-secure-admin-password'
  });
  assert.equal(login.status, 200);
  assert.equal((await getStore()).otpStore[email].used, true);
});

test('OTP verification locks out after the configured failed attempts', async () => {
  const store = await getStore();
  const admin = store.admins[0];
  const email = admin.email.toLowerCase();
  store.otpStore[email] = {
    otpHash: await bcrypt.hash('916204', 4),
    accountType: 'ADMIN',
    accountId: admin.id,
    expiresAt: Date.now() + 60_000,
    attempts: 5,
    used: false
  };
  const failed = await request(app).post('/api/auth/verify-otp').send({ email, otp: '916204' });
  assert.equal(failed.status, 400);
  assert.equal((await getStore()).otpStore[email].attempts, 5);
});

test('expired OTP cannot be verified or used to reset a password', async () => {
  const store = await getStore();
  const admin = store.admins[0];
  const email = admin.email.toLowerCase();
  store.otpStore[email] = {
    otpHash: await bcrypt.hash('183740', 4),
    accountType: 'ADMIN',
    accountId: admin.id,
    expiresAt: Date.now() - 1,
    attempts: 0,
    used: false
  };
  const verified = await request(app).post('/api/auth/verify-otp').send({ email, otp: '183740' });
  assert.equal(verified.status, 400);
  const reset = await request(app).post('/api/auth/reset-password').send({
    email,
    newPassword: 'another-secure-admin-password',
    confirmPassword: 'another-secure-admin-password'
  });
  assert.equal(reset.status, 400);
});
