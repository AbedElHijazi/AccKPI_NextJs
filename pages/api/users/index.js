import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getUsers(req, res);
  } else if (req.method === 'POST') {
    return await createUser(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getUsers(req, res) {
  try {
    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT 
        u.usrID,
        u.usrDesc,
        u.usrEmail,
        u.DepartmentID,
        u.usrAdmin,
        u.IsSpecialUser,
        d.DeptName
      FROM tblUsers u
      LEFT JOIN tblDepartments d ON u.DepartmentID = d.DepartmentID
      ORDER BY u.usrDesc ASC
    `);

    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function createUser(req, res) {
  const { usrDesc, usrEmail, usrPWD, DepartmentID, usrAdmin, IsSpecialUser } = req.body;

  if (!usrDesc || !usrEmail || !usrPWD || !DepartmentID) {
    return res.status(400).json({ error: 'Name, email, password, and department are required' });
  }

  try {
    const pool = await getPool();

    // Check if user already exists
    const existingUser = await pool.request()
      .input('usrEmail', sql.NVarChar, usrEmail)
      .query(`SELECT usrID FROM tblUsers WHERE usrEmail = @usrEmail`);

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const result = await pool.request()
      .input('usrDesc', sql.NVarChar, usrDesc)
      .input('usrEmail', sql.NVarChar, usrEmail)
      .input('usrPWD', sql.NVarChar, usrPWD)
      .input('DepartmentID', sql.Int, parseInt(DepartmentID))
      .input('usrAdmin', sql.Bit, usrAdmin || false)
      .input('IsSpecialUser', sql.Bit, IsSpecialUser || false)
      .query(`
        INSERT INTO tblUsers (usrDesc, usrEmail, usrPWD, DepartmentID, usrAdmin, IsSpecialUser)
        OUTPUT INSERTED.usrID, INSERTED.usrDesc, INSERTED.usrEmail, INSERTED.DepartmentID
        VALUES (@usrDesc, @usrEmail, @usrPWD, @DepartmentID, @usrAdmin, @IsSpecialUser)
      `);

    if (result.recordset.length === 0) {
      return res.status(500).json({ error: 'Failed to create user' });
    }

    return res.status(201).json({
      success: true,
      user: result.recordset[0],
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
}
