import { useAuth } from '@/lib/hooks';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function UserPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userTasks, setUserTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showAllDepartments, setShowAllDepartments] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function fetchUserTasks() {
      try {
        const response = await fetch('/api/tasks');
        if (response.ok) {
          const data = await response.json();
          setUserTasks(data);
        }
      } catch (err) {
        console.error('Failed to fetch tasks:', err);
      } finally {
        setLoadingTasks(false);
      }
    }
    if (user) {
      fetchUserTasks();
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
        <div className="alert alert-info alert-dismissible fade show" role="alert">
          <strong>👤 User Area</strong> - View your profile and assigned tasks
        </div>
        <h1 className="mb-4">My Dashboard</h1>
        
        <div className="row mb-4">
          <div className="col-lg-4">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h5 className="mb-0">User Profile</h5>
              </div>
              <div className="card-body">
                <p className="mb-2">
                  <strong>Name:</strong><br />
                  {user.usrDesc}
                </p>
                <p className="mb-2">
                  <strong>Email:</strong><br />
                  {user.usrEmail}
                </p>
                <p className="mb-2">
                  <strong>Department:</strong><br />
                  {user.department || 'Not assigned'}
                </p>
                <p className="mb-2">
                  <strong>Role:</strong><br />
                  {user.usrAdmin ? 'Administrator' : 'User'}
                </p>
                {user.IsSpecialUser && (
                  <p className="mb-0">
                    <span className="badge bg-warning">Special User</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-8">
            <div className="card">
              <div className="card-header bg-success text-white">
                <h5 className="mb-0">My Tasks</h5>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: 16 }}>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowAllDepartments(v => !v)}
                  >
                    {showAllDepartments ? 'Show Flat List' : 'Show All Departments'}
                  </button>
                </div>
                {loadingTasks ? (
                  <p>Loading tasks...</p>
                ) : userTasks && userTasks.length > 0 ? (
                  showAllDepartments ? (
                    <div>
                      <h5 style={{ fontWeight: 700, color: '#1976d2', marginBottom: 12 }}>All Departments</h5>
                      {Object.entries(userTasks.reduce((acc, task) => {
                        const dept = task.DeptName || 'Unknown Department';
                        if (!acc[dept]) acc[dept] = [];
                        acc[dept].push(task);
                        return acc;
                      }, {})).map(([dept, tasks]) => (
                        <div key={dept} style={{ marginBottom: 24 }}>
                          <h6 style={{ fontWeight: 600, color: '#333', marginBottom: 8 }}>{dept}</h6>
                          <table className="table table-striped table-hover">
                            <thead>
                              <tr>
                                <th>Task ID</th>
                                <th>Task Name</th>
                                <th>Priority</th>
                                <th>Days Required</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tasks.map(task => (
                                <tr key={task.TaskID}>
                                  <td>{task.TaskID}</td>
                                  <td>{task.TaskName}</td>
                                  <td>
                                    <span className={`badge bg-${task.Priority === 'High' ? 'danger' : task.Priority === 'Medium' ? 'warning' : 'info'}`}>
                                      {task.Priority}
                                    </span>
                                  </td>
                                  <td>{task.DaysRequired}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <table className="table table-striped table-hover">
                      <thead>
                        <tr>
                          <th>Task ID</th>
                          <th>Task Name</th>
                          <th>Priority</th>
                          <th>Days Required</th>
                          <th>Department</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTasks.map(task => (
                          <tr key={task.TaskID}>
                            <td>{task.TaskID}</td>
                            <td>{task.TaskName}</td>
                            <td>
                              <span className={`badge bg-${task.Priority === 'High' ? 'danger' : task.Priority === 'Medium' ? 'warning' : 'info'}`}>
                                {task.Priority}
                              </span>
                            </td>
                            <td>{task.DaysRequired}</td>
                            <td>{task.DeptName || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  <p className="text-muted">No tasks assigned</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
