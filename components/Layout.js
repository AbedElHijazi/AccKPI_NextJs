import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children, user }) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="d-flex">
      {/* Sidebar Navigation */}
      <nav className="navbar navbar-dark bg-dark navbar-expand-lg w-100">
        <div className="container-fluid">
          <Link className="navbar-brand" href="/">
            📊 AccKPI
          </Link>
          
          <button
            className="navbar-toggler"
            type="button"
            onClick={() => setNavOpen(!navOpen)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className={`collapse navbar-collapse ${navOpen ? 'show' : ''}`}>
            <ul className="navbar-nav ms-auto">
              {user && user.usrAdmin && (
                <>
                  <li className="nav-item">
                    <Link className="nav-link" href="/adminpage">
                      Admin Panel
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" href="/addPackage">
                      Add Package
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" href="/addUser">
                      Add User
                    </Link>
                  </li>
                </>
              )}
              
              {user && !user.usrAdmin && (
                <>
                  <li className="nav-item">
                    <Link className="nav-link" href="/workFlowDash">
                      Dashboard
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" href="/userpage">
                      My Tasks
                    </Link>
                  </li>
                  <li className="nav-item">
                    <Link className="nav-link" href="/taskhistory">
                      Task History
                    </Link>
                  </li>
                </>
              )}
              
              {user && (
                <>
                  <li className="nav-item dropdown">
                    <a
                      className="nav-link dropdown-toggle"
                      href="#"
                      id="userDropdown"
                      role="button"
                      data-bs-toggle="dropdown"
                    >
                      👤 {user.name}
                    </a>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li>
                        <button
                          className="dropdown-item"
                          onClick={handleLogout}
                        >
                          Logout
                        </button>
                      </li>
                    </ul>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="w-100">
        {children}
      </main>
    </div>
  );
}
