const fs = require('fs');
const path = require('path');
const { TestRunner } = require('./runner');

// Import the compiled WebAssembly modules
const GradientDescentWasmModule = require('../build/node/gradient-descent.js');

/**
 * JavaScript Gradient Descent implementation for comparison
 */
class GradientDescentImplementation {
    constructor() {}

    // Rosenbrock function: f(x) = sum(100*(x[i+1] - x[i]^2)^2 + (1 - x[i])^2)
    rosenbrockFunction(x) {
        let sum = 0.0;
        for (let i = 0; i < x.length - 1; i++) {
            const term1 = x[i + 1] - x[i] * x[i];
            const term2 = 1.0 - x[i];
            sum += 100.0 * term1 * term1 + term2 * term2;
        }
        return sum;
    }

    // Gradient of Rosenbrock function
    rosenbrockGradient(x) {
        const n = x.length;
        const grad = new Array(n).fill(0.0);
        
        // Compute gradient components
        for (let i = 0; i < n - 1; i++) {
            const xi = x[i];
            const xi_plus_1 = x[i + 1];
            
            // Gradient w.r.t. x[i]
            grad[i] += -400.0 * xi * (xi_plus_1 - xi * xi) - 2.0 * (1.0 - xi);
            
            // Gradient w.r.t. x[i+1]
            grad[i + 1] += 200.0 * (xi_plus_1 - xi * xi);
        }
        
        return grad;
    }

    // Initialize parameters with random values around 0
    initializeParameters(n) {
        const x = new Array(n);
        for (let i = 0; i < n; i++) {
            // Initialize with small random values around 0
            x[i] = (Math.random() - 0.5) * 2.0; // Range [-1, 1]
        }
        return x;
    }

    // Gradient descent optimization
    gradientDescent(nParams, nIterations, learningRate) {
        if (nParams <= 1 || nIterations <= 0) return null;
        
        // Initialize parameters
        const x = this.initializeParameters(nParams);
        
        // Gradient descent iterations
        for (let iter = 0; iter < nIterations; iter++) {
            // Compute gradient
            const grad = this.rosenbrockGradient(x);
            
            // Update parameters: x = x - learning_rate * gradient
            for (let i = 0; i < nParams; i++) {
                x[i] -= learningRate * grad[i];
            }
        }
        
        return x;
    }

    // Entry point function to run the gradient descent algorithm
    async runAlgorithm(config) {
        const { nParams, nIterations } = config;
        if (nParams <= 1 || nIterations <= 0) return null;
        
        // Use adaptive learning rate based on problem size
        const learningRate = 0.001 / Math.sqrt(nParams);
        
        // Run gradient descent
        const optimizedParams = this.gradientDescent(nParams, nIterations, learningRate);
        if (!optimizedParams) return null;
        
        // Compute final cost
        const finalCost = this.rosenbrockFunction(optimizedParams);
        
        // Compute average parameter value (should be close to 1.0 for good convergence)
        const avgParam = optimizedParams.reduce((sum, param) => sum + param, 0) / nParams;
        
        // Compute convergence rate (how close we are to the optimal solution)
        const convergenceRate = 1.0 / (1.0 + finalCost); // Range [0, 1], 1 = perfect convergence
        
        // Return results: [final_cost, convergence_rate, avg_param_value, param1, param2, ..., paramN]
        return [finalCost, convergenceRate, avgParam, ...optimizedParams];
    }
}

/**
 * Create a WebAssembly module wrapper
 * @param {Object} wasmInstance - The WebAssembly instance
 * @returns {Object} Wrapped module with runAlgorithm function
 */
function createWasmModule(wasmInstance) {
    return {
        runAlgorithm: async (config) => {
            try {
                const { nParams, nIterations } = config;
                
                // Use cwrap to create a JavaScript callable function
                const runGradientDescent = wasmInstance.cwrap('run_gradient_descent', 'number', ['number', 'number']);
                const freeGradientDescentData = wasmInstance.cwrap('free_gradient_descent_data', null, ['number']);
                
                // Run gradient descent
                const resultPtr = runGradientDescent(nParams, nIterations);
                if (!resultPtr) {
                    throw new Error('Gradient descent computation failed');
                }
                
                // Convert result back to JavaScript array
                const gradientDescentResult = [];
                const resultSize = nParams + 3; // [final_cost, convergence_rate, avg_param_value, param1, param2, ..., paramN]
                for (let i = 0; i < resultSize; i++) {
                    gradientDescentResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                }
                
                // Free memory
                freeGradientDescentData(resultPtr);
                
                return gradientDescentResult;
            } catch (error) {
                console.error('Error in WebAssembly Gradient Descent algorithm:', error);
                throw error;
            }
        }
    };
}

