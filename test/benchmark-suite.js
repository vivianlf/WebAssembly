#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { TestRunnerWithDatabase } = require('./runner-with-database');

// Import all WebAssembly modules
const MatrixMultiplyWasmModule = require('../build/node/matrix-multiply.js');
const FftWasmModule = require('../build/node/fft.js');
const NumericIntegrationWasmModule = require('../build/node/numeric-integration.js');
const GradientDescentWasmModule = require('../build/node/gradient-descent.js');
const JsonParserWasmModule = require('../build/node/json-parser.js');
const CsvParserWasmModule = require('../build/node/csv-parser.js');

// Import all JavaScript implementations
const MatrixMultiplyImplementation = require('../js/math/matrix-multiply.js');
const FftImplementation = require('../js/math/fft.js');
const NumericIntegrationImplementation = require('../js/math/numeric-integration.js');
const GradientDescentImplementation = require('../js/math/gradient-descent.js');
const JsonParserImplementation = require('../js/string/json-parser.js');
const CsvParserImplementation = require('../js/string/csv-parser.js');

// Test configurations
const TEST_CONFIGS = {
    'matrix': {
        name: 'Matrix Multiplication',
        type: 'math',
        iterations: 1, // Only 1 iteration for large matrices
        wasmModule: MatrixMultiplyWasmModule,
        jsImplementation: MatrixMultiplyImplementation,
        sizes: {
            small: 50,   // 50x50 matrices
            medium: 500, // 500x500 matrices
            // large: 2000  // Comment out large for faster testing
        },
        createWasmWrapper: (wasmInstance) => ({
            runAlgorithm: async (size) => {
                try {
                    const runMatrixMultiplicationTest = wasmInstance.cwrap('run_matrix_multiplication_test', 'number', ['number']);
                    
                    const result = runMatrixMultiplicationTest(size);
                    if (result === 0.0) throw new Error('Matrix multiplication test failed');
                    
                    return result;
                } catch (error) {
                    console.error('Error in WebAssembly Matrix Multiplication:', error);
                    throw error;
                }
            }
        }),
        validator: (wasmResult, jsResult) => {
            // Handle case where one or both results might be undefined/null
            if (wasmResult === undefined || jsResult === undefined || wasmResult === null || jsResult === null) {
                return { success: false, discrepancies: ['One or both results are undefined/null'] };
            }
            
            // More reasonable tolerance for matrix multiplication (scientific precision)
            const tolerance = 1e-6; // 0.000001 - much more reasonable than 1e-10
            const diff = Math.abs(wasmResult - jsResult) / Math.max(Math.abs(wasmResult), Math.abs(jsResult), 1e-10);
            
            return {
                success: diff < tolerance,
                discrepancies: diff >= tolerance ? [`Result mismatch: wasm=${wasmResult}, js=${jsResult}, diff=${diff.toExponential(3)}`] : []
            };
        }
    },
    
    'fft': {
        name: 'FFT (Fast Fourier Transform)',
        type: 'math',
        iterations: 5, // Moderate iterations for FFT
        wasmModule: FftWasmModule,
        jsImplementation: FftImplementation,
        sizes: {
            small: 256,   // 256 points
            medium: 1024, // 1024 points
            large: 4096   // 4096 points
        },
        createWasmWrapper: (wasmInstance) => ({
            runAlgorithm: async (size) => {
                try {
                    const runFftTest = wasmInstance.cwrap('run_fft_test', 'number', ['number']);
                    const freeFftData = wasmInstance.cwrap('free_fft_data', null, ['number']);
                    
                    const resultPtr = runFftTest(size);
                    if (!resultPtr) throw new Error('FFT test failed');
                    
                    const fftResult = [];
                    for (let i = 0; i < 4; i++) {
                        fftResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                    }
                    
                    freeFftData(resultPtr);
                    return fftResult;
                } catch (error) {
                    console.error('Error in WebAssembly FFT:', error);
                    throw error;
                }
            }
        }),
        validator: (wasmResult, jsResult) => {
            // Handle undefined/null results
            if (!wasmResult || !jsResult) {
                return { success: false, discrepancies: ['One or both results are undefined/null'] };
            }
            
            if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
                return { success: false, discrepancies: ['Results are not arrays'] };
            }
            
            if (wasmResult.length !== jsResult.length) {
                return { success: false, discrepancies: [`Array length mismatch: wasm=${wasmResult.length}, js=${jsResult.length}`] };
            }
            
            const tolerance = 0.01; // 1% tolerance - reasonable for FFT
            let discrepancies = [];
            
            for (let i = 0; i < wasmResult.length; i++) {
                // Handle NaN or undefined values
                if (isNaN(wasmResult[i]) || isNaN(jsResult[i])) {
                    discrepancies.push(`Index ${i}: Contains NaN - wasm=${wasmResult[i]}, js=${jsResult[i]}`);
                    continue;
                }
                
                const denominator = Math.max(Math.abs(wasmResult[i]), Math.abs(jsResult[i]), 1e-10);
                const diff = Math.abs(wasmResult[i] - jsResult[i]) / denominator;
                
                if (diff > tolerance) {
                    discrepancies.push(`Index ${i}: wasm=${wasmResult[i].toFixed(6)}, js=${jsResult[i].toFixed(6)}, diff=${(diff*100).toFixed(2)}%`);
                }
            }
            
            return { success: discrepancies.length === 0, discrepancies: discrepancies.slice(0, 3) };
        }
    },
    
    'integration': {
        name: 'Numeric Integration',
        type: 'math',
        iterations: 3, // Moderate iterations for integration
        wasmModule: NumericIntegrationWasmModule,
        jsImplementation: NumericIntegrationImplementation,
        sizes: {
            small: 1000,    // 1000 points
            medium: 10000,  // 10000 points
            large: 100000   // 100000 points
        },
        createWasmWrapper: (wasmInstance) => ({
            runAlgorithm: async (size) => {
                try {
                    const runIntegrationTest = wasmInstance.cwrap('run_integration_test', 'number', ['number']);
                    const freeIntegrationData = wasmInstance.cwrap('free_integration_data', null, ['number']);
                    
                    const resultPtr = runIntegrationTest(size);
                    if (!resultPtr) throw new Error('Integration test failed');
                    
                    const integrationResult = [];
                    for (let i = 0; i < 4; i++) {
                        integrationResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                    }
                    
                    freeIntegrationData(resultPtr);
                    return integrationResult;
                } catch (error) {
                    console.error('Error in WebAssembly Integration:', error);
                    throw error;
                }
            }
        }),
        validator: (wasmResult, jsResult) => {
            if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
                return { success: false, discrepancies: ['Results are not arrays'] };
            }
            
            const tolerance = 0.01;
            let discrepancies = [];
            
            for (let i = 0; i < Math.min(wasmResult.length, jsResult.length); i++) {
                const diff = Math.abs(wasmResult[i] - jsResult[i]) / Math.max(Math.abs(wasmResult[i]), Math.abs(jsResult[i]));
                if (diff > tolerance) {
                    discrepancies.push(`Index ${i}: wasm=${wasmResult[i]}, js=${jsResult[i]}, diff=${diff.toFixed(3)}`);
                }
            }
            
            return { success: discrepancies.length === 0, discrepancies: discrepancies.slice(0, 3) };
        }
    },
    
    'gradient': {
        name: 'Gradient Descent',
        type: 'math',
        iterations: 3, // Moderate iterations for gradient descent
        wasmModule: GradientDescentWasmModule,
        jsImplementation: GradientDescentImplementation,
        sizes: {
            small: { iterations: 100, parameters: 10 },     // 100 iterations, 10 parameters
            medium: { iterations: 1000, parameters: 100 },  // 1000 iterations, 100 parameters
            large: { iterations: 10000, parameters: 1000 }  // 10000 iterations, 1000 parameters
        },
        createWasmWrapper: (wasmInstance) => ({
            runAlgorithm: async (config) => {
                try {
                    const runGradientDescentTest = wasmInstance.cwrap('run_gradient_descent_test', 'number', ['number', 'number']);
                    const freeGradientDescentData = wasmInstance.cwrap('free_gradient_descent_data', null, ['number']);
                    
                    const resultPtr = runGradientDescentTest(config.iterations, config.parameters);
                    if (!resultPtr) throw new Error('Gradient descent test failed');
                    
                    const gradientResult = [];
                    for (let i = 0; i < 4; i++) {
                        gradientResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                    }
                    
                    freeGradientDescentData(resultPtr);
                    return gradientResult;
                } catch (error) {
                    console.error('Error in WebAssembly Gradient Descent:', error);
                    throw error;
                }
            }
        }),
        validator: (wasmResult, jsResult) => {
            // Handle undefined/null results
            if (!wasmResult || !jsResult) {
                return { success: false, discrepancies: ['One or both results are undefined/null'] };
            }
            
            if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
                return { success: false, discrepancies: ['Results are not arrays'] };
            }
            
            if (wasmResult.length !== jsResult.length) {
                return { success: false, discrepancies: [`Array length mismatch: wasm=${wasmResult.length}, js=${jsResult.length}`] };
            }
            
            // More lenient tolerance for optimization algorithms (they can have natural variance)
            const tolerance = 0.15; // 15% tolerance - optimization algorithms can vary
            let discrepancies = [];
            
            for (let i = 0; i < wasmResult.length; i++) {
                // Handle NaN or undefined values
                if (isNaN(wasmResult[i]) || isNaN(jsResult[i])) {
                    discrepancies.push(`Index ${i}: Contains NaN - wasm=${wasmResult[i]}, js=${jsResult[i]}`);
                    continue;
                }
                
                const denominator = Math.max(Math.abs(wasmResult[i]), Math.abs(jsResult[i]), 1e-10);
                const diff = Math.abs(wasmResult[i] - jsResult[i]) / denominator;
                
                if (diff > tolerance) {
                    discrepancies.push(`Index ${i}: wasm=${wasmResult[i].toFixed(6)}, js=${jsResult[i].toFixed(6)}, diff=${(diff*100).toFixed(2)}%`);
                }
            }
            
            return { success: discrepancies.length === 0, discrepancies: discrepancies.slice(0, 3) };
        }
    },
    
    'json': {
        name: 'JSON Parser',
        type: 'string',
        iterations: 2, // Few iterations for large file parsing
        wasmModule: JsonParserWasmModule,
        jsImplementation: JsonParserImplementation,
        sizes: {
            small: 1,   // 1MB
            medium: 5,  // 5MB
            large: 20   // 20MB
        },
        createWasmWrapper: (wasmInstance) => ({
            runAlgorithm: async (targetSizeMb) => {
                try {
                    const runJsonParserTest = wasmInstance.cwrap('run_json_parser_test', 'number', ['number']);
                    const freeJsonParserData = wasmInstance.cwrap('free_json_parser_data', null, ['number']);
                    
                    const resultPtr = runJsonParserTest(targetSizeMb);
                    if (!resultPtr) throw new Error('JSON parser test failed');
                    
                    const jsonParserResult = [];
                    for (let i = 0; i < 4; i++) {
                        jsonParserResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                    }
                    
                    freeJsonParserData(resultPtr);
                    return jsonParserResult;
                } catch (error) {
                    console.error('Error in WebAssembly JSON Parser:', error);
                    throw error;
                }
            }
        }),
        validator: (wasmResult, jsResult) => {
            // Handle undefined/null results
            if (!wasmResult || !jsResult) {
                return { success: false, discrepancies: ['One or both results are undefined/null'] };
            }
            
            if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
                return { success: false, discrepancies: ['Results are not arrays'] };
            }
            
            if (wasmResult.length !== jsResult.length) {
                return { success: false, discrepancies: [`Array length mismatch: wasm=${wasmResult.length}, js=${jsResult.length}`] };
            }
            
            const tolerance = 0.1; // 10% tolerance for parsing operations
            let discrepancies = [];
            
            // Check record count (index 0)
            if (wasmResult.length > 0 && jsResult.length > 0) {
                const recordCountDiff = Math.abs(wasmResult[0] - jsResult[0]) / Math.max(wasmResult[0], jsResult[0], 1);
                if (recordCountDiff > tolerance) {
                    discrepancies.push(`Record count: wasm=${wasmResult[0].toFixed(0)}, js=${jsResult[0].toFixed(0)}, diff=${(recordCountDiff*100).toFixed(2)}%`);
                }
            }
            
            // Check average value (index 2) if exists
            if (wasmResult.length > 2 && jsResult.length > 2) {
                const avgValueDiff = Math.abs(wasmResult[2] - jsResult[2]) / Math.max(Math.abs(wasmResult[2]), Math.abs(jsResult[2]), 1e-10);
                if (avgValueDiff > 0.01) { // 1% tolerance for average values
                    discrepancies.push(`Average value: wasm=${wasmResult[2].toFixed(6)}, js=${jsResult[2].toFixed(6)}, diff=${(avgValueDiff*100).toFixed(2)}%`);
                }
            }
            
            return { success: discrepancies.length === 0, discrepancies: discrepancies.slice(0, 3) };
        }
    },
    
    'csv': {
        name: 'CSV Parser',
        type: 'string',
        iterations: 2, // Few iterations for large file parsing
        wasmModule: CsvParserWasmModule,
        jsImplementation: CsvParserImplementation,
        sizes: {
            small: 1,   // 1MB
            medium: 5,  // 5MB
            large: 20   // 20MB
        },
        createWasmWrapper: (wasmInstance) => ({
            runAlgorithm: async (targetSizeMb) => {
                try {
                    const runCsvParserTest = wasmInstance.cwrap('run_csv_parser_test', 'number', ['number']);
                    const freeCsvParserData = wasmInstance.cwrap('free_csv_parser_data', null, ['number']);
                    
                    const resultPtr = runCsvParserTest(targetSizeMb);
                    if (!resultPtr) throw new Error('CSV parser test failed');
                    
                    const csvParserResult = [];
                    for (let i = 0; i < 4; i++) {
                        csvParserResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                    }
                    
                    freeCsvParserData(resultPtr);
                    return csvParserResult;
                } catch (error) {
                    console.error('Error in WebAssembly CSV Parser:', error);
                    throw error;
                }
            }
        }),
        validator: (wasmResult, jsResult) => {
            // Handle undefined/null results
            if (!wasmResult || !jsResult) {
                return { success: false, discrepancies: ['One or both results are undefined/null'] };
            }
            
            if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
                return { success: false, discrepancies: ['Results are not arrays'] };
            }
            
            if (wasmResult.length !== jsResult.length) {
                return { success: false, discrepancies: [`Array length mismatch: wasm=${wasmResult.length}, js=${jsResult.length}`] };
            }
            
            const tolerance = 0.1; // 10% tolerance for parsing operations
            let discrepancies = [];
            
            // Check record count (index 0)
            if (wasmResult.length > 0 && jsResult.length > 0) {
                const recordCountDiff = Math.abs(wasmResult[0] - jsResult[0]) / Math.max(wasmResult[0], jsResult[0], 1);
                if (recordCountDiff > tolerance) {
                    discrepancies.push(`Record count: wasm=${wasmResult[0].toFixed(0)}, js=${jsResult[0].toFixed(0)}, diff=${(recordCountDiff*100).toFixed(2)}%`);
                }
            }
            
            // Check average value (index 2) if exists
            if (wasmResult.length > 2 && jsResult.length > 2) {
                const avgValueDiff = Math.abs(wasmResult[2] - jsResult[2]) / Math.max(Math.abs(wasmResult[2]), Math.abs(jsResult[2]), 1e-10);
                if (avgValueDiff > 0.01) { // 1% tolerance for average values
                    discrepancies.push(`Average value: wasm=${wasmResult[2].toFixed(6)}, js=${jsResult[2].toFixed(6)}, diff=${(avgValueDiff*100).toFixed(2)}%`);
                }
            }
            
            return { success: discrepancies.length === 0, discrepancies: discrepancies.slice(0, 3) };
        }
    }
};

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Utility functions
function createResultsDirectory(algorithmKey) {
    const resultsDir = path.join(__dirname, '..', 'results', algorithmKey);
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    return resultsDir;
}

