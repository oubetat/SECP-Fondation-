/**
 * SECP-090: Native WASM Proof-of-Life Kernel (C source)
 * 
 * This kernel is compiled directly to WASM to prove the toolchain is functional.
 */

// We use __attribute__((export_name("..."))) to explicitly name the export
// or we can use -Wl,--export-all during linking.

__attribute__((export_name("native_add")))
float native_add(float a, float b) {
    return a + b;
}

__attribute__((export_name("native_multiply")))
float native_multiply(float a, float b) {
    return a * b;
}

// A simple loop to prove it's not a stub
__attribute__((export_name("native_dot_product")))
float native_dot_product(float* a, float* b, int n) {
    float sum = 0.0f;
    for (int i = 0; i < n; i++) {
        sum += a[i] * b[i];
    }
    return sum;
}
