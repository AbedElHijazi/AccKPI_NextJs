import { getPool } from '@/lib/db';
import { getAllDepartments } from '@/lib/helpers';
import { getCached, setCached, CACHE_KEYS } from '@/lib/cache';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
}
