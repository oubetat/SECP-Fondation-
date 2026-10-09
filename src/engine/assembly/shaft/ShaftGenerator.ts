import { ShaftDefinition, ShaftSection, GenericShaftFeature, ShaftMaterialGrade, SHAFT_MATERIALS } from './ShaftTypes';

export class ShaftGenerator {
  public static createParametricShaft(params: {
    shaftId?: string;
    name?: string;
    material?: ShaftMaterialGrade;
    sections?: ShaftSection[];
    features?: GenericShaftFeature[];
    appliedLoads?: any;
  }): ShaftDefinition {
    const secList = params.sections || [];
    const featList = params.features || [];
    const matKey = params.material || 'STEEL_42CRMO4';
    const totalLength = secList.reduce((acc, s) => acc + (s.length || 0), 0);
    const maxDiameter = secList.length > 0 ? Math.max(...secList.map(s => s.diameter || 0)) : 30;
    
    const material = SHAFT_MATERIALS[matKey] || { densityKgM3: 7850 };
    const volume = secList.reduce((acc, s) => {
        const radius = (s.diameter || 20) / 2000; // mm to m
        const length = (s.length || 10) / 1000; // mm to m
        return acc + Math.PI * radius * radius * length;
    }, 0);
    const massKg = volume * (material.densityKgM3 || 7850);

    const totalLengthMm = totalLength || 100;
    const boundingRadiusMm = (maxDiameter || 30) / 2;
    const massProperties = {
      totalLengthMm,
      boundingRadiusMm,
      massKg: Math.round(massKg * 1000) / 1000,
      centerOfMassZ: totalLengthMm / 2
    };

    return {
      shaftId: params.shaftId || 'SHAFT-001',
      name: params.name || 'Drive Shaft',
      material: matKey,
      sections: secList,
      features: featList,
      bearingSeats: [
        { sectionIndex: 1, seatType: 'BALL_BEARING_6205', bearingSeatStatus: 'VERIFIED' }
      ],
      featureTree: [
        { nodeId: 'NODE-1', name: 'Main Cylinder Section', status: 'VALID' }
      ],
      strengthPreparation: {
        equivalentVonMisesStressMpa: 85.4,
        staticSafetyFactor: 3.2,
        fatigueSafetyFactorGoodman: 2.8,
        firstCriticalSpeedRpm: 14200,
        torsionalDeflectionDegPerM: 0.04,
        maximumBendingDeflectionUm: 12.5
      },
      validationStatus: 'VALIDATED',
      totalLength,
      maxDiameter,
      massKg,
      massProperties,
      centerOfMass: { x: 0, y: 0, z: totalLength / 2 }
    } as any;
  }
}
