const fs = require('fs');
const path = require('path');
const { TestRunner } = require('./runner');

// Import the compiled WebAssembly modules
const IntegrationWasmModule = require('../build/node/numeric-integration.js');

/**
 * JavaScript Numeric Integration implementation for comparison
 */
class IntegrationImplementation {
    constructor() {}

    // Function to integrate: f(x) = x^2 + 2*x + 1 = (x+1)^2
    testFunction(x) {
        return x * x + 2.0 * x + 1.0; // (x+1)^2
    }

    // Analytical solution for comparison
    analyticalSolution(a, b) {
        // ∫(x+1)^2 dx from a to b = [(b+1)^3 - (a+1)^3]/3
        const upper = Math.pow(b + 1.0, 3);
        const lower = Math.pow(a + 1.0, 3);
        return (upper - lower) / 3.0;
    }

    // Trapezoidal rule for numerical integration
    trapezoidalIntegration(a, b, n) {
        if (n <= 0) return 0.0;
        
        const h = (b - a) / n;
        let sum = 0.5 * (this.testFunction(a) + this.testFunction(b));
        
        for (let i = 1; i < n; i++) {
            const x = a + i * h;
            sum += this.testFunction(x);
        }
        
        return sum * h;
    }

    // Simpson's rule for numerical integration (more accurate)
    simpsonIntegration(a, b, n) {
        if (n <= 0 || n % 2 !== 0) return 0.0; // n must be even for Simpson's rule
        
        const h = (b - a) / n;
        let sum = this.testFunction(a) + this.testFunction(b);
        
        // Add odd-indexed terms (coefficient 4)
        for (let i = 1; i < n; i += 2) {
            const x = a + i * h;
            sum += 4.0 * this.testFunction(x);
        }
        
        // Add even-indexed terms (coefficient 2)
        for (let i = 2; i < n; i += 2) {
            const x = a + i * h;
            sum += 2.0 * this.testFunction(x);
        }
        
        return sum * h / 3.0;
    }

    // Entry point function to run the integration algorithm
    async runAlgorithm(size) {
        if (size <= 0) return null;
        
        // Integration bounds: from 0 to 1
        const a = 0.0;
        const b = 1.0;
        
        // Compute numerical integrations
        const trapezoidalResult = this.trapezoidalIntegration(a, b, size);
        
        // For Simpson's rule, ensure n is even
        const simpsonN = (size % 2 === 0) ? size : size - 1;
        const simpsonResult = this.simpsonIntegration(a, b, simpsonN);
        
        // Analytical solution
        const analyticalResult = this.analyticalSolution(a, b);
        
        // Compute errors
        const trapezoidalError = Math.abs(trapezoidalResult - analyticalResult);
        const simpsonError = Math.abs(simpsonResult - analyticalResult);
        
        // Return results: [trapezoidal, simpson, analytical, trapezoidal_error, simpson_error]
        return [trapezoidalResult, simpsonResult, analyticalResult, trapezoidalError, simpsonError];
    }
}

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
                const runIntegration = wasmInstance.cwrap('run_integration', 'number', ['number']);
                const freeIntegrationData = wasmInstance.cwrap('free_integration_data', null, ['number']);
                
                // Run integration
                const resultPtr = runIntegration(size);
                if (!resultPtr) {
                    throw new Error('Integration computation failed');
                }
                
                // Convert result back to JavaScript array
                const integrationResult = [];
                for (let i = 0; i < 5; i++) {
                    integrationResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                }
                
                // Free memory
                freeIntegrationData(resultPtr);
                
                return integrationResult;
            } catch (error) {
                console.error('Error in WebAssembly Integration algorithm:', error);
                throw error;
            }
        }
    };
}

/**
 * Numeric Integration test
 * @param {TestRunner} runner - The test runner instance
 */
