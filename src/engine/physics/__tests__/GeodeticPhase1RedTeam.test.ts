/**
 * SECP Physics Engine — Independent Phase 1 Red-Team Adversarial Test Suite
 * 
 * Capability: CAP-SUP-018 (Geodetic Datum & Multi-Coordinate Frame Kernel)
 * 
 * Strict Red-Team Contract:
 * - Assume CAP-SUP-018 is NOT PROVEN until independent mathematical benchmarks pass.
 * - Do NOT use GeodeticFrameEngine to generate expected values.
 * - Test an exhaustive matrix: Equator, Mid-Lat, High-Lat, Near Pole, ±180° Lon, 
 *   Negative Altitude, Sea Level, High Altitude (Everest), LEO (400km), GEO (35,786km).
 * - Measure separately: Latitude error, Longitude error, Altitude error, 3D ECEF position error.
 */

import { describe, it, expect } from 'vitest';
import { GeodeticFrameEngine, GeodeticPoint, EcefPoint } from '../GeodeticFrameEngine';

/**
 * B1 — Independent Reference Implementation
 * 
 * WGS84 Constants:
 * - Ellipsoid: WGS84 (EPSG:4326)
 * - Semi-major axis a = 6378137.0 m
 * - Flattening 1/f = 298.257223563
 * - b = a * (1 - f) = 6356752.314245179 m
 * - e^2 = (a^2 - b^2) / a^2 = 0.0066943799901413165
 */
class IndependentGeodeticReference {
  public static readonly A = 6378137.0;
  public static readonly F = 1.0 / 298.257223563;
  public static readonly B = IndependentGeodeticReference.A * (1.0 - IndependentGeodeticReference.F);
  public static readonly E2 = (Math.pow(IndependentGeodeticReference.A, 2) - Math.pow(IndependentGeodeticReference.B, 2)) / Math.pow(IndependentGeodeticReference.A, 2);

  /**
   * Direct closed-form Geodetic to ECEF
   */
  public static toEcef(latDeg: number, lonDeg: number, altM: number): { x: number; y: number; z: number } {
    const phi = latDeg * (Math.PI / 180.0);
    const lam = lonDeg * (Math.PI / 180.0);
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const sinLam = Math.sin(lam);
    const cosLam = Math.cos(lam);

    const N = IndependentGeodeticReference.A / Math.sqrt(1.0 - IndependentGeodeticReference.E2 * sinPhi * sinPhi);

    const x = (N + altM) * cosPhi * cosLam;
    const y = (N + altM) * cosPhi * sinLam;
    const z = (N * (1.0 - IndependentGeodeticReference.E2) + altM) * sinPhi;

    return { x, y, z };
  }

  /**
   * Independent High-Precision Newton-Raphson Reference Solver for ECEF -> Geodetic
   */
  public static toGeodetic(x: number, y: number, z: number): { latDeg: number; lonDeg: number; altM: number } {
    const p = Math.hypot(x, y);
    const lam = Math.atan2(y, x);

    if (p < 1e-12) {
      // Polar singularity
      const lat = z >= 0 ? 90.0 : -90.0;
      const alt = Math.abs(z) - IndependentGeodeticReference.B;
      return { latDeg: lat, lonDeg: 0, altM: alt };
    }

    let phi = Math.atan2(z, p * (1.0 - IndependentGeodeticReference.E2));
    let h = 0;

    for (let iter = 0; iter < 20; iter++) {
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const N = IndependentGeodeticReference.A / Math.sqrt(1.0 - IndependentGeodeticReference.E2 * sinPhi * sinPhi);
      h = p / cosPhi - N;
      const phiNext = Math.atan2(z, p * (1.0 - IndependentGeodeticReference.E2 * (N / (N + h))));
      if (Math.abs(phiNext - phi) < 1e-15) {
        phi = phiNext;
        break;
      }
      phi = phiNext;
    }

    return {
      latDeg: phi * (180.0 / Math.PI),
      lonDeg: lam * (180.0 / Math.PI),
      altM: h
    };
  }
}

interface TestMatrixPoint {
  description: string;
  lat: number;
  lon: number;
  alt: number;
  maxAllowedEcefErrorM: number;
}

