import { getSessionServerSide } from '@/lib/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSessionServerSide(req, res);
    
    if (session.user) {
      return res.status(200).json({
        authenticated: true,
        usrAdmin: session.user.usrAdmin || false,
        isSpecialUser: session.user.IsSpecialUser || false,
        projectID: session.user.ProjectID || null,
        user: session.user
      });
    } else {
      return res.status(401).json({
        authenticated: false,
        message: 'Not authenticated'
      });
    }
  } catch (err) {
    console.error('Session check error:', err);
    return res.status(500).json({
      authenticated: false,
      error: 'Failed to check session'
    });
  }
}
