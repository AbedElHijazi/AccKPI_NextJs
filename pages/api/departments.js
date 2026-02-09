
import { getPool } from '@/lib/db';
import { getAllDepartments } from '@/lib/helpers';
import { getCached, setCached, CACHE_KEYS } from '@/lib/cache';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const cached = getCached(CACHE_KEYS.DEPARTMENTS);
      if (cached) return res.status(200).json(cached);
      const departments = await getAllDepartments();
      setCached(CACHE_KEYS.DEPARTMENTS, departments);
      return res.status(200).json(departments);
    } catch (error) {
      console.error('Error fetching departments:', error);
      return res.status(500).json({ error: 'Failed to fetch departments' });
    }
  } else if (req.method === 'DELETE') {
    // Delete department by ID (query param: ?id=123)
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ error: 'Department ID is required' });
    }
    try {
      const pool = await getPool();
      // Optionally: check for users/tasks referencing this department before deleting
      await pool.request()
        .input('DepartmentID', sql.Int, id)
        .query('DELETE FROM tblDepartments WHERE DepartmentID = @DepartmentID');
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting department:', error);
      return res.status(500).json({ error: 'Failed to delete department' });
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
