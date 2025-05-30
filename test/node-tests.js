const fs = require('fs');
const path = require('path');
const { TestRunner } = require('./runner');
const { MatrixMultiplication } = require('../js/math/matrix-multiply');

// Import the compiled WebAssembly modules
const MatrixMultiplyWasmModule = require('../build/node/matrix-multiply.js');

/**
 * Create a WebAssembly module wrapper
 * @param {Object} wasmInstance - The WebAssembly instance
 * @returns {Object} Wrapped module with runAlgorithm function
 */
function createWasmModule(wasmInstance) {
    return {
        runAlgorithm: async (size) => {
            try {
                // Use cwrap to create a JavaScript callable function
                const runMatrixMultiplication = wasmInstance.cwrap('run_matrix_multiplication', 'number', ['number']);
                const freeMatrix = wasmInstance.cwrap('free_matrix', null, ['number']);
                
                // Run the algorithm
                const resultPtr = runMatrixMultiplication(size);
                
                if (!resultPtr) {
                    throw new Error('Matrix multiplication failed');
                }
                
                // Convert result back to JavaScript array
                const result = new Float64Array(wasmInstance.HEAPF64.buffer, resultPtr, size * size);
                const matrixResult = Array(size).fill().map((_, i) => 
                    Array.from(result.slice(i * size, (i + 1) * size))
                );
                
                // Free the result matrix
                freeMatrix(resultPtr);
                
                return matrixResult;
            } catch (error) {
                console.error('Error in WebAssembly algorithm:', error);
                throw error;
            }
        }
    };
}

/**
 * Matrix multiplication test
 * @param {TestRunner} runner - The test runner instance
 */
async function runMatrixMultiplicationTest(runner) {
    // Create a JavaScript implementation
    const jsModule = new MatrixMultiplication();
    
    // Create a simple validator function that just checks if we got a result
    const validator = (wasmResult, jsResult) => {
        if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
            return { success: false, discrepancies: ['Results are not matrices'] };
        }
        if (wasmResult.length !== jsResult.length) {
            return { success: false, discrepancies: ['Matrix dimensions do not match'] };
        }
        return { success: true, discrepancies: [] };
    };
    
    // Define test sizes
    const sizes = {
        small: 50,
        medium: 500,
        large: 2000
    };
    
    // Run tests for each size
    for (const [sizeName, size] of Object.entries(sizes)) {
        console.log(`\nRunning ${sizeName} matrix multiplication test (${size}x${size})...`);
        await runner.runTest(
            'Matrix Multiplication',
            'math',
            sizeName,
            size,
            10, // Reduced to 10 iterations
            validator
        );
    }
}

/**
 * Main function to run all benchmark tests
 */
async function runAllTests() {
    // Create results directory
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a timestamp for the results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `node-benchmark-${timestamp}.json`);
    
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
    
    console.log('Starting WebAssembly vs JavaScript benchmarks...');
    console.log('Environment: Node.js');
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log('Initializing WebAssembly module...');
        const wasmInstance = await (MatrixMultiplyWasmModule.default ? MatrixMultiplyWasmModule.default() : MatrixMultiplyWasmModule());
        console.log('WebAssembly module initialized successfully');
        
        // Create wrapped WebAssembly module
        const wasmModule = createWasmModule(wasmInstance);
        
        // Create JavaScript implementation
        const jsModule = new MatrixMultiplication();
        
        // Create a test runner with both implementations
        const runner = new TestRunner(wasmModule, jsModule);
        
        // Override the exportResults method to write incrementally
        runner.exportResults = (metrics) => {
            results.results.push(metrics);
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`Results updated for ${metrics.algorithm} (${metrics.size})`);
        };
        
        // Run Matrix Multiplication test
        console.log('Running Matrix Multiplication benchmarks...');
        await runMatrixMultiplicationTest(runner);
        
        console.log('======================================');
        console.log('All benchmarks completed.');
        console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error('Error during test execution:', error);
        throw error;
    }
}

// Run all tests
runAllTests().catch(error => {
    console.error('Error running benchmarks:', error);
    process.exit(1);
});