/**
 * Gradient Descent test
 * @param {TestRunner} runner - The test runner instance
 */
async function runGradientDescentTest(runner) {
    // Create a JavaScript implementation
    const jsModule = new GradientDescentImplementation();
    
    // Create a validator function that checks if we got a result
    const validator = (wasmResult, jsResult) => {
        if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
            return { success: false, discrepancies: ['Results are not arrays'] };
        }
        if (wasmResult.length !== jsResult.length) {
            return { success: false, discrepancies: ['Array lengths do not match'] };
        }
        
        // Check if results are reasonably close (allowing for floating point differences and randomness)
        const tolerance = 1e-1; // More relaxed tolerance due to random initialization
        let discrepancies = [];
        
        // Check final cost (both should be reasonably low)
        const wasmCost = wasmResult[0];
        const jsCost = jsResult[0];
        if (wasmCost > 1000 || jsCost > 1000) {
            discrepancies.push(`High cost values: wasm=${wasmCost}, js=${jsCost}`);
        }
        
        // Check convergence rate (both should be reasonable)
        const wasmConvergence = wasmResult[1];
        const jsConvergence = jsResult[1];
        if (wasmConvergence < 0.001 || jsConvergence < 0.001) {
            discrepancies.push(`Poor convergence: wasm=${wasmConvergence}, js=${jsConvergence}`);
        }
        
        // Check average parameter (should be moving towards 1.0)
        const wasmAvgParam = wasmResult[2];
        const jsAvgParam = jsResult[2];
        if (Math.abs(wasmAvgParam) > 10 || Math.abs(jsAvgParam) > 10) {
            discrepancies.push(`Parameters diverged: wasm_avg=${wasmAvgParam}, js_avg=${jsAvgParam}`);
        }
        
        return { 
            success: discrepancies.length === 0, 
            discrepancies: discrepancies.slice(0, 5) // Limit to first 5 discrepancies
        };
    };
    
    // Define test configurations as specified in the requirements
    const configs = {
        small: { nParams: 10, nIterations: 100 },      // 100 iterations, 10 parameters
        medium: { nParams: 100, nIterations: 1000 },   // 1000 iterations, 100 parameters
        large: { nParams: 1000, nIterations: 10000 }   // 10000 iterations, 1000 parameters
    };
    
    // Run tests for each configuration
    for (const [sizeName, config] of Object.entries(configs)) {
        console.log(`\nRunning ${sizeName} Gradient Descent test (${config.nIterations} iterations, ${config.nParams} parameters)...`);
        await runner.runTest(
            'Gradient Descent',
            'optimization',
            sizeName,
            config,
            10, // 10 iterations for proper benchmarking
            validator
        );
    }
}

/**
 * Main function to run all Gradient Descent benchmark tests
 */
async function runAllTests() {
    // Create results directory
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a timestamp for the results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `node-gradient-descent-benchmark-${timestamp}.json`);
    
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
    
    console.log('Starting Gradient Descent WebAssembly vs JavaScript benchmarks...');
    console.log('Environment: Node.js');
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log('Initializing Gradient Descent WebAssembly module...');
        const wasmInstance = await (GradientDescentWasmModule.default ? GradientDescentWasmModule.default() : GradientDescentWasmModule());
        
        // Wait for module to be ready
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log('Gradient Descent WebAssembly module initialized successfully');
        console.log('Available functions:', Object.keys(wasmInstance).filter(key => key.startsWith('_')));
        console.log('cwrap available:', typeof wasmInstance.cwrap);
        console.log('ccall available:', typeof wasmInstance.ccall);
        console.log('getValue available:', typeof wasmInstance.getValue);
        
        // Create wrapped WebAssembly module
        const wasmModule = createWasmModule(wasmInstance);
        
        // Create JavaScript implementation
        const jsModule = new GradientDescentImplementation();
        
        // Create a test runner with both implementations
        const runner = new TestRunner(wasmModule, jsModule);
        
        // Override the exportResults method to write incrementally
        runner.exportResults = (metrics) => {
            results.results.push(metrics);
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`Results updated for ${metrics.algorithm} (${metrics.size})`);
        };
        
        // Run Gradient Descent test
        console.log('Running Gradient Descent benchmarks...');
        await runGradientDescentTest(runner);
        
        console.log('======================================');
        console.log('All Gradient Descent benchmarks completed.');
        console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error('Error during Gradient Descent test execution:', error);
        throw error;
    }
}

// Run all tests
runAllTests().catch(error => {
    console.error('Error running Gradient Descent benchmarks:', error);
    process.exit(1);
}); 