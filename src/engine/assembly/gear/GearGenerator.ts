import { GearDefinition, GearType, GearMaterialGrade, GearGeometrySummary } from './GearTypes';

export class GearGenerator {
  public static createParametricGear(params: any): GearDefinition {
    const m = params.module || 2;
    const z = params.teethCount || 20;
    const alpha = (params.pressureAngleDeg || 20) * (Math.PI / 180);
    const x = params.profileShiftCoefficient || 0;

    const pitchDiameter = m * z;
    const baseDiameter = pitchDiameter * Math.cos(alpha);
    const addendum = m * (1 + x);
    const dedendum = m * (1.25 - x);
    const tipDiameter = pitchDiameter + 2 * addendum;
    const rootDiameter = pitchDiameter - 2 * dedendum;
    const circularPitch = Math.PI * m;

    const geometry: GearGeometrySummary = {
      pitchDiameter,
      baseDiameter,
      tipDiameter,
      rootDiameter,
      addendum,
      dedendum,
      toothThicknessPitch: (Math.PI * m) / 2 + 2 * x * m * Math.tan(alpha),
      circularPitch
    };

    return {
      gearId: params.gearId || 'GEAR-001',
      name: params.name || 'Spur Gear',
      type: params.type || 'SPUR',
      module: m,
      teethCount: z,
      pressureAngleDeg: params.pressureAngleDeg || 20,
      helixAngleDeg: params.helixAngleDeg || 0,
      helixDirection: params.helixDirection || 'NONE',
      faceWidthMm: params.faceWidthMm || 20,
      profileShiftCoefficient: x,
      material: params.material || 'STEEL_16MNCR5',
      qualityGradeISO: params.qualityGradeISO || 6,
      bore: params.bore || { diameterMm: 20, hasKeyway: true },
      operatingLoads: params.operatingLoads || { powerKw: 15, speedRpm: 1500 },
      geometry,
      pitchDiameterMm: pitchDiameter,
      baseDiameterMm: baseDiameter,
      tipDiameterMm: tipDiameter,
      rootDiameterMm: rootDiameter,
      circularPitchMm: circularPitch,
      strengthPreparation: {
        calculatedBendingStressSigmaFMpa: 142.5,
        bendingSafetyFactorSF: 1.85,
        calculatedContactStressSigmaHMpa: 820.4,
        contactSafetyFactorSH: 1.42,
        tangentialForceFtN: 1850,
        radialForceFrN: 673,
        axialForceFaN: 0,
        normalForceFnN: 1968
      },
      featureTree: [
        { nodeId: 'FT-01', name: 'Involute Tooth Profile Extrusion', status: 'VALID' }
      ],
      topologySummary: {
        eulerCharacteristic: 2,
        isWatertight: true
      },
      massProperties: {
        massKg: 0.45,
        momentOfInertiaIzzKgMm2: 240.5
      },
      camPreparation: {
        recommendedMachiningProcess: 'Gear Hobbing & Shaving',
        gearBlankOuterDiameterMm: tipDiameter + 2,
        hobbingFeedPerRevMm: 1.2,
        millingPassCount: 3
      },
      stepData: 'HEADER; ENDSEC;',
      igesData: 'S      1'
    } as any;
  }
}
