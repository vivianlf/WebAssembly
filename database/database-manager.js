const { Client, Pool } = require('pg');
const config = require('./config');

/**
 * Database Manager for WebAssembly Benchmark Suite
 * Handles saving complete JSON benchmark results to PostgreSQL database
 * Preserves ALL information from the original JSON files
 */

class DatabaseManager {
    constructor() {
        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: config.ssl,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
            connectionTimeoutMillis: config.connectionTimeoutMillis
        });
    }

    /**
     * Save complete benchmark results from JSON to database
     * @param {Object} benchmarkData - Complete JSON benchmark data
     * @returns {Object} - Database operation results with IDs
     */
    async saveBenchmarkResults(benchmarkData) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            console.log(`💾 Saving ${benchmarkData.algorithm} benchmark results to database...`);

            // 1. Save environment information
            const environmentId = await this.saveEnvironmentInfo(client, benchmarkData);
            console.log(`   ✅ Environment info saved (ID: ${environmentId})`);

            // 2. Save CPU information
            await this.saveCpuInfo(client, environmentId, benchmarkData.environment.specs.cpus);
            console.log(`   ✅ CPU info saved (${benchmarkData.environment.specs.cpus.length} CPUs)`);

            // 3. Save all test results
            const testRunIds = [];
            for (const result of benchmarkData.results) {
                const testRunId = await this.saveTestRun(client, environmentId, result);
                testRunIds.push(testRunId);
                
                // Save performance statistics
                await this.savePerformanceStats(client, testRunId, result, 'wasm');
                await this.savePerformanceStats(client, testRunId, result, 'js');
                
                // Save memory measurements
                await this.saveMemoryMeasurements(client, testRunId, result, 'wasm');
                await this.saveMemoryMeasurements(client, testRunId, result, 'js');
                
                // Save memory statistics
                await this.saveMemoryStats(client, testRunId, result, 'wasm');
                await this.saveMemoryStats(client, testRunId, result, 'js');
                
                // Save validation results
                await this.saveValidationResults(client, testRunId, result.validationResults);
                
                console.log(`   ✅ Test result saved: ${result.algorithm} (${result.size}) - ID: ${testRunId}`);
            }

            await client.query('COMMIT');
            console.log(`🎉 Successfully saved all benchmark data for ${benchmarkData.algorithm}!\n`);

            return {
                success: true,
                environmentId,
                testRunIds,
                message: `Saved ${benchmarkData.results.length} test results`
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Error saving benchmark results:`, error.message);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Save environment information
     */
    async saveEnvironmentInfo(client, data) {
        const query = `
            INSERT INTO environment_info (
                timestamp, algorithm, platform, node_version, platform_os, 
                architecture, total_memory, free_memory, cpu_count
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
        `;
        
        const values = [
            new Date(data.timestamp),
            data.algorithm,
            data.environment.platform,
            data.environment.specs.version,
            data.environment.specs.platform,
            data.environment.specs.arch,
            data.environment.specs.totalMemory,
            data.environment.specs.freeMemory,
            data.environment.specs.cpus.length
        ];

        const result = await client.query(query, values);
        return result.rows[0].id;
    }

    /**
     * Save CPU information
     */
    async saveCpuInfo(client, environmentId, cpus) {
        const query = `
            INSERT INTO cpu_info (
                environment_id, cpu_index, model, speed, 
                user_time, nice_time, sys_time, idle_time, irq_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;

        for (let i = 0; i < cpus.length; i++) {
            const cpu = cpus[i];
            const values = [
                environmentId,
                i,
                cpu.model,
                cpu.speed,
                cpu.times.user,
                cpu.times.nice,
                cpu.times.sys,
                cpu.times.idle,
                cpu.times.irq
            ];
            
            await client.query(query, values);
        }
    }

    /**
     * Save test run information
     */
    async saveTestRun(client, environmentId, result) {
        const query = `
            INSERT INTO test_runs (
                environment_id, algorithm, algorithm_type, size_category, 
                iterations_count, speedup, validation_success
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;

        const values = [
            environmentId,
            result.algorithm,
            result.type,
            result.size,
            result.wasmTimes.length, // iterations count
            result.speedup,
            result.validationResults.success
        ];

        const queryResult = await client.query(query, values);
        return queryResult.rows[0].id;
    }

    /**
     * Save performance statistics
     */
    async savePerformanceStats(client, testRunId, result, executionType) {
        const stats = executionType === 'wasm' ? result.wasmStats : result.jsStats;
        const times = executionType === 'wasm' ? result.wasmTimes : result.jsTimes;

        const query = `
            INSERT INTO performance_stats (
                test_run_id, execution_type, min_time, max_time, mean_time, 
                median_time, std_dev, p95_time, p99_time, individual_times
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        const values = [
            testRunId,
            executionType,
            stats.min,
            stats.max,
            stats.mean,
            stats.median,
            stats.stdDev,
            stats.p95,
            stats.p99,
            JSON.stringify(times)
        ];

        await client.query(query, values);
    }

    /**
     * Save memory measurements for each iteration
     */
    async saveMemoryMeasurements(client, testRunId, result, executionType) {
        const memoryData = executionType === 'wasm' ? result.wasmMemory : result.jsMemory;
        
        const query = `
            INSERT INTO memory_measurements (
                test_run_id, execution_type, iteration_index, 
                heap_used, heap_total, external_memory, rss
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        for (let i = 0; i < memoryData.length; i++) {
            const memory = memoryData[i];
            const values = [
                testRunId,
                executionType,
                i,
                memory.heapUsed,
                memory.heapTotal,
                memory.external,
                memory.rss
            ];
            
            await client.query(query, values);
        }
    }

    /**
     * Save memory statistics summary
     */
    async saveMemoryStats(client, testRunId, result, executionType) {
        const memoryStats = executionType === 'wasm' ? result.wasmMemoryStats : result.jsMemoryStats;
        const memoryDetails = result.memoryDetails ? result.memoryDetails[executionType] : {};

        const query = `
            INSERT INTO memory_stats (
                test_run_id, execution_type, min_heap, max_heap, mean_heap, 
                median_heap, std_dev_heap, p95_heap, p99_heap, memory_details
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        const values = [
            testRunId,
            executionType,
            memoryStats.min,
            memoryStats.max,
            memoryStats.mean,
            memoryStats.median,
            memoryStats.stdDev,
            memoryStats.p95,
            memoryStats.p99,
            JSON.stringify(memoryDetails)
        ];

        await client.query(query, values);
    }

    /**
     * Save validation results
     */
    async saveValidationResults(client, testRunId, validationResults) {
        const query = `
            INSERT INTO validation_results (
                test_run_id, success, discrepancies, error_message
            ) VALUES ($1, $2, $3, $4)
        `;

        const values = [
            testRunId,
            validationResults.success,
            JSON.stringify(validationResults.discrepancies || []),
            validationResults.error || null
        ];

        await client.query(query, values);
    }

    /**
     * Load benchmark results from a JSON file and save to database
     */
    async saveBenchmarkFromFile(filePath) {
        const fs = require('fs');
        const path = require('path');
        
        try {
            console.log(`📂 Reading benchmark file: ${filePath}`);
            const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            const result = await this.saveBenchmarkResults(jsonData);
            console.log(`✅ Successfully saved data from ${path.basename(filePath)}`);
            
            return result;
        } catch (error) {
            console.error(`❌ Error processing file ${filePath}:`, error.message);
            throw error;
        }
    }

    /**
     * Save all JSON files from results directory
     */
    async saveAllResults() {
        const fs = require('fs');
        const path = require('path');
        
        const resultsDir = path.join(__dirname, '..', 'results');
        const algorithmDirs = ['matrix', 'fft', 'integration', 'gradient', 'json', 'csv'];
        
        console.log('🔄 Processing all benchmark results...\n');
        
        const results = [];
        
        for (const algorithmDir of algorithmDirs) {
            const dirPath = path.join(resultsDir, algorithmDir);
            
            if (fs.existsSync(dirPath)) {
                const files = fs.readdirSync(dirPath)
                    .filter(file => file.endsWith('.json'))
                    .sort(); // Process in chronological order
                
                console.log(`📁 Processing ${algorithmDir} directory (${files.length} files)...`);
                
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    try {
                        const result = await this.saveBenchmarkFromFile(filePath);
                        results.push({ file, ...result });
                    } catch (error) {
                        console.error(`❌ Failed to process ${file}:`, error.message);
                        results.push({ file, success: false, error: error.message });
                    }
                }
                
                console.log(''); // Empty line for readability
            } else {
                console.log(`⚠️ Directory ${algorithmDir} not found, skipping...`);
            }
        }
        
        // Summary
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log('📊 Processing Summary:');
        console.log(`   ✅ Successfully processed: ${successful} files`);
        console.log(`   ❌ Failed: ${failed} files`);
        console.log(`   📈 Total: ${results.length} files`);
        
        return results;
    }

    /**
     * Query recent benchmark results
     */
    async getRecentResults(limit = 10) {
        const query = `
            SELECT * FROM recent_benchmarks 
            ORDER BY created_at DESC 
            LIMIT $1
        `;
        
        const result = await this.pool.query(query, [limit]);
        return result.rows;
    }

    /**
     * Get algorithm performance summary
     */
    async getAlgorithmSummary() {
        const query = 'SELECT * FROM algorithm_summary ORDER BY algorithm, size_category';
        const result = await this.pool.query(query);
        return result.rows;
    }

    /**
     * Close database connection pool
     */
    async close() {
        await this.pool.end();
        console.log('📡 Database connection pool closed.');
    }
}

module.exports = DatabaseManager; 