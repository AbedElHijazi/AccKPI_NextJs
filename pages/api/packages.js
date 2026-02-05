import { getPool } from '@/lib/db';
import { getAllPackages } from '@/lib/helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const packages = await getAllPackages();
    return res.status(200).json(packages);
  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({ error: 'Failed to fetch packages' });
  }
}
