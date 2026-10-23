import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import connectDB from './config/db.js';
import { getDatabase } from './config/db.js';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
    const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!origin || isDevelopment || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.get('/api/health', async (req, res) => {
  try {
    if (process.env.NODE_ENV !== 'test') await getDatabase().command({ ping: 1 });
    return res.json({ status: 'ok', database: process.env.NODE_ENV === 'test' ? 'test-memory' : 'mongodb' });
  } catch (error) {
    return res.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employees', employeeRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({ message: 'Internal server error' });
  }
  return res.status(500).json({ message: err.message || 'Unknown error' });
});

const PORT = Number(process.env.PORT || 5000);

const startServer = async (port) => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exitCode = 1;
    return;
  }
  const server = app.listen(port, () => {
    console.log(`BurnoutGuard backend running on http://localhost:${port}`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      console.warn(`Port ${port} is busy. Retrying on ${fallbackPort}.`);
      void startServer(fallbackPort);
      return;
    }

    console.error('Server start error:', error);
    process.exitCode = 1;
  });
};

const isTestRun = process.argv.some((argument) => argument.includes('test'));

if (!isTestRun && process.env.NODE_ENV !== 'test') {
  startServer(PORT);
}

export { app };
