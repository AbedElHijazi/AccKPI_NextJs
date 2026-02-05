import { getPool } from '@/lib/db';
import sql from 'mssql';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await getTasks(req, res);
  } else if (req.method === 'POST') {
    return await createTask(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getTasks(req, res) {
  try {
    const pool = await getPool();
    const { department, process } = req.query;

    let query = `
      SELECT 
        t.TaskID,
        t.TaskName,
        t.TaskPlanned,
        t.IsTaskSelected,
        t.PlannedDate,
        t.DepId,
        t.Priority,
        t.DaysRequired,
        t.proccessID,
        d.DeptName,
        pr.ProcessName
      FROM tblTasks t
      LEFT JOIN tblDepartments d ON t.DepId = d.DepartmentID
      LEFT JOIN tblProcess pr ON t.proccessID = pr.NumberOfProccessID
      WHERE 1=1
    `;

    if (department) {
      query += ` AND t.DepId = ${parseInt(department)}`;
    }

    if (process) {
      query += ` AND t.proccessID = ${parseInt(process)}`;
    }

    query += ` ORDER BY t.Priority ASC, t.TaskName ASC`;

    const result = await pool.request().query(query);
    return res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

async function createTask(req, res) {
  const { taskName, taskPlanned, plannedDate, depId, priority, daysRequired, processID } = req.body;

  if (!taskName || !depId || !processID) {
    return res.status(400).json({ error: 'taskName, depId, and processID are required' });
  }

  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('taskName', sql.NVarChar, taskName)
      .input('taskPlanned', sql.Bit, taskPlanned || false)
      .input('plannedDate', sql.DateTime, plannedDate || new Date())
      .input('depId', sql.Int, parseInt(depId))
      .input('priority', sql.Int, priority || 1)
      .input('daysRequired', sql.Int, daysRequired || 1)
      .input('processID', sql.Int, parseInt(processID))
      .query(`
        INSERT INTO tblTasks (TaskName, TaskPlanned, PlannedDate, DepId, Priority, DaysRequired, proccessID)
        OUTPUT INSERTED.TaskID, INSERTED.TaskName, INSERTED.DepId, INSERTED.proccessID
        VALUES (@taskName, @taskPlanned, @plannedDate, @depId, @priority, @daysRequired, @processID)
      `);

    if (result.recordset.length === 0) {
      return res.status(500).json({ error: 'Failed to create task' });
    }

    return res.status(201).json({
      success: true,
      task: result.recordset[0],
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
}
