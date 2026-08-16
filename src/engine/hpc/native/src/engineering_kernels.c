/**
 * SECP-093: Unified Engineering Kernels (FEA + CFD)
 * 
 * This file combines all native engineering solvers into a single high-performance WASM artifact.
 */

#include <stdint.h>

// Built-ins for safety and performance
#define fabs(x) __builtin_fabs(x)
#define sqrt(x) __builtin_sqrt(x)
#define isnan(x) __builtin_isnan(x)
#define isinf(x) __builtin_isinf(x)
#define NAN (__builtin_nan(""))
#define PI 3.14159265358979323846
#define HALF_PI 1.57079632679489661923

static double native_sin(double x) {
    // Range reduction to [-PI, PI]
    if (x > PI || x < -PI) {
        double n = (x > 0) ? (int)((x + PI) / (2.0 * PI)) : (int)((x - PI) / (2.0 * PI));
        x -= n * 2.0 * PI;
    }
    // Further reduction to [-PI/2, PI/2]
    if (x > HALF_PI) x = PI - x;
    else if (x < -HALF_PI) x = -PI - x;

    double x2 = x * x;
    // 13th order Taylor/Minimax for sin(x)
    return x * (1.0 + x2 * (-1.6666666666666632e-1 + x2 * (8.3333333333224894e-3 + x2 * (-1.9841269829857949e-4 + x2 * (2.7557313707070067e-6 + x2 * (-2.5050760253022334e-8 + x2 * (1.5896909952115501e-10)))))));
}

static double native_cos(double x) {
    return native_sin(HALF_PI - x);
}

static double native_atan(double x) {
    if (x < 0) return -native_atan(-x);
    if (x > 1.0) return HALF_PI - native_atan(1.0 / x);
    if (x > 0.4) {
        // atan(x) = atan(0.5) + atan((x - 0.5) / (1 + 0.5 * x))
        // atan(0.5) = 0.46364760900080611621
        return 0.46364760900080611621 + native_atan((x - 0.5) / (1.0 + 0.5 * x));
    }
    double x2 = x * x;
    // Evaluation for x in [0, 0.4] - Taylor series converges rapidly here
    return x * (1.0 + x2 * (-3.3333333333333333e-01 + 
           x2 * (2.0000000000000000e-01 + 
           x2 * (-1.4285714285714285e-01 + 
           x2 * (1.1111111111111111e-01 + 
           x2 * (-9.0909090909090909e-02 + 
           x2 * (7.6923076923076923e-02 + 
           x2 * (-6.6666666666666667e-02 +
           x2 * (5.8823529411764706e-02 +
           x2 * -5.2631578947368421e-02)))))))));
}

static double native_atan2(double y, double x) {
    if (x == 0.0) {
        if (y > 0.0) return HALF_PI;
        if (y < 0.0) return -HALF_PI;
        return 0.0;
    }
    
    double atan_val;
    if (fabs(x) >= fabs(y)) {
        atan_val = native_atan(y / x);
        if (x < 0.0) {
            if (y >= 0.0) return atan_val + PI;
            return atan_val - PI;
        }
        return atan_val;
    } else {
        atan_val = native_atan(x / y);
        if (y > 0.0) return HALF_PI - atan_val;
        return -HALF_PI - atan_val;
    }
}

static double native_acos(double x) {
    if (x > 1.0 || x < -1.0) return NAN;
    if (x == 1.0) return 0.0;
    if (x == -1.0) return PI;
    return native_atan2(sqrt(1.0 - x * x), x);
}

#define sin native_sin
#define cos native_cos
#define acos native_acos
#define atan2 native_atan2

// ==========================================
// SECTION 1: FEA KERNELS (SECP-092)
// ==========================================

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

static double dot_f64(int n, const double* a, const double* b) {
    double sum = 0.0;
    for (int i = 0; i < n; i++) sum += a[i] * b[i];
    return sum;
}