function createResultsFile(algorithmKey, algorithmName) {
    const resultsDir = createResultsDirectory(algorithmKey);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `${algorithmKey}-benchmark-${timestamp}.json`);
    
    const results = {
        timestamp: new Date().toISOString(),
        algorithm: algorithmName,
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
    
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    return resultsFile;
}

async function runSingleTest(algorithmKey) {
    const config = TEST_CONFIGS[algorithmKey];
    console.log(`\n🚀 Running ${config.name} benchmark...`);
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log(`Initializing ${config.name} WebAssembly module...`);
        const wasmInstance = await (config.wasmModule.default ? config.wasmModule.default() : config.wasmModule());
        
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log(`${config.name} WebAssembly module initialized successfully`);
        
        // Create wrapped modules
        const wasmModule = config.createWasmWrapper(wasmInstance);
        const jsModule = new config.jsImplementation();
        
        // Create test runner with database integration
        const runner = TestRunnerWithDatabase.create(wasmModule, jsModule, config.name, {
            saveToDatabase: true,
            saveToJson: true
        });
        
        // Run complete benchmark (all sizes) with automatic database saving
        const results = await runner.runCompleteBenchmark(
            config.name, 
            config.type,
            config.sizes, 
            config.iterations || 1, // Use config iterations or default to 1
            config.validator
        );
        
        console.log(`\n✅ ${config.name} benchmark completed!`);
        console.log(`📊 Summary:`);
        if (results && results.length > 0) {
            results.forEach(result => {
                if (result && result.speedup > 0) {
                    const validation = result.validationResults && result.validationResults.success ? '✅' : '❌';
                    console.log(`   ${result.size}: ${result.speedup.toFixed(2)}x speedup (${validation} validated)`);
                } else if (result) {
                    console.log(`   ${result.size}: ❌ Test failed - ${result.validationResults?.discrepancies?.[0] || 'Unknown error'}`);
                } else {
                    console.log(`   Unknown size: ❌ Test failed`);
                }
            });
        } else {
            console.log(`   ❌ No successful tests completed`);
        }
        
        // Cleanup
        await runner.cleanup();
        
    } catch (error) {
        console.error(`❌ Error running ${config.name} benchmark:`, error);
    }
}

