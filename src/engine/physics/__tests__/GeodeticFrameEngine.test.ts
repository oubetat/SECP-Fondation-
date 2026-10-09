import { describe, it, expect } from 'vitest';
import { GeodeticFrameEngine } from '../GeodeticFrameEngine';

describe('GeodeticFrameEngine — Geodetic Frame Transformation Kernel', () => {
  it('should convert WGS84 Geodetic coordinates to ECEF and back with zero loss', () => {
    // NASA Kennedy Space Center Launch Pad 39A
    const origPt = {
      latitudeDeg: 28.608389,
      longitudeDeg: -80.604333,
      altitudeMeters: 10.5
    };

    const ecef = GeodeticFrameEngine.geodeticToEcef(origPt);
    const roundTripPt = GeodeticFrameEngine.ecefToGeodetic(ecef);

    expect(roundTripPt.latitudeDeg).toBeCloseTo(origPt.latitudeDeg, 7);
    expect(roundTripPt.longitudeDeg).toBeCloseTo(origPt.longitudeDeg, 7);
    expect(roundTripPt.altitudeMeters).toBeCloseTo(origPt.altitudeMeters, 4);
  });

  it('should convert ECEF to Local ENU relative to reference datum', () => {
    const datum = { latitudeDeg: 37.774929, longitudeDeg: -122.419416, altitudeMeters: 0.0 }; // San Francisco
    const target = { latitudeDeg: 37.775000, longitudeDeg: -122.419000, altitudeMeters: 5.0 };

    const targetEcef = GeodeticFrameEngine.geodeticToEcef(target);
    const enu = GeodeticFrameEngine.ecefToEnu(targetEcef, datum);

    expect(enu.eastMeters).toBeGreaterThan(0); // Target is east of datum
    expect(enu.northMeters).toBeGreaterThan(0); // Target is north of datum
    expect(enu.upMeters).toBeCloseTo(5.0, 2);
  });

  it('should verify sub-micrometer round-trip positional accuracy', () => {
    const datum = { latitudeDeg: 48.858844, longitudeDeg: 2.294351, altitudeMeters: 35.0 }; // Paris
    const airframePoint = { latitudeDeg: 48.859000, longitudeDeg: 2.295000, altitudeMeters: 40.0 };

    const res = GeodeticFrameEngine.verifyRoundTripAccuracy(airframePoint, datum);

    expect(res.passed).toBe(true);
    expect(res.maxPositionalErrorMeters).toBeLessThan(1e-6); // < 1 micrometer
  });
});