static void axpy_f64(int n, double a, const double* x, double* y) {
    for (int i = 0; i < n; i++) y[i] += a * x[i];
}

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
    double* r,
    double* p,
    double* Ap,
    double* out_residualNorm
) {
    native_csr_matvec_f64(n, rowPtr, colInd, values, x, Ap);
    for (int i = 0; i < n; i++) {
        r[i] = b[i] - Ap[i];
        p[i] = r[i];
    }

    double rsold = dot_f64(n, r, r);
    if (sqrt(rsold) < tolerance) {
        *out_residualNorm = sqrt(rsold);
        return 0;
    }

    int k = 0;
    for (k = 0; k < maxIterations; k++) {
        native_csr_matvec_f64(n, rowPtr, colInd, values, p, Ap);
        double pAp = dot_f64(n, p, Ap);
        if (fabs(pAp) < 1e-20) break;
        double alpha = rsold / pAp;
        axpy_f64(n, alpha, p, x);
        axpy_f64(n, -alpha, Ap, r);
        double rsnew = dot_f64(n, r, r);
        if (sqrt(rsnew) < tolerance) {
            rsold = rsnew;
            break;
        }
        double beta = rsnew / rsold;
        for (int i = 0; i < n; i++) {
            p[i] = r[i] + beta * p[i];
        }
        rsold = rsnew;
    }
    *out_residualNorm = sqrt(rsold);
    return k + 1;
}

// ==========================================
// SECTION 2: CFD KERNELS (SECP-093)
// ==========================================

/**
 * 3D Face Flux Computation (Inviscid)
 */
__attribute__((export_name("native_cfd_flux")))
void native_cfd_flux(
    double rho_L, double u_L, double v_L, double w_L, double p_L,
    double rho_R, double u_R, double v_R, double w_R, double p_R,
    double nx, double ny, double nz, double area,
    double* out_fluxes
) {
    double rho = 0.5 * (rho_L + rho_R);
    double u = 0.5 * (u_L + u_R);
    double v = 0.5 * (v_L + v_R);
    double w = 0.5 * (w_L + w_R);
    double p = 0.5 * (p_L + p_R);

    double vn = u * nx + v * ny + w * nz;
    out_fluxes[0] = rho * vn * area;
    out_fluxes[1] = (rho * u * vn + p * nx) * area;
    out_fluxes[2] = (rho * v * vn + p * ny) * area;
    out_fluxes[3] = (rho * w * vn + p * nz) * area;
    double energy = (p / 0.4) + 0.5 * rho * (u * u + v * v + w * w);
    out_fluxes[4] = (energy + p) * vn * area;
}

