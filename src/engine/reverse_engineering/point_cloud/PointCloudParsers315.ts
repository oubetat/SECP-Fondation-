import { Point3D, BoundingBox3D, PointCloudImportResult, RejectedPointRecord } from './PointCloudTypes315';

export class PointCloudParsers315 {
  public static calculateBounds(points: Point3D[]): BoundingBox3D {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.z > maxZ) maxZ = p.z;
    }

    if (points.length === 0) {
      minX = minY = minZ = 0;
      maxX = maxY = maxZ = 0;
    }

    const dx = maxX - minX;
    const dy = maxY - minY;
    const dz = maxZ - minZ;

    return {
      minX, minY, minZ,
      maxX, maxY, maxZ,
      sizeX: dx,
      sizeY: dy,
      sizeZ: dz,
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      diagonalMm: Math.sqrt(dx * dx + dy * dy + dz * dz)
    };
  }

  public static parsePLY(content: string): PointCloudImportResult {
    const lines = content.split('\n');
    let declaredPointCount = 0;
    let inHeader = true;
    const points: Point3D[] = [];
    const rejectedPoints: RejectedPointRecord[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (inHeader) {
        if (line.startsWith('element vertex ')) {
          declaredPointCount = parseInt(line.substring(15).trim(), 10);
        }
        if (line === 'end_header') {
          inHeader = false;
        }
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const rawX = parts[0];
        const rawY = parts[1];
        const rawZ = parts[2];

        const x = parseFloat(rawX);
        const y = parseFloat(rawY);
        const z = parseFloat(rawZ);

        const pointIdx = points.length + rejectedPoints.length;

        const isXInf = rawX.toUpperCase().startsWith('INF') || !isFinite(x) && !isNaN(x);
        const isYInf = rawY.toUpperCase().startsWith('INF') || !isFinite(y) && !isNaN(y);
        const isZInf = rawZ.toUpperCase().startsWith('INF') || !isFinite(z) && !isNaN(z);

        if (isXInf || isYInf || isZInf) {
          rejectedPoints.push({
            pointIndex: pointIdx,
            rawText: line,
            reason: 'INFINITY_VALUE',
            sourceLocation: `line ${i + 1}`
          });
        } else if (rawX.toUpperCase() === 'NAN' || rawY.toUpperCase() === 'NAN' || rawZ.toUpperCase() === 'NAN' || isNaN(x) || isNaN(y) || isNaN(z)) {
          rejectedPoints.push({
            pointIndex: pointIdx,
            rawText: line,
            reason: 'NAN_COORDINATE',
            sourceLocation: `line ${i + 1}`
          });
        } else {
          const intensity = parts[3] ? parseFloat(parts[3]) : undefined;
          points.push({ x, y, z, intensity });
        }
      } else {
        const pointIdx = points.length + rejectedPoints.length;
        rejectedPoints.push({
          pointIndex: pointIdx,
          rawText: line,
          reason: 'MALFORMED_ROW',
          sourceLocation: `line ${i + 1}`
        });
      }
    }

    return {
      format: 'PLY',
      declaredPointCount,
      points,
      rejectedPoints,
      detectedUnits: 'UNIT_UNKNOWN'
    };
  }

  public static parsePCD(content: string): PointCloudImportResult {
    const lines = content.split('\n');
    let declaredPointCount = 0;
    let inHeader = true;
    const points: Point3D[] = [];
    const rejectedPoints: RejectedPointRecord[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (inHeader) {
        if (line.startsWith('POINTS ')) {
          declaredPointCount = parseInt(line.substring(7).trim(), 10);
        }
        if (line.startsWith('DATA ascii')) {
          inHeader = false;
        }
        continue;
      }

      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const rawX = parts[0];
        const rawY = parts[1];
        const rawZ = parts[2];

        const x = parseFloat(rawX);
        const y = parseFloat(rawY);
        const z = parseFloat(rawZ);

        const pointIdx = points.length + rejectedPoints.length;

        const isXInf = rawX.toUpperCase().startsWith('INF') || !isFinite(x) && !isNaN(x);
        const isYInf = rawY.toUpperCase().startsWith('INF') || !isFinite(y) && !isNaN(y);
        const isZInf = rawZ.toUpperCase().startsWith('INF') || !isFinite(z) && !isNaN(z);

        if (isXInf || isYInf || isZInf) {
          rejectedPoints.push({
            pointIndex: pointIdx,
            rawText: line,
            reason: 'INFINITY_VALUE',
            sourceLocation: `line ${i + 1}`
          });
        } else if (rawX.toUpperCase() === 'NAN' || rawY.toUpperCase() === 'NAN' || rawZ.toUpperCase() === 'NAN' || isNaN(x) || isNaN(y) || isNaN(z)) {
          rejectedPoints.push({
            pointIndex: pointIdx,
            rawText: line,
            reason: 'NAN_COORDINATE',
            sourceLocation: `line ${i + 1}`
          });
        } else {
          const intensity = parts[3] ? parseFloat(parts[3]) : undefined;
          points.push({ x, y, z, intensity });
        }
      } else {
        const pointIdx = points.length + rejectedPoints.length;
        rejectedPoints.push({
          pointIndex: pointIdx,
          rawText: line,
          reason: 'MALFORMED_ROW',
          sourceLocation: `line ${i + 1}`
        });
      }
    }

    return {
      format: 'PCD',
      declaredPointCount,
      points,
      rejectedPoints,
      detectedUnits: 'UNIT_UNKNOWN'
    };
  }

  public static parseXYZ(content: string): PointCloudImportResult {
    const lines = content.split('\n');
    const points: Point3D[] = [];
    const rejectedPoints: RejectedPointRecord[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(/\s+/);
      if (parts.length >= 3) {
        const rawX = parts[0];
        const rawY = parts[1];
        const rawZ = parts[2];

        const x = parseFloat(rawX);
        const y = parseFloat(rawY);
        const z = parseFloat(rawZ);

        const pointIdx = points.length + rejectedPoints.length;

        const isXInf = rawX.toUpperCase().startsWith('INF') || !isFinite(x) && !isNaN(x);
        const isYInf = rawY.toUpperCase().startsWith('INF') || !isFinite(y) && !isNaN(y);
        const isZInf = rawZ.toUpperCase().startsWith('INF') || !isFinite(z) && !isNaN(z);

        if (isXInf || isYInf || isZInf) {
          rejectedPoints.push({
            pointIndex: pointIdx,
            rawText: line,
            reason: 'INFINITY_VALUE',
            sourceLocation: `line ${i + 1}`
          });
        } else if (rawX.toUpperCase() === 'NAN' || rawY.toUpperCase() === 'NAN' || rawZ.toUpperCase() === 'NAN' || isNaN(x) || isNaN(y) || isNaN(z)) {
          rejectedPoints.push({
            pointIndex: pointIdx,
            rawText: line,
            reason: 'NAN_COORDINATE',
            sourceLocation: `line ${i + 1}`
          });
        } else {
          const intensity = parts[3] ? parseFloat(parts[3]) : undefined;
          points.push({ x, y, z, intensity });
        }
      } else {
        const pointIdx = points.length + rejectedPoints.length;
        rejectedPoints.push({
          pointIndex: pointIdx,
          rawText: line,
          reason: 'MALFORMED_ROW',
          sourceLocation: `line ${i + 1}`
        });
      }
    }

    return {
      format: 'XYZ',
      declaredPointCount: points.length + rejectedPoints.length,
      points,
      rejectedPoints,
      detectedUnits: 'UNIT_UNKNOWN'
    };
  }
}
