import { NurbsCurve, NurbsSurface, NurbsValidationResult, NurbsValidationError } from './NurbsContracts';

export class NurbsValidator {
  public static validateCurve(curve: NurbsCurve): NurbsValidationResult {
    const errors: NurbsValidationError[] = [];
    
    if (!curve) {
      return { isValid: false, errors: [{ code: 'NULL_CURVE', message: 'Curve is null or undefined' }] };
    }

    if (typeof curve.degree !== 'number' || curve.degree < 0 || !Number.isInteger(curve.degree) || !Number.isFinite(curve.degree)) {
      errors.push({ code: 'INVALID_DEGREE', message: 'Degree must be a finite non-negative integer', expected: '>= 0', actual: curve.degree });
    }

    if (!Array.isArray(curve.controlPoints) || curve.controlPoints.length === 0) {
      errors.push({ code: 'INVALID_CONTROL_POINTS', message: 'Control points must be a non-empty array', expected: '> 0 elements', actual: curve.controlPoints?.length });
    } else {
      for (let i = 0; i < curve.controlPoints.length; i++) {
        const cp = curve.controlPoints[i];
        if (!cp || !Number.isFinite(cp.x) || !Number.isFinite(cp.y) || !Number.isFinite(cp.z)) {
          errors.push({ code: 'INVALID_CP_COORD', message: `Control point at index ${i} has invalid coordinates`, location: `cp[${i}]`, actual: cp });
        }
        if (typeof cp.w !== 'number' || !Number.isFinite(cp.w) || cp.w <= 0) {
          errors.push({ code: 'INVALID_CP_WEIGHT', message: `Control point at index ${i} has invalid weight (must be > 0)`, expected: '> 0', actual: cp?.w, location: `cp[${i}]` });
        }
      }
    }

    if (!Array.isArray(curve.knots) || curve.knots.length === 0) {
      errors.push({ code: 'INVALID_KNOTS', message: 'Knots must be a non-empty array' });
    } else {
      const p = curve.degree;
      const n = (curve.controlPoints?.length || 1) - 1;
      const expectedKnots = n + p + 2;
      
      if (curve.knots.length !== expectedKnots) {
        errors.push({ code: 'INVALID_KNOT_COUNT', message: `Invalid knot count. Expected n + p + 2 = ${expectedKnots}, got ${curve.knots.length}`, expected: expectedKnots, actual: curve.knots.length });
      }

      for (let i = 0; i < curve.knots.length; i++) {
        if (!Number.isFinite(curve.knots[i])) {
          errors.push({ code: 'INVALID_KNOT_VALUE', message: `Knot at index ${i} is not finite`, location: `knots[${i}]`, actual: curve.knots[i] });
        }
        if (i > 0 && curve.knots[i] < curve.knots[i - 1]) {
          errors.push({ code: 'DESCENDING_KNOTS', message: `Knots must be non-decreasing. knots[${i}] < knots[${i-1}]`, location: `knots[${i}]`, actual: `${curve.knots[i]} < ${curve.knots[i-1]}` });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static validateSurface(surface: NurbsSurface): NurbsValidationResult {
    const errors: NurbsValidationError[] = [];
    if (!surface) {
      return { isValid: false, errors: [{ code: 'NULL_SURFACE', message: 'Surface is null or undefined' }] };
    }

    const checkDegree = (deg: number, dir: string) => {
      if (typeof deg !== 'number' || deg < 0 || !Number.isInteger(deg) || !Number.isFinite(deg)) {
        errors.push({ code: 'INVALID_DEGREE', message: `Degree ${dir} must be a finite non-negative integer`, expected: '>= 0', actual: deg, location: dir });
      }
    };
    checkDegree(surface.degreeU, 'U');
    checkDegree(surface.degreeV, 'V');

    if (!Array.isArray(surface.controlPoints) || surface.controlPoints.length === 0) {
      errors.push({ code: 'INVALID_CONTROL_POINTS', message: 'Control points grid must be a non-empty 2D array' });
    } else {
      const numU = surface.controlPoints.length;
      const numV = surface.controlPoints[0]?.length || 0;
      if (numV === 0) {
        errors.push({ code: 'INVALID_CONTROL_POINTS_V', message: 'Control points grid must have V elements' });
      }
      for (let i = 0; i < numU; i++) {
        const row = surface.controlPoints[i];
        if (!Array.isArray(row) || row.length !== numV) {
          errors.push({ code: 'JAGGED_CONTROL_POINTS', message: `Control points row ${i} has inconsistent length`, expected: numV, actual: row?.length });
        } else {
          for (let j = 0; j < numV; j++) {
            const cp = row[j];
            if (!cp || !Number.isFinite(cp.x) || !Number.isFinite(cp.y) || !Number.isFinite(cp.z)) {
              errors.push({ code: 'INVALID_CP_COORD', message: `Control point at [${i}][${j}] has invalid coordinates`, location: `cp[${i}][${j}]`, actual: cp });
            }
            if (typeof cp.w !== 'number' || !Number.isFinite(cp.w) || cp.w <= 0) {
              errors.push({ code: 'INVALID_CP_WEIGHT', message: `Control point at [${i}][${j}] has invalid weight (must be > 0)`, location: `cp[${i}][${j}]`, actual: cp?.w });
            }
          }
        }
      }

      if (Array.isArray(surface.knotsU) && Array.isArray(surface.knotsV)) {
        const pU = surface.degreeU;
        const nU = numU - 1;
        const expectedKnotsU = nU + pU + 2;
        if (surface.knotsU.length !== expectedKnotsU) {
          errors.push({ code: 'INVALID_KNOT_COUNT_U', message: `Invalid knotsU count. Expected ${expectedKnotsU}`, expected: expectedKnotsU, actual: surface.knotsU.length });
        }

        const pV = surface.degreeV;
        const nV = numV - 1;
        const expectedKnotsV = nV + pV + 2;
        if (surface.knotsV.length !== expectedKnotsV) {
          errors.push({ code: 'INVALID_KNOT_COUNT_V', message: `Invalid knotsV count. Expected ${expectedKnotsV}`, expected: expectedKnotsV, actual: surface.knotsV.length });
        }

        const validateKnotArr = (arr: readonly number[], dir: string) => {
          for (let i = 0; i < arr.length; i++) {
            if (!Number.isFinite(arr[i])) {
              errors.push({ code: 'INVALID_KNOT_VALUE', message: `Knot ${dir} at index ${i} is not finite`, location: `knots${dir}[${i}]` });
            }
            if (i > 0 && arr[i] < arr[i - 1]) {
              errors.push({ code: 'DESCENDING_KNOTS', message: `Knots ${dir} must be non-decreasing`, location: `knots${dir}[${i}]` });
            }
          }
        };
        validateKnotArr(surface.knotsU, 'U');
        validateKnotArr(surface.knotsV, 'V');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
