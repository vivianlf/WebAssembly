const fs = require('fs');
const path = require('path');
const { TestRunner } = require('./runner');

// Import the compiled WebAssembly modules
const JsonParserWasmModule = require('../build/node/json-parser.js');

/**
 * JavaScript JSON Parser implementation for comparison
 */
class JsonParserImplementation {
    constructor() {}

    // Generate synthetic JSON data
    generateJsonData(numRecords) {
        const records = [];
        for (let i = 0; i < numRecords; i++) {
            records.push({
                id: i + 1,
                name: `Record_${i + 1}`,
                value: (i + 1) * 3.14159,
                active: i % 2 === 0
            });
        }
        return JSON.stringify(records, null, 2);
    }

    // Generate JSON data of specified size
    generateTestJson(targetSizeMb) {
        // Estimate records needed for target size
        const estimatedRecords = Math.floor(targetSizeMb * 1024 * 1024 / 120); // ~120 bytes per record
        return this.generateJsonData(estimatedRecords);
    }

    // Parse JSON and return parsing statistics
    parseJsonData(jsonStr) {
        if (!jsonStr) return null;

        // Measure parsing time
        const startTime = process.hrtime.bigint();
        
        try {
            // Parse JSON using native JavaScript parser
            const records = JSON.parse(jsonStr);
            
            const endTime = process.hrtime.bigint();
            const parseTimeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            // Calculate statistics
            let totalValue = 0.0;
            for (const record of records) {
                if (record.value) {
                    totalValue += record.value;
                }
            }
            const avgValue = records.length > 0 ? totalValue / records.length : 0.0;
            
            // Return results: [record_count, total_size, avg_value, parse_time_ms]
            return [
                records.length,
                jsonStr.length,
                avgValue,
                parseTimeMs
            ];
        } catch (error) {
            console.error('JSON parsing error:', error);
            return null;
        }
    }

    // Entry point function to run the JSON parser algorithm
    async runAlgorithm(targetSizeMb) {
        if (targetSizeMb <= 0) return null;
        
        // Generate test data
        const jsonData = this.generateTestJson(targetSizeMb);
        if (!jsonData) return null;
        
        // Parse the data
        const results = this.parseJsonData(jsonData);
        
        return results;
    }
}

/**
 * Create a WebAssembly module wrapper
 * @param {Object} wasmInstance - The WebAssembly instance
 * @returns {Object} Wrapped module with runAlgorithm function
 */
function createWasmModule(wasmInstance) {
    return {
        runAlgorithm: async (targetSizeMb) => {
            try {
                // Use cwrap to create a JavaScript callable function
                const runJsonParserTest = wasmInstance.cwrap('run_json_parser_test', 'number', ['number']);
                const freeJsonParserData = wasmInstance.cwrap('free_json_parser_data', null, ['number']);
                
                // Run JSON parser test
                const resultPtr = runJsonParserTest(targetSizeMb);
                if (!resultPtr) {
                    throw new Error('JSON parser test failed');
                }
                
                // Convert result back to JavaScript array
                const jsonParserResult = [];
                for (let i = 0; i < 4; i++) { // [record_count, total_size, avg_value, parse_time_ms]
                    jsonParserResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                }
                
                // Free memory
                freeJsonParserData(resultPtr);
                
                return jsonParserResult;
            } catch (error) {
                console.error('Error in WebAssembly JSON Parser algorithm:', error);
                throw error;
            }
        }
    };
}

/**
 * JSON Parser test
 * @param {TestRunner} runner - The test runner instance
 */
