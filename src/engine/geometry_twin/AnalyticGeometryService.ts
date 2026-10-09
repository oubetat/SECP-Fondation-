// SECP Industrial OS v2 — Analytic Geometry Service
import { AnalyticGeometryDefinition, AnalyticSurfaceType, AnalyticCurveType, Vector3D } from './types';
import { CanonicalGeometrySerializer } from './CanonicalGeometrySerializer';

export class AnalyticGeometryService {
  public static createCylinder(params: {
    id: string;
    origin: Vector3D;
    axis: Vector3D;
    radius: number;
    height: number;
  }): AnalyticGeometryDefinition {
    const geom: AnalyticGeometryDefinition = {
      entityId: params.id,
      type: 'CYLINDER',
      origin: params.origin,
      axis: params.axis,
      radius: params.radius,
      parameterDomain: [0, params.height],
      orientation: 'FORWARD',
      analyticHash: ''
    };
    geom.analyticHash = CanonicalGeometrySerializer.computeAnalyticHash(geom);
    return geom;
  }

  public static createSphere(params: {
    id: string;
    origin: Vector3D;
    axis: Vector3D;
    radius: number;
  }): AnalyticGeometryDefinition {
    const geom: AnalyticGeometryDefinition = {
      entityId: params.id,
      type: 'SPHERE',
      origin: params.origin,
      axis: params.axis,
      radius: params.radius,
      parameterDomain: [0, Math.PI],
      orientation: 'FORWARD',
      analyticHash: ''
    };
    geom.analyticHash = CanonicalGeometrySerializer.computeAnalyticHash(geom);
    return geom;
  }

  public static createPlane(params: {
    id: string;
    origin: Vector3D;
    normal: Vector3D;
  }): AnalyticGeometryDefinition {
    const geom: AnalyticGeometryDefinition = {
      entityId: params.id,
      type: 'PLANE',
      origin: params.origin,
      axis: params.normal,
      orientation: 'FORWARD',
      analyticHash: ''
    };
    geom.analyticHash = CanonicalGeometrySerializer.computeAnalyticHash(geom);
    return geom;
  }

  public static createCircle(params: {
    id: string;
    center: Vector3D;
    normal: Vector3D;
    radius: number;
  }): AnalyticGeometryDefinition {
    const geom: AnalyticGeometryDefinition = {
      entityId: params.id,
      type: 'CIRCLE',
      origin: params.center,
      axis: params.normal,
      radius: params.radius,
      parameterDomain: [0, 2 * Math.PI],
      orientation: 'FORWARD',
      analyticHash: ''
    };
    geom.analyticHash = CanonicalGeometrySerializer.computeAnalyticHash(geom);
    return geom;
  }
}
