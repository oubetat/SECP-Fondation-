
/**
 * Branded types for type-safe unit handling.
 * Millimeters (mm) is the Public API standard.
 * Meters (m) is the Kernel Internal standard.
 */

export type Millimeters = number & { __unit?: "mm" };
export type Meters = number & { __unit?: "m" };

/**
 * Casts a raw number to Millimeters. Use only at the API entry point.
 */
export function asMm(val: number): Millimeters {
  return val as Millimeters;
}

/**
 * Casts a raw number to Meters. Use only when receiving raw meter values (e.g. from a lower-level library).
 */
export function asM(val: number): Meters {
  return val as Meters;
}

export function asMeters(val: number): Meters {
  return val as Meters;
}

export function asMillimeters(val: number): Millimeters {
  return val as Millimeters;
}

/**
 * Converts Millimeters to Meters.
 * Should be called exactly once when data enters the kernel.
 */
export function mmToM(mm: Millimeters): Meters {
  return (mm / 1000) as Meters;
}

/**
 * Converts Meters to Millimeters.
 * Should be called when data exits the kernel to the public API.
 */
export function mToMm(m: Meters): Millimeters {
  return (m * 1000) as Millimeters;
}
