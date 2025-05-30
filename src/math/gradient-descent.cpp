#include <emscripten/emscripten.h>
#include <cmath>
#include <cstdlib>
#include <vector>

extern "C" {

// Rosenbrock function: f(x) = sum(100*(x[i+1] - x[i]^2)^2 + (1 - x[i])^2)
// Global minimum at x[i] = 1 for all i, with f(x) = 0
double rosenbrock_function(const double* x, int n) {
    double sum = 0.0;
    for (int i = 0; i < n - 1; i++) {
        double term1 = x[i + 1] - x[i] * x[i];
        double term2 = 1.0 - x[i];
        sum += 100.0 * term1 * term1 + term2 * term2;
    }
    return sum;
}

// Gradient of Rosenbrock function
void rosenbrock_gradient(const double* x, double* grad, int n) {
    // Initialize gradient to zero
    for (int i = 0; i < n; i++) {
        grad[i] = 0.0;
    }
    
    // Compute gradient components
    for (int i = 0; i < n - 1; i++) {
        double xi = x[i];
        double xi_plus_1 = x[i + 1];
        
        // Gradient w.r.t. x[i]
        grad[i] += -400.0 * xi * (xi_plus_1 - xi * xi) - 2.0 * (1.0 - xi);
        
        // Gradient w.r.t. x[i+1]
        grad[i + 1] += 200.0 * (xi_plus_1 - xi * xi);
    }
}

// Initialize parameters with random values around 0
void initialize_parameters(double* x, int n) {
    // Use fixed seed for deterministic behavior (same as JavaScript)
    srand(12345);
    
    for (int i = 0; i < n; i++) {
        // Initialize with small random values around 0
        x[i] = ((double)rand() / RAND_MAX - 0.5) * 2.0; // Range [-1, 1]
    }
}

// Gradient descent optimization
EMSCRIPTEN_KEEPALIVE
double* gradient_descent(int n_params, int n_iterations, double learning_rate) {
    if (n_params <= 1 || n_iterations <= 0) return nullptr;
    
    // Allocate memory for parameters and gradient
    double* x = (double*)malloc(n_params * sizeof(double));
    double* grad = (double*)malloc(n_params * sizeof(double));
    if (!x || !grad) {
        if (x) free(x);
        if (grad) free(grad);
        return nullptr;
    }
    
    // Initialize parameters
    initialize_parameters(x, n_params);
    
    // Gradient descent iterations
    for (int iter = 0; iter < n_iterations; iter++) {
        // Compute gradient
        rosenbrock_gradient(x, grad, n_params);
        
        // Update parameters: x = x - learning_rate * gradient
        for (int i = 0; i < n_params; i++) {
            x[i] -= learning_rate * grad[i];
        }
    }
    
    // Free gradient memory
    free(grad);
    
    // Return optimized parameters
    return x;
}

// Evaluate Rosenbrock function at given point
EMSCRIPTEN_KEEPALIVE
double evaluate_rosenbrock(const double* x, int n) {
    return rosenbrock_function(x, n);
}

// Run complete gradient descent optimization and return results
EMSCRIPTEN_KEEPALIVE
double* run_gradient_descent(int n_params, int n_iterations) {
    if (n_params <= 1 || n_iterations <= 0) return nullptr;
    
    // Use adaptive learning rate based on problem size
    double learning_rate = 0.001 / sqrt(n_params);
    
    // Allocate memory for results: [final_cost, convergence_rate, avg_param_value, param1, param2, ..., paramN]
    double* results = (double*)malloc((n_params + 3) * sizeof(double));
    if (!results) return nullptr;
    
    // Run gradient descent
    double* optimized_params = gradient_descent(n_params, n_iterations, learning_rate);
    if (!optimized_params) {
        free(results);
        return nullptr;
    }
    
    // Compute final cost
    double final_cost = rosenbrock_function(optimized_params, n_params);
    
    // Compute average parameter value (should be close to 1.0 for good convergence)
    double avg_param = 0.0;
    for (int i = 0; i < n_params; i++) {
        avg_param += optimized_params[i];
    }
    avg_param /= n_params;
    
    // Compute convergence rate (how close we are to the optimal solution)
    double convergence_rate = 1.0 / (1.0 + final_cost); // Range [0, 1], 1 = perfect convergence
    
    // Store results
    results[0] = final_cost;
    results[1] = convergence_rate;
    results[2] = avg_param;
    
    // Store optimized parameters
    for (int i = 0; i < n_params; i++) {
        results[i + 3] = optimized_params[i];
    }
    
    // Free optimized parameters
    free(optimized_params);
    
    return results;
}

// Free memory allocated for gradient descent results
EMSCRIPTEN_KEEPALIVE
void free_gradient_descent_data(double* data) {
    if (data) {
        free(data);
    }
}

// Get the theoretical minimum value (always 0 for Rosenbrock)
EMSCRIPTEN_KEEPALIVE
double get_theoretical_minimum() {
    return 0.0;
}

// Get the theoretical optimal parameters (always 1.0 for all parameters in Rosenbrock)
EMSCRIPTEN_KEEPALIVE
double get_theoretical_optimal_param() {
    return 1.0;
}

// Entry point function to run the gradient descent test and return statistics
EMSCRIPTEN_KEEPALIVE
double* run_gradient_descent_test(int n_iterations, int n_params) {
    if (n_params <= 1 || n_iterations <= 0) return nullptr;
    
    // Use adaptive learning rate based on problem size
    double learning_rate = 0.001 / sqrt(n_params);
    
    // Run gradient descent
    double* optimized_params = gradient_descent(n_params, n_iterations, learning_rate);
    if (!optimized_params) return nullptr;
    
    // Compute final cost
    double final_cost = rosenbrock_function(optimized_params, n_params);
    
    // Compute average parameter value (should be close to 1.0 for good convergence)
    double avg_param = 0.0;
    for (int i = 0; i < n_params; i++) {
        avg_param += optimized_params[i];
    }
    avg_param /= n_params;
    
    // Compute convergence rate (how close we are to the optimal solution)
    double convergence_rate = 1.0 / (1.0 + final_cost); // Range [0, 1], 1 = perfect convergence
    
    // Allocate memory for results: [final_cost, convergence_rate, avg_param, first_param]
    double* results = (double*)malloc(4 * sizeof(double));
    if (!results) {
        free(optimized_params);
        return nullptr;
    }
    
    results[0] = final_cost;
    results[1] = convergence_rate;
    results[2] = avg_param;
    results[3] = optimized_params[0];
    
    // Free optimized parameters
    free(optimized_params);
    
    return results;
}

} // extern "C"
