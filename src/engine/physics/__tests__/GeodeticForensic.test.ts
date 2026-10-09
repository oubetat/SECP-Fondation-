import { describe, it, expect } from 'vitest';
import { GeodeticFrameEngine } from '../GeodeticFrameEngine';

describe('GeodeticForensic — Geodetic Correctness Audit', () => {
  it('FORENSIC: Should match WGS84 standard reference points (Equator/Poles)', () => {
    // Equator (0,0,0) -> X=a, Y=0, Z=0
    const equator = { latitudeDeg: 0, longitudeDeg: 0, altitudeMeters: 0 };
    const ecefEquator = GeodeticFrameEngine.geodeticToEcef(equator);
    expect(ecefEquator.xMeters).toBeCloseTo(6378137.0, 1);
    expect(ecefEquator.yMeters).toBeCloseTo(0, 1);
    expect(ecefEquator.zMeters).toBeCloseTo(0, 1);

    // North Pole (90,0,0) -> X=0, Y=0, Z=b
    const nPole = { latitudeDeg: 90, longitudeDeg: 0, altitudeMeters: 0 };
    const ecefNPole = GeodeticFrameEngine.geodeticToEcef(nPole);
    expect(ecefNPole.xMeters).toBeCloseTo(0, 1);
    expect(ecefNPole.yMeters).toBeCloseTo(0, 1);
    expect(ecefNPole.zMeters).toBeCloseTo(6356752.314, 1);
  });

  it('ADVERSARIAL: Should handle extreme altitudes and ±180 longitude', () => {
    const spacePoint = { latitudeDeg: 45, longitudeDeg: 180, altitudeMeters: 400000 }; // ISS altitude
    const ecef = GeodeticFrameEngine.geodeticToEcef(spacePoint);
    const roundTrip = GeodeticFrameEngine.ecefToGeodetic(ecef);

    expect(roundTrip.latitudeDeg).toBeCloseTo(45, 7);
    expect(Math.abs(roundTrip.longitudeDeg)).toBeCloseTo(180, 7);
    expect(roundTrip.altitudeMeters).toBeCloseTo(400000, 1);
  });
});
