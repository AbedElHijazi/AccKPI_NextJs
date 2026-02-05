import { getPool } from '@/lib/db';
import { getAllProcesses } from '@/lib/helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const processes = await getAllProcesses();
    return res.status(200).json(processes);
  } catch (error) {
    console.error('Error fetching processes:', error);
    return res.status(500).json({ error: 'Failed to fetch processes' });
  }
}
