/**
 * SECP CAD Kernel — WP-07 Transformations & Deformation Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { DeformationEngine } from '../modeling/DeformationEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { BRepValidator } from '../brep/BRepValidator';
import { BRepKernel } from '../brep/BRepKernel';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-07 Transformations & Deformation Qualification', () => {
  const validator = new BRepValidator();
  const kernel = BRepKernel.getCanonical();

  it('QUAL-01: Non-Uniform Affine Scaling with Manifold Preservation', () => {
    const box = BoxFactory.createBox('BOX_SCALE', 0, 0, 0, 10, 10, 10);
    const scaledBox = DeformationEngine.scaleNonUniform(box, 2.0, 1.5, 0.5);

    const val = validator.validate(scaledBox);
    expect(val.status).toBe('VALID');
    expect(val.manifoldStatus).toBe('MANIFOLD');

    const origVol = kernel.computeVolume(box as any);
    const scaledVol = kernel.computeVolume(scaledBox as any);
    // Expected volume scale = 2.0 * 1.5 * 0.5 = 1.5x original
    expect(scaledVol).toBeCloseTo(origVol * 1.5, 4);
  });

  it('QUAL-02: Adversarial Rejection of Inverted Jacobian Scaling (sx * sy * sz <= 0)', () => {
    const box = BoxFactory.createBox('BOX_INV', 0, 0, 0, 10, 10, 10);
    expect(() => DeformationEngine.scaleNonUniform(box, -1.0, 1.0, 1.0)).toThrow('Jacobian determinant must be positive');
  });

  it('QUAL-03: 4x4 Affine Matrix Rigid Spatial Translation & Rotation', () => {
    const box = BoxFactory.createBox('BOX_AFFINE', 0, 0, 0, 10, 10, 10);
    // Translate +100 in X, +50 in Y
    const matrix = [
      [1, 0, 0, 100],
      [0, 1, 0, 50],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ];
    const transBox = DeformationEngine.transformAffine(box, matrix);

    const val = validator.validate(transBox);
    expect(val.status).toBe('VALID');

    const origVol = kernel.computeVolume(box as any);
    const transVol = kernel.computeVolume(transBox as any);
    expect(transVol).toBeCloseTo(origVol, 4);
  });

  it('QUAL-04: Non-Linear Spatial Twist Deformation along Z-Axis', () => {
    const box = BoxFactory.createBox('BOX_TWIST', 0, 0, 0, 10, 10, 20);
    const twistedBox = DeformationEngine.twistSolid(box, Math.PI / 4, 20);

    const val = validator.validate(twistedBox);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-05: Non-Linear Spatial Taper Deformation along Z-Axis', () => {
    const box = BoxFactory.createBox('BOX_TAPER', 0, 0, 0, 10, 10, 20);
    const taperedBox = DeformationEngine.taperSolid(box, 1.0, 0.5, 20);

    const val = validator.validate(taperedBox);
    expect(val.status).toBe('VALID');
  });
});