async function runJsonParserTest(runner) {
    // Create a JavaScript implementation
    const jsModule = new JsonParserImplementation();
    
    // Create a validator function that checks if we got a result
    const validator = (wasmResult, jsResult) => {
        if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
            return { success: false, discrepancies: ['Results are not arrays'] };
        }
        if (wasmResult.length !== jsResult.length) {
            return { success: false, discrepancies: ['Array lengths do not match'] };
        }
        
        // Check if results are reasonably close
        const tolerance = 0.1; // 10% tolerance for record counts and sizes
        let discrepancies = [];
        
        // Check record count (should be very close)
        const wasmRecordCount = wasmResult[0];
        const jsRecordCount = jsResult[0];
        const recordCountDiff = Math.abs(wasmRecordCount - jsRecordCount) / Math.max(wasmRecordCount, jsRecordCount);
        if (recordCountDiff > tolerance) {
            discrepancies.push(`Record count mismatch: wasm=${wasmRecordCount}, js=${jsRecordCount}, diff=${recordCountDiff.toFixed(3)}`);
        }
        
        // Check total size (should be very close)
        const wasmSize = wasmResult[1];
        const jsSize = jsResult[1];
        const sizeDiff = Math.abs(wasmSize - jsSize) / Math.max(wasmSize, jsSize);
        if (sizeDiff > tolerance) {
            discrepancies.push(`Size mismatch: wasm=${wasmSize}, js=${jsSize}, diff=${sizeDiff.toFixed(3)}`);
        }
        
        // Check average value (should be identical for same data)
        const wasmAvgValue = wasmResult[2];
        const jsAvgValue = jsResult[2];
        const avgValueDiff = Math.abs(wasmAvgValue - jsAvgValue) / Math.max(Math.abs(wasmAvgValue), Math.abs(jsAvgValue));
        if (avgValueDiff > 0.01) { // 1% tolerance for floating point
            discrepancies.push(`Average value mismatch: wasm=${wasmAvgValue}, js=${jsAvgValue}, diff=${avgValueDiff.toFixed(3)}`);
        }
        
        // Parse time is not compared as it's the performance metric we're measuring
        
        return { 
            success: discrepancies.length === 0, 
            discrepancies: discrepancies.slice(0, 5) // Limit to first 5 discrepancies
        };
    };
    
    // Define test sizes as specified in the requirements
    const sizes = {
        small: 1,   // 1MB (~10k records)
        medium: 5,  // 5MB (~50k records)
        large: 20   // 20MB (~200k records)
    };
    
    // Run tests for each size
    for (const [sizeName, sizeMb] of Object.entries(sizes)) {
        const estimatedRecords = Math.floor(sizeMb * 1024 * 1024 / 120);
        console.log(`\nRunning ${sizeName} JSON Parser test (${sizeMb}MB, ~${Math.floor(estimatedRecords/1000)}k records)...`);
        await runner.runTest(
            'JSON Parser',
            'string',
            sizeName,
            sizeMb,
            10, // 10 iterations for proper benchmarking
            validator
        );
    }
}

/**
 * Main function to run all JSON Parser benchmark tests
 */
async function runAllTests() {
    // Create results directory
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a timestamp for the results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `node-json-parser-benchmark-${timestamp}.json`);
    
    // Initialize results object
    const results = {
        timestamp: new Date().toISOString(),
        environment: {
            platform: 'Node.js',
            specs: {
                version: process.version,
                platform: process.platform,
                arch: process.arch,
                cpus: require('os').cpus(),
                totalMemory: require('os').totalmem(),
                freeMemory: require('os').freemem()
            }
        },
        results: []
    };
    
    // Write initial results file
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log('Starting JSON Parser WebAssembly vs JavaScript benchmarks...');
    console.log('Environment: Node.js');
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log('Initializing JSON Parser WebAssembly module...');
        const wasmInstance = await (JsonParserWasmModule.default ? JsonParserWasmModule.default() : JsonParserWasmModule());
        
        // Wait for module to be ready
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log('JSON Parser WebAssembly module initialized successfully');
        console.log('Available functions:', Object.keys(wasmInstance).filter(key => key.startsWith('_')));
        console.log('cwrap available:', typeof wasmInstance.cwrap);
        console.log('ccall available:', typeof wasmInstance.ccall);
        console.log('getValue available:', typeof wasmInstance.getValue);
        
        // Create wrapped WebAssembly module
        const wasmModule = createWasmModule(wasmInstance);
        
        // Create JavaScript implementation
        const jsModule = new JsonParserImplementation();
        
        // Create a test runner with both implementations
        const runner = new TestRunner(wasmModule, jsModule);
        
        // Override the exportResults method to write incrementally
        runner.exportResults = (metrics) => {
            results.results.push(metrics);
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`Results updated for ${metrics.algorithm} (${metrics.size})`);
        };
        
        // Run JSON Parser test
        console.log('Running JSON Parser benchmarks...');
        await runJsonParserTest(runner);
        
        console.log('======================================');
        console.log('All JSON Parser benchmarks completed.');
        console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error('Error during JSON Parser test execution:', error);
        throw error;
    }
}

// Run all tests
runAllTests().catch(error => {
    console.error('Error running JSON Parser benchmarks:', error);
    process.exit(1);
}); 