export const riskFromValue = (value) => {
  if (value >= 70) return 'HIGH';
  if (value >= 40) return 'MEDIUM';
  return 'LOW';
};

export const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeText = (value = '') => String(value).trim();

export const hashPassword = async (bcrypt, rawPassword) => bcrypt.hash(rawPassword, 10);

export const generateToken = (user, role) => {
  const jwt = (await import('jsonwebtoken')).default;
  return jwt.sign({ userId: user.id, email: user.email, role }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
};
