import { getUserById } from './helpers';

export async function withAuth(handler) {
  return async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const user = await getUserById(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      req.user = user;
      return handler(req, res);
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

export async function withAdminAuth(handler) {
  return async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
      const user = await getUserById(req.session.userId);
      if (!user || !user.usrAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      req.user = user;
      return handler(req, res);
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
}
