/**
 * SECP-092: Native FEA CSR + Conjugate Gradient Kernels
 * 
 * Implementation of high-performance sparse solvers in C for WASM.
 * Strictly uses linear memory pointers for zero-copy efficiency.
 */

#include <stdint.h>

// Use built-ins to avoid math.h dependency in nostdlib mode
#define fabs(x) __builtin_fabs(x)
#define sqrt(x) __builtin_sqrt(x)

// CSR Matrix structure as seen from memory
// Memory layout: [rowPtrs] [colIndices] [values] [rhs] [solution] [p] [r] [Ap]

__attribute__((export_name("native_csr_matvec_f64")))
void native_csr_matvec_f64(
    int n, 
    const int* rowPtr, 
    const int* colInd, 
    const double* values, 
    const double* x, 
    double* y
) {
    for (int i = 0; i < n; i++) {
        double sum = 0.0;
        int row_start = rowPtr[i];
        int row_end = rowPtr[i + 1];
        for (int j = row_start; j < row_end; j++) {
            sum += values[j] * x[colInd[j]];
        }
        y[i] = sum;
    }
}

// Simple dot product for double vectors
static double dot_f64(int n, const double* a, const double* b) {
    double sum = 0.0;
    for (int i = 0; i < n; i++) sum += a[i] * b[i];
    return sum;
}

// axpy: y = a*x + y
static void axpy_f64(int n, double a, const double* x, double* y) {
    for (int i = 0; i < n; i++) y[i] += a * x[i];
}

/**
 * Conjugate Gradient Solver
 * Solves A * x = b for Symmetric Positive Definite A.
 * Returns the number of iterations taken.
 */
__attribute__((export_name("native_fea_cg_solve")))
int native_fea_cg_solve(
    int n,
    const int* rowPtr,
    const int* colInd,
    const double* values,
    const double* b,
    double* x,
    double tolerance,
    int maxIterations,
    double* r,       // Workspace: residual
    double* p,       // Workspace: direction
    double* Ap,      // Workspace: A*p
    double* out_residualNorm
) {
    // 1. Initial residual: r = b - A*x
    native_csr_matvec_f64(n, rowPtr, colInd, values, x, Ap);
    for (int i = 0; i < n; i++) {
        r[i] = b[i] - Ap[i];
        p[i] = r[i]; // p = r
    }

    double rsold = dot_f64(n, r, r);
    if (sqrt(rsold) < tolerance) {
        *out_residualNorm = sqrt(rsold);
        return 0;
    }

    int k = 0;
    for (k = 0; k < maxIterations; k++) {
        // Ap = A * p
        native_csr_matvec_f64(n, rowPtr, colInd, values, p, Ap);

        // alpha = rsold / (p' * Ap)
        double pAp = dot_f64(n, p, Ap);
        if (fabs(pAp) < 1e-20) break; // Numerical safety

        double alpha = rsold / pAp;

        // x = x + alpha * p
        axpy_f64(n, alpha, p, x);

        // r = r - alpha * Ap
        axpy_f64(n, -alpha, Ap, r);

        double rsnew = dot_f64(n, r, r);
        if (sqrt(rsnew) < tolerance) {
            rsold = rsnew;
            break;
        }

        // p = r + (rsnew / rsold) * p
        double beta = rsnew / rsold;
        for (int i = 0; i < n; i++) {
            p[i] = r[i] + beta * p[i];
        }
        rsold = rsnew;
    }

    *out_residualNorm = sqrt(rsold);
    return k + 1;
}

// Re-export basic kernels for verification
__attribute__((export_name("native_add")))
float native_add(float a, float b) { return a + b; }

__attribute__((export_name("native_multiply")))
float native_multiply(float a, float b) { return a * b; }
