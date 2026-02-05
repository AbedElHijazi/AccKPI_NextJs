import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (req.method === 'GET') {
    return await getUserDetail(id, res);
  } else if (req.method === 'PUT') {
    return await updateUser(id, req, res);
  } else if (req.method === 'DELETE') {
    return await deleteUser(id, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getUserDetail(userId, res) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('usrID', sql.NVarChar, userId)
      .query(`
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
        WHERE u.usrID = @usrID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
}

async function updateUser(userId, req, res) {
  const { usrDesc, DepartmentID, usrAdmin, IsSpecialUser } = req.body;

  try {
    const pool = await getPool();

    const updates = [];
    const request = pool.request().input('usrID', sql.NVarChar, userId);

    if (usrDesc !== undefined) {
      updates.push('usrDesc = @usrDesc');
      request.input('usrDesc', sql.NVarChar, usrDesc);
    }
    if (DepartmentID !== undefined) {
      updates.push('DepartmentID = @DepartmentID');
      request.input('DepartmentID', sql.Int, DepartmentID);
    }
    if (usrAdmin !== undefined) {
      updates.push('usrAdmin = @usrAdmin');
      request.input('usrAdmin', sql.Bit, usrAdmin);
    }
    if (IsSpecialUser !== undefined) {
      updates.push('IsSpecialUser = @IsSpecialUser');
      request.input('IsSpecialUser', sql.Bit, IsSpecialUser);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    await request.query(`UPDATE tblUsers SET ${updates.join(', ')} WHERE usrID = @usrID`);

    return res.status(200).json({
      success: true,
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

async function deleteUser(userId, res) {
  try {
    const pool = await getPool();

    await pool.request()
      .input('usrID', sql.NVarChar, userId)
      .query(`DELETE FROM tblUsers WHERE usrID = @usrID`);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
}
