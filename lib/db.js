import sql from 'mssql';

// Database configuration
const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'sa',
  server: process.env.DB_SERVER || '10.10.2.123',
  database: process.env.DB_DATABASE || 'AccDBF',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectionTimeout: 5000,
    requestTimeout: 5000
  }
};

const fallbackConfig = {
  user: 'sa',
  password: 'sa',
  server: 'localhost',
  database: process.env.DB_DATABASE || 'AccDBF',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

let pool = null;

export async function connectDatabase() {
  if (pool) return pool;
  
  try {
    console.log(`🔗 Attempting to connect to ${config.server}...`);
    pool = await sql.connect(config);
    console.log("✅ Database connected to server successfully");
    return pool;
  } catch (err) {
    console.error("❌ Server connection failed, attempting fallback to localhost...");
    try {
      console.log("🔄 Falling back to localhost...");
      pool = await sql.connect(fallbackConfig);
      console.log("✅ Database connected to localhost successfully");
      return pool;
    } catch (fallbackErr) {
      console.error("❌ Fallback connection also failed:", fallbackErr.message);
      throw new Error("Database connection failed");
    }
  }
}

export async function getPool() {
  if (!pool) {
    return await connectDatabase();
  }
  return pool;
}