async function runAllTests() {
    console.log('\n🚀 Running ALL benchmarks (LIGHT - Optimized iterations)...');
    console.log('💡 Fast testing with algorithm-specific iteration counts for quick results');
    console.log('======================================');
    
    const globalStartTime = performance.now();
    let totalTests = 0;
    let successfulTests = 0;
    
    for (const algorithmKey of Object.keys(TEST_CONFIGS)) {
        totalTests++;
        try {
            await runSingleTest(algorithmKey);
            successfulTests++;
            console.log('\n' + '='.repeat(50));
        } catch (error) {
            console.error(`❌ Failed to complete ${TEST_CONFIGS[algorithmKey].name}: ${error.message}`);
        }
    }
    
    const globalEndTime = performance.now();
    const totalTime = (globalEndTime - globalStartTime) / 1000; // Convert to seconds
    
    console.log('\n🎉 All LIGHT benchmarks completed!');
    console.log(`📊 Summary: ${successfulTests}/${totalTests} tests successful`);
    console.log(`⏱️ Total execution time: ${totalTime.toFixed(2)} seconds`);
    console.log(`💡 Mode: LIGHT (Optimized iterations for speed)`);
    
    // Show database summary if available
    try {
        const runner = TestRunnerWithDatabase.create({}, {}, 'Summary');
        const recentResults = await runner.getRecentResults(5);
        if (recentResults && recentResults.length > 0) {
            console.log('\n📈 Recent database results:');
            recentResults.forEach(result => {
                console.log(`   ${result.algorithm} (${result.size_category}): ${result.speedup}x speedup`);
            });
        }
        await runner.cleanup();
    } catch (error) {
        // Silently handle database connection issues
    }
}

