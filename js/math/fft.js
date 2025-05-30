/**
 * JavaScript FFT implementation for comparison with WebAssembly
 */
class FftImplementation {
    constructor() {}

    // Create a synthetic signal with known frequency components
    createSyntheticSignal(n) {
        if (n <= 0) return null;
        
        const signal = new Array(n * 2); // Real and imaginary parts interleaved
        
        // Generate synthetic signal with multiple frequency components
        for (let i = 0; i < n; i++) {
            const t = i / n;
            // Mix of sine waves at different frequencies
            const realPart = Math.sin(2.0 * Math.PI * 5.0 * t) +     // 5 Hz component
                           0.5 * Math.sin(2.0 * Math.PI * 10.0 * t) + // 10 Hz component
                           0.3 * Math.sin(2.0 * Math.PI * 20.0 * t);  // 20 Hz component
            
            signal[2 * i] = realPart;      // Real part
            signal[2 * i + 1] = 0.0;       // Imaginary part (initially zero)
        }
        
        return signal;
    }

    // Bit-reverse permutation for FFT
    bitReverse(data, n) {
        let j = 0;
        for (let i = 0; i < n; i++) {
            if (i < j) {
                // Swap real parts
                let temp = data[2 * i];
                data[2 * i] = data[2 * j];
                data[2 * j] = temp;
                
                // Swap imaginary parts
                temp = data[2 * i + 1];
                data[2 * i + 1] = data[2 * j + 1];
                data[2 * j + 1] = temp;
            }
            
            let k = Math.floor(n / 2);
            while (k > 0 && k <= j) {
                j -= k;
                k = Math.floor(k / 2);
            }
            j += k;
        }
    }

    // Fast Fourier Transform implementation
    computeFft(input, n) {
        if (!input || n <= 0 || (n & (n - 1)) !== 0) return null; // n must be power of 2
        
        // Copy input to output
        const output = [...input];
        
        // Bit-reverse permutation
        this.bitReverse(output, n);
        
        // FFT computation
        for (let length = 2; length <= n; length *= 2) {
            const angle = -2.0 * Math.PI / length;
            const wlenReal = Math.cos(angle);
            const wlenImag = Math.sin(angle);
            
            for (let i = 0; i < n; i += length) {
                let wReal = 1.0;
                let wImag = 0.0;
                
                for (let j = 0; j < length / 2; j++) {
                    const uIdx = i + j;
                    const vIdx = i + j + length / 2;
                    
                    const uReal = output[2 * uIdx];
                    const uImag = output[2 * uIdx + 1];
                    const vReal = output[2 * vIdx];
                    const vImag = output[2 * vIdx + 1];
                    
                    // Complex multiplication: v * w
                    const tempReal = vReal * wReal - vImag * wImag;
                    const tempImag = vReal * wImag + vImag * wReal;
                    
                    // Butterfly operation
                    output[2 * uIdx] = uReal + tempReal;
                    output[2 * uIdx + 1] = uImag + tempImag;
                    output[2 * vIdx] = uReal - tempReal;
                    output[2 * vIdx + 1] = uImag - tempImag;
                    
                    // Update twiddle factor
                    const nextWReal = wReal * wlenReal - wImag * wlenImag;
                    const nextWImag = wReal * wlenImag + wImag * wlenReal;
                    wReal = nextWReal;
                    wImag = nextWImag;
                }
            }
        }
        
        return output;
    }

    // Entry point function to run the FFT algorithm
    async runAlgorithm(size) {
        if (size <= 0 || (size & (size - 1)) !== 0) return null; // size must be power of 2
        
        // Create synthetic signal
        const signal = this.createSyntheticSignal(size);
        if (!signal) return null;
        
        // Compute FFT
        const result = this.computeFft(signal, size);
        if (!result) return null;
        
        // Return FFT result (same as WebAssembly)
        return result;
    }
}

module.exports = FftImplementation;
