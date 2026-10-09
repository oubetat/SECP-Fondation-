/**
 * SECP Industrial OS v2 — Cross-Kernel Source Baseline Extractor
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 * 
 * Captures comprehensive immutable fingerprints of the native source model before
 * cross-kernel interchange.
 */

import { NativeSECPDocument } from '../native-secp/NativeSECPTypes';
import { SourceBaseline } from './CrossKernelTypes';
import { NativeSECPCanonicalizer } from '../native-secp/NativeSECPCanonicalizer';
import * as crypto from 'crypto';

export class CrossKernelSourceExtractor {

  public static extractBaseline(doc: NativeSECPDocument): SourceBaseline {
    const canonicalHashResult = NativeSECPCanonicalizer.computeCanonicalHash(doc);
    const canonicalHash = canonicalHashResult.canonicalHash;

    // Geometry fingerprint
    const points = doc.model.geometry.points || [];
    const analyticCurves = doc.model.geometry.analyticCurves || [];
    const nurbsCurves = doc.model.geometry.nurbsCurves || [];
    const analyticSurfaces = doc.model.geometry.analyticSurfaces || [];
    const nurbsSurfaces = doc.model.geometry.nurbsSurfaces || [];

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const pt of points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.z < minZ) minZ = pt.z;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
      if (pt.z > maxZ) maxZ = pt.z;
    }

    if (points.length === 0) {
      minX = minY = minZ = maxX = maxY = maxZ = 0;
    }

    let totalVolumeMm3 = 0;
    let totalSurfaceAreaMm2 = 0;
    for (const s of doc.model.topology.solids || []) {
      totalVolumeMm3 += s.volumeMm3 || 0;
      totalSurfaceAreaMm2 += s.surfaceAreaMm2 || 0;
    }

    // Topology adjacency fingerprint
    const topo = doc.model.topology;
    const adjacencyString = (topo.solids || []).map(s => `${s.id}:${s.outerShellId}`).join(';') + '|' +
      (topo.shells || []).map(sh => `${sh.id}:${(sh.faceIds || []).join(',')}`).join(';') + '|' +
      (topo.faces || []).map(f => `${f.id}:${f.outerLoopId}:${(f.innerLoopIds || []).join(',')}`).join(';') + '|' +
      (topo.loops || []).map(l => `${l.id}:${(l.edgeIds || []).join(',')}`).join(';') + '|' +
      (topo.edges || []).map(e => `${e.id}:${e.startVertexId}->${e.endVertexId}`).join(';') + '|' +
      (topo.vertices || []).map(v => `${v.id}:${v.pointId}`).join(';');

    const adjacencyHash = crypto.createHash('sha256').update(adjacencyString, 'utf8').digest('hex');

    // NURBS fingerprint
    const curvesDegree = nurbsCurves.map(nc => nc.degree);
    const surfacesDegree = nurbsSurfaces.map(ns => [ns.degreeU, ns.degreeV] as [number, number]);
    let totalControlPoints = 0;
    nurbsCurves.forEach(nc => totalControlPoints += (nc.controlPoints || []).length);
    nurbsSurfaces.forEach(ns => {
      (ns.controlPoints || []).forEach(row => totalControlPoints += row.length);
    });

    // Feature fingerprint
    const feat = doc.model.features || { features: [], executionOrder: [], isValid: true };

    // Assembly fingerprint
    const asm = doc.model.assemblies || { nodes: [], instances: [], mates: [] };

    // PMI fingerprint
    const mfg = doc.manufacturing || { features: [], toolpaths: [] };

    return {
      objectId: doc.identity.engineeringObjectId,
      revisionId: doc.identity.revisionId,
      document: doc,
      canonicalHash,
      geometryFingerprint: {
        pointsCount: points.length,
        analyticCurvesCount: analyticCurves.length,
        nurbsCurvesCount: nurbsCurves.length,
        analyticSurfacesCount: analyticSurfaces.length,
        nurbsSurfacesCount: nurbsSurfaces.length,
        boundingBox: {
          min: { x: minX, y: minY, z: minZ },
          max: { x: maxX, y: maxY, z: maxZ }
        },
        totalVolumeMm3,
        totalSurfaceAreaMm2
      },
      topologyFingerprint: {
        verticesCount: (topo.vertices || []).length,
        edgesCount: (topo.edges || []).length,
        loopsCount: (topo.loops || []).length,
        facesCount: (topo.faces || []).length,
        shellsCount: (topo.shells || []).length,
        solidsCount: (topo.solids || []).length,
        adjacencyHash
      },
      nurbsFingerprint: {
        curvesDegree,
        surfacesDegree,
        totalControlPoints
      },
      featureFingerprint: {
        featuresCount: feat.features.length,
        featureTypes: feat.features.map(f => f.featureType),
        executionOrder: Array.from(feat.executionOrder)
      },
      assemblyFingerprint: {
        instancesCount: (asm.instances || []).length,
        nodesCount: (asm.nodes || []).length,
        matesCount: (asm.mates || []).length
      },
      pmiFingerprint: {
        mfgFeaturesCount: (mfg.features || []).length,
        toolpathsCount: (mfg.toolpaths || []).length
      },
      units: {
        length: doc.header.units.length,
        angle: doc.header.units.angle,
        scaleFactorToMm: doc.header.units.scaleFactorToMm || 1.0
      },
      tolerance: {
        linear: doc.header.tolerance.linear,
        angular: doc.header.tolerance.angular
      }
    };
  }
}