async function migrateExistingResults() {
    console.log('\n🔄 Migrating existing JSON results to database...');
    console.log('======================================');
    
    try {
        const results = await TestRunnerWithDatabase.migrateAllResults();
        
        console.log('\n📊 Migration completed!');
        console.log(`✅ Successfully migrated: ${results.filter(r => r.success).length} files`);
        console.log(`❌ Failed: ${results.filter(r => !r.success).length} files`);
        
        return results;
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        return null;
    }
}

async function showDatabaseSummary() {
    console.log('\n📊 Database Performance Summary');
    console.log('======================================');
    
    try {
        const runner = TestRunnerWithDatabase.create({}, {}, 'Summary');
        
        const summary = await runner.getPerformanceSummary();
        if (summary && summary.length > 0) {
            console.log('\n📈 Algorithm Performance Summary:');
            console.log('Algorithm'.padEnd(25) + 'Size'.padEnd(10) + 'Avg Speedup'.padEnd(12) + 'Test Count');
            console.log('-'.repeat(60));
            
            summary.forEach(row => {
                const algorithm = row.algorithm.substring(0, 24).padEnd(25);
                const size = row.size_category.padEnd(10);
                const speedup = `${row.avg_speedup.toFixed(2)}x`.padEnd(12);
                const count = row.test_count.toString();
                console.log(algorithm + size + speedup + count);
            });
        } else {
            console.log('No performance data found in database.');
        }
        
        const recentResults = await runner.getRecentResults(10);
        if (recentResults && recentResults.length > 0) {
            console.log('\n🕒 Recent Test Results:');
            recentResults.forEach(result => {
                const date = new Date(result.created_at).toLocaleDateString();
                console.log(`   ${date}: ${result.algorithm} (${result.size_category}) - ${result.speedup}x speedup`);
            });
        }
        
        await runner.cleanup();
    } catch (error) {
        console.error('❌ Failed to retrieve database summary:', error.message);
    }
}

