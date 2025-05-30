#include <emscripten/emscripten.h>
#include <cmath>
#include <cstdlib>

extern "C" {

// Function to integrate: f(x) = x^2 + 2*x + 1 = (x+1)^2
// Analytical solution: ∫(x+1)^2 dx = (x+1)^3/3
// From 0 to 1: (2)^3/3 - (1)^3/3 = 8/3 - 1/3 = 7/3 ≈ 2.333333
double test_function(double x) {
    return x * x + 2.0 * x + 1.0; // (x+1)^2
}

// Analytical solution for comparison
double analytical_solution(double a, double b) {
    // ∫(x+1)^2 dx from a to b = [(b+1)^3 - (a+1)^3]/3
    double upper = (b + 1.0) * (b + 1.0) * (b + 1.0);
    double lower = (a + 1.0) * (a + 1.0) * (a + 1.0);
    return (upper - lower) / 3.0;
}

// Trapezoidal rule for numerical integration
EMSCRIPTEN_KEEPALIVE
double trapezoidal_integration(double a, double b, int n) {
    if (n <= 0) return 0.0;
    
    double h = (b - a) / n;
    double sum = 0.5 * (test_function(a) + test_function(b));
    
    for (int i = 1; i < n; i++) {
        double x = a + i * h;
        sum += test_function(x);
    }
    
    return sum * h;
}

// Simpson's rule for numerical integration (more accurate)
EMSCRIPTEN_KEEPALIVE
double simpson_integration(double a, double b, int n) {
    if (n <= 0 || n % 2 != 0) return 0.0; // n must be even for Simpson's rule
    
    double h = (b - a) / n;
    double sum = test_function(a) + test_function(b);
    
    // Add odd-indexed terms (coefficient 4)
    for (int i = 1; i < n; i += 2) {
        double x = a + i * h;
        sum += 4.0 * test_function(x);
    }
    
    // Add even-indexed terms (coefficient 2)
    for (int i = 2; i < n; i += 2) {
        double x = a + i * h;
        sum += 2.0 * test_function(x);
    }
    
    return sum * h / 3.0;
}

// Get the analytical solution for comparison
EMSCRIPTEN_KEEPALIVE
double get_analytical_solution(double a, double b) {
    return analytical_solution(a, b);
}

// Main integration function that runs both methods and returns results
EMSCRIPTEN_KEEPALIVE
double* run_integration(int n) {
    if (n <= 0) return nullptr;
    
    // Integration bounds: from 0 to 1
    double a = 0.0;
    double b = 1.0;
    
    // Allocate memory for results: [trapezoidal, simpson, analytical, trapezoidal_error, simpson_error]
    double* results = (double*)malloc(5 * sizeof(double));
    if (!results) return nullptr;
    
    // Compute numerical integrations
    results[0] = trapezoidal_integration(a, b, n);
    
    // For Simpson's rule, ensure n is even
    int simpson_n = (n % 2 == 0) ? n : n - 1;
    results[1] = simpson_integration(a, b, simpson_n);
    
    // Analytical solution
    results[2] = analytical_solution(a, b);
    
    // Compute errors
    results[3] = fabs(results[0] - results[2]); // Trapezoidal error
    results[4] = fabs(results[1] - results[2]); // Simpson error
    
    return results;
}

// Free memory allocated for integration results
EMSCRIPTEN_KEEPALIVE
void free_integration_data(double* data) {
    if (data) {
        free(data);
    }
}

// Entry point function to run the integration test and return statistics
EMSCRIPTEN_KEEPALIVE
double* run_integration_test(int n) {
    if (n <= 0) return nullptr;
    
    // Integration bounds: from 0 to 1
    double a = 0.0;
    double b = 1.0;
    
    // Compute numerical integrations
    double trapezoidal_result = trapezoidal_integration(a, b, n);
    
    // For Simpson's rule, ensure n is even
    int simpson_n = (n % 2 == 0) ? n : n - 1;
    double simpson_result = simpson_integration(a, b, simpson_n);
    
    // Analytical solution
    double analytical_result = analytical_solution(a, b);
    
    // Compute errors
    double trapezoidal_error = fabs(trapezoidal_result - analytical_result);
    
    // Allocate memory for results: [trapezoidal, simpson, analytical, trapezoidal_error]
    double* results = (double*)malloc(4 * sizeof(double));
    if (!results) return nullptr;
    
    results[0] = trapezoidal_result;
    results[1] = simpson_result;
    results[2] = analytical_result;
    results[3] = trapezoidal_error;
    
    return results;
}

} // extern "C"