describe('SECP Phase 1 Red-Team — CAP-SUP-018 (Geodetic Datum & Frames)', () => {

  const testMatrix: TestMatrixPoint[] = [
    { description: 'Equator (Prime Meridian)', lat: 0, lon: 0, alt: 0, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Mid-Latitude (45N, 45E)', lat: 45, lon: 45, alt: 100, maxAllowedEcefErrorM: 1e-6 },
    { description: 'High Latitude (75N, -120W)', lat: 75, lon: -120, alt: 500, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Near North Pole (89.9999N, 30E)', lat: 89.9999, lon: 30, alt: 10, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Antimeridian East (+180 Lon)', lat: 30, lon: 180, alt: 250, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Antimeridian West (-180 Lon)', lat: -30, lon: -180, alt: 250, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Southern Hemisphere (Prime Meridian)', lat: -45, lon: 0, alt: 50, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Negative Altitude (Dead Sea -400m)', lat: 31.5, lon: 35.5, alt: -400, maxAllowedEcefErrorM: 1e-6 },
    { description: 'Sea Level (London)', lat: 51.5, lon: 0, alt: 0, maxAllowedEcefErrorM: 1e-6 },
    { description: 'High Altitude (Mt. Everest 8848m)', lat: 28.0, lon: 86.9, alt: 8848, maxAllowedEcefErrorM: 1e-6 },
    { description: 'LEO Spaceflight (400 km ISS Orbit)', lat: 0, lon: 0, alt: 400000, maxAllowedEcefErrorM: 1e-6 },
    { description: 'GEO Geostationary Orbit (35,786 km)', lat: 10, lon: 100, alt: 35786000, maxAllowedEcefErrorM: 1e-4 }
  ];

  it('B2: Comprehensive Round-Trip Matrix Evaluation against Independent Reference', () => {
    let maxObservedLatErrDeg = 0;
    let maxObservedLonErrDeg = 0;
    let maxObservedAltErrM = 0;
    let maxObservedEcefErrM = 0;

    for (const testCase of testMatrix) {
      // 1. Compute reference ECEF from Independent reference
      const refEcef = IndependentGeodeticReference.toEcef(testCase.lat, testCase.lon, testCase.alt);

      // 2. Compute ECEF with production engine
      const prodEcef = GeodeticFrameEngine.geodeticToEcef({
        latitudeDeg: testCase.lat,
        longitudeDeg: testCase.lon,
        altitudeMeters: testCase.alt
      });

      // Compare Forward Geodetic -> ECEF
      const fwdErr = Math.hypot(
        prodEcef.xMeters - refEcef.x,
        prodEcef.yMeters - refEcef.y,
        prodEcef.zMeters - refEcef.z
      );
      expect(fwdErr).toBeLessThan(1e-7);

      // 3. Compute Inverse ECEF -> Geodetic with production engine
      const prodGeodetic = GeodeticFrameEngine.ecefToGeodetic(prodEcef);

      // 4. Measure decomposed errors
      const latErrDeg = Math.abs(prodGeodetic.latitudeDeg - testCase.lat);
      // Handle +/-180 wrap-around
      let lonDiff = Math.abs(prodGeodetic.longitudeDeg - testCase.lon);
      if (lonDiff > 359.999) lonDiff = Math.abs(lonDiff - 360.0);
      const lonErrDeg = lonDiff;
      const altErrM = Math.abs(prodGeodetic.altitudeMeters - testCase.alt);

      // 5. Compute round-trip ECEF error
      const roundTripEcef = GeodeticFrameEngine.geodeticToEcef(prodGeodetic);
      const ecefPosErrM = Math.hypot(
        roundTripEcef.xMeters - prodEcef.xMeters,
        roundTripEcef.yMeters - prodEcef.yMeters,
        roundTripEcef.zMeters - prodEcef.zMeters
      );

      maxObservedLatErrDeg = Math.max(maxObservedLatErrDeg, latErrDeg);
      maxObservedLonErrDeg = Math.max(maxObservedLonErrDeg, lonErrDeg);
      maxObservedAltErrM = Math.max(maxObservedAltErrM, altErrM);
      maxObservedEcefErrM = Math.max(maxObservedEcefErrM, ecefPosErrM);

      expect(ecefPosErrM).toBeLessThan(testCase.maxAllowedEcefErrorM);
      expect(latErrDeg).toBeLessThan(1e-9);
      expect(lonErrDeg).toBeLessThan(1e-9);
    }

    console.log(`[CAP-SUP-018 ACCURACY CONTRACT SUMMARY]
Max Lat Error (deg): ${maxObservedLatErrDeg.toExponential(3)}
Max Lon Error (deg): ${maxObservedLonErrDeg.toExponential(3)}
Max Alt Error (m):   ${maxObservedAltErrM.toExponential(3)}
Max ECEF Error (m):  ${maxObservedEcefErrM.toExponential(3)}`);
  });

  it('B3: ENU Local Tangent Plane Round-Trip Accuracy', () => {
    const datum: GeodeticPoint = { latitudeDeg: 37.7749, longitudeDeg: -122.4194, altitudeMeters: 50 }; // San Francisco
    const target: GeodeticPoint = { latitudeDeg: 37.7800, longitudeDeg: -122.4100, altitudeMeters: 150 };

    const rtResult = GeodeticFrameEngine.verifyRoundTripAccuracy(target, datum);
    expect(rtResult.passed).toBe(true);
    expect(rtResult.maxPositionalErrorMeters).toBeLessThan(1e-6);
  });
});
