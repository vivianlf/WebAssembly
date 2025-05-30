#include <emscripten/emscripten.h>
#include <vector>
#include <cstdlib>
#include <ctime>

extern "C" {

// Create a matrix of size n×n filled with random values
EMSCRIPTEN_KEEPALIVE
double* create_random_matrix(int n) {
    if (n <= 0) return nullptr;
    
    double* matrix = (double*)malloc(n * n * sizeof(double));
    if (!matrix) return nullptr;
    
    for (int i = 0; i < n * n; i++) {
        matrix[i] = ((double)rand() / RAND_MAX) * 100.0;
    }
    
    return matrix;
}

// Matrix multiplication: C = A × B
EMSCRIPTEN_KEEPALIVE
double* multiply_matrices(double* A, double* B, int n) {
    if (!A || !B || n <= 0) return nullptr;
    
    double* C = (double*)malloc(n * n * sizeof(double));
    if (!C) return nullptr;
    
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            C[i * n + j] = 0;
            for (int k = 0; k < n; k++) {
                C[i * n + j] += A[i * n + k] * B[k * n + j];
            }
        }
    }
    
    return C;
}

// Free memory allocated for a matrix
EMSCRIPTEN_KEEPALIVE
void free_matrix(double* matrix) {
    if (matrix) {
        free(matrix);
    }
}

// Entry point function to run the algorithm
EMSCRIPTEN_KEEPALIVE
double* run_matrix_multiplication(int size) {
    if (size <= 0) return nullptr;
    
    // Seed the random number generator
    srand(time(NULL));
    
    // Create two random matrices
    double* A = create_random_matrix(size);
    if (!A) return nullptr;
    
    double* B = create_random_matrix(size);
    if (!B) {
        free_matrix(A);
        return nullptr;
    }
    
    // Multiply them
    double* C = multiply_matrices(A, B, size);
    
    // Free input matrices
    free_matrix(A);
    free_matrix(B);
    
    // Return result matrix
    return C;
}

// Calculate sum of all elements in matrix (for validation)
EMSCRIPTEN_KEEPALIVE
double sum_matrix_elements(double* matrix, int n) {
    if (!matrix || n <= 0) return 0.0;
    
    double sum = 0.0;
    for (int i = 0; i < n * n; i++) {
        sum += matrix[i];
    }
    
    return sum;
}

// Entry point function that returns a scalar value for benchmarking
EMSCRIPTEN_KEEPALIVE
double run_matrix_multiplication_test(int size) {
    if (size <= 0) return 0.0;
    
    // Run matrix multiplication
    double* result_matrix = run_matrix_multiplication(size);
    if (!result_matrix) return 0.0;
    
    // Calculate sum of all elements
    double sum = sum_matrix_elements(result_matrix, size);
    
    // Free the result matrix
    free_matrix(result_matrix);
    
    return sum;
}

// Alias for compatibility with different test files
EMSCRIPTEN_KEEPALIVE
double run_matrix_test(int size) {
    return run_matrix_multiplication_test(size);
}

} // extern "C"
