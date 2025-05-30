/**
 * JavaScript Numeric Integration implementation for comparison with WebAssembly
 */
class NumericIntegrationImplementation {
    constructor() {}

    // Function to integrate: f(x) = x^2 + 2*x + 1 = (x+1)^2
    // Analytical solution: ∫(x+1)^2 dx = (x+1)^3/3
    // From 0 to 1: (2)^3/3 - (1)^3/3 = 8/3 - 1/3 = 7/3 ≈ 2.333333
    testFunction(x) {
        return x * x + 2.0 * x + 1.0; // (x+1)^2
    }

    // Analytical solution for comparison
    analyticalSolution(a, b) {
        // ∫(x+1)^2 dx from a to b = [(b+1)^3 - (a+1)^3]/3
        const upper = (b + 1.0) * (b + 1.0) * (b + 1.0);
        const lower = (a + 1.0) * (a + 1.0) * (a + 1.0);
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

    // Main integration function that runs both methods and returns results
    async runAlgorithm(n) {
        if (n <= 0) return null;
        
        // Integration bounds: from 0 to 1
        const a = 0.0;
        const b = 1.0;
        
        // Compute numerical integrations
        const trapezoidalResult = this.trapezoidalIntegration(a, b, n);
        
        // For Simpson's rule, ensure n is even
        const simpsonN = (n % 2 === 0) ? n : n - 1;
        const simpsonResult = this.simpsonIntegration(a, b, simpsonN);
        
        // Analytical solution
        const analyticalResult = this.analyticalSolution(a, b);
        
        // Compute errors
        const trapezoidalError = Math.abs(trapezoidalResult - analyticalResult);
        const simpsonError = Math.abs(simpsonResult - analyticalResult);
        
        // Return results: [trapezoidal, simpson, analytical, trapezoidal_error]
        return [trapezoidalResult, simpsonResult, analyticalResult, trapezoidalError];
    }
}

module.exports = NumericIntegrationImplementation;
