import { 
  Vector3D, 
  TransformMatrix4x4, 
  PatternInstance, 
  LinearPatternDefinition, 
  CircularPatternDefinition, 
  VariablePatternDefinition 
} from './PatternTypes';

export class PatternMath {
  /**
   * Normalizes a 3D vector. Returns unit vector.
   */
  public static normalize(v: Vector3D): Vector3D {
    const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    if (len === 0) return { x: 1, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
  }

  /**
   * Creates a 4x4 translation transform matrix in column-major order.
   */
  public static createTranslationMatrix(translation: Vector3D): TransformMatrix4x4 {
    return {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        translation.x, translation.y, translation.z, 1
      ]
    };
  }

  /**
   * Creates a 4x4 rotation around arbitrary axis origin and direction.
   */
  public static createRotationAroundAxisMatrix(
    axisOrigin: Vector3D, 
    axisDir: Vector3D, 
    angleRad: number
  ): TransformMatrix4x4 {
    const u = PatternMath.normalize(axisDir);
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const oneMinusCos = 1 - cosA;

    // Rotation matrix R
    const r00 = cosA + u.x * u.x * oneMinusCos;
    const r01 = u.x * u.y * oneMinusCos - u.z * sinA;
    const r02 = u.x * u.z * oneMinusCos + u.y * sinA;

    const r10 = u.y * u.x * oneMinusCos + u.z * sinA;
    const r11 = cosA + u.y * u.y * oneMinusCos;
    const r12 = u.y * u.z * oneMinusCos - u.x * sinA;

    const r20 = u.z * u.x * oneMinusCos - u.y * sinA;
    const r21 = u.z * u.y * oneMinusCos + u.x * sinA;
    const r22 = cosA + u.z * u.z * oneMinusCos;

    // Translation to/from axisOrigin
    const tx = axisOrigin.x - (r00 * axisOrigin.x + r01 * axisOrigin.y + r02 * axisOrigin.z);
    const ty = axisOrigin.y - (r10 * axisOrigin.x + r11 * axisOrigin.y + r12 * axisOrigin.z);
    const tz = axisOrigin.z - (r20 * axisOrigin.x + r21 * axisOrigin.y + r22 * axisOrigin.z);

    return {
      elements: [
        r00, r10, r20, 0,
        r01, r11, r21, 0,
        r02, r12, r22, 0,
        tx, ty, tz, 1
      ]
    };
  }

  /**
   * Generates linear pattern instances according to formula:
   * P_ij = P + i * delta1 * d1 + j * delta2 * d2
   */
  public static computeLinearInstances(
    def: LinearPatternDefinition, 
    suppressionList: number[] = [],
    baseBRepHash: string = 'brep_src'
  ): PatternInstance[] {
    const instances: PatternInstance[] = [];
    const dir1 = PatternMath.normalize(def.direction1);
    const sign1 = def.reverse1 ? -1 : 1;
    
    const count1 = Math.max(1, def.count1);
    const delta1 = def.isTotalSpacing1 && count1 > 1 
      ? def.spacing1 / (count1 - 1) 
      : def.spacing1;

    const count2 = def.direction2 && def.count2 ? Math.max(1, def.count2) : 1;
    const dir2 = def.direction2 ? PatternMath.normalize(def.direction2) : { x: 0, y: 1, z: 0 };
    const sign2 = def.reverse2 ? -1 : 1;
    const delta2 = def.isTotalSpacing2 && count2 > 1 && def.spacing2 
      ? def.spacing2 / (count2 - 1) 
      : (def.spacing2 || 0);

    let instanceCounter = 0;

    for (let j = 0; j < count2; j++) {
      for (let i = 0; i < count1; i++) {
        const offsetI = def.isSymmetric1 ? (i - (count1 - 1) / 2) : i;
        const offsetJ = def.isSymmetric2 ? (j - (count2 - 1) / 2) : j;

        const posX = sign1 * offsetI * delta1 * dir1.x + sign2 * offsetJ * delta2 * dir2.x;
        const posY = sign1 * offsetI * delta1 * dir1.y + sign2 * offsetJ * delta2 * dir2.y;
        const posZ = sign1 * offsetI * delta1 * dir1.z + sign2 * offsetJ * delta2 * dir2.z;

        const pos: Vector3D = { x: posX, y: posY, z: posZ };
        const transform = PatternMath.createTranslationMatrix(pos);
        const isSuppressed = suppressionList.includes(instanceCounter);

        instances.push({
          instanceIndex: instanceCounter,
          gridCoordinate: { i, j },
          position: pos,
          transform,
          isSuppressed,
          bRepInstanceHash: `${baseBRepHash}_lin_inst_${instanceCounter}_x${posX.toFixed(2)}_y${posY.toFixed(2)}_z${posZ.toFixed(2)}`
        });

        instanceCounter++;
      }
    }

    return instances;
  }

