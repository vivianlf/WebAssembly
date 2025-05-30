const fs = require('fs');
const path = require('path');
const { TestRunner } = require('./runner');

// Import the compiled WebAssembly modules
const CsvParserWasmModule = require('../build/node/csv-parser.js');

// Import the JavaScript implementation
const CsvParserImplementation = require('../js/string/csv-parser.js');

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
                const runCsvParserTest = wasmInstance.cwrap('run_csv_parser_test', 'number', ['number']);
                const freeCsvParserData = wasmInstance.cwrap('free_csv_parser_data', null, ['number']);
                
                // Run CSV parser test
                const resultPtr = runCsvParserTest(targetSizeMb);
                if (!resultPtr) {
                    throw new Error('CSV parser test failed');
                }
                
                // Convert result back to JavaScript array
                const csvParserResult = [];
                for (let i = 0; i < 4; i++) { // [record_count, total_size, avg_value1, parse_time_ms]
                    csvParserResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                }
                
                // Free memory
                freeCsvParserData(resultPtr);
                
                return csvParserResult;
            } catch (error) {
                console.error('Error in WebAssembly CSV Parser algorithm:', error);
                throw error;
            }
        }
    };
}

/**
 * CSV Parser test
 * @param {TestRunner} runner - The test runner instance
 */
async function runCsvParserTest(runner) {
    // Create a JavaScript implementation
    const jsModule = new CsvParserImplementation();
    
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
        
        // Check average value1 (should be identical for same data)
        const wasmAvgValue = wasmResult[2];
        const jsAvgValue = jsResult[2];
        const avgValueDiff = Math.abs(wasmAvgValue - jsAvgValue) / Math.max(Math.abs(wasmAvgValue), Math.abs(jsAvgValue));
        if (avgValueDiff > 0.01) { // 1% tolerance for floating point
            discrepancies.push(`Average value1 mismatch: wasm=${wasmAvgValue}, js=${jsAvgValue}, diff=${avgValueDiff.toFixed(3)}`);
        }
        
        // Parse time is not compared as it's the performance metric we're measuring
        
        return { 
            success: discrepancies.length === 0, 
            discrepancies: discrepancies.slice(0, 5) // Limit to first 5 discrepancies
        };
    };
    
    // Define test sizes as specified in the requirements
    const sizes = {
        small: 1,   // 1MB (~4k records with 20 columns)
        medium: 5,  // 5MB (~20k records with 20 columns)
        large: 20   // 20MB (~80k records with 20 columns)
    };
    
    // Run tests for each size
    for (const [sizeName, sizeMb] of Object.entries(sizes)) {
        const estimatedRecords = Math.floor(sizeMb * 1024 * 1024 / 250);
        console.log(`\nRunning ${sizeName} CSV Parser test (${sizeMb}MB, ~${Math.floor(estimatedRecords/1000)}k records, 20 columns)...`);
        await runner.runTest(
            'CSV Parser',
            'string',
            sizeName,
            sizeMb,
            10, // 10 iterations for proper benchmarking
            validator
        );
    }
}

/**
 * Main function to run all CSV Parser benchmark tests
 */
async function runAllTests() {
    // Create results directory
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a timestamp for the results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `node-csv-parser-benchmark-${timestamp}.json`);
    
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
    
    console.log('Starting CSV Parser WebAssembly vs JavaScript benchmarks...');
    console.log('Environment: Node.js');
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log('Initializing CSV Parser WebAssembly module...');
        const wasmInstance = await (CsvParserWasmModule.default ? CsvParserWasmModule.default() : CsvParserWasmModule());
        
        // Wait for module to be ready
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log('CSV Parser WebAssembly module initialized successfully');
        console.log('Available functions:', Object.keys(wasmInstance).filter(key => key.startsWith('_')));
        console.log('cwrap available:', typeof wasmInstance.cwrap);
        console.log('ccall available:', typeof wasmInstance.ccall);
        console.log('getValue available:', typeof wasmInstance.getValue);
        
        // Create wrapped WebAssembly module
        const wasmModule = createWasmModule(wasmInstance);
        
        // Create JavaScript implementation
        const jsModule = new CsvParserImplementation();
        
        // Create a test runner with both implementations
        const runner = new TestRunner(wasmModule, jsModule);
        
        // Override the exportResults method to write incrementally
        runner.exportResults = (metrics) => {
            results.results.push(metrics);
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`Results updated for ${metrics.algorithm} (${metrics.size})`);
        };
        
        // Run CSV Parser test
        console.log('Running CSV Parser benchmarks...');
        await runCsvParserTest(runner);
        
        console.log('======================================');
        console.log('All CSV Parser benchmarks completed.');
        console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error('Error during CSV Parser test execution:', error);
        throw error;
    }
}

// Run all tests
runAllTests().catch(error => {
    console.error('Error running CSV Parser benchmarks:', error);
    process.exit(1);
}); 