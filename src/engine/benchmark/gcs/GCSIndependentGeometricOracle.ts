import { GeometricOracleResult } from './types';

export interface OracleVerificationReport {
  verdict: 'PASS' | 'FAIL';
  maxError?: number;
  violations?: string[];
}

export class GCSIndependentGeometricOracle {
  /**
   * Independently evaluates the geometric validity of a sketch definition
   * without invoking the production solver or any variational solver engine.
   * Uses first-principles geometric predicates (Euclidean distances, vector dot/cross products).
   */
  public static verifySketch(sketch: any, tolerance: number = 1e-4): GeometricOracleResult {
    if (!sketch || !sketch.entities || !sketch.constraints) {
      return {
        satisfied: false,
        maxError: Infinity,
        tolerance,
        evaluatedConstraints: 0,
        violations: ['Invalid sketch definition provided: missing entities or constraints'],
        details: []
      };
    }

    const entities = sketch.entities;
    const constraints = sketch.constraints;
    const violations: string[] = [];
    const details: string[] = [];
    let maxError = 0;
    let evaluatedCount = 0;

    const validateVector = (v: any, entityId: string): { x: number; y: number; z: number } | string => {
      if (v.x === undefined || v.y === undefined || v.z === undefined) {
        return `Validation Error: Entity '${entityId}' has incomplete canonical coordinates.`;
      }
      if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
        return `Validation Error: Entity '${entityId}' contains non-finite canonical coordinates.`;
      }
      return { x: Number(v.x), y: Number(v.y), z: Number(v.z) };
    };

    const extractVector3D = (entityId: string): { x: number; y: number; z: number } | string => {
      const entity = entities[entityId];
      if (!entity) {
        return `Validation Error: Unresolved entity reference '${entityId}' could not be resolved in the current context.`;
      }

      // LEGACY/COMPATIBILITY RULE: For 2D POINT, we allow flat x/y but still enforce finiteness
      if (entity.type === 'POINT') {
        const x = entity.x;
        const y = entity.y;
        const z = entity.z ?? 0;

        if (x === undefined || y === undefined) {
          return `Validation Error: Entity '${entityId}' of type POINT is missing flat coordinates.`;
        }

        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
          return `Validation Error: Entity '${entityId}' contains non-finite flat coordinates.`;
        }

        return { x: Number(x), y: Number(y), z: Number(z) };
      }

      // STRICT RULE: If it's a 3D entity, it MUST have geometry.data
      if (!entity.geometry || !entity.geometry.data) {
        return `Validation Error: Entity '${entityId}' of type ${entity.type} is missing required canonical 'geometry.data' block.`;
      }

      const data = entity.geometry.data;

      switch (entity.type) {
        case 'POINT_3D':
        case 'DATUM_POINT':
          return validateVector({ x: data.x, y: data.y, z: data.z }, entityId);

        case 'LINE_3D':
        case 'DATUM_AXIS':
        case 'AXIS_3D':
        case 'CYLINDER':
        case 'PLANE':
        case 'DATUM_PLANE':
        case 'COORDINATE_SYSTEM':
          const p = data.origin || data.center || data.position;
          if (p) return validateVector({ x: p.x, y: p.y, z: p.z }, entityId);
          break;

        case 'CIRCLE_3D':
        case 'ARC_3D':
        case 'SPHERE':
          if (data.center) return validateVector({ x: data.center.x, y: data.center.y, z: data.center.z }, entityId);
          break;

        case 'RIGID_BODY':
        case 'ASSEMBLY_COMPONENT':
          if (data.position) return validateVector({ x: data.position.x, y: data.position.y, z: data.position.z }, entityId);
          break;
      }

