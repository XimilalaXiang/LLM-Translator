import { Router } from 'express';
import { authService } from '../services/authService';

const router = Router();

router.get('/status', (req, res) => {
  const user = (req as any).user || null;
  res.json({ success: true, data: { authEnabled: authService.isAuthEnabled(), user } });
});

router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!authService.isAuthEnabled()) {
      return res.status(400).json({ success: false, error: 'Registration disabled' });
    }
    if (!username || !password || username.trim().length < 3 || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Invalid username or password' });
    }
    const existed = authService.getUserByUsername(username);
    if (existed) return res.status(409).json({ success: false, error: 'Username exists' });
    const u = authService.createUser(username.trim(), password, 'user');
    const session = authService.createSession(u.id);
    res.setHeader('Set-Cookie', `sessionId=${session.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
    res.json({ success: true, data: { user: u } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Register failed' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }
    const u = authService.verifyPassword(username, password);
    if (!u) return res.status(401).json({ success: false, error: 'Invalid credentials' });
    const session = authService.createSession(u.id);
    res.setHeader('Set-Cookie', `sessionId=${session.id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
    res.json({ success: true, data: { user: u } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  try {
    const sessionId = (req as any).sessionId as string | undefined;
    if (sessionId) authService.deleteSession(sessionId);
    res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Logout failed' });
  }
});

router.get('/me', (req, res) => {
  const user = (req as any).user || null;
  res.json({ success: true, data: { user } });
});

export default router;


