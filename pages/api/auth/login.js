import { getSessionServerSide } from '@/lib/session';
import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password, project } = req.body;

  // Validation
  if (!username || !password || !project) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username, password, and project are required' 
    });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.VarChar, username.toLowerCase().trim())
      .input('password', sql.VarChar, password.trim())
      .query(`
        SELECT usrID, usrDesc, usrEmail, DepartmentID, usrAdmin, IsSpecialUser 
        FROM tblUsers 
        WHERE LOWER(usrEmail) = @username AND usrPWD = @password
      `);

    if (result.recordset.length === 1) {
      const user = result.recordset[0];

      // Get session and store user data
      const session = await getSessionServerSide(req, res);
      session.user = {
        id: user.usrID,
        name: user.usrDesc,
        email: user.usrEmail,
        usrAdmin: user.usrAdmin,
        DepartmentId: user.DepartmentID,
        IsSpecialUser: user.IsSpecialUser,
        ProjectID: parseInt(project)
      };
      await session.save();

      return res.json({
        success: true,
        user: session.user,
        redirect: user.usrAdmin ? "/adminpage" : "/workflowdashboard"
      });
    } else {
      return res.json({ success: false, message: "Invalid username or password" });
    }

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