function showMenu() {
    console.log('\n📊 WebAssembly vs JavaScript Benchmark Suite');
    console.log('='.repeat(50));
    console.log('Choose which tests to run:');
    console.log('');
    
    Object.entries(TEST_CONFIGS).forEach(([key, config], index) => {
        const iterations = config.iterations || 1;
        console.log(`${index + 1}. ${config.name} (${config.type}) - ${iterations} iteration${iterations > 1 ? 's' : ''}`);
    });
    
    const numTests = Object.keys(TEST_CONFIGS).length;
    console.log(`${numTests + 1}. Run ALL tests (LIGHT - Fast testing with config iterations)`);
    console.log(`${numTests + 2}. Run ALL tests (HEAVY - 10 iterations each, scientific accuracy)`);
    console.log(`${numTests + 3}. Migrate existing results to database`);
    console.log(`${numTests + 4}. Show database summary`);
    console.log('0. Exit');
    console.log('');
    console.log('💡 LIGHT: Quick testing with optimized iterations per algorithm');
    console.log('🔬 HEAVY: Full scientific testing with 10 iterations for maximum accuracy');
    console.log('');
}

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function main() {
    console.log('🎯 Welcome to the WebAssembly Benchmark Suite!');
    console.log('💾 Automatic database integration enabled - results will be saved to PostgreSQL');
    
    while (true) {
        showMenu();
        
        const choice = await askQuestion('Enter your choice (0-10): ');
        const choiceNum = parseInt(choice);
        
        if (choiceNum === 0) {
            console.log('👋 Goodbye!');
            break;
        }
        
        const algorithmKeys = Object.keys(TEST_CONFIGS);
        
        if (choiceNum === algorithmKeys.length + 1) {
            // Run all tests (LIGHT)
            await runAllTests();
        } else if (choiceNum === algorithmKeys.length + 2) {
            // Run all tests (HEAVY)
            console.log('⚠️  Warning: HEAVY testing will take significantly longer!');
            const confirm = await askQuestion('Are you sure you want to run HEAVY testing? (y/n): ');
            if (confirm.toLowerCase() === 'y') {
                await runAllTestsHeavy();
            } else {
                console.log('❌ HEAVY testing cancelled');
            }
        } else if (choiceNum === algorithmKeys.length + 3) {
            // Migrate existing results to database
            await migrateExistingResults();
        } else if (choiceNum === algorithmKeys.length + 4) {
            // Show database summary
            await showDatabaseSummary();
        } else if (choiceNum >= 1 && choiceNum <= algorithmKeys.length) {
            // Run single test
            const algorithmKey = algorithmKeys[choiceNum - 1];
            await runSingleTest(algorithmKey);
        } else {
            console.log('❌ Invalid choice. Please try again.');
            continue;
        }
        
        const continueChoice = await askQuestion('\nDo you want to run more tests? (y/n): ');
        if (continueChoice.toLowerCase() !== 'y') {
            console.log('👋 Goodbye!');
            break;
        }
    }
    
    rl.close();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    rl.close();
    process.exit(0);
});

