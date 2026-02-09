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

  const { usrID, usrDesc, usrEmail, usrPWD, DepartmentID, usrAdmin, IsSpecialUser } = req.body;

  if (!usrID || !usrDesc || !usrEmail || !usrPWD) {
    return res.status(400).json({ error: 'User ID, name, email, and password are required' });
  }
  // DepartmentID is required for non-admin users
  if (!usrAdmin && !DepartmentID) {
    return res.status(400).json({ error: 'Department is required for regular or special users' });
  }

  try {
    const pool = await getPool();


    // Check if user ID or email already exists
    const existingUser = await pool.request()
      .input('usrID', sql.NVarChar, usrID)
      .input('usrEmail', sql.NVarChar, usrEmail)
      .query(`SELECT usrID FROM tblUsers WHERE usrID = @usrID OR usrEmail = @usrEmail`);

    if (existingUser.recordset.length > 0) {
      return res.status(400).json({ error: 'User with this ID or email already exists' });
    }

    const request = pool.request()
      .input('usrID', sql.NVarChar, usrID)
      .input('usrDesc', sql.NVarChar, usrDesc)
      .input('usrEmail', sql.NVarChar, usrEmail)
      .input('usrPWD', sql.NVarChar, usrPWD)
      .input('usrAdmin', sql.Bit, usrAdmin || false)
      .input('IsSpecialUser', sql.Bit, IsSpecialUser || false);
    if (!usrAdmin) {
      request.input('DepartmentID', sql.Int, parseInt(DepartmentID));
    } else {
      request.input('DepartmentID', sql.Int, null);
    }
    const result = await request.query(`
      INSERT INTO tblUsers (usrID, usrDesc, usrEmail, usrPWD, DepartmentID, usrAdmin, IsSpecialUser)
      OUTPUT INSERTED.usrID, INSERTED.usrDesc, INSERTED.usrEmail, INSERTED.DepartmentID, INSERTED.usrAdmin, INSERTED.IsSpecialUser
      VALUES (@usrID, @usrDesc, @usrEmail, @usrPWD, @DepartmentID, @usrAdmin, @IsSpecialUser)
    `);

    if (result.recordset.length === 1) {
      const newId = result.recordset[0].usrID;
      return res.status(201).json({
        success: true,
        idLength: newId ? newId.length : 0,
        user: result.recordset[0],
        message: 'User created successfully'
      });
    } else {
      return res.status(500).json({ error: 'Failed to create user' });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
}
