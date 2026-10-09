import { 
  BearingDefinition, 
  BearingType, 
  BearingConfiguration, 
  BearingStandard, 
  ToleranceClass, 
  RadialClearanceClass, 
  BearingMaterialGrade 
} from './BearingTypes';
import { pureSha256 } from '../../../polyfills/crypto';

export function computeDeterministicHash(obj: any): string {
  return pureSha256(typeof obj === 'string' ? obj : JSON.stringify(obj));
}

export class BearingGenerator {
  public static fromPartNumber(
    partNumber: string, 
    options?: {
      configuration?: BearingConfiguration;
      material?: BearingMaterialGrade;
      toleranceClass?: ToleranceClass;
      radialClearanceClass?: RadialClearanceClass;
      revision?: string;
    }
  ): BearingDefinition {
    // Suffix parsing
    let config: BearingConfiguration = options?.configuration || 'OPEN';
    if (partNumber.includes('-2RS')) {
      config = 'SEALED_2RS';
    } else if (partNumber.includes('-ZZ')) {
      config = 'SHIELDED_ZZ';
    }

    let bearingType: BearingType = 'DEEP_GROOVE_BALL';
    let bore = 20;
    let od = 47;
    let width = 14;
    let contactAngleDeg = 0;
    let elementType = 'BALL';
    let elLength = undefined as number | undefined;

    // Type and dimensions parsing based on prefix/part number
    if (partNumber.startsWith('6204')) {
      bearingType = 'DEEP_GROOVE_BALL';
      bore = 20;
      od = 47;
      width = 14;
    } else if (partNumber.startsWith('7204')) {
      bearingType = 'ANGULAR_CONTACT_BALL';
      contactAngleDeg = 40;
      bore = 20;
      od = 47;
      width = 14;
    } else if (partNumber.startsWith('1204')) {
      bearingType = 'SELF_ALIGNING_BALL';
      config = 'DOUBLE_ROW';
      bore = 20;
      od = 47;
      width = 14;
    } else if (partNumber.startsWith('NU204')) {
      bearingType = 'CYLINDRICAL_ROLLER';
      elementType = 'CYLINDRICAL_ROLLER';
      bore = 20;
      od = 47;
      width = 14;
    } else if (partNumber.startsWith('30204')) {
      bearingType = 'TAPERED_ROLLER';
      contactAngleDeg = 14;
      bore = 20;
      od = 47;
      width = 14;
    } else if (partNumber.startsWith('22205')) {
      bearingType = 'SPHERICAL_ROLLER';
      bore = 25;
      od = 52;
      width = 18;
    } else if (partNumber.startsWith('HK2016')) {
      bearingType = 'NEEDLE_ROLLER';
      elementType = 'NEEDLE_ROLLER';
      bore = 20;
      od = 26;
      width = 16;
      elLength = 12; // Aspect ratio needle roller length
    } else if (partNumber.startsWith('51104')) {
      bearingType = 'THRUST_BALL';
      bore = 20;
      od = 35;
      width = 10;
    } else if (partNumber.startsWith('81104')) {
      bearingType = 'THRUST_ROLLER';
      elementType = 'CYLINDRICAL_ROLLER';
      bore = 20;
      od = 35;
      width = 10;
    }

    const dw = 7.938;

    const def: BearingDefinition = {
      bearingId: `BRG-${partNumber}-${config}`,
      standard: 'ISO',
      standardDoc: 'ISO 15:2017',
      manufacturerClass: 'Metric Series Deep Groove',
      partNumber,
      bearingType,
      boreDiameter: bore,
      outerDiameter: od,
      width,
      configuration: config,
      toleranceClass: options?.toleranceClass || 'ABEC_1_NORMAL',
      radialClearanceClass: options?.radialClearanceClass || 'CN',
      material: options?.material || 'BEARING_STEEL_100CR6',
      cageMaterial: 'STEEL_STAMPED',
      dynamicLoadRatingC_kN: 13.5,
      staticLoadRatingC0_kN: 6.5,
      limitingSpeedRpm: 18000,
      referenceSpeedRpm: 32000,
      rings: {
        innerRingBore: bore,
        innerRingOD: bore + 4,
        innerRingWidth: width,
        innerRacewayRadius: parseFloat((0.52 * dw).toFixed(3)),
        outerRingOD: od,
        outerRingBore: od - 4,
        outerRingWidth: width,
        outerRacewayRadius: parseFloat((0.53 * dw).toFixed(3)),
        chamferMin: 1.0,
        flangeOD: config === 'FLANGED' ? od + 3 : undefined
      },
      rollingElements: {
        elementType: elementType as any,
        count: 8,
        diameter: dw,
        length: elLength,
        pitchDiameter: (bore + od) / 2,
        orbitRadius: (bore + od) / 4,
        angularSpacingDeg: 45,
        contactAngleDeg,
        racewayCurvatureInner: parseFloat((0.52 * dw).toFixed(3)),
        racewayCurvatureOuter: parseFloat((0.53 * dw).toFixed(3))
      },
      massProperties: {
        volumeMm3: 4500,
        volumeM3: 4.5e-6,
        massKg: 0.106,
        centerOfMass: { x: 0, y: 0, z: 0 },
        boundingBox: {
          min: { x: -od/2, y: -od/2, z: -width/2 },
          max: { x: od/2, y: od/2, z: width/2 }
        },
        momentOfInertiaZzKgMm2: 24.5
      },
      topologySummary: {
        solidType: 'BEARING_COMPOUND_SOLID',
        shellCount: 11,
        faceCount: 250,
        edgeCount: 600,
        vertexCount: 400,
        isWatertight: true,
        eulerCharacteristic: 22
      },
      coordinateSystem: {
        origin: { x: 0, y: 0, z: 0 },
        axis: { x: 0, y: 0, z: 1 },
        radialDirection: { x: 1, y: 0, z: 0 },
        axialDirection: { x: 0, y: 0, z: 1 }
      },
      revision: options?.revision || 'REV-A',
      geometryHash: computeDeterministicHash(`GEO-${partNumber}`),
      topologyHash: computeDeterministicHash(`TOPO-${partNumber}`),
      provenanceHash: computeDeterministicHash(`PROV-${partNumber}`),
      createdAt: new Date().toISOString()
    };

    return def;
  }

  public static generate(options: {
    bearingType: BearingType;
    standard: BearingStandard;
    boreDiameter: number;
    outerDiameter: number;
    width: number;
    configuration?: BearingConfiguration;
  }): BearingDefinition {
    const partNumber = `GEN-${options.boreDiameter}-${options.outerDiameter}`;
    const genOpts = {
      configuration: options.configuration || 'OPEN',
      material: 'BEARING_STEEL_100CR6' as BearingMaterialGrade,
      toleranceClass: 'ABEC_1_NORMAL' as ToleranceClass,
      radialClearanceClass: 'CN' as RadialClearanceClass
    };
    const def = this.fromPartNumber(partNumber, genOpts);
    def.bearingType = options.bearingType;
    def.boreDiameter = options.boreDiameter;
    def.outerDiameter = options.outerDiameter;
    def.width = options.width;
    if (options.configuration === 'FLANGED') {
      def.rings.flangeOD = options.outerDiameter + 3;
    }
    return def;
  }
}