  /**
   * Generates circular pattern instances around axis.
   */
  public static computeCircularInstances(
    def: CircularPatternDefinition, 
    suppressionList: number[] = [],
    baseBRepHash: string = 'brep_src'
  ): PatternInstance[] {
    const instances: PatternInstance[] = [];
    const count = Math.max(1, def.count);
    const sign = def.reverse ? -1 : 1;

    const totalAngleRad = (def.angleDegrees * Math.PI) / 180;
    
    // Step angle calculation
    let stepAngleRad = 0;
    if (def.isTotalAngle) {
      stepAngleRad = count > 1 ? totalAngleRad / (def.angleDegrees === 360 ? count : (count - 1)) : 0;
    } else {
      stepAngleRad = totalAngleRad;
    }

    for (let i = 0; i < count; i++) {
      const offsetI = def.isSymmetric ? (i - (count - 1) / 2) : i;
      const angleRad = sign * offsetI * stepAngleRad;
      const angleDeg = (angleRad * 180) / Math.PI;

      const transform = PatternMath.createRotationAroundAxisMatrix(
        def.axisOrigin,
        def.axisDirection,
        angleRad
      );

      const isSuppressed = suppressionList.includes(i);

      instances.push({
        instanceIndex: i,
        position: { x: def.axisOrigin.x, y: def.axisOrigin.y, z: def.axisOrigin.z },
        rotation: { x: 0, y: 0, z: angleDeg },
        transform,
        isSuppressed,
        bRepInstanceHash: `${baseBRepHash}_circ_inst_${i}_deg${angleDeg.toFixed(1)}`
      });
    }

    return instances;
  }

  /**
   * Generates variable pattern instances.
   */
  public static computeVariableInstances(
    def: VariablePatternDefinition,
    suppressionList: number[] = [],
    baseBRepHash: string = 'brep_src'
  ): PatternInstance[] {
    let baseInstances: PatternInstance[] = [];
    if (def.baseType === 'LINEAR' && def.linearDef) {
      baseInstances = PatternMath.computeLinearInstances(def.linearDef, suppressionList, baseBRepHash);
    } else if (def.baseType === 'CIRCULAR' && def.circularDef) {
      baseInstances = PatternMath.computeCircularInstances(def.circularDef, suppressionList, baseBRepHash);
    }

    // Apply variable overrides
    return baseInstances.map(inst => {
      const override = def.overrides.find(o => o.instanceIndex === inst.instanceIndex);
      if (!override) return inst;

      const newPos: Vector3D = {
        x: inst.position.x + (override.customOffset?.x || 0),
        y: inst.position.y + (override.customOffset?.y || 0),
        z: inst.position.z + (override.customOffset?.z || 0)
      };

      const scale = override.scaleFactor ? { x: override.scaleFactor, y: override.scaleFactor, z: override.scaleFactor } : undefined;
      const transform = PatternMath.createTranslationMatrix(newPos);

      return {
        ...inst,
        position: newPos,
        scale,
        transform,
        bRepInstanceHash: `${inst.bRepInstanceHash}_var_mod`
      };
    });
  }
}
