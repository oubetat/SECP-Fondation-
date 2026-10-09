import { describe, it, expect } from 'vitest';
import { BRepKernel } from '../../brep/BRepKernel';
import { CFDAdapter } from '../CFDAdapter';
import { Fvm3DNavierStokesSolver } from '../../../cfd3d/Fvm3DNavierStokesSolver';
import { EngineeringHashChain } from '../../../evidence/EngineeringHashChain';

describe('PATCH-KERNEL-008 — CAD -> CFD Pipeline Verification', () => {
  const brepKernel = BRepKernel.getCanonical();

  it('should detect geometric changes and propagate them through the entire CFD pipeline', () => {
    // 1. Setup two pipes with DIFFERENT diameters (20mm vs 40mm)
    // createCylinder(r, h)
    const pipeA = brepKernel.createCylinder(0.01, 0.1, 'Pipe_20mm'); // r=10mm -> d=20mm
    const pipeB = brepKernel.createCylinder(0.02, 0.1, 'Pipe_40mm'); // r=20mm -> d=40mm

    // 2. Extract domain & mesh from BRep
    const { mesh: meshA, brepHash: hashA, meshHash: mHashA } = CFDAdapter.meshFromBRep(pipeA, {
      nx: 10, ny: 4, nz: 4,
      inletVelocity: { x: 1.0, y: 0, z: 0 }
    });

    const { mesh: meshB, brepHash: hashB, meshHash: mHashB } = CFDAdapter.meshFromBRep(pipeB, {
      nx: 10, ny: 4, nz: 4,
      inletVelocity: { x: 1.0, y: 0, z: 0 }
    });

    // 3. ASSERT: BRep Hashes must be different
    console.log('BRepHash 20mm:', hashA);
    console.log('BRepHash 40mm:', hashB);
    expect(hashA).not.toBe(hashB);

    // 4. ASSERT: Domain / Mesh properties must be different
    console.log('Cell Volume A:', meshA.cells[0].volume);
    console.log('Cell Volume B:', meshB.cells[0].volume);
    expect(meshA.cells[0].volume).not.toBe(meshB.cells[0].volume);
    expect(meshA.boundingBox).not.toEqual(meshB.boundingBox);
    expect(mHashA).not.toBe(mHashB);

    // 5. Run Navier-Stokes solver on both
    const fluid = { densityKgM3: 1.225, viscosityPaS: 1.8e-5 };
    const config = {
      maxIterations: 10, // Small iterations for verification speed
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR' as const,
      upwindScheme: 'FIRST_ORDER_UPWIND' as const
    };

    const resA = Fvm3DNavierStokesSolver.solve(meshA, fluid, config);
    const resB = Fvm3DNavierStokesSolver.solve(meshB, fluid, config);

    // 6. ASSERT: Results must reflect the geometry
    // Pressure drop in a pipe is sensitive to diameter (dP ~ 1/D^4 for laminar flow)
    console.log('Pressure Drop A:', resA.monitors.pressureDropPa);
    console.log('Pressure Drop B:', resB.monitors.pressureDropPa);
    expect(resA.monitors.pressureDropPa).not.toBe(resB.monitors.pressureDropPa);

    // Velocity field hashes
    const uHashA = EngineeringHashChain.computeCanonicalHash(resA.velocity.u).canonicalHash;
    const uHashB = EngineeringHashChain.computeCanonicalHash(resB.velocity.u).canonicalHash;
    expect(uHashA).not.toBe(uHashB);

    console.log('CFD Pipeline Divergence Verified.');
  });
});
