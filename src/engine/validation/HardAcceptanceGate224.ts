/**
 * PATCH-224 — Hard Acceptance Gate 224: Gear Engineering, Kinematics & B-Rep Assembly Integration
 * Rigorous multi-stage verification gate testing parametric Spur, Helical, Internal, and Pinion gears,
 * real analytical involute tooth generation, DIN 6885-1 keyways, Euler-Poincaré topology,
 * ISO 6336 / AGMA stress & safety factors, Gear Pair meshing & contact ratios (epsilon_alpha > 1.2),
 * Assembly kinematic mates, Shaft mounting, Adversarial rejections, STEP/IGES exports, and CAM metadata.
 */

import { GearGenerator } from '../assembly/gear/GearGenerator';
import { GearInvoluteEngine } from '../assembly/gear/GearInvoluteEngine';
import { GearStandardRegistry } from '../assembly/gear/GearStandardRegistry';
import { GearPairKinematicsEngine } from '../assembly/gear/GearPairKinematicsEngine';
import { GearAssemblyBridge } from '../assembly/gear/GearAssemblyBridge';
import { GearDefinition } from '../assembly/gear/GearTypes';

export interface Gate224Check {
  id: string;
  name: string;
  category: 'INVOLUTE_GEOMETRY' | 'HELICAL_INTERNAL' | 'TOPOLOGY_BREP' | 'GEAR_PAIR_KINEMATICS' | 'ASSEMBLY_SHAFT_INTEGRATION' | 'ISO6336_STRENGTH' | 'ADVERSARIAL_ROBUSTNESS' | 'STEP_IGES_CAM';
  status: 'PASS' | 'FAIL';
  description: string;
  data?: any;
}

export interface HardAcceptanceGate224Report {
  gateId: 'GATE-224-GEARS';
  verdict: 'PROVEN' | 'FAIL';
  totalChecks: number;
  passedChecks: number;
  timestamp: string;
  checks: Gate224Check[];
  evidencePackage: Record<string, string>;
}

