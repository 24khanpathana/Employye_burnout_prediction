import jwt from 'jsonwebtoken';
import { findEmployeeById } from '../services/store.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice('Bearer '.length), jwtSecret());
  } catch {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
  if (decoded.role !== 'EMPLOYEE') return res.status(403).json({ message: 'Employee access required.' });
  const user = await findEmployeeById(decoded.userId);
  if (!user || user.status !== 'APPROVED') return res.status(401).json({ message: 'User not found or account is not approved.' });
  req.user = { ...decoded, role: 'EMPLOYEE' };
  return next();
};

export const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Admin token missing' });
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice('Bearer '.length), jwtSecret());
  } catch {
    return res.status(401).json({ message: 'Invalid admin token' });
  }
  if (decoded.role !== 'ADMIN') return res.status(403).json({ message: 'Admin access required' });
  req.user = decoded;
  return next();
};

export const authorizeEmployee = (req, res, next) => {
  if (!req.user || req.user.role !== 'EMPLOYEE') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
};

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be configured in production.');
  return 'dev-secret';
}
