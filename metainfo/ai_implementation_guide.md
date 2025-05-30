# AI Implementation Guide

## Project Structure
- `src/`: Contains C++ source code for WebAssembly implementation
- `js/`: Contains JavaScript implementations for comparison
- `test/`: Contains test runners and test cases
- `build/`: Contains compiled WebAssembly modules
- `results/`: Contains benchmark results in JSON format
- `metainfo/`: Contains implementation guides and notes
- `lab_notes/`: Contains development insights and decisions

## Implementation Steps

### 1. WebAssembly Implementation (C++)
1. Add new functions in `src/math/matrix-multiply.cpp`
2. Use `EMSCRIPTEN_KEEPALIVE` for exported functions
3. Follow memory management pattern:
   ```cpp
   // Allocate memory
   double* ptr = (double*)malloc(size);
   if (!ptr) return nullptr;
   
   // Use memory
   // ...
   
   // Free memory
   free(ptr);
   ```
4. Wrap functions in `extern "C"` block

### 2. JavaScript Implementation
1. Add corresponding implementation in `js/math/`
2. Match WebAssembly function signature
3. Implement validation in test runner

### 3. Test Implementation
1. Create test wrapper in `test/node-tests.js`:
   ```javascript
   function createWasmModule(wasmInstance) {
       return {
           runAlgorithm: async (params) => {
               // 1. Get function references
               const func = wasmInstance.cwrap('function_name', 'return_type', ['param_types']);
               
               // 2. Allocate memory if needed
               // 3. Copy data to WebAssembly memory
               // 4. Run algorithm
               // 5. Convert result back to JavaScript
               // 6. Free memory
               // 7. Return result
           }
       };
   }
   ```

2. Add test cases in `runMatrixMultiplicationTest`:
   ```javascript
   await runner.runTest(
       'Test Name',
       'type',
       'size',
       params,
       10, // iterations (fixed at 10 for optimal balance)
       validator
   );
   ```

### 4. Memory Management Rules
1. Always check for null after allocation
2. Free memory in reverse order of allocation
3. Use proper buffer types (HEAPF64 for doubles)
4. Keep track of all allocated pointers
5. Free memory even in error cases
6. Consider memory pressure with 10 iterations

### 5. Validation Rules
1. Implement validator function:
   ```javascript
   const validator = (wasmResult, jsResult) => {
       // 1. Check result types
       // 2. Check dimensions
       // 3. Return validation result
   };
   ```
2. Focus on matrix structure validation
3. Avoid element-by-element comparison for performance

### 6. Error Handling
1. Use try-catch blocks
2. Check for null pointers
3. Validate input parameters
4. Log detailed error messages
5. Clean up resources in error cases
6. Handle WebAssembly initialization errors

### 7. Performance Considerations
1. Use 10 iterations for optimal balance
2. Minimize memory allocations
3. Use appropriate buffer types
4. Consider SIMD operations
5. Profile memory usage
6. Monitor execution time
7. Log results incrementally

### 8. Testing Process
1. Run small tests first
2. Validate matrix structure
3. Check memory usage
4. Monitor execution time
5. Verify results are logged
6. Check JSON output format

### 9. Result Logging
1. Use incremental JSON logging
2. Include timestamp in filename
3. Log after each test completion
4. Include environment details
5. Save in `results/` directory
6. Format for easy analysis

### 10. Common Pitfalls
1. Forgetting to free memory
2. Using wrong buffer types
3. Not checking null pointers
4. Missing error handling
5. Excessive validation
6. Too many iterations
7. Not logging results incrementally

### 11. Best Practices
1. Validate input parameters
2. Clean up resources properly
3. Use consistent error handling
4. Document assumptions
5. Keep iterations at 10
6. Log results as they come in
7. Monitor memory usage

## Example Implementation
```javascript
// 1. Create WebAssembly wrapper
const wasmModule = createWasmModule(wasmInstance);

// 2. Create JavaScript implementation
const jsModule = new Implementation();

// 3. Create test runner
const runner = new TestRunner(wasmModule, jsModule);

// 4. Run tests
await runner.runTest(
    'Test Name',
    'type',
    'size',
    params,
    10,
    validator
);
``` 