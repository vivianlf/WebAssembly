// Database configuration for Neon PostgreSQL
const config = {
  // Full connection string
  connectionString: 'postgresql://neondb_owner:npg_N1mUPbenfQz7@ep-billowing-hat-a8napemv-pooler.eastus2.azure.neon.tech/neondb?sslmode=require',
  
  // Alternative connection configuration
  host: 'ep-billowing-hat-a8napemv-pooler.eastus2.azure.neon.tech',
  port: 5432,
  database: 'neondb',
  user: 'neondb_owner',
  password: 'npg_N1mUPbenfQz7',
  ssl: {
    require: true,
    rejectUnauthorized: false
  },
  
  // Connection pool settings
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

module.exports = config; 