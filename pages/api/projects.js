import { getPool } from '@/lib/db';
import { getAllProjects } from '@/lib/helpers';
import { getCached, setCached, CACHE_KEYS } from '@/lib/cache';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cached = getCached(CACHE_KEYS.PROJECTS);
    if (cached) return res.status(200).json(cached);

    const projects = await getAllProjects();
    setCached(CACHE_KEYS.PROJECTS, projects);
    return res.status(200).json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}
