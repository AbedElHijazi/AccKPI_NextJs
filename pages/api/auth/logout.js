import { getSessionServerSide } from '@/lib/session';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session = await getSessionServerSide(req, res);
    session.destroy();
    
    res.setHeader('Set-Cookie', 'acckpi_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 UTC;');
    res.redirect('/login');
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Failed to logout' });
  }
}
