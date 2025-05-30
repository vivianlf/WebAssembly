#include <emscripten/emscripten.h>
#include <vector>
#include <cstdlib>
#include <cmath>
#include <complex>
#include <stdio.h>

extern "C" {

// Create a synthetic signal with known frequency components
EMSCRIPTEN_KEEPALIVE
double* create_synthetic_signal(int n) {
    if (n <= 0) return nullptr;
    
    // Allocate memory for real and imaginary parts (interleaved)
    double* signal = (double*)malloc(n * 2 * sizeof(double));
    if (!signal) return nullptr;
    
    // Generate synthetic signal with multiple frequency components
    for (int i = 0; i < n; i++) {
        double t = (double)i / n;
        // Mix of sine waves at different frequencies
        double real_part = sin(2.0 * M_PI * 5.0 * t) +     // 5 Hz component
                          0.5 * sin(2.0 * M_PI * 10.0 * t) + // 10 Hz component
                          0.3 * sin(2.0 * M_PI * 20.0 * t);  // 20 Hz component
        
        signal[2 * i] = real_part;      // Real part
        signal[2 * i + 1] = 0.0;        // Imaginary part (initially zero)
    }
    
    return signal;
}

// Bit-reverse permutation for FFT
void bit_reverse(double* data, int n) {
    int j = 0;
    for (int i = 0; i < n; i++) {
        if (i < j) {
            // Swap real parts
            double temp = data[2 * i];
            data[2 * i] = data[2 * j];
            data[2 * j] = temp;
            
            // Swap imaginary parts
            temp = data[2 * i + 1];
            data[2 * i + 1] = data[2 * j + 1];
            data[2 * j + 1] = temp;
        }
        
        int k = n / 2;
        while (k > 0 && k <= j) {
            j -= k;
            k /= 2;
        }
        j += k;
    }
}

// Fast Fourier Transform implementation
EMSCRIPTEN_KEEPALIVE
double* compute_fft(double* input, int n) {
    if (!input || n <= 0 || (n & (n - 1)) != 0) return nullptr; // n must be power of 2
    
    // Allocate output array
    double* output = (double*)malloc(n * 2 * sizeof(double));
    if (!output) return nullptr;
    
    // Copy input to output
    for (int i = 0; i < n * 2; i++) {
        output[i] = input[i];
    }
    
    // Bit-reverse permutation
    bit_reverse(output, n);
    
    // FFT computation
    for (int length = 2; length <= n; length *= 2) {
        double angle = -2.0 * M_PI / length;
        double wlen_real = cos(angle);
        double wlen_imag = sin(angle);
        
        for (int i = 0; i < n; i += length) {
            double w_real = 1.0;
            double w_imag = 0.0;
            
            for (int j = 0; j < length / 2; j++) {
                int u_idx = i + j;
                int v_idx = i + j + length / 2;
                
                double u_real = output[2 * u_idx];
                double u_imag = output[2 * u_idx + 1];
                double v_real = output[2 * v_idx];
                double v_imag = output[2 * v_idx + 1];
                
                // Complex multiplication: v * w
                double temp_real = v_real * w_real - v_imag * w_imag;
                double temp_imag = v_real * w_imag + v_imag * w_real;
                
                // Butterfly operation
                output[2 * u_idx] = u_real + temp_real;
                output[2 * u_idx + 1] = u_imag + temp_imag;
                output[2 * v_idx] = u_real - temp_real;
                output[2 * v_idx + 1] = u_imag - temp_imag;
                
                // Update twiddle factor
                double next_w_real = w_real * wlen_real - w_imag * wlen_imag;
                double next_w_imag = w_real * wlen_imag + w_imag * wlen_real;
                w_real = next_w_real;
                w_imag = next_w_imag;
            }
        }
    }
    
    return output;
}

// Free memory allocated for FFT data
EMSCRIPTEN_KEEPALIVE
void free_fft_data(double* data) {
    if (data) {
        free(data);
    }
}

// Entry point function to run the FFT algorithm
EMSCRIPTEN_KEEPALIVE
double* run_fft(int size) {
    if (size <= 0 || (size & (size - 1)) != 0) return nullptr; // size must be power of 2
    
    // Create synthetic signal
    double* signal = create_synthetic_signal(size);
    if (!signal) return nullptr;
    
    // Compute FFT
    double* result = compute_fft(signal, size);
    
    // Free input signal
    free_fft_data(signal);
    
    // Return FFT result
    return result;
}

// Entry point function to run the FFT algorithm and return statistics
EMSCRIPTEN_KEEPALIVE
double* run_fft_test(int size) {
    if (size <= 0 || (size & (size - 1)) != 0) return nullptr; // size must be power of 2
    
    // Create synthetic signal
    double* signal = create_synthetic_signal(size);
    if (!signal) return nullptr;
    
    // Compute FFT
    double* fft_result = compute_fft(signal, size);
    if (!fft_result) {
        free_fft_data(signal);
        return nullptr;
    }
    
    // Calculate statistics for comparison
    double max_magnitude = 0.0;
    double total_energy = 0.0;
    int peak_frequency = 0;
    
    for (int i = 0; i < size; i++) {
        double real = fft_result[2 * i];
        double imag = fft_result[2 * i + 1];
        double magnitude = sqrt(real * real + imag * imag);
        
        total_energy += magnitude * magnitude;
        
        if (magnitude > max_magnitude) {
            max_magnitude = magnitude;
            peak_frequency = i;
        }
    }
    
    double avg_energy = total_energy / size;
    
    // Allocate memory for results: [max_magnitude, total_energy, avg_energy, peak_frequency]
    double* results = (double*)malloc(4 * sizeof(double));
    if (!results) {
        free_fft_data(signal);
        free_fft_data(fft_result);
        return nullptr;
    }
    
    results[0] = max_magnitude;
    results[1] = total_energy;
    results[2] = avg_energy;
    results[3] = (double)peak_frequency;
    
    // Free intermediate results
    free_fft_data(signal);
    free_fft_data(fft_result);
    
    return results;
}

} // extern "C"

