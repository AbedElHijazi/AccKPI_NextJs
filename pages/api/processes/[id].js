import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  console.log(`[DELETE API] Request received for ID: ${id}, Method: ${req.method}`);

  if (req.method === 'DELETE') {
    if (!id) {
      console.log(`[DELETE API] No ID provided`);
      return res.status(400).json({ error: 'Process ID is required' });
    }

    try {
      // Just do a simple test first - return a successful response
      console.log(`[DELETE API] Simple test - returning success`);
      return res.status(200).json({ message: 'Process deleted successfully (test mode)' });
      
    } catch (error) {
      console.error('[DELETE API] Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete process' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

