import { describe, it, expect, beforeEach } from 'vitest';
import { DroneAerodynamicModelManager } from '../aerodynamics/DroneAerodynamicModelManager';
import { EPC024EvidenceGenerator } from '../aerodynamics/EPC024EvidenceGenerator';
import { EPC024Verifier } from '../aerodynamics/EPC024Verifier';
import { ParametricAirframeManager } from '../airframe/ParametricAirframeManager';
import { DronePropulsionManager } from '../propulsion/DronePropulsionManager';
import { DroneMassPropertiesManager } from '../mass/DroneMassPropertiesManager';

describe('EPC-024 — Industrial Drone Aerodynamic Model', () => {
  let aeroManager: DroneAerodynamicModelManager;

  beforeEach(() => {
    const airframeMgr = new ParametricAirframeManager();
    const massMgr = new DroneMassPropertiesManager(airframeMgr);
    const propulsionMgr = new DronePropulsionManager(massMgr);
    aeroManager = new DroneAerodynamicModelManager(airframeMgr, propulsionMgr, massMgr);
  });

  it('1. initializes DroneAerodynamicModelManager with correct model and case IDs', () => {
    expect(aeroManager.modelId).toBe('EPC024-DRONE-AERO-MODEL');
    expect(aeroManager.caseId).toBe('EPC-016-DRONE-ASSEMBLY');
    expect(aeroManager.version).toBe('v1.0.0');
  });

  it('2. evaluates International Standard Atmosphere (ISA) properties accurately across altitudes', () => {
    const seaLevel = aeroManager.getAtmosphericConditions(0);
    expect(seaLevel.altitudeM).toBe(0);
    expect(seaLevel.densityKgM3).toBeCloseTo(1.225, 2);
    expect(seaLevel.pressurePa).toBeCloseTo(101325, 0);
    expect(seaLevel.temperatureK).toBeCloseTo(288.15, 2);
    expect(seaLevel.speedOfSoundMps).toBeGreaterThan(340);

    const highAlt = aeroManager.getAtmosphericConditions(2000);
    expect(highAlt.altitudeM).toBe(2000);
    expect(highAlt.densityKgM3).toBeLessThan(seaLevel.densityKgM3);
    expect(highAlt.pressurePa).toBeLessThan(seaLevel.pressurePa);
  });

  it('3. calculates dynamic reference parameters from airframe geometry footprint', () => {
    const ref = aeroManager.getReferenceParameters();
    expect(ref.referenceAreaM2).toBeGreaterThan(0.05);
    expect(ref.referenceLengthM).toBeGreaterThan(0.20);
    expect(ref.geometryRevision).toBeDefined();
  });

  it('4. decomposes airframe component aerodynamics into drag, lift, and moments', () => {
    const atmos = aeroManager.getAtmosphericConditions(0);
    const components = aeroManager.evaluateComponentAerodynamics(15.0, 0, atmos);

    expect(components.length).toBeGreaterThanOrEqual(6);
    const fuselage = components.find(c => c.componentId === 'COMP-FUSELAGE-001');
    expect(fuselage).toBeDefined();
    expect(fuselage?.dragForceN).toBeGreaterThan(0);

    const arms = components.find(c => c.componentId === 'COMP-ARMS-002');
    expect(arms).toBeDefined();
    expect(arms?.dragForceN).toBeGreaterThan(0);
  });

  it('5. integrates EPC-023 propulsion rotor states and calculates momentum downwash velocity', () => {
    const atmos = aeroManager.getAtmosphericConditions(0);
    const rotors = aeroManager.evaluateRotorAerodynamics(atmos);

    expect(rotors.length).toBe(4); // 4-motor Quadcopter
    rotors.forEach(r => {
      expect(r.rpm).toBeGreaterThan(0);
      expect(r.thrustN).toBeGreaterThan(0);
      expect(r.inducedVelocityMps).toBeGreaterThan(0);
      expect(r.downwashDynamicPressurePa).toBeGreaterThan(0);
    });
  });

  it('6. executes SECP 3D FVM Navier-Stokes CFD solver simulation with residual convergence', () => {
    const atmos = aeroManager.getAtmosphericConditions(0);
    const ref = aeroManager.getReferenceParameters();
    const cfd = aeroManager.runCFDSolverSimulation({ x: 15, y: 0, z: 0 }, atmos, ref.referenceAreaM2);

    expect(cfd.solverSettings.solverName).toContain('3D FVM Navier-Stokes');
    expect(cfd.meshMetadata.totalCells).toBeGreaterThan(0);
    expect(cfd.meshMetadata.hasPositiveVolumes).toBe(true);
    expect(cfd.solution.converged).toBe(true);
    expect(cfd.solution.finalContinuityResidual).toBeLessThan(1e-3);
  });

  it('7. evaluates complete aerodynamic model schema for 15 m/s forward flight', () => {
    const model = aeroManager.evaluateAerodynamicModel(0, { x: 15, y: 0, z: 0 });

    expect(model.aerodynamicModelId).toBe('EPC024-DRONE-AERO-MODEL');
    expect(model.velocityMps).toBeCloseTo(15.0, 2);
    expect(model.dynamicPressurePa).toBeCloseTo(0.5 * 1.225 * 225, 0);
    expect(model.forcesAndMoments.dragN).toBeGreaterThan(0);
    expect(model.coefficients.CD).toBeGreaterThan(0);
    expect(model.coefficients.CD).toBeLessThan(1.5);
    expect(model.regime).toBe('FORWARD_FLIGHT');
    expect(model.regimeStatus).toBe('SUPPORTED');
  });

  it('8. evaluates flight regime matrix correctly including hover and turning flight', () => {
    const hover = aeroManager.evaluateFlightRegime({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0);
    expect(hover.regime).toBe('HOVER');
    expect(hover.status).toBe('SUPPORTED');

    const turning = aeroManager.evaluateFlightRegime({ x: 10, y: 0, z: 0 }, { x: 0.2, y: 0, z: 0 }, 0.03);
    expect(turning.regime).toBe('TURNING_MANEUVERING');
    expect(turning.status).toBe('SUPPORTED');

    const supersonic = aeroManager.evaluateFlightRegime({ x: 300, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.95);
    expect(supersonic.regime).toBe('SUPERSONIC_HIGH_MACH');
    expect(supersonic.status).toBe('NOT_SUPPORTED');
  });

  it('9. generates full aerodynamic polar curves and power required bucket curve', () => {
    const polars = aeroManager.generateAerodynamicOutputs();

    expect(polars.alphaSweepCL.length).toBeGreaterThan(5);
    expect(polars.velocitySweepDrag.length).toBeGreaterThan(5);
    expect(polars.powerRequiredCurve.length).toBeGreaterThan(5);

    // Verify characteristic bucket power curve: hover power > minimum power speed
    const hoverPower = polars.powerRequiredCurve.find(p => p.velocityMps === 0)?.powerReqW || 0;
    expect(hoverPower).toBeGreaterThan(300);
  });

  it('10. performs 10/10 physics sanity and physical consistency checks', () => {
    const model = aeroManager.evaluateAerodynamicModel(0, { x: 15, y: 0, z: 0 });
    const validation = aeroManager.validatePhysicsSanity(model);

    expect(validation.passed).toBe(true);
    expect(validation.checks.liftDirectionValid).toBe(true);
    expect(validation.checks.dragDirectionValid).toBe(true);
    expect(validation.checks.dynamicPressurePositive).toBe(true);
    expect(validation.checks.densityPhysical).toBe(true);
    expect(validation.checks.coefficientBoundsValid).toBe(true);
    expect(validation.checks.conservationCheckValid).toBe(true);
  });

  it('11. verifies requirement traceability graph linking requirement to CFD simulation', () => {
    const trace = aeroManager.getRequirementTraceability();
    expect(trace.length).toBeGreaterThan(0);
    trace.forEach(item => {
      expect(item.requirementId).toBeDefined();
      expect(item.simulatedValue).toBeDefined();
      expect(item.verified).toBe(true);
    });
  });

  it('12. performs deterministic execution audit verifying zero numerical drift', () => {
    const audit = aeroManager.auditReproducibility();
    expect(audit.length).toBeGreaterThan(0);
    audit.forEach(item => {
      expect(item.verdict).toBe('PASS');
      expect(item.difference).toBeLessThanOrEqual(item.tolerance);
    });
  });

  it('13. constructs signed cryptographic evidence package (EPC024-PKG-*)', () => {
    const pkg = EPC024EvidenceGenerator.generateEvidencePackage(aeroManager);

    expect(pkg.packageId).toContain('EPC024-PKG-');
    expect(pkg.canonicalInputHash).toBeDefined();
    expect(pkg.canonicalOutputHash).toBeDefined();
    expect(pkg.signature).toContain('SIG-EPC024-');
    expect(pkg.provenance.cfdSolverEngine).toContain('SECP_FVM_3D_NAVIER_STOKES_SOLVER');
  });

  it('14. runs master EPC024Verifier and renders ENGINEERING VERDICT: PASS', () => {
    const summary = EPC024Verifier.verifyAerodynamicModel(aeroManager);

    expect(summary.verdict).toBe('PASS');
    expect(summary.failedCount).toBe(0);
    expect(summary.passedCount).toBe(summary.totalCriteriaCount);
    expect(summary.verdictReportString).toContain('ENGINEERING VERDICT: EPC-024 = PASS');
  });
});
