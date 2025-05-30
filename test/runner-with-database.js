const { TestRunner } = require('./runner');
const DatabaseManager = require('../database/database-manager');
const fs = require('fs');
const path = require('path');

/**
 * Enhanced TestRunner with Database Integration
 * Extends the original TestRunner to automatically save results to PostgreSQL
 * while preserving all existing functionality and JSON export
 */
class TestRunnerWithDatabase extends TestRunner {
    constructor(wasmModule, jsImplementation, options = {}) {
        super(wasmModule, jsImplementation);
        
        this.options = {
            saveToDatabase: true,
            saveToJson: true,
            algorithm: 'Unknown Algorithm',
            ...options
        };
        
        this.databaseManager = null;
        this.allResults = [];
        this.environmentInfo = null;
        
        // Initialize database manager if enabled
        if (this.options.saveToDatabase) {
            this.initializeDatabase();
        }
    }

    /**
     * Initialize database manager with error handling
     */
    async initializeDatabase() {
        try {
            this.databaseManager = new DatabaseManager();
            console.log('🔗 Database connection initialized successfully');
        } catch (error) {
            console.warn('⚠️ Database initialization failed, results will only be saved to JSON:', error.message);
            this.options.saveToDatabase = false;
        }
    }

    /**
     * Enhanced runTest method that saves to both JSON and database
     */
    async runTest(algorithmName, algorithmType, size, testData, iterations = 10, validator = null) {
        try {
            // Run the original test
            const metrics = await super.runTest(algorithmName, algorithmType, size, testData, iterations, validator);
            
            // Validate that we got meaningful results
            if (!metrics || typeof metrics.speedup === 'undefined' || isNaN(metrics.speedup)) {
                console.error(`⚠️ Invalid metrics received for ${algorithmName} (${size})`);
                return null;
            }
            
            // Store results for batch processing
            this.allResults.push(metrics);
            
            // Save to JSON immediately (preserving original behavior)
            if (this.options.saveToJson) {
                this.exportResults(metrics);
            }
            
            console.log(`✅ Test completed: ${algorithmName} (${size}) - Speedup: ${metrics.speedup.toFixed(2)}x`);
            
            return metrics;
        } catch (error) {
            console.error(`❌ Test failed for ${algorithmName} (${size}):`, error.message);
            
            // Create a minimal error result to maintain consistency
            const errorResult = {
                algorithm: algorithmName,
                type: algorithmType,
                size: size,
                speedup: 0,
                wasmStats: { mean: 0, min: 0, max: 0, median: 0, stdDev: 0, p95: 0, p99: 0 },
                jsStats: { mean: 0, min: 0, max: 0, median: 0, stdDev: 0, p95: 0, p99: 0 },
                wasmTimes: [],
                jsTimes: [],
                wasmMemory: [],
                jsMemory: [],
                wasmMemoryStats: { mean: 0, min: 0, max: 0, median: 0, stdDev: 0, p95: 0, p99: 0 },
                jsMemoryStats: { mean: 0, min: 0, max: 0, median: 0, stdDev: 0, p95: 0, p99: 0 },
                validationResults: { 
                    success: false, 
                    discrepancies: [`Test execution failed: ${error.message}`] 
                },
                memoryDetails: {
                    wasm: { heapUsed: { min: 0, max: 0, mean: 0, median: 0 }, external: { min: 0, max: 0, mean: 0 } },
                    js: { heapUsed: { min: 0, max: 0, mean: 0, median: 0 }, external: { min: 0, max: 0, mean: 0 } }
                }
            };
            
            return errorResult;
        }
    }

    /**
     * Complete benchmark execution with database saving
     */
    async runCompleteBenchmark(algorithmName, algorithmType, sizes = {}, iterations = 10, validator = null) {
        console.log(`\n🚀 Running complete benchmark for ${algorithmName}...`);
        
        // Clear previous results
        this.allResults = [];
        this.options.algorithm = algorithmName;
        
        let successfulTests = 0;
        let totalTests = Object.keys(sizes).length;
        
        // Run all size variations
        for (const [sizeName, sizeValue] of Object.entries(sizes)) {
            console.log(`\n📊 Running ${algorithmName} - ${sizeName} size...`);
            
            try {
                const result = await this.runTest(
                    algorithmName,
                    algorithmType,
                    sizeName,
                    sizeValue,
                    iterations,
                    validator
                );
                
                if (result && result.speedup > 0) {
                    successfulTests++;
                } else {
                    console.warn(`⚠️ ${algorithmName} (${sizeName}) test failed or returned invalid results`);
                }
            } catch (error) {
                console.error(`❌ Error running ${algorithmName} (${sizeName}):`, error.message);
            }
        }
        
        // Save complete results to database only if we have successful tests
        if (this.options.saveToDatabase && this.allResults.length > 0) {
            const validResults = this.allResults.filter(r => r && r.speedup > 0);
            if (validResults.length > 0) {
                // Temporarily replace allResults with valid ones for database saving
                const originalResults = this.allResults;
                this.allResults = validResults;
                
                try {
                    await this.saveBenchmarkToDatabase();
                } catch (dbError) {
                    console.error(`❌ Database save failed: ${dbError.message}`);
                } finally {
                    // Restore original results
                    this.allResults = originalResults;
                }
            } else {
                console.warn(`⚠️ No valid results to save to database for ${algorithmName}`);
            }
        }
        
        console.log(`\n🎉 Complete benchmark for ${algorithmName} finished!`);
        console.log(`📊 Results: ${successfulTests}/${totalTests} tests successful`);
        
        return this.allResults;
    }

