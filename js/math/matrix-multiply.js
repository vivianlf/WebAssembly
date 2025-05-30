/**
 * JavaScript implementation of matrix multiplication for benchmarking
 */
class MatrixMultiplication {
  /**
   * Create a matrix of size n×n filled with random values
   * @param {number} n - Matrix size
   * @returns {Array<Array<number>>} Random matrix
   */
  createRandomMatrix(n) {
    const matrix = new Array(n);
    
    for (let i = 0; i < n; i++) {
      matrix[i] = new Array(n);
      for (let j = 0; j < n; j++) {
        matrix[i][j] = Math.random() * 100.0;
      }
    }
    
    return matrix;
  }
  
  /**
   * Matrix multiplication: C = A × B
   * @param {Array<Array<number>>} A - First matrix
   * @param {Array<Array<number>>} B - Second matrix
   * @returns {Array<Array<number>>} Result matrix
   */
  multiplyMatrices(A, B) {
    const n = A.length;
    const C = new Array(n);
    
    for (let i = 0; i < n; i++) {
      C[i] = new Array(n);
      for (let j = 0; j < n; j++) {
        C[i][j] = 0.0;
        for (let k = 0; k < n; k++) {
          C[i][j] += A[i][k] * B[k][j];
        }
      }
    }
    
    return C;
  }
  
  /**
   * Run the matrix multiplication algorithm
   * @param {number} size - Matrix size (n×n)
   * @returns {Array<Array<number>>} Result matrix
   */
  async runAlgorithm(size) {
    if (size <= 0) return null;
    
    // Create two random matrices
    const A = this.createRandomMatrix(size);
    const B = this.createRandomMatrix(size);
    
    // Multiply them
    const C = this.multiplyMatrices(A, B);
    
    return C;
  }
}

module.exports = MatrixMultiplication;
