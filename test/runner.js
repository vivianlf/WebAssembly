class TestRunner {
  constructor(wasmModule, jsImplementation) {
    this.wasm = wasmModule;
    this.js = jsImplementation;
    this.results = [];
  }

  /**
   * Run a benchmark test comparing WebAssembly vs JavaScript
   * @param {string} algorithmName - The name of the algorithm being tested
   * @param {string} algorithmType - "math" or "string"
   * @param {string} size - "small", "medium", or "large"
   * @param {any} testData - The input data for the algorithm
   * @param {number} iterations - Number of test iterations (default: 10)
   * @param {Function} validator - Function to validate results between implementations
   * @returns {Object} Test metrics
   */
  async runTest(algorithmName, algorithmType, size, testData, iterations = 10, validator = null) {
    const metrics = {
      algorithm: algorithmName,
      type: algorithmType,
      size: size,
      wasmTimes: [],
      jsTimes: [],
      wasmMemory: [],
      jsMemory: [],
      validationResults: {
        success: true,
        discrepancies: []
      }
    };

    console.log(`Running test: ${algorithmName} (${size}) - ${iterations} iterations`);

    // Run iterations
    for (let i = 0; i < iterations; i++) {
      console.log(`Iteração ${i + 1}/${iterations}`);
      
      // Measure WebAssembly performance
      console.log(`  -> Rodando WebAssembly...`);
      const wasmStart = performance.now();
      const wasmMemoryBefore = this.measureMemory();
      const wasmResult = await this.wasm.runAlgorithm(testData);
      const wasmMemoryAfter = this.measureMemory();
      const wasmEnd = performance.now();
      console.log(`  -> WebAssembly concluído em ${(wasmEnd - wasmStart).toFixed(2)}ms`);
      
      metrics.wasmTimes.push(wasmEnd - wasmStart);
      metrics.wasmMemory.push(this.calculateMemoryUsage(wasmMemoryBefore, wasmMemoryAfter));

      // Measure JavaScript performance
      console.log(`  -> Rodando JavaScript...`);
      const jsStart = performance.now();
      const jsMemoryBefore = this.measureMemory();
      const jsResult = await this.js.runAlgorithm(testData);
      const jsMemoryAfter = this.measureMemory();
      const jsEnd = performance.now();
      console.log(`  -> JavaScript concluído em ${(jsEnd - jsStart).toFixed(2)}ms`);
      
      metrics.jsTimes.push(jsEnd - jsStart);
      metrics.jsMemory.push(this.calculateMemoryUsage(jsMemoryBefore, jsMemoryAfter));

      // Validate results if validator is provided
      if (validator && i === 0) { // Only validate the first run
        const validationResult = validator(wasmResult, jsResult);
        metrics.validationResults.success = validationResult.success;
        if (!validationResult.success) {
          metrics.validationResults.discrepancies = validationResult.discrepancies;
        }
      }
    }

    // Calculate statistics
    metrics.wasmStats = this.calculateStats(metrics.wasmTimes);
    metrics.jsStats = this.calculateStats(metrics.jsTimes);
    metrics.wasmMemoryStats = this.calculateStats(metrics.wasmMemory.map(m => m.heapUsed));
    metrics.jsMemoryStats = this.calculateStats(metrics.jsMemory.map(m => m.heapUsed));
    metrics.speedup = metrics.jsStats.mean / metrics.wasmStats.mean;

    // Add detailed memory metrics
    metrics.memoryDetails = {
      wasm: {
        heapUsed: {
          min: metrics.wasmMemoryStats.min / (1024 * 1024),
          max: metrics.wasmMemoryStats.max / (1024 * 1024),
          mean: metrics.wasmMemoryStats.mean / (1024 * 1024),
          median: metrics.wasmMemoryStats.median / (1024 * 1024)
        },
        external: {
          min: Math.min(...metrics.wasmMemory.map(m => m.external)) / (1024 * 1024),
          max: Math.max(...metrics.wasmMemory.map(m => m.external)) / (1024 * 1024),
          mean: metrics.wasmMemory.reduce((acc, m) => acc + m.external, 0) / (metrics.wasmMemory.length * 1024 * 1024)
        }
      },
      js: {
        heapUsed: {
          min: metrics.jsMemoryStats.min / (1024 * 1024),
          max: metrics.jsMemoryStats.max / (1024 * 1024),
          mean: metrics.jsMemoryStats.mean / (1024 * 1024),
          median: metrics.jsMemoryStats.median / (1024 * 1024)
        },
        external: {
          min: Math.min(...metrics.jsMemory.map(m => m.external)) / (1024 * 1024),
          max: Math.max(...metrics.jsMemory.map(m => m.external)) / (1024 * 1024),
          mean: metrics.jsMemory.reduce((acc, m) => acc + m.external, 0) / (metrics.jsMemory.length * 1024 * 1024)
        }
      }
    };

    // Export results incrementally
    if (typeof this.exportResults === 'function') {
      this.exportResults(metrics);
    }
    
    return metrics;
  }

  /**
   * Run benchmark for a specific algorithm and size
   * @param {string} algorithm - Algorithm name
   * @param {string} size - Size category (small, medium, large)
   * @param {number} iterations - Number of iterations
   * @returns {Promise<Array>} Array of benchmark results
   */
  async runBenchmark(algorithm, size, iterations) {
    // Map size to actual dimensions
    const sizeMap = {
      small: 50,
      medium: 500,
      large: 2000
    };

    const dimensions = sizeMap[size];
    if (!dimensions) {
      throw new Error(`Invalid size: ${size}`);
    }

    // Run the benchmark
    const result = await this.runTest(
      algorithm,
      'math',
      size,
      dimensions,
      iterations,
      (wasmResult, jsResult) => {
        // Simple validation: check if results are close enough
        const tolerance = 0.0001;
        let success = true;
        const discrepancies = [];

        // For now, just check if both results are matrices of the same size
        if (!Array.isArray(wasmResult) || !Array.isArray(jsResult)) {
          return { success: false, discrepancies: ['Results are not matrices'] };
        }

        if (wasmResult.length !== jsResult.length) {
          return { success: false, discrepancies: ['Matrix dimensions do not match'] };
        }

        // For large matrices, just check a few elements
        const sampleSize = Math.min(10, dimensions);
        for (let i = 0; i < sampleSize; i++) {
          for (let j = 0; j < sampleSize; j++) {
            const diff = Math.abs(wasmResult[i][j] - jsResult[i][j]);
            if (diff > tolerance) {
              success = false;
              discrepancies.push(`Mismatch at [${i}][${j}]: wasm=${wasmResult[i][j]}, js=${jsResult[i][j]}`);
            }
          }
        }

        return { success, discrepancies };
      }
    );

    return [result];
  }

  /**
   * Calculate memory usage between two measurements
   * @param {Object} before - Memory measurement before operation
   * @param {Object} after - Memory measurement after operation
   * @returns {Object} Memory usage metrics
   */
  calculateMemoryUsage(before, after) {
    if (before.unavailable || after.unavailable) {
      return { unavailable: true };
    }

    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
      rss: after.rss - before.rss
    };
  }

  /**
   * Calculate statistics for a series of measurements
   * @param {Array<number>} times - Array of timing measurements
   * @returns {Object} Statistical calculations
   */
  calculateStats(times) {
    const sum = times.reduce((a, b) => a + b, 0);
    const mean = sum / times.length;
    
    // Calculate standard deviation
    const squareDiffs = times.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    // Sort for percentiles
    const sorted = [...times].sort((a, b) => a - b);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: mean,
      median: sorted[Math.floor(sorted.length / 2)],
      stdDev: stdDev,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Measure current memory usage
   * @returns {Object} Memory usage metrics
   */
  measureMemory() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      // Node.js environment
      return process.memoryUsage();
    } else if (typeof performance !== 'undefined' && performance.memory) {
      // Browser environment
      return performance.memory;
    } else {
      // Fallback if no memory API is available
      return { unavailable: true };
    }
  }

  /**
   * Export results to JSON
   * @param {Object} metrics - Test metrics to export
   */
  exportResults(metrics) {
    // This method is overridden in the main test file
    // to support incremental logging
  }

  /**
   * Get information about the current environment
   * @returns {Object} Environment details
   */
  getEnvironmentInfo() {
    const env = {
      platform: typeof process !== 'undefined' ? 'Node.js' : 'Browser',
      specs: {}
    };
    
    if (typeof process !== 'undefined') {
      // Node.js environment
      env.specs = {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: require('os').cpus(),
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem()
      };
    } else if (typeof navigator !== 'undefined') {
      // Browser environment
      env.specs = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
      };
    }
    
    return env;
  }
}

// For Node.js environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestRunner };
}
