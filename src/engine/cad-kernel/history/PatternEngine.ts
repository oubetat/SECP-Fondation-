/**
 * SECP CAD Kernel — Feature Pattern & Mirror Engine
 * WP-04 Implementation
 */

import { Solid, TopoShapeEnum, Vertex } from '../topology/TopologyContracts';
import { DirectModelingEngine } from '../modeling/DirectModelingEngine';
import { BooleanEngine } from '../boolean/BooleanEngine';
import { Point, Direction } from '../geometry/GeometryContracts';

export class PatternEngine {
  /**
   * Executes a linear pattern of a solid.
   */
  public static executeLinearPattern(
    baseSolid: Solid,
    count: number,
    direction: { x: number; y: number; z: number },
    spacing: number
  ): Solid {
    if (count < 1) return baseSolid;
    let result = baseSolid;

    const len = Math.hypot(direction.x, direction.y, direction.z) || 1;
    const u = { x: direction.x / len, y: direction.y / len, z: direction.z / len };

    for (let i = 1; i < count; i++) {
      const translation = {
        x: u.x * spacing * i,
        y: u.y * spacing * i,
        z: u.z * spacing * i
      };

      const copy = DirectModelingEngine.cloneShape(baseSolid);
      this.translateShape(copy, translation);

      const res = BooleanEngine.execute('UNION', result, copy);
      if (res.status === 'SUCCESS' && res.resultShape) {
        result = res.resultShape as Solid;
      }
    }

    return result;
  }

  /**
   * Executes a circular pattern of a solid around an axis.
   */
  public static executeCircularPattern(
    baseSolid: Solid,
    count: number,
    totalAngleRad: number,
    axisPoint: Point,
    axisDir: Direction
  ): Solid {
    if (count <= 1) return baseSolid;
    let result = baseSolid;

    const len = Math.hypot(axisDir.x, axisDir.y, axisDir.z) || 1;
    const u = { x: axisDir.x / len, y: axisDir.y / len, z: axisDir.z / len };
    const stepAngle = totalAngleRad / (count - 1 || 1);

    for (let i = 1; i < count; i++) {
      const theta = stepAngle * i;
      const copy = DirectModelingEngine.cloneShape(baseSolid);
      this.rotateShape(copy, theta, axisPoint, u);

      const res = BooleanEngine.execute('UNION', result, copy);
      if (res.status === 'SUCCESS' && res.resultShape) {
        result = res.resultShape as Solid;
      }
    }

    return result;
  }

  /**
   * Mirrors a solid across a 3D plane.
   */
  public static executeMirrorPattern(
    baseSolid: Solid,
    mirrorOrigin: Point,
    mirrorNormal: Direction
  ): Solid {
    const len = Math.hypot(mirrorNormal.x, mirrorNormal.y, mirrorNormal.z) || 1;
    const un = { x: mirrorNormal.x / len, y: mirrorNormal.y / len, z: mirrorNormal.z / len };

    const copy = DirectModelingEngine.cloneShape(baseSolid);
    this.reflectShape(copy, mirrorOrigin, un);

    const res = BooleanEngine.execute('UNION', baseSolid, copy);
    if (res.status === 'SUCCESS' && res.resultShape) {
      return res.resultShape as Solid;
    }

    return baseSolid;
  }

  private static translateShape(shape: any, t: { x: number; y: number; z: number }): void {
    const entityMap = (DirectModelingEngine as any).collectEntities(shape);
    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        entity.geometry.x += t.x;
        entity.geometry.y += t.y;
        entity.geometry.z += t.z;
      }
    }
  }

  private static rotateShape(
    shape: any,
    angleRad: number,
    axisPoint: Point,
    u: Direction
  ): void {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const entityMap = (DirectModelingEngine as any).collectEntities(shape);

    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const px = entity.geometry.x - axisPoint.x;
        const py = entity.geometry.y - axisPoint.y;
        const pz = entity.geometry.z - axisPoint.z;

        const dot = px * u.x + py * u.y + pz * u.z;
        const crossX = u.y * pz - u.z * py;
        const crossY = u.z * px - u.x * pz;
        const crossZ = u.x * py - u.y * px;

        entity.geometry.x = axisPoint.x + (px * cosA + crossX * sinA + u.x * dot * (1 - cosA));
        entity.geometry.y = axisPoint.y + (py * cosA + crossY * sinA + u.y * dot * (1 - cosA));
        entity.geometry.z = axisPoint.z + (pz * cosA + crossZ * sinA + u.z * dot * (1 - cosA));
      }
    }
  }

  private static reflectShape(shape: any, planeOrigin: Point, un: Direction): void {
    const entityMap = (DirectModelingEngine as any).collectEntities(shape);

    for (const entity of entityMap.values()) {
      if (entity.shapeType === TopoShapeEnum.VERTEX) {
        const px = entity.geometry.x - planeOrigin.x;
        const py = entity.geometry.y - planeOrigin.y;
        const pz = entity.geometry.z - planeOrigin.z;

        const dist = px * un.x + py * un.y + pz * un.z;

        entity.geometry.x = entity.geometry.x - 2 * dist * un.x;
        entity.geometry.y = entity.geometry.y - 2 * dist * un.y;
        entity.geometry.z = entity.geometry.z - 2 * dist * un.z;
      }
    }
  }
}