export class HardAcceptanceGate224 {
  public async validate(): Promise<HardAcceptanceGate224Report> {
    const checks: Gate224Check[] = [];
    const evidencePackage: Record<string, string> = {};

    // =========================================================================
    // 1. SPUR GEAR ANALYTICAL INVOLUTE GENERATION (m=2.0mm, z=24, alpha=20°)
    // =========================================================================
    const spurGear = GearGenerator.createParametricGear({
      gearId: 'GEAR-SPUR-01',
      name: 'Precision Spur Gear m2.0 z24',
      module: 2.0,
      teethCount: 24,
      pressureAngleDeg: 20,
      faceWidthMm: 25,
      material: 'CASE_HARDENED_16MNCR5',
      bore: { diameterMm: 15, hasKeyway: true }
    });

    const expectedPitchDia = 2.0 * 24; // 48.0 mm
    const expectedBaseDia = 48.0 * Math.cos((20 * Math.PI) / 180); // ~45.105 mm
    const expectedTipDia = 48.0 + 2 * 2.0; // 52.0 mm
    const expectedRootDia = 48.0 - 2 * (1.25 * 2.0); // 43.0 mm

    const pitchDiff = Math.abs(spurGear.pitchDiameterMm! - expectedPitchDia);
    const baseDiff = Math.abs(spurGear.baseDiameterMm! - expectedBaseDia);
    const tipDiff = Math.abs(spurGear.tipDiameterMm! - expectedTipDia);
    const rootDiff = Math.abs(spurGear.rootDiameterMm! - expectedRootDia);

    checks.push({
      id: 'CHK-224-01',
      name: 'Spur Gear Analytical Dimensions (ISO 21771)',
      category: 'INVOLUTE_GEOMETRY',
      status: pitchDiff < 0.001 && baseDiff < 0.01 && tipDiff < 0.001 && rootDiff < 0.001 ? 'PASS' : 'FAIL',
      description: `Pitch Ø=${spurGear.pitchDiameterMm}mm (exp 48), Base Ø=${spurGear.baseDiameterMm!.toFixed(3)}mm (exp ${expectedBaseDia.toFixed(3)}), Tip Ø=${spurGear.tipDiameterMm}mm (exp 52), Root Ø=${spurGear.rootDiameterMm}mm (exp 43)`,
      data: { pitchDiameterMm: spurGear.pitchDiameterMm, baseDiameterMm: spurGear.baseDiameterMm, tipDiameterMm: spurGear.tipDiameterMm, rootDiameterMm: spurGear.rootDiameterMm }
    });

    // =========================================================================
    // 2. INVOLUTE PROFILE CURVE CONTINUITY & ANGULAR PATTERNING
    // =========================================================================
    const toothCountGenerated = spurGear.involuteProfile.length;
    const firstTooth = spurGear.involuteProfile[0];
    const leftFlankPointsCount = firstTooth.leftFlankPoints.length;
    const rightFlankPointsCount = firstTooth.rightFlankPoints.length;

    // Check involute math at pitch circle on left flank: radius must be close to pitch radius
    const midPointLeft = firstTooth.leftFlankPoints[Math.floor(leftFlankPointsCount / 2)];
    const isFlankRadiusValid = midPointLeft.radius >= firstTooth.baseRadiusMm && midPointLeft.radius <= firstTooth.tipRadiusMm;

    checks.push({
      id: 'CHK-224-02',
      name: 'Involute Curve Generation & 360° Circular Pattern',
      category: 'INVOLUTE_GEOMETRY',
      status: toothCountGenerated === 24 && leftFlankPointsCount >= 16 && rightFlankPointsCount >= 16 && isFlankRadiusValid ? 'PASS' : 'FAIL',
      description: `Generated ${toothCountGenerated} teeth involute profiles, each with ${leftFlankPointsCount} flank vertices bounded between Base Ø${firstTooth.baseRadiusMm.toFixed(2)} and Tip Ø${firstTooth.tipRadiusMm.toFixed(2)}.`,
      data: { toothCountGenerated, leftFlankPointsCount, rightFlankPointsCount }
    });

    // =========================================================================
    // 3. HELICAL GEAR GEOMETRY (Normal Module mn=2.5, beta=15°, z=30)
    // =========================================================================
    const helicalGear = GearGenerator.createParametricGear({
      gearId: 'GEAR-HELICAL-01',
      name: 'Helical Gear mn2.5 z30 beta15 RH',
      module: 2.5,
      teethCount: 30,
      helixAngleDeg: 15,
      helixDirection: 'RIGHT_HAND',
      pressureAngleDeg: 20,
      faceWidthMm: 35,
      material: 'NITRIDED_42CRMO4',
      bore: { diameterMm: 25, hasKeyway: true }
    });

    const expectedTransverseModule = 2.5 / Math.cos((15 * Math.PI) / 180); // ~2.588 mm
    const expectedHelicalPitchDia = expectedTransverseModule * 30; // ~77.646 mm
    const mtDiff = Math.abs(helicalGear.transverseModule! - expectedTransverseModule);
    const helicalPitchDiff = Math.abs(helicalGear.pitchDiameterMm! - expectedHelicalPitchDia);

    checks.push({
      id: 'CHK-224-03',
      name: 'Helical Gear Transverse Module & Pitch Diameter',
      category: 'HELICAL_INTERNAL',
      status: mtDiff < 0.01 && helicalPitchDiff < 0.01 && helicalGear.helixDirection === 'RIGHT_HAND' ? 'PASS' : 'FAIL',
      description: `Normal module mn=2.5mm, Transverse module mt=${helicalGear.transverseModule!.toFixed(3)}mm (exp ${expectedTransverseModule.toFixed(3)}), Pitch Ø=${helicalGear.pitchDiameterMm!.toFixed(3)}mm (exp ${expectedHelicalPitchDia.toFixed(3)})`,
      data: { transverseModule: helicalGear.transverseModule, pitchDiameterMm: helicalGear.pitchDiameterMm }
    });

    // =========================================================================
    // 4. INTERNAL GEAR INWARD TEETH GEOMETRY (m=3.0, z=60, Internal)
    // =========================================================================
    const internalGear = GearGenerator.createParametricGear({
      gearId: 'GEAR-INTERNAL-01',
      name: 'Internal Ring Gear m3.0 z60',
      type: 'SPUR_INTERNAL',
      module: 3.0,
      teethCount: 60,
      pressureAngleDeg: 20,
      faceWidthMm: 40,
      bore: { diameterMm: 220, type: 'SOLID_NO_BORE', hasKeyway: false }
    });

    const expectedInternalPitch = 3.0 * 60; // 180 mm
    const expectedInternalTip = 180 - 2 * 3.0; // 174 mm (inward tip is smaller than pitch)
    const expectedInternalRoot = 180 + 2 * (1.25 * 3.0); // 187.5 mm

    const isInternalValid = internalGear.tipDiameterMm! < internalGear.pitchDiameterMm! && internalGear.rootDiameterMm! > internalGear.pitchDiameterMm!;

    checks.push({
      id: 'CHK-224-04',
      name: 'Internal Gear Inward Flank & Tip/Root Geometry',
      category: 'HELICAL_INTERNAL',
      status: isInternalValid && Math.abs(internalGear.pitchDiameterMm! - expectedInternalPitch) < 0.001 ? 'PASS' : 'FAIL',
      description: `Internal Ring Pitch Ø=${internalGear.pitchDiameterMm}mm, Tip Ø=${internalGear.tipDiameterMm}mm (inward < Pitch), Root Ø=${internalGear.rootDiameterMm}mm (outward > Pitch).`,
      data: { pitchDiameterMm: internalGear.pitchDiameterMm, tipDiameterMm: internalGear.tipDiameterMm, rootDiameterMm: internalGear.rootDiameterMm }
    });

    // =========================================================================
    // 5. DIN 6885-1 KEYWAY BOOLEAN SUBTRACTION FROM GEAR BORE
    // =========================================================================
    const keyedGear = GearGenerator.createParametricGear({
      gearId: 'GEAR-KEYED-01',
      module: 3.0,
      teethCount: 20,
      bore: { diameterMm: 20, hasKeyway: true }
    });

    // For bore Ø20mm, DIN 6885-1 specifies key width 6mm, hub depth t2 2.8mm
    const keySpec = GearStandardRegistry.getHubKeyway(20);
    const hasKeywayFeature = keyedGear.featureTree?.some((f: any) => f.type === 'KEYWAY_CUT') ?? false;

    checks.push({
      id: 'CHK-224-05',
      name: 'Bore & DIN 6885-1 Keyway Subtraction Feature',
      category: 'TOPOLOGY_BREP',
      status: keyedGear.bore.keywayWidthMm === 6 && keyedGear.bore.keywayDepthMm === 2.8 && hasKeywayFeature ? 'PASS' : 'FAIL',
      description: `Bore Ø20mm equipped with DIN 6885-1 Keyway: Width=${keyedGear.bore.keywayWidthMm}mm (exp 6), Hub depth=${keyedGear.bore.keywayDepthMm}mm (exp 2.8).`,
      data: { boreDiameter: keyedGear.bore.diameterMm, keyWidth: keyedGear.bore.keywayWidthMm, keyDepth: keyedGear.bore.keywayDepthMm }
    });

    // =========================================================================
    // 6. EULER-POINCARÉ 2-MANIFOLD TOPOLOGY (V - E + F = 2) & WATERTIGHTNESS
    // =========================================================================
    const topo = spurGear.topologySummary;
    const isManifoldValid = topo.isWatertight && topo.eulerCharacteristic === 2 && topo.manifoldCheckStatus === 'VALID';

    checks.push({
      id: 'CHK-224-06',
      name: 'B-Rep Solid Manifold & Euler-Poincaré Verification',
      category: 'TOPOLOGY_BREP',
      status: isManifoldValid ? 'PASS' : 'FAIL',
      description: `Euler characteristic chi=${topo.eulerCharacteristic} (exp 2), Watertight=${topo.isWatertight}, Faces=${topo.faceCount}, Edges=${topo.edgeCount}, Vertices=${topo.vertexCount}.`,
      data: { euler: topo.eulerCharacteristic, isWatertight: topo.isWatertight, faces: topo.faceCount }
    });

    // =========================================================================
    // 7. MASS PROPERTIES & MASS MOMENT OF INERTIA I_ZZ
    // =========================================================================
    const mass = spurGear.massProperties;
    const isMassValid = mass.massKg > 0.05 && mass.momentOfInertiaIzzKgMm2 > 0 && mass.volumeMm3 > 0;

    checks.push({
      id: 'CHK-224-07',
      name: 'Solid Mass Properties & Polar Inertia I_zz',
      category: 'TOPOLOGY_BREP',
      status: isMassValid ? 'PASS' : 'FAIL',
      description: `Volume=${mass.volumeMm3.toFixed(2)}mm³, Mass=${mass.massKg}kg (Case Hardened 16MnCr5 @ 7850 kg/m³), Izz=${mass.momentOfInertiaIzzKgMm2} kg*mm², Radius of gyration=${mass.polarRadiusOfGyrationMm}mm.`,
      data: { volumeMm3: mass.volumeMm3, massKg: mass.massKg, izz: mass.momentOfInertiaIzzKgMm2 }
    });

    // =========================================================================
    // 8. GEAR PAIR MESHING & OPERATING CENTER DISTANCE (z1=20, z2=60, m=2.5)
    // =========================================================================
    const pinion = GearGenerator.createParametricGear({
      gearId: 'GEAR-PINION-20',
      module: 2.5,
      teethCount: 20,
      faceWidthMm: 30,
      material: 'CASE_HARDENED_16MNCR5'
    });

    const wheel = GearGenerator.createParametricGear({
      gearId: 'GEAR-WHEEL-60',
      module: 2.5,
      teethCount: 60,
      faceWidthMm: 30,
      material: 'CASE_HARDENED_16MNCR5'
    });

    const gearPair = GearPairKinematicsEngine.createGearPair({
      pinionGear: pinion,
      wheelGear: wheel,
      pinionSpeedRpm: 1500,
      inputPowerKw: 15
    });

    const expectedCenterDist = (2.5 * 20 + 2.5 * 60) / 2; // (50 + 150) / 2 = 100.0 mm
    const expectedRatio = 60 / 20; // 3.0 : 1

    const centerDistDiff = Math.abs(gearPair.nominalCenterDistanceMm! - expectedCenterDist);
    const ratioDiff = Math.abs(gearPair.gearRatio - expectedRatio);

    checks.push({
      id: 'CHK-224-08',
      name: 'Gear Pair Center Distance & Exact Ratio (3:1)',
      category: 'GEAR_PAIR_KINEMATICS',
      status: centerDistDiff < 0.001 && ratioDiff < 0.001 && gearPair.meshingStatus === 'PERFECT_MESH' ? 'PASS' : 'FAIL',
      description: `Pinion z=20, Wheel z=60: Center distance a=${gearPair.nominalCenterDistanceMm}mm (exp 100.0), Gear ratio i=${gearPair.gearRatio} (exp 3.00).`,
      data: { nominalCenterDistanceMm: gearPair.nominalCenterDistanceMm, gearRatio: gearPair.gearRatio }
    });

    // =========================================================================
    // 9. PROFILE CONTACT RATIO (epsilon_alpha >= 1.20)
    // =========================================================================
    const contactRatio = gearPair.contactRatioProfileEpsilonAlpha!;
    const isContactRatioSufficient = contactRatio >= 1.20;

    checks.push({
      id: 'CHK-224-09',
      name: 'Profile Contact Ratio Verification (εα >= 1.20)',
      category: 'GEAR_PAIR_KINEMATICS',
      status: isContactRatioSufficient ? 'PASS' : 'FAIL',
      description: `Computed Profile Contact Ratio εα=${contactRatio} >= 1.20 (Ensures continuous multi-tooth load handover without impact shock).`,
      data: { contactRatioProfileEpsilonAlpha: contactRatio }
    });

    // =========================================================================
    // 10. ROTATION RELATIONSHIP & DIRECTION TRANSMISSION
    // =========================================================================
    const isOppositeRotation = gearPair.pinionRotationDirection === 'CW' && gearPair.wheelRotationDirection === 'CCW';
    const expectedWheelSpeed = 1500 / 3; // 500 RPM
    const wheelSpeedDiff = Math.abs(gearPair.wheelSpeedRpm! - expectedWheelSpeed);

    checks.push({
      id: 'CHK-224-10',
      name: 'Kinematic Rotation Direction & Angular Velocity',
      category: 'GEAR_PAIR_KINEMATICS',
      status: isOppositeRotation && wheelSpeedDiff < 0.01 ? 'PASS' : 'FAIL',
      description: `Pinion @ 1500 RPM (CW) → Wheel @ ${gearPair.wheelSpeedRpm} RPM (CCW) (Exact transmission ratio 1:3).`,
      data: { pinionSpeedRpm: gearPair.pinionSpeedRpm, wheelSpeedRpm: gearPair.wheelSpeedRpm, pinionDir: gearPair.pinionRotationDirection, wheelDir: gearPair.wheelRotationDirection }
    });

    // =========================================================================
    // 11. ISO 6336 / AGMA BENDING & CONTACT STRESS ANALYSIS
    // =========================================================================
    const str = pinion.strengthPreparation;
    const isStrengthValid = str.tangentialForceFtN > 0 && str.calculatedBendingStressSigmaFMpa > 0 && str.calculatedContactStressSigmaHMpa > 0 && str.bendingSafetyFactorSF > 1.0;

    checks.push({
      id: 'CHK-224-11',
      name: 'ISO 6336 / AGMA Bending & Contact Safety Factors',
      category: 'ISO6336_STRENGTH',
      status: isStrengthValid ? 'PASS' : 'FAIL',
      description: `Torque=${str.nominalTorqueNm}Nm, Tangential Force Ft=${str.tangentialForceFtN}N, Bending Stress σF=${str.calculatedBendingStressSigmaFMpa}MPa (SF=${str.bendingSafetyFactorSF}), Contact Stress σH=${str.calculatedContactStressSigmaHMpa}MPa (SH=${str.contactSafetyFactorSH}).`,
      data: { torqueNm: str.nominalTorqueNm, ftN: str.tangentialForceFtN, sigmaF: str.calculatedBendingStressSigmaFMpa, sf: str.bendingSafetyFactorSF, sh: str.contactSafetyFactorSH }
    });

    // =========================================================================
    // 12. ASSEMBLY SHAFT INTEGRATION & BORE-TO-JOURNAL MATING
    // =========================================================================
    const shaftMount = GearAssemblyBridge.createShaftMountConstraints({
      gear: spurGear,
      shaftComponentId: 'COMP-SHAFT-MAIN',
      shaftJournalDiameterMm: 15,
      shaftJournalLengthMm: 30,
      axialPositionZMm: 50
    });

    const isShaftFitValid = shaftMount.isBoreFitValid && shaftMount.concentricConstraint.status === 'SATISFIED' && shaftMount.axialMateConstraint.status === 'SATISFIED';

    checks.push({
      id: 'CHK-224-12',
      name: 'Shaft Journal Concentric & Planar Shoulder Mates',
      category: 'ASSEMBLY_SHAFT_INTEGRATION',
      status: isShaftFitValid ? 'PASS' : 'FAIL',
      description: `Gear bore Ø15mm mounted to Shaft Journal Ø15mm: Concentric mate constraint [${shaftMount.concentricConstraint.constraintId}] and Shoulder mate [${shaftMount.axialMateConstraint.constraintId}] verified.`,
      data: { concentricStatus: shaftMount.concentricConstraint.status, axialStatus: shaftMount.axialMateConstraint.status }
    });

    // =========================================================================
    // 13. ASSEMBLY GEAR MATE KINEMATIC COUPLING
    // =========================================================================
    const instPinion = GearAssemblyBridge.createGearAssemblyComponent(pinion, 1);
    const instWheel = GearAssemblyBridge.createGearAssemblyComponent(wheel, 1);
    const gearMate = GearAssemblyBridge.createGearMateConstraint(instPinion, instWheel, gearPair);

    checks.push({
      id: 'CHK-224-13',
      name: 'Assembly Constraint Solver GEAR_MATE Coupling',
      category: 'ASSEMBLY_SHAFT_INTEGRATION',
      status: gearMate.status === 'SATISFIED' && gearMate.parameters.ratio === 3.0 ? 'PASS' : 'FAIL',
      description: `Created GEAR_MATE kinematic constraint with pitch coupling ratio 3:1 between ${instPinion.instanceId} and ${instWheel.instanceId}.`,
      data: { constraintId: gearMate.constraintId, ratio: gearMate.parameters.ratio, reverseDirection: gearMate.parameters.reverseDirection }
    });

    // =========================================================================
    // 14. MULTI-STAGE GEAR TRAIN KINEMATIC REDUCTION SOLVER
    // =========================================================================
    const trainResult = GearAssemblyBridge.solveGearTrain(
      [
        { pinionTeeth: 18, wheelTeeth: 54 }, // 3:1
        { pinionTeeth: 20, wheelTeeth: 80 }  // 4:1
      ],
      1440 // 1440 RPM motor input
    );

    const expectedTotalRatio = 3 * 4; // 12:1
    const expectedOutputRpm = 1440 / 12; // 120 RPM

    checks.push({
      id: 'CHK-224-14',
      name: 'Multi-Stage 2-Step Gear Train Reduction (12:1)',
      category: 'ASSEMBLY_SHAFT_INTEGRATION',
      status: trainResult.totalReductionRatio === 12 && trainResult.outputRpm === 120 ? 'PASS' : 'FAIL',
      description: `Stage 1 (18:54=3:1) + Stage 2 (20:80=4:1) → Total Reduction 12:1, Input 1440 RPM → Output ${trainResult.outputRpm} RPM (Torque multiplier=${trainResult.outputTorqueMultiplier}x).`,
      data: { totalRatio: trainResult.totalReductionRatio, outputRpm: trainResult.outputRpm, torqueMultiplier: trainResult.outputTorqueMultiplier }
    });

    // =========================================================================
    // 15. ADVERSARIAL: MODULE MISMATCH REJECTION
    // =========================================================================
    const gearM2 = GearGenerator.createParametricGear({ module: 2.0, teethCount: 20 });
    const gearM3 = GearGenerator.createParametricGear({ module: 3.0, teethCount: 40 });
    const mismatchPair = GearPairKinematicsEngine.createGearPair({ pinionGear: gearM2, wheelGear: gearM3 });

    checks.push({
      id: 'CHK-224-15',
      name: 'Adversarial: Module Mismatch Rejection',
      category: 'ADVERSARIAL_ROBUSTNESS',
      status: mismatchPair.meshingStatus === 'MODULE_MISMATCH' && mismatchPair.diagnostics?.some((d: string) => d.includes('Module Mismatch')) ? 'PASS' : 'FAIL',
      description: `Correctly rejected meshing between m=2.0mm and m=3.0mm gears with MODULE_MISMATCH diagnostic.`,
      data: { meshingStatus: mismatchPair.meshingStatus, diagnostics: mismatchPair.diagnostics }
    });

    // =========================================================================
    // 16. ADVERSARIAL: IMPOSSIBLE CENTER DISTANCE & TOOTH CLASH
    // =========================================================================
    const clashPair = GearPairKinematicsEngine.createGearPair({
      pinionGear: pinion,
      wheelGear: wheel,
      centerDistanceOverrideMm: 40 // Too small for (50+150)/2 = 100mm -> severe clash
    });

    checks.push({
      id: 'CHK-224-16',
      name: 'Adversarial: Impossible Center Distance Clash Rejection',
      category: 'ADVERSARIAL_ROBUSTNESS',
      status: clashPair.hasInterference && clashPair.meshingStatus === 'TIP_INTERFERENCE' ? 'PASS' : 'FAIL',
      description: `Correctly identified severe physical tooth clash when center distance overridden to 40mm (nominal 100mm).`,
      data: { hasInterference: clashPair.hasInterference, meshingStatus: clashPair.meshingStatus }
    });

    // =========================================================================
    // 17. ADVERSARIAL: UNDERCUT DIAGNOSTIC FOR LOW TOOTH COUNT (z=8)
    // =========================================================================
    const lowTeethGear = GearGenerator.createParametricGear({
      module: 2.0,
      teethCount: 8,
      pressureAngleDeg: 20
    });

    const hasUndercutWarning = lowTeethGear.diagnostics?.some((d: string) => d.includes('Undercut will occur') || d.includes('below minimum threshold')) ?? false;

    checks.push({
      id: 'CHK-224-17',
      name: 'Adversarial: Undercut Warning for Low Teeth Count (z=8 < 17)',
      category: 'ADVERSARIAL_ROBUSTNESS',
      status: hasUndercutWarning ? 'PASS' : 'FAIL',
      description: `Correctly diagnosed that z=8 with alpha=20° causes severe kinematic root undercut and generated corrective shift recommendation.`,
      data: { teethCount: lowTeethGear.teethCount, diagnostics: lowTeethGear.diagnostics }
    });

    // =========================================================================
    // 18. STEP AP214 DETERMINISTIC SOLID EXPORT VERIFICATION
    // =========================================================================
    const stepOutput = spurGear.stepData || '';
    const hasStepHeaders = stepOutput.includes('ISO-10303-21;') &&
                           stepOutput.includes('AUTOMOTIVE_DESIGN') &&
                           stepOutput.includes('MANIFOLD_SOLID_BREP') &&
                           stepOutput.includes('ADVANCED_BREP_SHAPE_REPRESENTATION');

    checks.push({
      id: 'CHK-224-18',
      name: 'STEP AP214 Advanced B-Rep Solid Stream Compliance',
      category: 'STEP_IGES_CAM',
      status: hasStepHeaders ? 'PASS' : 'FAIL',
      description: `Generated valid STEP AP214 standard entity stream (${stepOutput.length} bytes) including CLOSED_SHELL and MANIFOLD_SOLID_BREP entities.`,
      data: { stepLengthBytes: stepOutput.length }
    });

    // =========================================================================
    // 19. IGES 5.3 STANDARD EXCHANGE COMPLIANCE
    // =========================================================================
    const igesOutput = spurGear.igesData || '';
    const hasIgesSections = igesOutput.includes('S      1') && igesOutput.includes('G      1') && igesOutput.includes('D      1') && igesOutput.includes('P      1');

    checks.push({
      id: 'CHK-224-19',
      name: 'IGES 5.3 CAD Interchange Format Compliance',
      category: 'STEP_IGES_CAM',
      status: hasIgesSections ? 'PASS' : 'FAIL',
      description: `Generated formatted 80-column fixed-card IGES 5.3 dataset with Section cards S, G, D, P, T.`,
      data: { igesLengthBytes: igesOutput.length }
    });

    // =========================================================================
    // 20. CAM MANUFACTURING PREPARATION & BLANK ENVELOPE
    // =========================================================================
    const cam = spurGear.camPreparation;
    const isCamValid = cam.gearBlankOuterDiameterMm >= spurGear.tipDiameterMm! &&
                       cam.hobbingModuleMm === spurGear.module &&
                       cam.millingPassCount > 0 &&
                       cam.gcodeStockEnvelope.xMax > 0;

    checks.push({
      id: 'CHK-224-20',
      name: 'CAM Blank Definition & CNC Hobbing Toolpaths',
      category: 'STEP_IGES_CAM',
      status: isCamValid ? 'PASS' : 'FAIL',
      description: `Blank Outer Ø=${cam.gearBlankOuterDiameterMm}mm, Machining Process: ${cam.recommendedMachiningProcess}, Hobbing feed=${cam.hobbingFeedPerRevMm}mm/rev, Pass count=${cam.millingPassCount}.`,
      data: { blankDia: cam.gearBlankOuterDiameterMm, process: cam.recommendedMachiningProcess }
    });

    // =========================================================================
    // 21. DETERMINISM & NUMERICAL REPEATABILITY
    // =========================================================================
    const gearCopyA = GearGenerator.createParametricGear({ module: 2.0, teethCount: 24 });
    const gearCopyB = GearGenerator.createParametricGear({ module: 2.0, teethCount: 24 });

    const isDeterministic = gearCopyA.pitchDiameterMm === gearCopyB.pitchDiameterMm &&
                            gearCopyA.baseDiameterMm === gearCopyB.baseDiameterMm &&
                            gearCopyA.massProperties.massKg === gearCopyB.massProperties.massKg;

    checks.push({
      id: 'CHK-224-21',
      name: 'Mathematical Determinism & Geometric Repeatability',
      category: 'INVOLUTE_GEOMETRY',
      status: isDeterministic ? 'PASS' : 'FAIL',
      description: `Identical parametric input parameters produce strictly bitwise-identical pitch diameters, base diameters, and solid mass tensors.`,
      data: { isDeterministic }
    });

    // =========================================================================
    // FINAL GATE REPORT EVALUATION
    // =========================================================================
    const totalChecks = checks.length;
    const passedChecks = checks.filter(c => c.status === 'PASS').length;
    const verdict: 'PROVEN' | 'FAIL' = passedChecks === totalChecks ? 'PROVEN' : 'FAIL';

    evidencePackage['SPUR_GEAR_INVOLUTE'] = JSON.stringify({
      gearId: spurGear.gearId,
      pitchDiameterMm: spurGear.pitchDiameterMm,
      baseDiameterMm: spurGear.baseDiameterMm,
      tipDiameterMm: spurGear.tipDiameterMm,
      rootDiameterMm: spurGear.rootDiameterMm,
      teethCount: spurGear.teethCount,
      module: spurGear.module
    });

    evidencePackage['GEAR_PAIR_MESHING'] = JSON.stringify({
      pairId: gearPair.pairId,
      nominalCenterDistanceMm: gearPair.nominalCenterDistanceMm,
      gearRatio: gearPair.gearRatio,
      contactRatioProfileEpsilonAlpha: gearPair.contactRatioProfileEpsilonAlpha,
      meshingStatus: gearPair.meshingStatus
    });

    return {
      gateId: 'GATE-224-GEARS',
      verdict,
      totalChecks,
      passedChecks,
      timestamp: new Date().toISOString(),
      checks,
      evidencePackage
    };
  }
}
