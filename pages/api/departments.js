import { getPool } from '@/lib/db';
import { getAllDepartments } from '@/lib/helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const departments = await getAllDepartments();
    return res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
}