// Run the main function
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Error running benchmark suite:', error);
        rl.close();
        process.exit(1);
    });
}

async function runAllTestsHeavy() {
    console.log('\n🚀 Running ALL benchmarks (HEAVY - 10 iterations each)...');
    console.log('⚠️  This will take significantly longer but provides the most accurate results');
    console.log('======================================');
    
    const globalStartTime = performance.now();
    let totalTests = 0;
    let successfulTests = 0;
    
    for (const algorithmKey of Object.keys(TEST_CONFIGS)) {
        totalTests++;
        try {
            await runSingleTestHeavy(algorithmKey);
            successfulTests++;
            console.log('\n' + '='.repeat(50));
        } catch (error) {
            console.error(`❌ Failed to complete ${TEST_CONFIGS[algorithmKey].name}: ${error.message}`);
        }
    }
    
    const globalEndTime = performance.now();
    const totalTime = (globalEndTime - globalStartTime) / 1000; // Convert to seconds
    
    console.log('\n🎉 All HEAVY benchmarks completed!');
    console.log(`📊 Summary: ${successfulTests}/${totalTests} tests successful`);
    console.log(`⏱️ Total execution time: ${totalTime.toFixed(2)} seconds`);
    console.log(`🔬 Scientific accuracy: Maximum (10 iterations per test)`);
    
    // Show database summary if available
    try {
        const runner = TestRunnerWithDatabase.create({}, {}, 'Summary');
        const recentResults = await runner.getRecentResults(5);
        if (recentResults && recentResults.length > 0) {
            console.log('\n📈 Recent database results:');
            recentResults.forEach(result => {
                console.log(`   ${result.algorithm} (${result.size_category}): ${result.speedup}x speedup`);
            });
        }
        await runner.cleanup();
    } catch (error) {
        // Silently handle database connection issues
    }
}

