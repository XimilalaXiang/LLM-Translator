import { Router } from 'express';
import { authService } from '../services/authService';
import { db } from '../database/schema';
import { requireAdmin } from '../utils/authMiddleware';
import { modelService } from '../services/modelService';
import { knowledgeService } from '../services/knowledgeService';

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

// Share toggles for admin-owned resources
router.post('/models/:id/share', requireAdmin, (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const { id } = req.params;
    const { isPublic } = req.body as { isPublic?: boolean };
    const m = modelService.getModelById(id);
    if (!m) return res.status(404).json({ success: false, error: 'Model not found' });
    if (m.ownerUserId !== userId) return res.status(403).json({ success: false, error: 'Only owner can share' });
    db.prepare('UPDATE model_configs SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isPublic ? 1 : 0, id);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

router.post('/knowledge/:id/share', requireAdmin, (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const { id } = req.params;
    const { isPublic } = req.body as { isPublic?: boolean };
    const kb = knowledgeService.getKnowledgeBaseById(id);
    if (!kb) return res.status(404).json({ success: false, error: 'Knowledge base not found' });
    if (kb.ownerUserId !== userId) return res.status(403).json({ success: false, error: 'Only owner can share' });
    db.prepare('UPDATE knowledge_bases SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isPublic ? 1 : 0, id);
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

// Cleanup legacy shared or ownerless resources
router.post('/cleanup-legacy', requireAdmin, async (req, res) => {
  try {
    const adminId = (req as any).user?.id as string;
    const kbRows = db.prepare("SELECT id FROM knowledge_bases WHERE owner_user_id IS NULL OR is_public = 1").all() as { id: string }[];
    let kbDeleted = 0;
    for (const row of kbRows) {
      try {
        if (knowledgeService.deleteKnowledgeBase(row.id, adminId, true)) kbDeleted++;
      } catch {
        // ignore
      }
    }

    const modelRows = db.prepare("SELECT id FROM model_configs WHERE owner_user_id IS NULL OR is_public = 1").all() as { id: string }[];
    let modelDeleted = 0;
    for (const row of modelRows) {
      try {
        const r = db.prepare('DELETE FROM model_configs WHERE id = ?').run(row.id);
        if (r.changes > 0) modelDeleted++;
      } catch {
        // ignore (possible RESTRICT if any leftover KB depends on it)
      }
    }

    res.json({ success: true, data: { kbDeleted, modelDeleted } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Cleanup failed' });
  }
});


