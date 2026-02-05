import { getIronSession } from 'iron-session';

const sessionConfig = {
  password: process.env.SESSION_SECRET || 'your-secret-key-min-32-characters-long!',
  cookieName: 'acckpi_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
};

/**
 * Get the current session (SERVER-SIDE ONLY)
 * @param {object} req - Next.js request object
 * @param {object} res - Next.js response object
 * @returns {Promise<IronSession>} Session object
 */
export async function getSessionServerSide(req, res) {
  const session = await getIronSession(req, res, sessionConfig);
  return session;
}

/**
 * Check if session is valid
 * @param {IronSession} session - Session object to check
 * @returns {boolean} True if session has valid user
 */
export function isSessionValid(session) {
  return !!(session && session.user && session.user.id);
}
