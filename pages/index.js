import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/hooks';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(null);
  const [data, setData] = useState({
    packages: 0,
    processes: 0,
    projects: 0,
    departments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    // Load dashboard data
    async function loadData() {
      try {
        const [pkgRes, procRes, projRes, deptRes] = await Promise.all([
          fetch('/api/packages'),
          fetch('/api/processes'),
          fetch('/api/projects'),
          fetch('/api/departments')
        ]);

        if (!pkgRes.ok || !procRes.ok || !projRes.ok || !deptRes.ok) {
          throw new Error('Failed to load data');
        }

        const [packages, processes, projects, departments] = await Promise.all([
          pkgRes.json(),
          procRes.json(),
          projRes.json(),
          deptRes.json()
        ]);

        setData({
          packages: packages.length,
          processes: processes.length,
          projects: projects.length,
          departments: departments.length
        });
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadData();
    }
  }, [user, authLoading, router]);

  if (authLoading || (user && loading)) {
    return (
      <main className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <main className="container mt-5">
        <h1>KPI Management System</h1>
        <p className="text-danger">{error}</p>
      </main>
    );
  }

  return (
    <main className="container mt-5">
      <div className="row mb-5">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1>KPI Management System</h1>
              <p className="lead mb-0">Welcome back, <strong>{user.name}</strong>!</p>
            </div>
            <div>
              <a href="/api/auth/logout" className="btn btn-outline-danger">
                <i className="fas fa-sign-out-alt me-2"></i>Logout
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-3">
          <div className="card border-primary">
            <div className="card-body">
              <h5 className="card-title">
                <i className="fas fa-box text-primary me-2"></i>Packages
              </h5>
              <h2 className="text-primary">{data.packages}</h2>
              <a href="/packages" className="btn btn-primary btn-sm">View</a>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-success">
            <div className="card-body">
              <h5 className="card-title">
                <i className="fas fa-cogs text-success me-2"></i>Processes
              </h5>
              <h2 className="text-success">{data.processes}</h2>
              <a href="/processes" className="btn btn-success btn-sm">View</a>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-info">
            <div className="card-body">
              <h5 className="card-title">
                <i className="fas fa-project-diagram text-info me-2"></i>Projects
              </h5>
              <h2 className="text-info">{data.projects}</h2>
              <a href="/projects" className="btn btn-info btn-sm">View</a>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card border-warning">
            <div className="card-body">
              <h5 className="card-title">
                <i className="fas fa-sitemap text-warning me-2"></i>Departments
              </h5>
              <h2 className="text-warning">{data.departments}</h2>
              <a href="/departments" className="btn btn-warning btn-sm">View</a>
            </div>
          </div>
        </div>
      </div>

      {user.usrAdmin && (
        <div className="row mt-5">
          <div className="col-md-12">
            <div className="alert alert-info">
              <h5>
                <i className="fas fa-shield-alt me-2"></i>Admin Panel
              </h5>
              <p className="mb-2">As an administrator, you have access to:</p>
              <a href="/adminpage" className="btn btn-info btn-sm me-2">
                Admin Dashboard
              </a>
              <a href="/addUser" className="btn btn-info btn-sm me-2">
                Add User
              </a>
              <a href="/addPackage" className="btn btn-info btn-sm">
                Add Package
              </a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