      return `Validation Error: Entity '${entityId}' has unsupported type '${entity.type}' for point extraction.`;
    };

    const getLinePoints = (lineIdOrEntity: string | any): [{ x: number; y: number; z: number }, { x: number; y: number; z: number }] | string => {
      const ent = typeof lineIdOrEntity === 'string' ? entities[lineIdOrEntity] : lineIdOrEntity;
      if (!ent) return `Validation Error: Line reference could not be resolved.`;

      if (ent.type === 'LINE' || ent.type === 'LINE_3D' || ent.type === 'AXIS_3D' || ent.type === 'DATUM_AXIS') {
        if (ent.type === 'LINE') {
          const p1Id = ent.p1Id || ent.startPointId || (ent.entityIds && ent.entityIds[0]);
          const p2Id = ent.p2Id || ent.endPointId || (ent.entityIds && ent.entityIds[1]);
          
          if (!p1Id || !p2Id) {
            return `Validation Error: Line '${ent.id}' is missing startPointId or endPointId.`;
          }

          const res1 = extractVector3D(p1Id);
          const res2 = extractVector3D(p2Id);

          if (typeof res1 === 'string') return res1;
          if (typeof res2 === 'string') return res2;

          return [res1, res2];
        } else {
          // For 3D lines/axes, we use origin and origin + direction
          const data = ent.geometry?.data;
          if (!data || !data.origin || !data.direction) {
            return `Validation Error: Entity '${ent.id}' of type ${ent.type} is missing canonical origin/direction.`;
          }
          const p1 = validateVector(data.origin, ent.id);
          if (typeof p1 === 'string') return p1;
          const p2 = {
            x: p1.x + data.direction.x,
            y: p1.y + data.direction.y,
            z: p1.z + data.direction.z
          };
          const v2 = validateVector(p2, ent.id);
          if (typeof v2 === 'string') return v2;
          return [p1, v2];
        }
      }
      return `Validation Error: Entity is not a valid line type.`;
    };

    const constrList = Array.isArray(constraints) ? constraints : Object.values(constraints);

    for (const constr of constrList as any[]) {
      if (constr.suppressionState === 'SUPPRESSED') continue;
      evaluatedCount++;
      let err = 0;
      let constrDesc = `${constr.type} constraint '${constr.id || 'unnamed'}'`;
      let validationError: string | null = null;

      const type = String(constr.type).toUpperCase();
      const rawEntities = constr.entityIds || constr.entities || [];
      const entityIds = rawEntities.map((e: any) => typeof e === 'string' ? e : (e.entityId || e.id));

      if (type === 'DISTANCE') {
        const targetVal = Number(constr.value ?? constr.distance ?? 0);
        if (entityIds.length >= 2) {
          const pt1 = extractVector3D(entityIds[0]);
          const pt2 = extractVector3D(entityIds[1]);
          if (typeof pt1 === 'string') { validationError = pt1; }
          else if (typeof pt2 === 'string') { validationError = pt2; }
          else {
            const dist = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y, pt2.z - pt1.z);
            err = Math.abs(dist - targetVal);
            constrDesc += ` (pt-pt distance: measured=${dist.toFixed(4)}, target=${targetVal.toFixed(4)})`;
          }
        } else {
          validationError = `Validation Error: DISTANCE constraint requires at least 2 entities.`;
        }
      } else if (type === 'COINCIDENT') {
        if (entityIds.length >= 2) {
          const pt1 = extractVector3D(entityIds[0]);
          const pt2 = extractVector3D(entityIds[1]);
          if (typeof pt1 === 'string') { validationError = pt1; }
          else if (typeof pt2 === 'string') { validationError = pt2; }
          else {
            err = Math.hypot(pt2.x - pt1.x, pt2.y - pt1.y, pt2.z - pt1.z);
            constrDesc += ` (coincident distance: measured=${err.toFixed(4)})`;
          }
        } else {
          validationError = `Validation Error: COINCIDENT constraint requires at least 2 entities.`;
        }
      } else if (type === 'HORIZONTAL') {
        if (entityIds.length >= 1) {
          const res = getLinePoints(entityIds[0]);
          const linePts = typeof res === 'string' ? null : res;
          if (typeof res === 'string') validationError = res;
          else if (linePts && linePts[0] && linePts[1]) {
            const lineLen = Math.hypot(linePts[1].x - linePts[0].x, linePts[1].y - linePts[0].y);
            if (lineLen <= 1e-9) {
              validationError = `Degeneracy Violation: Entity '${entityIds[0]}' has zero length (${lineLen.toExponential(4)} <= 1e-9). Undefined direction cannot satisfy HORIZONTAL.`;
            } else {
              err = Math.abs(linePts[1].y - linePts[0].y);
              constrDesc += ` (horizontal dy: measured=${err.toFixed(4)})`;
            }
          }
        }
      } else if (type === 'VERTICAL') {
        if (entityIds.length >= 1) {
          const res = getLinePoints(entityIds[0]);
          const linePts = typeof res === 'string' ? null : res;
          if (typeof res === 'string') validationError = res;
          else if (linePts && linePts[0] && linePts[1]) {
            const lineLen = Math.hypot(linePts[1].x - linePts[0].x, linePts[1].y - linePts[0].y);
            if (lineLen <= 1e-9) {
              validationError = `Degeneracy Violation: Entity '${entityIds[0]}' has zero length (${lineLen.toExponential(4)} <= 1e-9). Undefined direction cannot satisfy VERTICAL.`;
            } else {
              err = Math.abs(linePts[1].x - linePts[0].x);
              constrDesc += ` (vertical dx: measured=${err.toFixed(4)})`;
            }
          }
        }
      } else if (type === 'PARALLEL') {
        if (entityIds.length >= 2) {
          const res1 = getLinePoints(entityIds[0]);
          const res2 = getLinePoints(entityIds[1]);
          if (typeof res1 === 'string') validationError = res1;
          else if (typeof res2 === 'string') validationError = res2;
          else {
            const v1 = { x: res1[1].x - res1[0].x, y: res1[1].y - res1[0].y };
            const v2 = { x: res2[1].x - res2[0].x, y: res2[1].y - res2[0].y };
            const len1 = Math.hypot(v1.x, v1.y);
            const len2 = Math.hypot(v2.x, v2.y);
            if (len1 <= 1e-9 || len2 <= 1e-9) {
              validationError = `Degeneracy Violation: Entity in PARALLEL has zero length (len1=${len1.toExponential(4)}, len2=${len2.toExponential(4)}). Undefined direction cannot satisfy PARALLEL.`;
            } else {
              const cross = Math.abs(v1.x * v2.y - v1.y * v2.x);
              err = cross / (len1 * len2);
              constrDesc += ` (parallel cross-prod norm: measured=${err.toFixed(4)})`;
            }
          }
        }
      } else if (type === 'PERPENDICULAR') {
        if (entityIds.length >= 2) {
          const res1 = getLinePoints(entityIds[0]);
          const res2 = getLinePoints(entityIds[1]);
          if (typeof res1 === 'string') validationError = res1;
          else if (typeof res2 === 'string') validationError = res2;
          else {
            const v1 = { x: res1[1].x - res1[0].x, y: res1[1].y - res1[0].y };
            const v2 = { x: res2[1].x - res2[0].x, y: res2[1].y - res2[0].y };
            const len1 = Math.hypot(v1.x, v1.y);
            const len2 = Math.hypot(v2.x, v2.y);
            if (len1 <= 1e-9 || len2 <= 1e-9) {
              validationError = `Degeneracy Violation: Entity in PERPENDICULAR has zero length (len1=${len1.toExponential(4)}, len2=${len2.toExponential(4)}). Undefined direction cannot satisfy PERPENDICULAR.`;
            } else {
              const dot = Math.abs(v1.x * v2.x + v1.y * v2.y);
              err = dot / (len1 * len2);
              constrDesc += ` (perpendicular dot-prod norm: measured=${err.toFixed(4)})`;
            }
          }
        }
      } else if (type === 'RADIUS') {
        if (entityIds.length >= 1) {
          const circ = entities[entityIds[0]];
          if (circ && (circ.type === 'CIRCLE' || circ.type === 'ARC')) {
            const targetVal = Number(constr.value ?? constr.radius ?? 0);
            const radius = Number(circ.radius);
            if (!Number.isFinite(radius)) {
              validationError = `Validation Error: Entity '${entityIds[0]}' has non-finite radius.`;
            } else {
              err = Math.abs(radius - targetVal);
              constrDesc += ` (radius delta: measured=${radius}, target=${targetVal})`;
            }
          } else {
            validationError = `Validation Error: RADIUS constraint requires a CIRCLE or ARC entity.`;
          }
        }
      } else if (type === 'EQUAL') {
        if (entityIds.length >= 2) {
          const e1 = entities[entityIds[0]];
          const e2 = entities[entityIds[1]];
          if (e1 && e2) {
            if (e1.type === 'CIRCLE' && e2.type === 'CIRCLE') {
              const r1 = Number(e1.radius);
              const r2 = Number(e2.radius);
              if (!Number.isFinite(r1) || !Number.isFinite(r2)) {
                validationError = `Validation Error: EQUAL radii entities have non-finite values.`;
              } else {
                err = Math.abs(r1 - r2);
              }
            } else {
              const res1 = getLinePoints(e1);
              const res2 = getLinePoints(e2);
              if (typeof res1 === 'string') validationError = res1;
              else if (typeof res2 === 'string') validationError = res2;
              else {
                const len1 = Math.hypot(res1[1].x - res1[0].x, res1[1].y - res1[0].y);
                const len2 = Math.hypot(res2[1].x - res2[0].x, res2[1].y - res2[0].y);
                err = Math.abs(len1 - len2);
              }
            }
          } else {
            validationError = `Validation Error: EQUAL constraint could not resolve entities.`;
          }
        }
      } else if (type === 'TANGENT') {
        if (entityIds.length >= 2) {
          let circId = entityIds[0];
          let lineId = entityIds[1];
          let circ = entities[circId];
          let line = entities[lineId];
          
          if (circ && circ.type === 'LINE') {
            const tmpId = circId; circId = lineId; lineId = tmpId;
            const tmp = circ; circ = line; line = tmp;
          }

          if (circ && (circ.type === 'CIRCLE' || circ.type === 'ARC') && line) {
            const centerPt = extractVector3D(circ.centerPointId || circ.centerId);
            const lPts = getLinePoints(lineId);
            const radius = Number(circ.radius);

            if (typeof centerPt === 'string') validationError = centerPt;
            else if (typeof lPts === 'string') validationError = lPts;
            else if (!Number.isFinite(radius)) validationError = `Validation Error: Circle '${circId}' has non-finite radius.`;
            else {
              const [p1, p2] = lPts;
              const num = Math.abs((p2.y - p1.y) * centerPt.x - (p2.x - p1.x) * centerPt.y + p2.x * p1.y - p2.y * p1.x);
              const den = Math.hypot(p2.y - p1.y, p2.x - p1.x) || 1e-9;
              const distToLine = num / den;
              err = Math.abs(distToLine - radius);
            }
          } else {
            validationError = `Validation Error: TANGENT constraint requires a circle/arc and a line.`;
          }
        }
      }

      if (validationError) {
        violations.push(validationError);
        err = Infinity;
      }

      if (err > maxError) {
        maxError = err;
      }

      if (err > tolerance) {
        violations.push(`Violation in ${constrDesc}: error ${err.toExponential(4)} exceeds tolerance ${tolerance.toExponential(4)}`);
      } else {
        details.push(`Satisfied ${constrDesc}: error ${err.toExponential(4)} <= tolerance ${tolerance.toExponential(4)}`);
      }
    }


    const satisfied = violations.length === 0;
    return {
      satisfied,
      maxError,
      tolerance,
      evaluatedConstraints: evaluatedCount,
      violations,
      details
    };
  }

  /**
   * Compatibility wrapper for ProductionGCSBenchmarkSuite.
   */
  public static verify(entities: any, constraints: any, result: any, tolerance: number = 1e-4): OracleVerificationReport {
    const sketch = { entities, constraints };
    const geomRes = this.verifySketch(sketch, tolerance);
    return {
      verdict: geomRes.satisfied ? 'PASS' : 'FAIL',
      maxError: geomRes.maxError,
      violations: geomRes.violations
    };
  }
}
