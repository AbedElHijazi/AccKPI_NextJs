import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

export default function Login() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [project, setProject] = useState('1');
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load projects
    async function loadProjects() {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
          if (data.length > 0) {
            setProject(data[0].projectID?.toString());
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    }
    loadProjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, project })
      });

      const data = await response.json();
      console.log('Login response:', data);

      if (!data.success) {
        setError(data.message || 'Login failed');
        setLoading(false);
        return;
      }

      // Successful login - log user info for debugging
      console.log('User is admin:', data.user?.usrAdmin);
      console.log('Redirecting to:', data.redirect);
      
      // Successful login
      router.push(data.redirect || '/');
    } catch (err) {
      setError('An error occurred during login');
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100" style={{ background: '#f5f5f5' }}>
      <div className="card" style={{ width: '400px', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
        <div className="card-body p-5">
          <div className="text-center mb-4">
            <img 
              src="/images/accNewLog.webp" 
              alt="AccKPI Logo" 
              style={{ maxWidth: '200px', height: 'auto' }}
            />
          </div>
          <h3 className="card-title text-center mb-4">
            Sign In
          </h3>
          
          {error && (
            <div className="alert alert-danger alert-dismissible fade show" role="alert">
              {error}
              <button
                type="button"
                className="btn-close"
                onClick={() => setError('')}
              ></button>
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                placeholder="your@email.com"
              />
            </div>
            
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Project</label>
              <select
                className="form-select"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                disabled={loading}
              >
                <option value="">Select a project...</option>
                {projects.map(p => (
                  <option key={p.projectID} value={p.projectID}>
                    {p.projectName}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
