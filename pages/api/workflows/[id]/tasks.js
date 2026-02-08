import { getWorkflowTasks } from '@/lib/helpers';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Workflow ID is required' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const workflowId = parseInt(id, 10);
    const tasks = await getWorkflowTasks(workflowId);

    if (!tasks || tasks.length === 0) {
      return res.status(200).json([]);
    }

    // Transform tasks to match frontend expectations
    const transformedTasks = tasks.map(task => ({
      TaskID: task.TaskID,
      TaskName: task.TaskName,
      TaskPlanned: task.TaskPlanned,
      IsTaskSelected: task.IsTaskSelected,
      PlannedDate: task.PlannedDate,
      DepId: task.DepId,
      DeptName: task.DeptName,
      Priority: task.Priority,
      PredecessorID: task.PredecessorID,
      DaysRequired: task.DaysRequired,
      IsFixed: task.IsFixed,
      WorkFlowHdrID: task.WorkFlowHdrID,
      linkTasks: task.linkTasks,
      WorkflowDtlId: task.WorkflowDtlId,
      TimeStarted: task.TimeStarted,
      TimeFinished: task.TimeFinished,
      DelayReason: task.DelayReason,
      Delay: task.Delay,
      assignUser: task.assignUser,
      ProcessName: task.ProcessName,
      ProjectName: task.ProjectName,
      PkgeName: task.PkgeName,
      StepOrder: task.StepOrder,
      PaymentStep: task.PaymentStep,
      PaymentCount: task.PaymentCount,
      Status: task.TimeFinished ? 'Completed' : (task.TimeStarted ? 'In Progress' : 'Pending')
    }));

    return res.status(200).json(transformedTasks);
  } catch (error) {
    console.error('Error fetching workflow tasks:', error);
    return res.status(500).json({ error: 'Failed to fetch workflow tasks' });
  }
}
