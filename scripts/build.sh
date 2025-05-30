#!/bin/bash
# scripts/build.sh

# Ensure script exits on any error
set -e

# Set up variables
SRC_DIR="src"
BUILD_DIR="build"
BROWSER_DIR="$BUILD_DIR/browser"
NODE_DIR="$BUILD_DIR/node"

# Create build directories
mkdir -p $BROWSER_DIR
mkdir -p $NODE_DIR

# Verify Emscripten is installed
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten compiler not found. Please install and activate Emscripten first."
    echo "You can install it using:"
    echo "  git clone https://github.com/emscripten-core/emsdk.git"
    echo "  cd emsdk"
    echo "  ./emsdk install latest"
    echo "  ./emsdk activate latest"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Build Math Algorithms
echo "Building Math Algorithms..."

# Matrix Multiplication
echo "Building Matrix Multiplication..."
emcc $SRC_DIR/math/matrix-multiply.cpp -o $BROWSER_DIR/matrix-multiply.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_create_random_matrix", "_multiply_matrices", "_free_matrix", "_run_matrix_multiplication"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "getValue", "setValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16MB \
    -s MAXIMUM_MEMORY=512MB \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="MatrixMultiplyWasm" \
    -O3

# Create a Node.js compatible version
emcc $SRC_DIR/math/matrix-multiply.cpp -o $NODE_DIR/matrix-multiply.js \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_create_random_matrix", "_multiply_matrices", "_free_matrix", "_run_matrix_multiplication"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap", "getValue", "setValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16MB \
    -s MAXIMUM_MEMORY=512MB \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="MatrixMultiplyWasm" \
    -s ENVIRONMENT='node' \
    -O3

# Build Other Math Algorithms
# TODO: Add build commands for gradient descent, numeric integration, and FFT

# Build String Processing Algorithms
echo "Building String Processing Algorithms..."

# TODO: Add build commands for JSON parser and CSV parser

echo "Build completed successfully!"