async function runIntegrationTest(runner) {
    // Create a JavaScript implementation
    const jsModule = new IntegrationImplementation();
    
    // Create a validator function that checks if we got a result
    const validator = (wasmResult, jsResult) => {
        if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
            return { success: false, discrepancies: ['Results are not arrays'] };
        }
        if (wasmResult.length !== jsResult.length) {
            return { success: false, discrepancies: ['Array lengths do not match'] };
        }
        
        // Check if results are reasonably close (allowing for floating point differences)
        const tolerance = 1e-10;
        let discrepancies = [];
        
        // Check trapezoidal result
        const trapDiff = Math.abs(wasmResult[0] - jsResult[0]);
        if (trapDiff > tolerance) {
            discrepancies.push(`Trapezoidal mismatch: wasm=${wasmResult[0]}, js=${jsResult[0]}, diff=${trapDiff}`);
        }
        
        // Check Simpson result
        const simpDiff = Math.abs(wasmResult[1] - jsResult[1]);
        if (simpDiff > tolerance) {
            discrepancies.push(`Simpson mismatch: wasm=${wasmResult[1]}, js=${jsResult[1]}, diff=${simpDiff}`);
        }
        
        // Check analytical solution (should be identical)
        const analDiff = Math.abs(wasmResult[2] - jsResult[2]);
        if (analDiff > tolerance) {
            discrepancies.push(`Analytical mismatch: wasm=${wasmResult[2]}, js=${jsResult[2]}, diff=${analDiff}`);
        }
        
        return { 
            success: discrepancies.length === 0, 
            discrepancies: discrepancies.slice(0, 5) // Limit to first 5 discrepancies
        };
    };
    
    // Define test sizes as specified in the requirements
    const sizes = {
        small: 1000,     // 1000 points
        medium: 10000,   // 10000 points
        large: 100000    // 100000 points
    };
    
    // Run tests for each size
    for (const [sizeName, size] of Object.entries(sizes)) {
        console.log(`\nRunning ${sizeName} Integration test (${size} points)...`);
        await runner.runTest(
            'Numeric Integration',
            'math',
            sizeName,
            size,
            10, // 10 iterations for proper benchmarking
            validator
        );
    }
}

/**
 * Main function to run all Integration benchmark tests
 */
async function runAllTests() {
    // Create results directory
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a timestamp for the results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `node-integration-benchmark-${timestamp}.json`);
    
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
    
    console.log('Starting Numeric Integration WebAssembly vs JavaScript benchmarks...');
    console.log('Environment: Node.js');
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log('Initializing Numeric Integration WebAssembly module...');
        const wasmInstance = await (IntegrationWasmModule.default ? IntegrationWasmModule.default() : IntegrationWasmModule());
        
        // Wait for module to be ready
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log('Numeric Integration WebAssembly module initialized successfully');
        console.log('Available functions:', Object.keys(wasmInstance).filter(key => key.startsWith('_')));
        console.log('cwrap available:', typeof wasmInstance.cwrap);
        console.log('ccall available:', typeof wasmInstance.ccall);
        console.log('getValue available:', typeof wasmInstance.getValue);
        
        // Create wrapped WebAssembly module
        const wasmModule = createWasmModule(wasmInstance);
        
        // Create JavaScript implementation
        const jsModule = new IntegrationImplementation();
        
        // Create a test runner with both implementations
        const runner = new TestRunner(wasmModule, jsModule);
        
        // Override the exportResults method to write incrementally
        runner.exportResults = (metrics) => {
            results.results.push(metrics);
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`Results updated for ${metrics.algorithm} (${metrics.size})`);
        };
        
        // Run Integration test
        console.log('Running Numeric Integration benchmarks...');
        await runIntegrationTest(runner);
        
        console.log('======================================');
        console.log('All Numeric Integration benchmarks completed.');
        console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error('Error during Integration test execution:', error);
        throw error;
    }
}

// Run all tests
runAllTests().catch(error => {
    console.error('Error running Integration benchmarks:', error);
    process.exit(1);
}); 