import { useAdminAuth } from '@/lib/hooks';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function AdminPage() {
  const { user, loading } = useAdminAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
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
        const [usersRes, workflowsRes, statsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/workflows'),
          fetch('/api/dashboard')
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data);
        }
        if (workflowsRes.ok) {
          const data = await workflowsRes.json();
          setWorkflows(data);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
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
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <strong>🔐 Admin Area</strong> - Only administrators can access this page. Manage users, workflows, and system settings.
        </div>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>Admin Dashboard</h1>
          <span className="badge bg-danger fs-6">Administrator Access</span>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="row mb-4">
            <div className="col-md-3">
              <div className="card bg-primary text-white">
                <div className="card-body">
                  <h5 className="card-title">Total Users</h5>
                  <p className="card-text display-4">{users.length}</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-success text-white">
                <div className="card-body">
                  <h5 className="card-title">Total Workflows</h5>
                  <p className="card-text display-4">{stats.stats.totalWorkflows}</p>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card bg-info text-white">
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
          </div>
        )}

        {/* Users Management */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">👥 Users Management (Admin Only)</h5>
                <button className="btn btn-sm btn-light" onClick={() => router.push('/users/add')}>
                  + Add User
                </button>
              </div>
              <div className="card-body">
                {loadingData ? (
                  <p>Loading users...</p>
                ) : users && users.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Department</th>
                          <th>Admin</th>
                          <th>Special User</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(u => (
                          <tr key={u.usrID}>
                            <td>{u.usrID}</td>
                            <td>{u.usrDesc}</td>
                            <td>{u.usrEmail}</td>
                            <td>{u.DeptName || '-'}</td>
                            <td>
                              <span className={`badge bg-${u.usrAdmin ? 'success' : 'secondary'}`}>
                                {u.usrAdmin ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td>
                              <span className={`badge bg-${u.IsSpecialUser ? 'warning' : 'secondary'}`}>
                                {u.IsSpecialUser ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td>
                              <button className="btn btn-sm btn-warning me-2">Edit</button>
                              <button className="btn btn-sm btn-danger">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted">No users found</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Workflows Management */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                <h5 className="mb-0">⚙️ Workflows Management (Admin Only)</h5>
                <button className="btn btn-sm btn-light">
                  + Add Workflow
                </button>
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
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflows.map(wf => (
                          <tr key={wf.WorkFlowID}>
                            <td>{wf.WorkFlowID}</td>
                            <td>{wf.ProcessName || '-'}</td>
                            <td>{wf.ProjectName || '-'}</td>
                            <td>
                              <span className={`badge bg-${wf.status === 'Active' ? 'success' : 'secondary'}`}>
                                {wf.status}
                              </span>
                            </td>
                            <td>{new Date(wf.createdDate).toLocaleDateString()}</td>
                            <td>
                              <button className="btn btn-sm btn-info me-2">View</button>
                              <button className="btn btn-sm btn-warning me-2">Edit</button>
                              <button className="btn btn-sm btn-danger">Delete</button>
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
      </div>
    </Layout>
  );
}
