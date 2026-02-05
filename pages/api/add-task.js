import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ProcessID, DepId, TaskName, TaskPlanned, DaysRequired, IsFixed, linkTasks } = req.body;

  // Validate required fields
  if (!ProcessID || !DepId || !TaskName || !TaskPlanned || !DaysRequired) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const pool = await getPool();

    // Insert task with only the columns that definitely exist
    const taskResult = await pool
      .request()
      .input('TaskName', sql.NVarChar, TaskName)
      .input('TaskPlanned', sql.NVarChar, TaskPlanned)
      .input('DaysRequired', sql.Int, parseInt(DaysRequired))
      .input('IsFixed', sql.Bit, parseInt(IsFixed) ? 1 : 0)
      .input('DepId', sql.Int, parseInt(DepId))
      .input('proccessID', sql.Int, parseInt(ProcessID))
      .input('PlannedDate', sql.DateTime, new Date())
      .query(`
        INSERT INTO tblTasks 
        (TaskName, TaskPlanned, DaysRequired, IsFixed, DepId, proccessID, PlannedDate)
        OUTPUT INSERTED.TaskID
        VALUES 
        (@TaskName, @TaskPlanned, @DaysRequired, @IsFixed, @DepId, @proccessID, @PlannedDate)
      `);

    if (!taskResult.recordset || taskResult.recordset.length === 0) {
      return res.status(500).json({ error: 'Failed to create task - no record returned' });
    }

    const taskId = taskResult.recordset[0].TaskID;
    console.log(`[ADD-TASK] Created task ${taskId} for process ${ProcessID}`);

    return res.status(201).json({
      message: 'Task created successfully',
      taskId,
    });
  } catch (error) {
    console.error('[ADD-TASK] Error:', error);
    return res.status(500).json({ error: 'Failed to create task: ' + error.message });
  }
}
