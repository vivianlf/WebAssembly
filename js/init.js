// Initialize the test runner
async function initializeTestRunner() {
    try {
        // Load the JavaScript implementation
        const jsImpl = new MatrixMultiplication();
        
        // Create a mock WebAssembly implementation for now
        // TODO: Replace with actual WebAssembly module
        const wasmImpl = {
            runAlgorithm: async (size) => {
                // Temporary implementation that just calls JS version
                return jsImpl.runAlgorithm(size);
            }
        };
        
        // Create test runner instance
        window.testRunner = new TestRunner(wasmImpl, jsImpl);
        console.log('Test runner initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize test runner:', error);
        return false;
    }
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    const success = await initializeTestRunner();
    if (!success) {
        statusText.textContent = 'Failed to initialize benchmark system';
        runBtn.disabled = true;
    }
}); 