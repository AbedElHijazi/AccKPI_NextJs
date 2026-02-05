import { useAuth } from '@/lib/hooks';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function WorkflowDash() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [workflows, setWorkflows] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);
        const [workflowsRes, tasksRes, statsRes] = await Promise.all([
          fetch('/api/workflows'),
          fetch('/api/tasks'),
          fetch('/api/dashboard')
        ]);

        if (workflowsRes.ok) {
          const data = await workflowsRes.json();
          setWorkflows(data);
        }
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setTasks(data);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoadingData(false);
      }
    }
    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center min-vh-100">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="container-fluid p-4">
        <div className="alert alert-primary alert-dismissible fade show" role="alert">
          <strong>Welcome {user.name}!</strong> - Workflow Dashboard for monitoring your workflows and tasks
        </div>

        <h1 className="mb-4">Workflow Dashboard</h1>

        {/* Statistics */}
        {stats && (
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-info text-white">
                <div className="card-body">
                  <h5 className="card-title">Total Workflows</h5>
                  <p className="card-text display-4">{stats.stats.totalWorkflows}</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body">
                  <h5 className="card-title">Active Workflows</h5>
                  <p className="card-text display-4">{stats.stats.activeWorkflows}</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-warning text-white">
                <div className="card-body">
                  <h5 className="card-title">Total Tasks</h5>
                  <p className="card-text display-4">{stats.stats.totalTasks}</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-secondary text-white">
                <div className="card-body">
                  <h5 className="card-title">My Department</h5>
                  <p className="card-text">{user.department || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Workflows */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-info text-white">
                <h5 className="mb-0">📊 All Workflows</h5>
              </div>
              <div className="card-body">
                {loadingData ? (
                  <p>Loading workflows...</p>
                ) : workflows && workflows.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Workflow ID</th>
                          <th>Process</th>
                          <th>Project</th>
                          <th>Status</th>
                          <th>Created Date</th>
                          <th>Tasks</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflows.map(wf => (
                          <tr key={wf.WorkFlowID}>
                            <td>#{wf.WorkFlowID}</td>
                            <td>{wf.ProcessName || '-'}</td>
                            <td>{wf.ProjectName || '-'}</td>
                            <td>
                              <span className={`badge bg-${wf.status === 'Active' ? 'success' : wf.status === 'Pending' ? 'warning' : 'secondary'}`}>
                                {wf.status}
                              </span>
                            </td>
                            <td>{new Date(wf.createdDate).toLocaleDateString()}</td>
                            <td>{wf.taskCount || 0} tasks</td>
                            <td>
                              <button className="btn btn-sm btn-primary">View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">No workflows found</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h5 className="mb-0">✓ Tasks</h5>
              </div>
              <div className="card-body">
                {loadingData ? (
                  <p>Loading tasks...</p>
                ) : tasks && tasks.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Task ID</th>
                          <th>Task Name</th>
                          <th>Priority</th>
                          <th>Days Required</th>
                          <th>Department</th>
                          <th>Process</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map(task => (
                          <tr key={task.TaskID}>
                            <td>#{task.TaskID}</td>
                            <td>{task.TaskName}</td>
                            <td>
                              <span className={`badge bg-${task.Priority === 'High' ? 'danger' : task.Priority === 'Medium' ? 'warning' : 'info'}`}>
                                {task.Priority || 'Normal'}
                              </span>
                            </td>
                            <td>{task.DaysRequired}</td>
                            <td>{task.DeptName || '-'}</td>
                            <td>{task.ProcessName || '-'}</td>
                            <td>
                              <span className={`badge bg-${task.IsTaskSelected ? 'success' : 'secondary'}`}>
                                {task.IsTaskSelected ? 'Selected' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">No tasks found</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
