import type express from 'express';
import { authService } from '../services/authService';

export function attachUser(req: express.Request, _res: express.Response, next: express.NextFunction) {
  try {
    const cookieHeader = req.headers.cookie || '';
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').map(c => c.trim()).filter(Boolean).forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx > 0) cookies[pair.substring(0, idx)] = decodeURIComponent(pair.substring(idx + 1));
    });
    const sessionId = cookies['sessionId'];
    if (sessionId) {
      const user = authService.getUserBySession(sessionId);
      (req as any).user = user || null;
      (req as any).sessionId = sessionId;
    }
  } catch {
    // ignore cookie parse errors
  }
  next();
}

export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authService.isAuthEnabled()) return next();
  if (!(req as any).user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

export function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authService.isAuthEnabled()) return res.status(403).json({ success: false, error: 'Admin only when auth enabled' });
  const user = (req as any).user as { role?: string } | null;
  if (!user) return res.status(401).json({ success: false, error: 'Authentication required' });
  if (user.role !== 'admin') return res.status(403).json({ success: false, error: 'Admin privilege required' });
  next();
}


