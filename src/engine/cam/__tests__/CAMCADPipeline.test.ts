import { describe, it, expect } from 'vitest';
import { BRepKernel } from '../../cad-kernel/brep/BRepKernel';
import { CAMSetup } from '../CAMSetup';
import { ManufacturingFeatureEngine } from '../feature-recognition/ManufacturingFeatureEngine';
import { ManufacturingFeatureType } from '../feature-recognition/FeatureTypes';

describe('PATCH-KERNEL-009 — CAD -> CAM Pipeline Verification', () => {
  it('should initialize CAM setup directly from BRep solid and recognize features', () => {
    // 1. Create a rich benchmark solid with holes, pockets, etc.
    const solid = ManufacturingFeatureEngine.createSyntheticMachiningTestSolid(150, 100, 40, 'Benchmark_Part');

    // 2. Initialize CAM setup from BRep
    const camSetup = CAMSetup.fromBRep(solid);

    // 3. ASSERT: Bounding Box is derived from geometry
    expect(camSetup.boundingBox.max.x).toBeCloseTo(0.15, 5); // 150mm -> 0.15m
    expect(camSetup.boundingBox.max.y).toBeCloseTo(0.1, 5);
    expect(camSetup.boundingBox.max.z).toBeCloseTo(0.045, 5);

    // 4. ASSERT: Features are recognized
    console.log('Recognized Holes:', camSetup.features.holes.length);
    console.log('Recognized Pockets:', camSetup.features.pockets.length);
    
    expect(camSetup.features.holes.length).toBeGreaterThan(0);
    expect(camSetup.features.pockets.length).toBeGreaterThan(0);
    // expect(camSetup.features.planes.length).toBeGreaterThan(0); // Stubbed
    expect(camSetup.machiningRegions.length).toBeGreaterThan(0);

    // 5. Verify Feature Graph exists
    expect(camSetup.featureGraph).toBeDefined();
  });

  it('should detect geometric changes and propagate them to CAM setup', () => {
    const brepKernel = BRepKernel.getCanonical();
    
    // Create two boxes of different sizes
    const boxA = brepKernel.createBox(0.1, 0.1, 0.05, 'BoxA');
    const boxB = brepKernel.createBox(0.2, 0.2, 0.05, 'BoxB');

    const setupA = CAMSetup.fromBRep(boxA);
    const setupB = CAMSetup.fromBRep(boxB);

    // BRep hashes must be different
    expect(setupA.brepHash).not.toBe(setupB.brepHash);

    // Bounding boxes must be different
    expect(setupA.boundingBox.max.x).not.toBe(setupB.boundingBox.max.x);
    
    console.log('CAM Setup Divergence Verified for box design change.');
  });
});
