#!/usr/bin/env node

/**
 * Standalone script to migrate existing JSON benchmark results to PostgreSQL database
 * Usage: node database/migrate-existing-data.js
 */

const DatabaseManager = require('./database-manager');

async function main() {
    console.log('🔄 WebAssembly Benchmark Data Migration Tool');
    console.log('='.repeat(50));
    console.log('This script will migrate all existing JSON results to PostgreSQL database\n');

    const dbManager = new DatabaseManager();
    
    try {
        // Test database connection first
        console.log('🧪 Testing database connection...');
        await dbManager.pool.query('SELECT NOW()');
        console.log('✅ Database connection successful!\n');
        
        // Start migration
        console.log('🔄 Starting migration process...\n');
        const results = await dbManager.saveAllResults();
        
        // Print detailed results
        console.log('\n📊 Migration Results Summary:');
        console.log('='.repeat(50));
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`✅ Successfully migrated: ${successful.length} files`);
        console.log(`❌ Failed migrations: ${failed.length} files`);
        console.log(`📈 Total files processed: ${results.length}\n`);
        
        if (successful.length > 0) {
            console.log('✅ Successfully migrated files:');
            successful.forEach(result => {
                console.log(`   📁 ${result.file}`);
                if (result.testRunIds) {
                    console.log(`      Database IDs: ${result.testRunIds.join(', ')}`);
                }
            });
            console.log('');
        }
        
        if (failed.length > 0) {
            console.log('❌ Failed migrations:');
            failed.forEach(result => {
                console.log(`   📁 ${result.file}`);
                console.log(`      Error: ${result.error}`);
            });
            console.log('');
        }
        
        // Show database statistics
        if (successful.length > 0) {
            console.log('📊 Database Statistics:');
            console.log('-'.repeat(30));
            
            try {
                const summary = await dbManager.getAlgorithmSummary();
                if (summary && summary.length > 0) {
                    summary.forEach(row => {
                        console.log(`${row.algorithm} (${row.size_category}): ${row.test_count} tests, avg speedup: ${row.avg_speedup.toFixed(2)}x`);
                    });
                }
            } catch (error) {
                console.log('Could not retrieve database statistics');
            }
        }
        
        console.log('\n🎉 Migration completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Database Connection Tips:');
            console.error('   - Check if PostgreSQL is running');
            console.error('   - Verify database connection string in database/config.js');
            console.error('   - Ensure network connectivity to Neon database');
        } else if (error.code === '28P01') {
            console.error('\n💡 Authentication Tips:');
            console.error('   - Verify database username and password');
            console.error('   - Check if your IP is allowed to connect');
        } else if (error.code === '42P01') {
            console.error('\n💡 Schema Tips:');
            console.error('   - Run database setup first: npm run setup-db');
            console.error('   - Check if database tables exist');
        }
        
        process.exit(1);
    } finally {
        await dbManager.close();
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}

module.exports = { main }; 