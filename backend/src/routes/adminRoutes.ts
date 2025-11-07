import { Router } from 'express';
import { authService } from '../services/authService';
import { db } from '../database/schema';
import { requireAdmin } from '../utils/authMiddleware';

const router = Router();

router.get('/settings', (req, res, next) => {
  // When auth is disabled, allow reading freely; otherwise require admin
  if (authService.isAuthEnabled()) return requireAdmin(req, res, next);
  next();
}, (_req, res) => {
  res.json({ success: true, data: { authEnabled: authService.isAuthEnabled() } });
});

router.post('/settings', (req, res, next) => {
  if (authService.isAuthEnabled()) return requireAdmin(req, res, next);
  next();
}, (req, res) => {
  const { authEnabled } = req.body as { authEnabled?: boolean };
  if (typeof authEnabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'authEnabled must be boolean' });
  }
  authService.setAuthEnabled(authEnabled);
  res.json({ success: true, data: { authEnabled } });
});

// Bootstrap first admin when no admin exists (allowed when auth is enabled but has no admin)
router.post('/bootstrap', (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!authService.isAuthEnabled()) {
      return res.status(400).json({ success: false, error: 'Auth not enabled' });
    }
    const found = db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get();
    if (found) {
      return res.status(409).json({ success: false, error: 'Admin already exists' });
    }
    if (!username || !password) return res.status(400).json({ success: false, error: 'username and password required' });
    const admin = authService.createUser(username, password, 'admin');
    const session = authService.createSession(admin.id);
    res.setHeader('Set-Cookie', `sessionId=${session.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
    res.json({ success: true, data: { user: admin } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Bootstrap failed' });
  }
});

// Danger zone: reset models (and optionally knowledge bases)
router.post('/reset-models', (req, res, next) => {
  // Require admin when auth enabled; allow during initial setup when auth disabled
  if (authService.isAuthEnabled()) return requireAdmin(req, res, next);
  next();
}, (req, res) => {
  try {
    const { deleteKnowledgeBases } = req.body as { deleteKnowledgeBases?: boolean };
    const tx = db.transaction(() => {
      if (deleteKnowledgeBases) {
        db.prepare('DELETE FROM knowledge_bases').run();
      }
      db.prepare('DELETE FROM model_configs').run();
    });
    try {
      tx();
    } catch (e) {
      // If RESTRICT fails due to existing knowledge base when not deleting them
      return res.status(409).json({ success: false, error: 'Cannot delete models: knowledge bases depend on them. Set deleteKnowledgeBases=true to force.' });
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Reset failed' });
  }
});

export default router;