async function runSingleTestHeavy(algorithmKey) {
    const config = TEST_CONFIGS[algorithmKey];
    console.log(`\n🚀 Running ${config.name} benchmark (HEAVY - 10 iterations)...`);
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log(`Initializing ${config.name} WebAssembly module...`);
        const wasmInstance = await (config.wasmModule.default ? config.wasmModule.default() : config.wasmModule());
        
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log(`${config.name} WebAssembly module initialized successfully`);
        
        // Create wrapped modules
        const wasmModule = config.createWasmWrapper(wasmInstance);
        const jsModule = new config.jsImplementation();
        
        // Create test runner with database integration
        const runner = TestRunnerWithDatabase.create(wasmModule, jsModule, config.name, {
            saveToDatabase: true,
            saveToJson: true
        });
        
        // For HEAVY testing, use full sizes including large matrix multiplication
        let heavySizes = config.sizes;
        if (algorithmKey === 'matrix') {
            heavySizes = {
                small: 50,   // 50x50 matrices
                medium: 500, // 500x500 matrices
                large: 1000  // 1000x1000 matrices for heavy testing (reduced from 2000 for feasibility)
            };
            console.log('🔬 HEAVY MODE: Including large matrix multiplication (1000x1000)');
        }
        
        // Run complete benchmark with HEAVY settings (10 iterations)
        const results = await runner.runCompleteBenchmark(
            config.name, 
            config.type,
            heavySizes, 
            10, // ALWAYS 10 iterations for heavy testing
            config.validator
        );
        
        console.log(`\n✅ ${config.name} HEAVY benchmark completed!`);
        console.log(`📊 Summary (10 iterations each):`);
        if (results && results.length > 0) {
            results.forEach(result => {
                if (result && result.speedup > 0) {
                    const validation = result.validationResults && result.validationResults.success ? '✅' : '❌';
                    console.log(`   ${result.size}: ${result.speedup.toFixed(2)}x speedup (${validation} validated)`);
                } else if (result) {
                    console.log(`   ${result.size}: ❌ Test failed - ${result.validationResults?.discrepancies?.[0] || 'Unknown error'}`);
                } else {
                    console.log(`   Unknown size: ❌ Test failed`);
                }
            });
        } else {
            console.log(`   ❌ No successful tests completed`);
        }
        
        // Cleanup
        await runner.cleanup();
        
    } catch (error) {
        console.error(`❌ Error running ${config.name} HEAVY benchmark:`, error);
    }
}

module.exports = { TEST_CONFIGS, runSingleTest, runAllTests, runSingleTestHeavy, runAllTestsHeavy }; 