    /**
     * Save all benchmark results to database
     */
    async saveBenchmarkToDatabase() {
        if (!this.databaseManager || this.allResults.length === 0) {
            return;
        }

        try {
            console.log('\n💾 Saving results to database...');
            
            // Create benchmark data structure matching JSON format
            const benchmarkData = {
                timestamp: new Date().toISOString(),
                algorithm: this.options.algorithm,
                environment: this.getEnvironmentInfo(),
                results: this.allResults
            };

            // Save to database
            const result = await this.databaseManager.saveBenchmarkResults(benchmarkData);
            
            console.log(`✅ Successfully saved to database:`);
            console.log(`   Environment ID: ${result.environmentId}`);
            console.log(`   Test Run IDs: ${result.testRunIds.join(', ')}`);
            console.log(`   Message: ${result.message}\n`);
            
            return result;
            
        } catch (error) {
            console.error('❌ Failed to save to database:', error.message);
            console.log('💡 Results are still available in JSON files\n');
            throw error;
        }
    }

    /**
     * Enhanced exportResults method (preserves original JSON saving)
     */
    exportResults(metrics) {
        if (!this.options.saveToJson) {
            return;
        }

        const algorithmName = this.options.algorithm.toLowerCase().replace(/\s+/g, '-');
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
        
        // Create results directory structure
        const resultsDir = path.join(__dirname, '..', 'results', algorithmName);
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }

        // Create complete benchmark data structure
        const benchmarkData = {
            timestamp: new Date().toISOString(),
            algorithm: this.options.algorithm,
            environment: this.getEnvironmentInfo(),
            results: this.allResults.length > 0 ? this.allResults : [metrics]
        };

        // Save to JSON file
        const filename = `${algorithmName}-benchmark-${timestamp}.json`;
        const filepath = path.join(resultsDir, filename);
        
        try {
            fs.writeFileSync(filepath, JSON.stringify(benchmarkData, null, 2));
            console.log(`📁 Results saved to: ${filepath}`);
        } catch (error) {
            console.error('❌ Failed to save JSON file:', error.message);
        }
    }

    /**
     * Migrate existing JSON files to database
     */
    async migrateExistingResults() {
        if (!this.databaseManager) {
            console.log('❌ Database manager not available for migration');
            return;
        }

        console.log('🔄 Migrating existing JSON results to database...\n');
        
        try {
            const results = await this.databaseManager.saveAllResults();
            
            console.log('📊 Migration Summary:');
            const successful = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;
            
            console.log(`   ✅ Successfully migrated: ${successful} files`);
            console.log(`   ❌ Failed: ${failed} files`);
            console.log(`   📈 Total: ${results.length} files\n`);
            
            return results;
            
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
            throw error;
        }
    }

    /**
     * Query recent results from database
     */
    async getRecentResults(limit = 10) {
        if (!this.databaseManager) {
            console.log('❌ Database manager not available');
            return null;
        }

        try {
            const results = await this.databaseManager.getRecentResults(limit);
            console.log(`📊 Retrieved ${results.length} recent results from database`);
            return results;
        } catch (error) {
            console.error('❌ Failed to retrieve recent results:', error.message);
            return null;
        }
    }

    /**
     * Get algorithm performance summary from database
     */
    async getPerformanceSummary() {
        if (!this.databaseManager) {
            console.log('❌ Database manager not available');
            return null;
        }

        try {
            const summary = await this.databaseManager.getAlgorithmSummary();
            console.log(`📈 Retrieved performance summary for ${summary.length} algorithm/size combinations`);
            return summary;
        } catch (error) {
            console.error('❌ Failed to retrieve performance summary:', error.message);
            return null;
        }
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.databaseManager) {
            await this.databaseManager.close();
            console.log('🔒 Database connections closed');
        }
    }

    /**
     * Static method to create TestRunner with database options
     */
    static create(wasmModule, jsImplementation, algorithm, options = {}) {
        return new TestRunnerWithDatabase(wasmModule, jsImplementation, {
            algorithm,
            ...options
        });
    }

    /**
     * Static method to migrate all existing results
     */
    static async migrateAllResults() {
        const dbManager = new DatabaseManager();
        
        try {
            console.log('🔄 Starting migration of all existing results...\n');
            const results = await dbManager.saveAllResults();
            
            // Print detailed summary
            console.log('\n📊 Detailed Migration Results:');
            results.forEach(result => {
                const status = result.success ? '✅' : '❌';
                console.log(`   ${status} ${result.file}`);
                if (!result.success) {
                    console.log(`      Error: ${result.error}`);
                }
            });
            
            return results;
            
        } catch (error) {
            console.error('❌ Migration process failed:', error.message);
            throw error;
        } finally {
            await dbManager.close();
        }
    }
}

module.exports = { TestRunnerWithDatabase }; 