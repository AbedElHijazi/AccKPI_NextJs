import { useEffect, useState } from 'react';

export default function Home() {
  const [data, setData] = useState({
    packages: 0,
    processes: 0,
    projects: 0,
    departments: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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

    loadData();
  }, []);

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
      <div className="row">
        <div className="col-md-12">
          <h1>KPI Management System</h1>
          <p className="lead">Welcome to AccKPI - Manage packages, processes, projects and workflows</p>
        </div>
      </div>

      <div className="row mt-5">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Packages</h5>
              <p className="card-text">{loading ? '...' : data.packages} packages</p>
              <a href="/packages" className="btn btn-primary btn-sm">View</a>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Processes</h5>
              <p className="card-text">{loading ? '...' : data.processes} processes</p>
              <a href="/processes" className="btn btn-primary btn-sm">View</a>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Projects</h5>
              <p className="card-text">{loading ? '...' : data.projects} projects</p>
              <a href="/projects" className="btn btn-primary btn-sm">View</a>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Departments</h5>
              <p className="card-text">{loading ? '...' : data.departments} departments</p>
              <a href="/departments" className="btn btn-primary btn-sm">View</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
