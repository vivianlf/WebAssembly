const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Database Setup Script for WebAssembly Benchmark Suite
 * Initializes the PostgreSQL schema on Neon cloud database
 */

async function setupDatabase() {
    console.log('🔧 Setting up WebAssembly Benchmark Database...\n');
    
    const client = new Client({
        connectionString: config.connectionString,
        ssl: config.ssl
    });

    try {
        // Connect to database
        console.log('📡 Connecting to Neon PostgreSQL...');
        await client.connect();
        console.log('✅ Connected successfully!\n');

        // Read and execute schema
        console.log('📋 Reading database schema...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('🏗️ Creating database tables and indexes...');
        await client.query(schema);
        console.log('✅ Database schema created successfully!\n');

        // Verify tables were created
        console.log('🔍 Verifying database setup...');
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `;
        
        const result = await client.query(tablesQuery);
        console.log('📊 Created tables:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // Verify views were created
        const viewsQuery = `
            SELECT table_name 
            FROM information_schema.views 
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `;
        
        const viewsResult = await client.query(viewsQuery);
        if (viewsResult.rows.length > 0) {
            console.log('\n📈 Created views:');
            viewsResult.rows.forEach(row => {
                console.log(`   ✓ ${row.table_name}`);
            });
        }

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Run benchmark tests: npm test');
        console.log('   2. Results will be automatically saved to the database');
        console.log('   3. Query results using the database client or views');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Connection Tips:');
            console.error('   - Check if the database URL is correct');
            console.error('   - Verify network connectivity');
            console.error('   - Ensure Neon database is running');
        } else if (error.code === '28P01') {
            console.error('\n💡 Authentication Tips:');
            console.error('   - Verify username and password');
            console.error('   - Check if database access is allowed from your IP');
        }
        
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n📡 Database connection closed.');
    }
}

// Test database connection
async function testConnection() {
    console.log('🧪 Testing database connection...\n');
    
    const client = new Client({
        connectionString: config.connectionString,
        ssl: config.ssl
    });

    try {
        await client.connect();
        
        // Test basic query
        const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
        console.log('✅ Connection test successful!');
        console.log(`⏰ Server time: ${result.rows[0].current_time}`);
        console.log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
        
        return true;
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        return false;
    } finally {
        await client.end();
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--test') || args.includes('-t')) {
        const success = await testConnection();
        process.exit(success ? 0 : 1);
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log('🚀 WebAssembly Benchmark Database Setup\n');
        console.log('Usage:');
        console.log('  node setup-database.js           Setup complete database schema');
        console.log('  node setup-database.js --test    Test database connection only');
        console.log('  node setup-database.js --help    Show this help message');
        process.exit(0);
    } else {
        await setupDatabase();
    }
}

// Export for use in other modules
module.exports = {
    setupDatabase,
    testConnection
};

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
} 