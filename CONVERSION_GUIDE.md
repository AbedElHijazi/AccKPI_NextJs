# AccKPI Express to Next.js Conversion Guide

## Overview
This guide provides detailed instructions for converting the remaining Express.js routes and EJS templates to Next.js.

## Part 1: Converting Express Routes to Next.js API Routes

### Pattern
**Express:**
```javascript
app.post('/api/packages/add', async (req, res) => {
  const { data } = req.body;
  // logic
  res.json({ success: true });
});
```

**Next.js:**
```javascript
// pages/api/packages/add.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { data } = req.body;
  // logic
  res.json({ success: true });
}
```

### Key Differences
1. Each route is a separate file in `pages/api/`
2. Use `req.method` to check HTTP method
3. No need for `app.get()`, `app.post()`, etc.
4. Return responses with `res.json()`, `res.status()`, etc.

## Part 2: Converting EJS Templates to React Components

### Pattern
**EJS (in views/login.ejs):**
```ejs
<form action="/login" method="POST">
  <input type="text" name="username" required>
  <input type="password" name="password" required>
  <button type="submit">Login</button>
</form>
```

**React Component (in pages/login.js):**
```javascript
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (response.ok) {
      router.push('/dashboard');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        type="text" 
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required 
      />
      <input 
        type="password" 
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required 
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

## Part 3: Common Conversions

### Form Handling

**Express with EJS:**
```ejs
<form action="/addPackage" method="POST">
  <input type="text" name="packageName">
  <button type="submit">Add</button>
</form>
```

**Next.js React:**
```javascript
import { useState } from 'react';

export default function AddPackage() {
  const [packageName, setPackageName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/packages/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName })
      });
      
      if (!res.ok) throw new Error('Failed to add package');
      // Handle success
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-danger">{error}</p>}
      <input 
        type="text" 
        value={packageName}
        onChange={(e) => setPackageName(e.target.value)}
      />
      <button type="submit">Add</button>
    </form>
  );
}
```

### Data Tables/Lists

**Express EJS:**
```ejs
<table>
  <% packages.forEach(pkg => { %>
    <tr>
      <td><%= pkg.PkgeName %></td>
      <td><%= pkg.Division %></td>
    </tr>
  <% }); %>
</table>
```

**Next.js React:**
```javascript
import { useEffect, useState } from 'react';

export default function PackagesList() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/packages')
      .then(res => res.json())
      .then(data => {
        setPackages(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Package Name</th>
          <th>Division</th>
        </tr>
      </thead>
      <tbody>
        {packages.map(pkg => (
          <tr key={pkg.PkgeID}>
            <td>{pkg.PkgeName}</td>
            <td>{pkg.Division}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Database Operations in API Routes

**Express (index.js):**
```javascript
app.post('/api/packages/add', async (req, res) => {
  const { packageName } = req.body;
  
  try {
    const result = await pool.request()
      .input('name', sql.NVarChar, packageName)
      .query('INSERT INTO tblPackages (PkgeName) VALUES (@name)');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Next.js (pages/api/packages/add.js):**
```javascript
import sql from 'mssql';
import { getPool } from '@/lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { packageName } = req.body;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, packageName)
      .query('INSERT INTO tblPackages (PkgeName) VALUES (@name)');
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

## Part 4: File Structure for New Routes

### Example: Add a Workflow API

**File: pages/api/workflows/get.js**
```javascript
import { getWorkflowTasks } from '@/lib/helpers';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { workflowId } = req.query;

  try {
    const tasks = await getWorkflowTasks(parseInt(workflowId));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

**File: pages/workflows/[id].js (Dynamic page)**
```javascript
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function WorkflowDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    fetch(`/api/workflows/get?workflowId=${id}`)
      .then(res => res.json())
      .then(data => {
        setTasks(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Workflow {id}</h1>
      <table className="table">
        <tbody>
          {tasks.map(task => (
            <tr key={task.TaskID}>
              <td>{task.TaskName}</td>
              <td>{task.DeptName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Part 5: Session Management

### Current Issue
The original Express app uses `express-session`. Next.js needs different approach.

### Solution 1: next-auth (Recommended)
```bash
npm install next-auth
```

### Solution 2: Custom Session Management
```javascript
// pages/api/auth/login.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  try {
    // Validate user
    const pool = await getPool();
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .input('password', sql.VarChar, password)
      .query(`
        SELECT usrID, usrDesc, usrAdmin, DepartmentID 
        FROM tblUsers 
        WHERE usrEmail = @email AND usrPWD = @password
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.recordset[0];

    // Store session (basic implementation)
    req.session.user = {
      id: user.usrID,
      name: user.usrDesc,
      admin: user.usrAdmin,
      departmentId: user.DepartmentID
    };

    await new Promise((resolve) => {
      req.session.save(resolve);
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

## Part 6: Middleware/Protected Routes

### Protecting API Routes

```javascript
// lib/withAuth.js
export function withAuth(handler) {
  return async (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return handler(req, res);
  };
}

// lib/withAdmin.js
export function withAdmin(handler) {
  return async (req, res) => {
    if (!req.session?.user?.admin) {
      return res.status(403).json({ error: 'Admin required' });
    }
    return handler(req, res);
  };
}
```

### Using Protected Routes

```javascript
// pages/api/users/list.js
import { withAuth } from '@/lib/withAuth';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get users from database
  res.json({ users: [] });
}

export default withAuth(handler);
```

## Part 7: Using Layout with Protected Pages

```javascript
// pages/protected-page.js
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ProtectedPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          router.push('/login');
        }
        return res.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, [router]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="container mt-5">
        <h1>Protected Content</h1>
        {/* Your content here */}
      </div>
    </Layout>
  );
}
```

## Next Steps

1. Copy static assets from accKPI/public to accNextjs/public
2. Convert remaining EJS files to React components
3. Implement remaining API routes
4. Test all functionality
5. Setup production environment
6. Deploy to server

## Quick Command Reference

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Useful Links

- [Next.js Pages Directory](https://nextjs.org/docs/pages)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [React Hooks](https://react.dev/reference/react)
- [MSSQL Node.js](https://github.com/tediousjs/node-mssql)
