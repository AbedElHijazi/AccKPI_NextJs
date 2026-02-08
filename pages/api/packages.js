import { getPool } from '@/lib/db';
import { getAllPackages } from '@/lib/helpers';
import { getCached, setCached, CACHE_KEYS } from '@/lib/cache';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cached = getCached(CACHE_KEYS.PACKAGES);
    if (cached) return res.status(200).json(cached);

    const packages = await getAllPackages();
    setCached(CACHE_KEYS.PACKAGES, packages);
    return res.status(200).json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({ error: 'Failed to fetch packages' });
  }
}
