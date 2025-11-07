import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { initDatabase } from './database/schema';
import { knowledgeService } from './services/knowledgeService';
import modelRoutes from './routes/modelRoutes';
import translationRoutes from './routes/translationRoutes';
import knowledgeRoutes from './routes/knowledgeRoutes';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import { attachUser } from './utils/authMiddleware';
import { authService } from './services/authService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Attach user from cookie if session exists
app.use(attachUser);

// Initialize database
initDatabase();

// Load existing knowledge bases
knowledgeService.loadExistingKnowledgeBases().catch(err => {
  console.error('Failed to load knowledge bases:', err);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// If auth is enabled, protect all other API routes by default (except health)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  if (req.path.startsWith('/api/health')) return next();
  if (req.path.startsWith('/api/auth')) return next();
  if (req.path.startsWith('/api/admin')) return next();
  if (!authService.isAuthEnabled()) return next();
  if (!(req as any).user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
});

app.use('/api/models', modelRoutes);
app.use('/api/translations', translationRoutes);
app.use('/api/knowledge', knowledgeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  console.error('Error:', err);
  res.status(500).json({ success: false, error: message });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    Legal Translation Review System - Backend Server      ║
║                                                           ║
║    Server running on: http://localhost:${PORT}              ║
║    Environment: ${process.env.NODE_ENV || 'development'}                        ║
║                                                           ║
║    API Endpoints:                                         ║
║    - GET  /api/health                                     ║
║    - *    /api/auth                                        ║
║    - *    /api/admin                                       ║
║    - *    /api/models                                      ║
║    - *    /api/translations                                ║
║    - *    /api/knowledge                                   ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;
