# AccKPI - Next.js Version

This is a converted version of the AccKPI application from Express.js to Next.js.

## 📁 Project Structure

```
accNextjs/
├── pages/
│   ├── api/              # API routes (Next.js API)
│   │   ├── auth/
│   │   │   ├── login.js
│   │   │   └── logout.js
│   │   ├── packages.js
│   │   ├── departments.js
│   │   ├── processes.js
│   │   └── projects.js
│   ├── index.js          # Home page
│   ├── login.js          # Login page
│   ├── _app.js           # App wrapper
│   └── _document.js      # HTML document
├── lib/
│   ├── db.js             # Database connection
│   ├── helpers.js        # Database helper functions
│   └── auth.js           # Authentication middleware
├── public/
│   ├── styles/           # CSS files
│   ├── js/               # JavaScript files
│   └── images/           # Image assets
├── components/           # React components
├── package.json
├── next.config.js
├── .env.local           # Environment variables
└── README.md
```

## 🚀 Getting Started

### 1. Install Dependencies

```bash
cd accNextjs
npm install
```

### 2. Configure Environment Variables

Edit `.env.local` with your database and API credentials:

```env
DB_USER=sa
DB_PASSWORD=sa
DB_SERVER=10.10.2.123
DB_DATABASE=AccDBF
PORT=3000
HOST=0.0.0.0
API_RESEND=your_resend_api_key_here
SESSION_SECRET=your_session_secret_here_change_in_production
```

### 3. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
npm start
```

## 🔄 Migration Notes

### From Express to Next.js

1. **Database Connection**: Moved from `index.js` to `lib/db.js` with connection pooling
2. **Helper Functions**: Converted from `databaseHelpers.js` to `lib/helpers.js`
3. **Routes**: Express routes converted to Next.js API routes in `pages/api/`
4. **Views**: EJS templates need to be converted to React components
5. **Middleware**: Session management needs to be configured in `pages/api/` routes
6. **Authentication**: Implemented in middleware pattern suitable for Next.js

## 📋 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/logout` - User logout

### Data Endpoints
- `GET /api/packages` - Get all packages
- `GET /api/departments` - Get all departments
- `GET /api/processes` - Get all processes
- `GET /api/projects` - Get all projects

## ⚙️ Configuration

### Next.js Config (`next.config.js`)
- Environment variables are exposed to client side
- Optimize images and bundle size
- SWC minification enabled

### Database Configuration
- Support for both remote SQL Server and localhost fallback
- Connection pooling with MSSQL
- Error handling and retry logic

## 🔐 Security

- Session-based authentication
- Rate limiting on login attempts (configure in `pages/api/auth/login.js`)
- SQL injection prevention through parameterized queries
- HTTPS configuration ready (certificates in root)

## 📝 TODO - Complete Migration Tasks

### Still Need to Convert:
1. **Pages/Views** - Convert remaining EJS files to React components:
   - addPackageForm.ejs
   - adduser.ejs
   - addworkflow.ejs
   - adminpage.ejs
   - assignWorkflow.ejs
   - checkuser.ejs
   - editprocess.ejs
   - edittasks.ejs
   - homepage.ejs
   - packageform.ejs
   - process.ejs
   - project.ejs
   - selectTask.ejs
   - signup.ejs
   - subpackage.ejs
   - task.ejs
   - taskhistory.ejs
   - userpage.ejs
   - workflowdashboard.ejs

2. **API Routes** - Convert remaining Express routes:
   - Workflow management routes
   - Task management routes
   - User management routes
   - Package management routes
   - Process management routes
   - Department management routes
   - Report generation routes

3. **Static Assets** - Copy and optimize:
   - CSS files from `public/styles/`
   - JavaScript files from `public/js/`
   - Font Awesome and Bootstrap assets
   - Image assets

4. **Session Management** - Implement:
   - Express-session replacement
   - Cookie handling for Next.js
   - Session persistence

5. **Form Validation** - Update:
   - Express-validator to client-side validation (can use existing library)
   - Custom validation in API routes

## 🛠️ Development Tips

- Use `npm run dev` for hot reload during development
- Check console logs for database connection status
- API routes are located in `pages/api/` directory
- Pages are located in `pages/` directory
- No need for manual routing - Next.js handles it automatically

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [MSSQL Documentation](https://github.com/tediousjs/node-mssql)
- [React Documentation](https://react.dev)

## 📝 License

ISC
