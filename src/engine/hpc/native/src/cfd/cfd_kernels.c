/**
 * SECP-093: Native CFD FVM Flux Kernels
 * 
 * Implementation of 3D Finite Volume Method (FVM) inviscid flux computation in C.
 * Designed for high-performance execution inside WebAssembly.
 */

#include <stdint.h>

// Built-ins for safety and performance
#define fabs(x) __builtin_fabs(x)
#define sqrt(x) __builtin_sqrt(x)

/**
 * 3D Face Flux Computation (Inviscid)
 * Computes the flux across a face shared by two cells (Left and Right).
 * 
 * Inputs:
 * - rho_L, rho_R: Density (kg/m3)
 * - u_L, v_L, w_L: Velocity components (m/s)
 * - u_R, v_R, w_R: Velocity components
 * - p_L, p_R: Pressure (Pa)
 * - nx, ny, nz: Face normal vector (unit vector)
 * - area: Face area (m2)
 * 
 * Outputs:
 * - flux_rho: Density flux (kg/s)
 * - flux_u, flux_v, flux_w: Momentum fluxes (kg*m/s2)
 * - flux_e: Energy flux (J/s) - simplified for 093
 */
__attribute__((export_name("native_cfd_flux")))
void native_cfd_flux(
    double rho_L, double u_L, double v_L, double w_L, double p_L,
    double rho_R, double u_R, double v_R, double w_R, double p_R,
    double nx, double ny, double nz, double area,
    double* out_fluxes // Array of 5 doubles
) {
    // 1. Average state (Central scheme for 093 Proof-of-Engineering)
    double rho = 0.5 * (rho_L + rho_R);
    double u = 0.5 * (u_L + u_R);
    double v = 0.5 * (v_L + v_R);
    double w = 0.5 * (w_L + w_R);
    double p = 0.5 * (p_L + p_R);

    // 2. Normal velocity component
    double vn = u * nx + v * ny + w * nz;

    // 3. Inviscid Fluxes (Euler equations)
    // Continuity: rho * vn * area
    out_fluxes[0] = rho * vn * area;

    // Momentum X: (rho * u * vn + p * nx) * area
    out_fluxes[1] = (rho * u * vn + p * nx) * area;

    // Momentum Y: (rho * v * vn + p * ny) * area
    out_fluxes[2] = (rho * v * vn + p * ny) * area;

    // Momentum Z: (rho * w * vn + p * nz) * area
    out_fluxes[3] = (rho * w * vn + p * nz) * area;

    // Energy: (Total Energy + p) * vn * area
    // Simplified: (p / 0.4 + 0.5 * rho * (u*u + v*v + w*w) + p) * vn * area
    double energy = (p / 0.4) + 0.5 * rho * (u * u + v * v + w * w);
    out_fluxes[4] = (energy + p) * vn * area;
}

/**
 * Bulk Face Flux Computation
 * Computes fluxes for N faces in a single call.
 */
__attribute__((export_name("native_cfd_momentum_flux")))
void native_cfd_momentum_flux(
    int n_faces,
    const double* cell_data_L, // [rho, u, v, w, p] * N
    const double* cell_data_R, // [rho, u, v, w, p] * N
    const double* normals,     // [nx, ny, nz] * N
    const double* areas,       // [area] * N
    double* flux_out           // [f_rho, f_u, f_v, f_w, f_e] * N
) {
    for (int i = 0; i < n_faces; i++) {
        int c_idx = i * 5;
        int n_idx = i * 3;
        
        native_cfd_flux(
            cell_data_L[c_idx + 0], cell_data_L[c_idx + 1], cell_data_L[c_idx + 2], cell_data_L[c_idx + 3], cell_data_L[c_idx + 4],
            cell_data_R[c_idx + 0], cell_data_R[c_idx + 1], cell_data_R[c_idx + 2], cell_data_R[c_idx + 3], cell_data_R[c_idx + 4],
            normals[n_idx + 0], normals[n_idx + 1], normals[n_idx + 2], areas[i],
            &flux_out[c_idx]
        );
    }
}

// Infrastructure compatibility exports
__attribute__((export_name("native_add")))
float native_add(float a, float b) { return a + b; }

__attribute__((export_name("native_multiply")))
float native_multiply(float a, float b) { return a * b; }
