import { useAdminAuth } from '@/lib/hooks';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function AdminPage() {
  const { user, loading } = useAdminAuth();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ usrDesc: '', usrEmail: '', usrPWD: '', DepartmentID: '', usrAdmin: false, IsSpecialUser: false });
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);
        const [usersRes, workflowsRes, processesRes, departmentsRes, statsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/workflows'),
          fetch('/api/processes'),
          fetch('/api/departments'),
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
        if (processesRes.ok) {
          const data = await processesRes.json();
          setProcesses(data);
        }
        if (departmentsRes.ok) {
          const data = await departmentsRes.json();
          setDepartments(data);
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleDeleteUser = async (usrID) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/${usrID}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users => users.filter(u => u.usrID !== usrID));
      } else {
        alert('Failed to delete user');
      }
    } catch (err) {
      alert('Error deleting user');
    }
  };

  const openEditModal = (user) => {
    console.log('openEditModal called with:', user);
    setEditUser(user);
    setEditForm({
      usrDesc: user.usrDesc != null ? String(user.usrDesc) : '',
      usrEmail: user.usrEmail != null ? String(user.usrEmail) : '',
      usrPWD: '',
      DepartmentID: user.DepartmentID != null ? String(user.DepartmentID) : '',
      usrAdmin: !!user.usrAdmin,
      IsSpecialUser: !!user.IsSpecialUser
    });
  };
  const closeEditModal = () => {
    setEditUser(null);
    setEditForm({ usrDesc: '', usrEmail: '', usrPWD: '', DepartmentID: '', usrAdmin: false, IsSpecialUser: false });
  };
  const handleEditChange = e => {
    const { name, value, type, checked } = e.target;
    setEditForm(f => {
      let updated = { ...f };
      if (type === 'checkbox') {
        updated[name] = checked;
        // If making user special, remove admin
        if (name === 'IsSpecialUser' && checked) {
          updated.usrAdmin = false;
        }
        // If making user admin, remove special and department
        if (name === 'usrAdmin' && checked) {
          updated.IsSpecialUser = false;
          delete updated.DepartmentID;
        }
      } else {
        updated[name] = value;
      }
      return updated;
    });
  };
  const handleEditSubmit = async e => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch(`/api/users/${editUser.usrID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(users => users.map(u => u.usrID === editUser.usrID ? { ...u, ...editForm, usrPWD: undefined } : u));
        closeEditModal();
      } else {
        alert('Failed to update user');
      }
    } catch (err) {
      alert('Error updating user');
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return <div className="d-flex justify-content-center align-items-center min-vh-100">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <style>{`
        :root {
          --primary: #005bab;
          --primary-dark: #003f7f;
          --primary-light: #e6f0ff;
          --accent: #007acc;
          --accent-dark: #005f99;
          --text: #333333;
          --text-light: #666666;
          --border: #e0e0e0;
          --background: #f8fafc;
          --white: #ffffff;
          --success: #28a745;
          --warning: #ffc107;
          --danger: #dc3545;
          --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }

        body {
          background-color: var(--background);
          color: var(--text);
          line-height: 1.6;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--white);
          padding: 1.2rem 2rem;
          border-bottom: 3px solid var(--danger);
          box-shadow: var(--shadow);
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 2rem;
        }

        .logo {
          height: 40px;
          width: auto;
          flex-shrink: 0;
          object-fit: contain;
          padding: 0.25rem;
          border-radius: 4px;
          transition: transform 0.3s ease;
        }

        .logo:hover {
          transform: scale(1.05);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 2rem;
          margin-left: auto;
        }

        .user-info {
          font-weight: 500;
          color: var(--danger);
          white-space: nowrap;
          font-size: 0.95rem;
        }

        .logout-btn {
          background-color: var(--danger);
          color: var(--white);
          padding: 0.6rem 1.3rem;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          transition: var(--transition);
          white-space: nowrap;
          font-size: 0.9rem;
          cursor: pointer;
          border: none;
        }

        .logout-btn:hover {
          background-color: #c82333;
          transform: translateY(-1px);
        }

        .main-content {
          flex: 1;
          padding: 1.5rem;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .section-title {
          font-size: 1.4rem;
          font-weight: 600;
          color: var(--primary-dark);
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.7rem;
        }

        .quick-actions {
          margin-bottom: 2.5rem;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .action-btn {
          background-color: var(--white);
          border: 2px solid var(--border);
          border-radius: 8px;
          padding: 1.5rem;
          text-decoration: none;
          color: var(--text);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.7rem;
          transition: var(--transition);
          text-align: center;
          cursor: pointer;
        }

        .action-btn:hover {
          border-color: var(--danger);
          box-shadow: var(--shadow);
          transform: translateY(-2px);
          background-color: #ffe6e6;
        }

        .action-btn i {
          font-size: 2rem;
          color: var(--danger);
        }

        .btn-label {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text);
        }

        .btn-subtitle {
          font-size: 0.8rem;
          color: var(--text-light);
        }

        .admin-alert {
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          color: #856404;
          padding: 1rem;
          border-radius: 6px;
          margin-bottom: 1.5rem;
          font-weight: 500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .stat-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 1.5rem;
          border-radius: 8px;
          box-shadow: var(--shadow);
        }

        .stat-card h5 {
          font-size: 0.9rem;
          opacity: 0.9;
          margin-bottom: 0.5rem;
        }

        .stat-card p {
          font-size: 2rem;
          font-weight: 700;
          margin: 0;
        }

        .stat-card.users {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .stat-card.workflows {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        .stat-card.processes {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }

        .stat-card.tasks {
          background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
        }

        .table-container {
          background-color: var(--white);
          border-radius: 8px;
          padding: 1.5rem;
          box-shadow: var(--shadow);
          margin-bottom: 2rem;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .table-header h3 {
          margin: 0;
          color: var(--primary-dark);
        }

        .add-btn {
          background-color: var(--success);
          color: white;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: var(--transition);
          display: inline-block;
          text-decoration: none;
          font-size: 0.95rem;
        }

        .add-btn:hover {
          background-color: #218838;
          transform: translateY(-1px);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background-color: var(--primary-light);
          border-bottom: 2px solid var(--primary);
        }

        th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          color: var(--primary-dark);
        }

        tbody tr {
          border-bottom: 1px solid var(--border);
          transition: var(--transition);
        }

        tbody tr:hover {
          background-color: var(--primary-light);
        }

        td {
          padding: 1rem;
        }
        .action-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .action-buttons button,
        .action-buttons a {
          background-color: var(--primary);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-size: 0.85rem;
          cursor: pointer;
          transition: var(--transition);
          white-space: nowrap;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }

        .action-buttons button:hover,
        .action-buttons a:hover {
          background-color: var(--primary-dark);
          transform: translateY(-1px);
        }

        .badge {
          display: inline-block;
          padding: 0.4rem 0.8rem;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .badge.admin {
          background-color: #d32f2f;
          color: white;
        }

        .badge.active {
          background-color: var(--success);
          color: white;
        }

        .badge.inactive {
          background-color: #9e9e9e;
          color: white;
        }
      `}</style>

      <header className="dashboard-header">
        <img src="/images/accLogo.png" alt="Company Logo" className="logo" />
        <div className="header-right">
          <p className="user-info">
            🔐
            <span style={{ fontWeight: 'bold', color: '#333' }}>
              {user.usrAdmin ? 'Admin' : user.IsSpecialUser ? 'Special User' : 'Regular User'}
            </span>
            <span style={{
              display: 'inline-block',
              marginLeft: 8,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 'bold',
              backgroundColor: user.usrAdmin ? '#d32f2f' : user.IsSpecialUser ? '#ffc107' : '#005bab',
              color: user.usrAdmin ? 'white' : user.IsSpecialUser ? '#856404' : 'white',
              border: user.IsSpecialUser ? '1px solid #ffc107' : 'none'
            }}>
              {user.usrAdmin ? 'ADMIN' : user.IsSpecialUser ? 'SPECIAL' : 'REGULAR'}
            </span>
            : {user.name || user.usrDesc}
          </p>
          <button onClick={handleLogout} className="logout-btn">
            <i className="fas fa-sign-out-alt"></i> Log out
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="admin-alert">
          <i className="fas fa-shield-alt"></i> <strong>Admin Area</strong> - Only administrators can access this page. Manage users, workflows, and system settings.
        </div>

        <section className="quick-actions">
          <h3 className="section-title"><i className="fas fa-bolt"></i> Admin Actions</h3>
          <div className="actions-grid">
            <a href="#" className="action-btn" title="Add new user">
              <i className="fas fa-user-plus"></i>
              <span className="btn-label">Add User</span>
              <span className="btn-subtitle">Create account</span>
            </a>

            <a href="/processes" className="action-btn" title="Manage processes">
              <i className="fas fa-cogs"></i>
              <span className="btn-label">Processes</span>
              <span className="btn-subtitle">Process management</span>
            </a>
            <a href="#" className="action-btn" title="Manage departments">
              <i className="fas fa-sitemap"></i>
              <span className="btn-label">Departments</span>
              <span className="btn-subtitle">Organization structure</span>
            </a>
            <a href="#" className="action-btn" title="View reports">
              <i className="fas fa-chart-bar"></i>
              <span className="btn-label">Reports</span>
              <span className="btn-subtitle">Analytics</span>
            </a>
          </div>
        </section>

        {/* Statistics */}
        {stats && (
          <div className="stats-grid">
            <div className="stat-card users">
              <h5>Total Users</h5>
              <p>{users.length}</p>
            </div>
            <div className="stat-card workflows">
              <h5>Total Workflows</h5>
              <p>{stats.stats.totalWorkflows}</p>
            </div>
            <div className="stat-card processes">
              <h5>Total Processes</h5>
              <p>{processes.length}</p>
            </div>
            <div className="stat-card tasks">
              <h5>Total Tasks</h5>
              <p>{stats.stats.totalTasks}</p>
            </div>
            <div className="stat-card">
              <h5 style={{color: '#fff'}}>Departments</h5>
              <p style={{color: '#fff'}}>{departments.length}</p>
            </div>
          </div>
        )}

        {/* Users Management */}
        <div className="table-container">
          <div className="table-header">
            <h3><i className="fas fa-users"></i> Users Management</h3>
            <button className="add-btn">+ Add User</button>
          </div>
          {loadingData ? (
            <p>Loading users...</p>
          ) : users && users.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Type</th>
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
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        backgroundColor: u.usrAdmin ? '#d32f2f' : u.IsSpecialUser ? '#ffc107' : '#005bab',
                        color: u.usrAdmin ? 'white' : u.IsSpecialUser ? '#856404' : 'white',
                        border: u.IsSpecialUser ? '1px solid #ffc107' : 'none'
                      }}>
                        {u.usrAdmin ? 'ADMIN' : u.IsSpecialUser ? 'SPECIAL' : 'REGULAR'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button onClick={() => openEditModal(u)}>Edit</button>
                        <button onClick={() => handleDeleteUser(u.usrID)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No users found</p>
          )}
        </div>

        {/* Workflows Management */}
        <div className="table-container">
          <div className="table-header">
            <h3><i className="fas fa-tasks"></i> Workflows Management</h3>
            <button className="add-btn">+ Add Workflow</button>
          </div>
          {loadingData ? (
            <p>Loading workflows...</p>
          ) : workflows && workflows.length > 0 ? (
            <table>
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
                    <td>#{wf.WorkFlowID}</td>
                    <td>{wf.ProcessName || '-'}</td>
                    <td>{wf.ProjectName || '-'}</td>
                    <td>
                      <span className={`badge ${wf.status === 'Active' ? 'active' : 'inactive'}`}>
                        {wf.status}
                      </span>
                    </td>
                    <td>{new Date(wf.createdDate).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button>View</button>
                        <button>Edit</button>
                        <button>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No workflows found</p>
          )}
        </div>

        {/* Processes Management */}
        <div className="table-container">
          <div className="table-header">
            <h3><i className="fas fa-cogs"></i> Processes</h3>
            <a href="/processes" className="add-btn">+ Manage Processes</a>
          </div>
          {loadingData ? (
            <p>Loading processes...</p>
          ) : processes && processes.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Process Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {processes.map(process => (
                  <tr key={process.NumberOfProccessID}>
                    <td>#{process.NumberOfProccessID}</td>
                    <td>{process.ProcessName}</td>
                    <td>{process.processDesc || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <a href="/processes">Edit</a>
                        <a href="/processes">Delete</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No processes found</p>
          )}
        </div>

        {/* Departments Management */}
        <div className="table-container">
          <div className="table-header">
            <h3><i className="fas fa-sitemap"></i> Departments</h3>
            <button className="add-btn">+ Add Department</button>
          </div>
          {loadingData ? (
            <p>Loading departments...</p>
          ) : departments && departments.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Department ID</th>
                  <th>Department Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map(dept => (
                  <tr key={dept.DepartmentID}>
                    <td>#{dept.DepartmentID}</td>
                    <td>{dept.DeptName}</td>
                    <td>
                      <div className="action-buttons">
                        <button>Edit</button>
                        <button>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No departments found</p>
          )}
        </div>

        {/* Edit User Modal */}
        {editUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 0, marginBottom: '20px' }}>
                <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#333' }}>
                  {editForm.usrAdmin ? 'Admin' : editForm.IsSpecialUser ? 'Special User' : 'Regular User'}
                </span>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  backgroundColor: editForm.usrAdmin ? '#d32f2f' : editForm.IsSpecialUser ? '#ffc107' : '#005bab',
                  color: editForm.usrAdmin ? 'white' : editForm.IsSpecialUser ? '#856404' : 'white',
                  border: editForm.IsSpecialUser ? '1px solid #ffc107' : 'none'
                }}>
                  {editForm.usrAdmin ? 'ADMIN' : editForm.IsSpecialUser ? 'SPECIAL' : 'REGULAR'}
                </span>
              </div>
              {/* Privilege type display */}
              <div style={{ marginBottom: '15px', fontWeight: 'bold', color: '#005bab' }}>
                Privilege:&nbsp;
                {editForm.usrAdmin ? 'Admin' : editForm.IsSpecialUser ? 'Special User' : 'Regular User'}
              </div>
              <form onSubmit={handleEditSubmit}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Name</label>
                  <input
                    type="text"
                    name="usrDesc"
                    value={editForm.usrDesc ?? ''}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Email</label>
                  <input
                    type="email"
                    name="usrEmail"
                    value={editForm.usrEmail ?? ''}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Password (leave blank to keep unchanged)</label>
                  <input
                    type="password"
                    name="usrPWD"
                    value={editForm.usrPWD ?? ''}
                    onChange={handleEditChange}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                {(!editForm.usrAdmin) ? (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Department <span style={{color:'#d32f2f'}}>*</span></label>
                    <select
                      name="DepartmentID"
                      value={editForm.DepartmentID ? String(editForm.DepartmentID) : ''}
                      onChange={handleEditChange}
                      required
                      style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
                    >
                      <option value="">Select department...</option>
                      {departments.map(d => (
                        <option key={d.DepartmentID} value={String(d.DepartmentID)}>{d.DeptName}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ marginBottom: '15px', color:'#888', fontStyle:'italic' }}>
                    Department selection is only required for regular users.
                  </div>
                )}
                <div style={{ marginBottom: '20px', display: 'flex', gap: '16px' }}>
                  {editForm.usrAdmin ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" name="usrAdmin" checked={!!editForm.usrAdmin} onChange={handleEditChange} /> Admin
                    </label>
                  ) : editForm.IsSpecialUser ? (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" name="IsSpecialUser" checked={!!editForm.IsSpecialUser} onChange={handleEditChange} /> Special User
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" name="usrAdmin" checked={!!editForm.usrAdmin} onChange={handleEditChange} /> Admin
                      </label>
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" name="usrAdmin" checked={!!editForm.usrAdmin} onChange={handleEditChange} /> Admin
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" name="IsSpecialUser" checked={!!editForm.IsSpecialUser} onChange={handleEditChange} /> Special User
                      </label>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f5f5f5', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    style={{ padding: '10px 20px', border: 'none', borderRadius: '6px', backgroundColor: '#005bab', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                  >
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