__attribute__((export_name("native_cfd_momentum_flux")))
void native_cfd_momentum_flux(
    int n_faces,
    const double* cell_data_L,
    const double* cell_data_R,
    const double* normals,
    const double* areas,
    double* flux_out
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

// ==========================================
// SECTION 3: CAM 5-AXIS KINEMATICS (SECP-094)
// ==========================================

#define PI 3.14159265358979323846
#define RAD_TO_DEG (180.0 / PI)
#define DEG_TO_RAD (PI / 180.0)

/**
 * 5-Axis Inverse Kinematics (Table-Table AC Configuration)
 * 
 * Given:
 * - (x, y, z): Tool tip position in workpiece coordinates
 * - (i, j, k): Tool vector (normalized direction)
 * 
 * Find:
 * - (xm, ym, zm): Machine axis coordinates
 * - (a, c): Rotary axis angles (in degrees)
 */
__attribute__((export_name("native_cam_5axis_ik")))
void native_cam_5axis_ik(
    double x, double y, double z,
    double i, double j, double k,
    double* out_machine_axes // [xm, ym, zm, a, c]
) {
    // 1. Calculate Rotary Axis Angles (A, C)
    // A axis (Tilt): angle between tool vector and Z axis
    if (k > 1.0) k = 1.0;
    if (k < -1.0) k = -1.0;
    double a_rad = acos(k);
    double a_deg = a_rad * RAD_TO_DEG;

    // C axis (Rotary): angle in XY plane
    double c_rad = 0.0;
    if (fabs(i) < 1e-12 && fabs(j) < 1e-12) {
        // Singularity: tool is vertical. 
        // In industrial CAM, we usually keep C at previous value.
        // For 094, we set to 0.0 but could signal singularity.
        c_rad = 0.0; 
    } else {
        c_rad = atan2(j, i);
    }
    double c_deg = c_rad * RAD_TO_DEG;

    // Handle Axis Limits (Industrial constraints)
    if (a_deg < 0.0) a_deg = 0.0;
    if (a_deg > 180.0) a_deg = 180.0;
    // C is usually cyclic, but we keep it in [-180, 180]
    while (c_deg > 180.0) c_deg -= 360.0;
    while (c_deg < -180.0) c_deg += 360.0;

    // Detect Invalid Input (NaN or Infinity in tool vector)
    if (isnan(k) || isnan(i) || isnan(j) || isinf(k) || isinf(i) || isinf(j)) {
        out_machine_axes[0] = NAN;
        out_machine_axes[1] = NAN;
        out_machine_axes[2] = NAN;
        out_machine_axes[3] = NAN;
        out_machine_axes[4] = NAN;
        out_machine_axes[5] = 2.0; // 2.0 = INVALID_INPUT
        return;
    }

    // 2. Machine Coordinate Transformation (Simplified)
    // In a real machine, this depends on table offsets and pivot points.
    // For 094, we implement the core rotation matrix transformation.
    double sinA = sin(a_rad);
    double cosA = cos(a_rad);
    double sinC = sin(c_rad);
    double cosC = cos(c_rad);

    // Coordinate rotation to align tool with workpiece
    // (This is the inverse of the table rotation)
    double xm = x * cosC + y * sinC;
    double ym = -x * sinC * cosA + y * cosC * cosA + z * sinA;
    double zm = x * sinC * sinA - y * cosC * sinA + z * cosA;

    out_machine_axes[0] = xm;
    out_machine_axes[1] = ym;
    out_machine_axes[2] = zm;
    out_machine_axes[3] = a_deg;
    out_machine_axes[4] = c_deg;
    out_machine_axes[5] = (fabs(i) < 1e-12 && fabs(j) < 1e-12) ? 1.0 : 0.0; // 1.0 = SINGULAR, 0.0 = OK
}

/**
 * Bulk 5-Axis Transformation
 */
__attribute__((export_name("native_cam_5axis_bulk")))
void native_cam_5axis_bulk(
    int n_points,
    const double* cartesian_pts, // [x, y, z, i, j, k] * N
    double* machine_pts          // [xm, ym, zm, a, c, status] * N
) {
    for (int idx = 0; idx < n_points; idx++) {
        int in_idx = idx * 6;
        int out_idx = idx * 6; // Changed from 5 to 6 to include status
        native_cam_5axis_ik(
            cartesian_pts[in_idx + 0], cartesian_pts[in_idx + 1], cartesian_pts[in_idx + 2],
            cartesian_pts[in_idx + 3], cartesian_pts[in_idx + 4], cartesian_pts[in_idx + 5],
            &machine_pts[out_idx]
        );
    }
}

// ==========================================
// SECTION 4: INFRASTRUCTURE
// ==========================================

__attribute__((export_name("native_add")))
float native_add(float a, float b) { return a + b; }

__attribute__((export_name("native_multiply")))
float native_multiply(float a, float b) { return a * b; }

// ==========================================
// SECTION 5: NATIVE GEOMETRY KERNELS (SECP-095)
// ==========================================

#define GEOM_EPSILON 1e-30
#define GEOM_MAX_VAL 1e30

__attribute__((export_name("native_geom_dot")))
double native_geom_dot(const double* u, const double* v, int* out_status) {
    if (!u || !v || !out_status) {
        if (out_status) *out_status = 2; // INVALID_INPUT
        return 0.0;
    }
    for (int i = 0; i < 3; i++) {
        double ui = u[i];
        double vi = v[i];
        if (ui != ui || vi != vi || ui == __builtin_inf() || ui == -__builtin_inf() || vi == __builtin_inf() || vi == -__builtin_inf()) {
            *out_status = 2; // INVALID_INPUT
            return 0.0;
        }
        if (fabs(ui) > GEOM_MAX_VAL || fabs(vi) > GEOM_MAX_VAL) {
            *out_status = 2; // INVALID_INPUT
            return 0.0;
        }
    }
    *out_status = 0; // OK
    return u[0]*v[0] + u[1]*v[1] + u[2]*v[2];
}

__attribute__((export_name("native_geom_cross")))
void native_geom_cross(const double* u, const double* v, double* out, int* out_status) {
    if (!u || !v || !out || !out_status) {
        if (out_status) *out_status = 2;
        return;
    }
    for (int i = 0; i < 3; i++) {
        double ui = u[i];
        double vi = v[i];
        if (ui != ui || vi != vi || ui == __builtin_inf() || ui == -__builtin_inf() || vi == __builtin_inf() || vi == -__builtin_inf()) {
            *out_status = 2;
            return;
        }
        if (fabs(ui) > GEOM_MAX_VAL || fabs(vi) > GEOM_MAX_VAL) {
            *out_status = 2;
            return;
        }
    }
    out[0] = u[1]*v[2] - u[2]*v[1];
    out[1] = u[2]*v[0] - u[0]*v[2];
    out[2] = u[0]*v[1] - u[1]*v[0];
    *out_status = 0;
}

__attribute__((export_name("native_geom_norm")))
double native_geom_norm(const double* u, int* out_status) {
    if (!u || !out_status) {
        if (out_status) *out_status = 2;
        return 0.0;
    }
    for (int i = 0; i < 3; i++) {
        double ui = u[i];
        if (ui != ui || ui == __builtin_inf() || ui == -__builtin_inf()) {
            *out_status = 2;
            return 0.0;
        }
        if (fabs(ui) > GEOM_MAX_VAL) {
            *out_status = 2;
            return 0.0;
        }
    }
    double sum = u[0]*u[0] + u[1]*u[1] + u[2]*u[2];
    if (sum < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR
        return 0.0;
    }
    double norm_val = sqrt(sum);
    if (norm_val != norm_val || norm_val == __builtin_inf()) {
        *out_status = 3; // NUMERICAL_FAILURE
        return 0.0;
    }
    *out_status = 0;
    return norm_val;
}

__attribute__((export_name("native_geom_normalize")))
void native_geom_normalize(const double* u, double* out, int* out_status) {
    if (!u || !out || !out_status) {
        if (out_status) *out_status = 2;
        return;
    }
    for (int i = 0; i < 3; i++) {
        double val = u[i];
        if (val != val || val == __builtin_inf() || val == -__builtin_inf()) {
            *out_status = 2;
            return;
        }
        if (fabs(val) > GEOM_MAX_VAL) {
            *out_status = 2;
            return;
        }
    }
    double sum = u[0]*u[0] + u[1]*u[1] + u[2]*u[2];
    if (sum < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR
        out[0] = 0.0; out[1] = 0.0; out[2] = 0.0;
        return;
    }
    double len = sqrt(sum);
    if (len != len || len == __builtin_inf()) {
        *out_status = 3; // NUMERICAL_FAILURE
        return;
    }
    out[0] = u[0] / len;
    out[1] = u[1] / len;
    out[2] = u[2] / len;
    *out_status = 0;
}

__attribute__((export_name("native_geom_dist")))
double native_geom_dist(const double* p1, const double* p2, int* out_status) {
    if (!p1 || !p2 || !out_status) {
        if (out_status) *out_status = 2;
        return 0.0;
    }
    for (int i = 0; i < 3; i++) {
        double p1_val = p1[i];
        double p2_val = p2[i];
        if (p1_val != p1_val || p2_val != p2_val || 
            p1_val == __builtin_inf() || p1_val == -__builtin_inf() || 
            p2_val == __builtin_inf() || p2_val == -__builtin_inf()) {
            *out_status = 2;
            return 0.0;
        }
        if (fabs(p1_val) > GEOM_MAX_VAL || fabs(p2_val) > GEOM_MAX_VAL) {
            *out_status = 2;
            return 0.0;
        }
    }
    double dx = p1[0] - p2[0];
    double dy = p1[1] - p2[1];
    double dz = p1[2] - p2[2];
    double sum = dx*dx + dy*dy + dz*dz;
    if (sum < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR (coincident)
        return 0.0;
    }
    double d = sqrt(sum);
    if (d != d || d == __builtin_inf()) {
        *out_status = 3; // NUMERICAL_FAILURE
        return 0.0;
    }
    *out_status = 0;
    return d;
}

__attribute__((export_name("native_geom_closest_point_on_segment")))
void native_geom_closest_point_on_segment(const double* p, const double* a, const double* b, double* out_c, int* out_status) {
    if (!p || !a || !b || !out_c || !out_status) {
        if (out_status) *out_status = 2;
        return;
    }
    for (int i = 0; i < 3; i++) {
        if (p[i] != p[i] || a[i] != a[i] || b[i] != b[i] ||
            p[i] == __builtin_inf() || p[i] == -__builtin_inf() ||
            a[i] == __builtin_inf() || a[i] == -__builtin_inf() ||
            b[i] == __builtin_inf() || b[i] == -__builtin_inf()) {
            *out_status = 2;
            return;
        }
        if (fabs(p[i]) > GEOM_MAX_VAL || fabs(a[i]) > GEOM_MAX_VAL || fabs(b[i]) > GEOM_MAX_VAL) {
            *out_status = 2;
            return;
        }
    }
    double vx = b[0] - a[0];
    double vy = b[1] - a[1];
    double vz = b[2] - a[2];
    
    double wx = p[0] - a[0];
    double wy = p[1] - a[1];
    double wz = p[2] - a[2];
    
    double v_dot_v = vx*vx + vy*vy + vz*vz;
    if (v_dot_v < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR
        out_c[0] = a[0];
        out_c[1] = a[1];
        out_c[2] = a[2];
        return;
    }
    
    double w_dot_v = wx*vx + wy*vy + wz*vz;
    double t = w_dot_v / v_dot_v;
    if (t < 0.0) t = 0.0;
    if (t > 1.0) t = 1.0;
    
    out_c[0] = a[0] + t * vx;
    out_c[1] = a[1] + t * vy;
    out_c[2] = a[2] + t * vz;
    *out_status = 0;
}

__attribute__((export_name("native_geom_plane_signed_dist")))
double native_geom_plane_signed_dist(const double* p, const double* q, const double* n, int* out_status) {
    if (!p || !q || !n || !out_status) {
        if (out_status) *out_status = 2;
        return 0.0;
    }
    for (int i = 0; i < 3; i++) {
        if (p[i] != p[i] || q[i] != q[i] || n[i] != n[i] ||
            p[i] == __builtin_inf() || p[i] == -__builtin_inf() ||
            q[i] == __builtin_inf() || q[i] == -__builtin_inf() ||
            n[i] == __builtin_inf() || n[i] == -__builtin_inf()) {
            *out_status = 2;
            return 0.0;
        }
        if (fabs(p[i]) > GEOM_MAX_VAL || fabs(q[i]) > GEOM_MAX_VAL || fabs(n[i]) > GEOM_MAX_VAL) {
            *out_status = 2;
            return 0.0;
        }
    }
    double n_len_sq = n[0]*n[0] + n[1]*n[1] + n[2]*n[2];
    if (n_len_sq < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR (zero normal)
        return 0.0;
    }
    double n_len = sqrt(n_len_sq);
    double dx = p[0] - q[0];
    double dy = p[1] - q[1];
    double dz = p[2] - q[2];
    
    double dot = dx*n[0] + dy*n[1] + dz*n[2];
    *out_status = 0;
    return dot / n_len;
}

__attribute__((export_name("native_geom_triangle_normal")))
void native_geom_triangle_normal(const double* a, const double* b, const double* c, double* out_n, int* out_status) {
    if (!a || !b || !c || !out_n || !out_status) {
        if (out_status) *out_status = 2;
        return;
    }
    for (int i = 0; i < 3; i++) {
        if (a[i] != a[i] || b[i] != b[i] || c[i] != c[i] ||
            a[i] == __builtin_inf() || a[i] == -__builtin_inf() ||
            b[i] == __builtin_inf() || b[i] == -__builtin_inf() ||
            c[i] == __builtin_inf() || c[i] == -__builtin_inf()) {
            *out_status = 2;
            return;
        }
        if (fabs(a[i]) > GEOM_MAX_VAL || fabs(b[i]) > GEOM_MAX_VAL || fabs(c[i]) > GEOM_MAX_VAL) {
            *out_status = 2;
            return;
        }
    }
    double ab_x = b[0] - a[0];
    double ab_y = b[1] - a[1];
    double ab_z = b[2] - a[2];
    
    double ac_x = c[0] - a[0];
    double ac_y = c[1] - a[1];
    double ac_z = c[2] - a[2];
    
    double nx = ab_y*ac_z - ab_z*ac_y;
    double ny = ab_z*ac_x - ab_x*ac_z;
    double nz = ab_x*ac_y - ab_y*ac_x;
    
    double n_len_sq = nx*nx + ny*ny + nz*nz;
    if (n_len_sq < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR
        out_n[0] = 0.0; out_n[1] = 0.0; out_n[2] = 0.0;
        return;
    }
    double n_len = sqrt(n_len_sq);
    out_n[0] = nx / n_len;
    out_n[1] = ny / n_len;
    out_n[2] = nz / n_len;
    *out_status = 0;
}

__attribute__((export_name("native_geom_triangle_area")))
double native_geom_triangle_area(const double* a, const double* b, const double* c, int* out_status) {
    if (!a || !b || !c || !out_status) {
        if (out_status) *out_status = 2;
        return 0.0;
    }
    for (int i = 0; i < 3; i++) {
        if (a[i] != a[i] || b[i] != b[i] || c[i] != c[i] ||
            a[i] == __builtin_inf() || a[i] == -__builtin_inf() ||
            b[i] == __builtin_inf() || b[i] == -__builtin_inf() ||
            c[i] == __builtin_inf() || c[i] == -__builtin_inf()) {
            *out_status = 2;
            return 0.0;
        }
        if (fabs(a[i]) > GEOM_MAX_VAL || fabs(b[i]) > GEOM_MAX_VAL || fabs(c[i]) > GEOM_MAX_VAL) {
            *out_status = 2;
            return 0.0;
        }
    }
    double ab_x = b[0] - a[0];
    double ab_y = b[1] - a[1];
    double ab_z = b[2] - a[2];
    
    double ac_x = c[0] - a[0];
    double ac_y = c[1] - a[1];
    double ac_z = c[2] - a[2];
    
    double nx = ab_y*ac_z - ab_z*ac_y;
    double ny = ab_z*ac_x - ab_x*ac_z;
    double nz = ab_x*ac_y - ab_y*ac_x;
    
    double cross_norm_sq = nx*nx + ny*ny + nz*nz;
    if (cross_norm_sq < GEOM_EPSILON) {
        *out_status = 1; // SINGULAR
        return 0.0;
    }
    double area = 0.5 * sqrt(cross_norm_sq);
    *out_status = 0;
    return area;
}

__attribute__((export_name("native_geom_bulk_execute")))
void native_geom_bulk_execute(
    int n_ops,
    const int* op_types,          // 0=dot, 1=cross, 2=norm, 3=normalize, 4=dist, 5=closest, 6=plane_dist, 7=tri_normal, 8=tri_area
    const double* inputs,         // Pack of coordinates: op 0, 1, 2, ...
    const int* input_offsets,     // offsets in inputs array
    double* outputs,              // Outputs array for results
    const int* output_offsets,    // offsets in outputs array
    int* statuses                 // status per operation
) {
    for (int idx = 0; idx < n_ops; idx++) {
        int op = op_types[idx];
        int in_off = input_offsets[idx];
        int out_off = output_offsets[idx];
        
        if (op == 0) { // dot
            outputs[out_off] = native_geom_dot(&inputs[in_off], &inputs[in_off + 3], &statuses[idx]);
        } else if (op == 1) { // cross
            native_geom_cross(&inputs[in_off], &inputs[in_off + 3], &outputs[out_off], &statuses[idx]);
        } else if (op == 2) { // norm
            outputs[out_off] = native_geom_norm(&inputs[in_off], &statuses[idx]);
        } else if (op == 3) { // normalize
            native_geom_normalize(&inputs[in_off], &outputs[out_off], &statuses[idx]);
        } else if (op == 4) { // dist
            outputs[out_off] = native_geom_dist(&inputs[in_off], &inputs[in_off + 3], &statuses[idx]);
        } else if (op == 5) { // closest segment
            native_geom_closest_point_on_segment(&inputs[in_off], &inputs[in_off + 3], &inputs[in_off + 6], &outputs[out_off], &statuses[idx]);
        } else if (op == 6) { // plane distance
            outputs[out_off] = native_geom_plane_signed_dist(&inputs[in_off], &inputs[in_off + 3], &inputs[in_off + 6], &statuses[idx]);
        } else if (op == 7) { // triangle normal
            native_geom_triangle_normal(&inputs[in_off], &inputs[in_off + 3], &inputs[in_off + 6], &outputs[out_off], &statuses[idx]);
        } else if (op == 8) { // triangle area
            outputs[out_off] = native_geom_triangle_area(&inputs[in_off], &inputs[in_off + 3], &inputs[in_off + 6], &statuses[idx]);
        } else {
            statuses[idx] = 2; // INVALID_INPUT
        }
    }
}


// ==========================================
// SECTION 6: NATIVE NURBS KERNELS (SECP-101.4)
// ==========================================

__attribute__((export_name("native_nurbs_basis")))
double native_nurbs_basis(int i, int p, double u, const double* knots, int knots_len) {
    if (p == 0) {
        if (u >= knots[i] && u < knots[i + 1]) return 1.0;
        if (u == knots[knots_len - 1] && u == knots[i + 1]) return 1.0;
        return 0.0;
    }
    double left = 0.0;
    double denom1 = knots[i + p] - knots[i];
    if (denom1 > 1e-12) {
        left = ((u - knots[i]) / denom1) * native_nurbs_basis(i, p - 1, u, knots, knots_len);
    }
    double right = 0.0;
    double denom2 = knots[i + p + 1] - knots[i + 1];
    if (denom2 > 1e-12) {
        right = ((knots[i + p + 1] - u) / denom2) * native_nurbs_basis(i + 1, p - 1, u, knots, knots_len);
    }
    return left + right;
}
