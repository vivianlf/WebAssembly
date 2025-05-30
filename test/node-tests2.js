const fs = require('fs');
const path = require('path');
const { TestRunner } = require('./runner');

// Import the compiled WebAssembly modules
const FFTWasmModule = require('../build/node/fft.js');

/**
 * JavaScript FFT implementation for comparison
 */
class FFTImplementation {
    constructor() {}

    // Create a synthetic signal with known frequency components
    createSyntheticSignal(n) {
        if (n <= 0) return null;
        
        const signal = new Array(n * 2); // Real and imaginary parts
        
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
            while (k > 0 && k <= j) {  // Added k > 0 condition to prevent infinite loop
                j -= k;
                k = Math.floor(k / 2);
            }
            j += k;
        }
    }

    // Fast Fourier Transform implementation
    computeFFT(input, n) {
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
        const result = this.computeFFT(signal, size);
        
        // Return FFT result
        return result;
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
                // Use the simpler run_fft function that returns the complete FFT result
                const runFFT = wasmInstance.cwrap('run_fft', 'number', ['number']);
                const freeFFTData = wasmInstance.cwrap('free_fft_data', null, ['number']);
                
                // Run FFT (creates signal internally and computes FFT)
                const resultPtr = runFFT(size);
                if (!resultPtr) {
                    throw new Error('FFT computation failed');
                }
                
                // Convert result back to JavaScript array
                const fftResult = [];
                for (let i = 0; i < size * 2; i++) {
                    fftResult.push(wasmInstance.getValue(resultPtr + i * 8, 'double'));
                }
                
                // Free memory
                freeFFTData(resultPtr);
                
                return fftResult;
            } catch (error) {
                console.error('Error in WebAssembly FFT algorithm:', error);
                throw error;
            }
        }
    };
}

/**
 * FFT test
 * @param {TestRunner} runner - The test runner instance
 */
async function runFFTTest(runner) {
    // Create a JavaScript implementation
    const jsModule = new FFTImplementation();
    
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
        for (let i = 0; i < Math.min(wasmResult.length, 20); i++) { // Check first 20 elements
            const diff = Math.abs(wasmResult[i] - jsResult[i]);
            if (diff > tolerance) {
                discrepancies.push(`Mismatch at index ${i}: wasm=${wasmResult[i]}, js=${jsResult[i]}, diff=${diff}`);
            }
        }
        
        return { 
            success: discrepancies.length === 0, 
            discrepancies: discrepancies.slice(0, 5) // Limit to first 5 discrepancies
        };
    };
    
    // Define test sizes (must be powers of 2 for FFT)
    const sizes = {
        small: 256,     // 2^8 - as requested
        medium: 1024,   // 2^10 - as requested
        large: 4096     // 2^12 - as requested
    };
    
    // Run tests for each size
    for (const [sizeName, size] of Object.entries(sizes)) {
        console.log(`\nRunning ${sizeName} FFT test (${size} points)...`);
        await runner.runTest(
            'Fast Fourier Transform',
            'math',
            sizeName,
            size,
            10, // 10 iterations for proper benchmarking
            validator
        );
    }
}

/**
 * Main function to run all FFT benchmark tests
 */
async function runAllTests() {
    // Create results directory
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Create a timestamp for the results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = path.join(resultsDir, `node-fft-benchmark-${timestamp}.json`);
    
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
    
    console.log('Starting FFT WebAssembly vs JavaScript benchmarks...');
    console.log('Environment: Node.js');
    console.log('======================================');
    
    try {
        // Initialize WebAssembly module
        console.log('Initializing FFT WebAssembly module...');
        const wasmInstance = await (FFTWasmModule.default ? FFTWasmModule.default() : FFTWasmModule());
        
        // Wait for module to be ready
        if (wasmInstance.ready) {
            await wasmInstance.ready;
        }
        
        console.log('FFT WebAssembly module initialized successfully');
        console.log('Available functions:', Object.keys(wasmInstance).filter(key => key.startsWith('_')));
        console.log('cwrap available:', typeof wasmInstance.cwrap);
        console.log('ccall available:', typeof wasmInstance.ccall);
        
        // Create wrapped WebAssembly module
        const wasmModule = createWasmModule(wasmInstance);
        
        // Create JavaScript implementation
        const jsModule = new FFTImplementation();
        
        // Create a test runner with both implementations
        const runner = new TestRunner(wasmModule, jsModule);
        
        // Override the exportResults method to write incrementally
        runner.exportResults = (metrics) => {
            results.results.push(metrics);
            fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`Results updated for ${metrics.algorithm} (${metrics.size})`);
        };
        
        // Run FFT test
        console.log('Running FFT benchmarks...');
        await runFFTTest(runner);
        
        console.log('======================================');
        console.log('All FFT benchmarks completed.');
        console.log(`Results saved to: ${resultsFile}`);
    } catch (error) {
        console.error('Error during FFT test execution:', error);
        throw error;
    }
}

// Run all tests
runAllTests().catch(error => {
    console.error('Error running FFT benchmarks:', error);
    process.exit(1);
}); 