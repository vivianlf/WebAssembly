/**
 * JavaScript Gradient Descent implementation for comparison with WebAssembly
 */
class GradientDescentImplementation {
    constructor() {
        // Simple Linear Congruential Generator for deterministic random numbers
        this.seed = 12345; // Fixed seed for reproducibility
    }

    // Simple pseudo-random number generator (same as C rand() with fixed seed)
    random() {
        this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
        return this.seed / 0x7fffffff;
    }

    // Reset seed for each test
    resetSeed() {
        this.seed = 12345;
    }

    // Rosenbrock function: f(x) = sum(100*(x[i+1] - x[i]^2)^2 + (1 - x[i])^2)
    // Global minimum at x[i] = 1 for all i, with f(x) = 0
    rosenbrockFunction(x, n) {
        let sum = 0.0;
        for (let i = 0; i < n - 1; i++) {
            const term1 = x[i + 1] - x[i] * x[i];
            const term2 = 1.0 - x[i];
            sum += 100.0 * term1 * term1 + term2 * term2;
        }
        return sum;
    }

    // Gradient of Rosenbrock function
    rosenbrockGradient(x, n) {
        const grad = new Array(n).fill(0.0);
        
        // Compute gradient components
        for (let i = 0; i < n - 1; i++) {
            const xi = x[i];
            const xiPlus1 = x[i + 1];
            
            // Gradient w.r.t. x[i]
            grad[i] += -400.0 * xi * (xiPlus1 - xi * xi) - 2.0 * (1.0 - xi);
            
            // Gradient w.r.t. x[i+1]
            grad[i + 1] += 200.0 * (xiPlus1 - xi * xi);
        }
        
        return grad;
    }

    // Initialize parameters with random values around 0 (deterministic)
    initializeParameters(n) {
        const x = new Array(n);
        for (let i = 0; i < n; i++) {
            // Initialize with small random values around 0 (same as C++ version)
            x[i] = (this.random() - 0.5) * 2.0; // Range [-1, 1]
        }
        return x;
    }

    // Gradient descent optimization
    gradientDescent(nParams, nIterations, learningRate) {
        if (nParams <= 1 || nIterations <= 0) return null;
        
        // Reset seed for deterministic behavior
        this.resetSeed();
        
        // Initialize parameters
        const x = this.initializeParameters(nParams);
        
        // Gradient descent iterations
        for (let iter = 0; iter < nIterations; iter++) {
            // Compute gradient
            const grad = this.rosenbrockGradient(x, nParams);
            
            // Update parameters: x = x - learning_rate * gradient
            for (let i = 0; i < nParams; i++) {
                x[i] -= learningRate * grad[i];
            }
        }
        
        return x;
    }

    // Run complete gradient descent optimization and return results
    async runAlgorithm(config) {
        const { iterations: nIterations, parameters: nParams } = config;
        
        if (nParams <= 1 || nIterations <= 0) return null;
        
        // Use adaptive learning rate based on problem size
        const learningRate = 0.001 / Math.sqrt(nParams);
        
        // Run gradient descent
        const optimizedParams = this.gradientDescent(nParams, nIterations, learningRate);
        if (!optimizedParams) return null;
        
        // Compute final cost
        const finalCost = this.rosenbrockFunction(optimizedParams, nParams);
        
        // Compute average parameter value (should be close to 1.0 for good convergence)
        let avgParam = 0.0;
        for (let i = 0; i < nParams; i++) {
            avgParam += optimizedParams[i];
        }
        avgParam /= nParams;
        
        // Compute convergence rate (how close we are to the optimal solution)
        const convergenceRate = 1.0 / (1.0 + finalCost); // Range [0, 1], 1 = perfect convergence
        
        // Return results: [final_cost, convergence_rate, avg_param, first_param]
        return [finalCost, convergenceRate, avgParam, optimizedParams[0]];
    }

    // Get the theoretical minimum value (always 0 for Rosenbrock)
    getTheoreticalMinimum() {
        return 0.0;
    }

    // Get the theoretical optimal parameters (always 1.0 for all parameters in Rosenbrock)
    getTheoreticalOptimalParam() {
        return 1.0;
    }
}

module.exports = GradientDescentImplementation;
