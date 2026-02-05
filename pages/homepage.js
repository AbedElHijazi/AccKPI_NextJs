import { useAuth } from '@/lib/hooks';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function Homepage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    if (user) {
      fetchStats();
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
        <h1 className="mb-4">Homepage User</h1>
        
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Welcome</h5>
                <p className="card-text">
                  <strong>User:</strong> {user.usrDesc}<br />
                  <strong>Email:</strong> {user.usrEmail}<br />
                  <strong>Department:</strong> {user.department}<br />
                  <strong>Admin:</strong> {user.usrAdmin ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </div>

          {stats && (
            <>
              <div className="col-md-3">
                <div className="card bg-primary text-white">
                  <div className="card-body">
                    <h5 className="card-title">Workflows</h5>
                    <p className="card-text display-4">{stats.stats.totalWorkflows}</p>
                  </div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card bg-success text-white">
                  <div className="card-body">
                    <h5 className="card-title">Tasks</h5>
                    <p className="card-text display-4">{stats.stats.totalTasks}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {stats && stats.recentWorkflows && stats.recentWorkflows.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">Recent Workflows</h5>
                </div>
                <div className="card-body">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th>Workflow ID</th>
                        <th>Process</th>
                        <th>Project</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentWorkflows.map(wf => (
                        <tr key={wf.WorkFlowID}>
                          <td>{wf.WorkFlowID}</td>
                          <td>{wf.ProcessName || '-'}</td>
                          <td>{wf.ProjectName || '-'}</td>
                          <td>{wf.status}</td>
                          <td>{new Date(wf.createdDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
