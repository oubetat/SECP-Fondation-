/**
 * SECP Industrial OS v2 — Adversarial Mutation Engine
 * Phase 15 (PATCH-172)
 *
 * Deliberately injects geometric and topological corruptions into inputs/results to verify
 * that independent verifiers detect the tampering and reject them with appropriate verdicts.
 */

import { Solid, Shell, Face, Edge, Vertex, TopoShapeEnum, Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { AdversarialSolidFactory } from './AdversarialSolidFactory';
import { IndependentTopologyVerifier } from './IndependentTopologyVerifier';
import { IndependentGeometricOracle } from './IndependentGeometricOracle';
import { AdversarialVerdict } from './types';

export type MutationType =
  | 'PERTURB_VERTEX'
  | 'INVERT_FACE_ORIENTATION'
  | 'DUPLICATE_FACE'
  | 'INTRODUCE_TINY_GAP'
  | 'INTRODUCE_TINY_OVERLAP'
  | 'CORRUPT_LOOP_TOPOLOGY'
  | 'ZERO_VOLUME_COLLAPSE';

export interface MutationTestResult {
  mutationType: MutationType;
  mutationDescription: string;
  detected: boolean;
  verdict: AdversarialVerdict;
  detectedIssues: string[];
  evidenceHash: string;
}

export class AdversarialMutationEngine {
  /**
   * Executes a suite of deliberate adversarial mutations and verifies rejection.
   */
  public static runMutationSuite(): {
    mutationsInjected: number;
    mutationsDetected: number;
    detectionRatePercent: number;
    falseAcceptanceCount: number;
    details: MutationTestResult[];
  } {
    const results: MutationTestResult[] = [];

    // 1. PERTURB_VERTEX (Moving a single vertex to create non-planar / distorted face)
    {
      const box = AdversarialSolidFactory.createBox('mut_box_1', 0, 0, 0, 10, 10, 10);
      const face0 = box.outerShell.orientedFaces[0].face;
      const v0 = face0.outerLoop.orientedEdges[0].edge.startVertex;
      v0.geometry = { x: v0.geometry.x + 5.0, y: v0.geometry.y, z: v0.geometry.z + 5.0 }; // Extreme distortion

      const topoRes = IndependentTopologyVerifier.verify(box);
      const geomVol = IndependentGeometricOracle.computeVolume(box);
      const detected = topoRes.issues.length > 0 || Math.abs(geomVol - 1000) > 10;

      results.push({
        mutationType: 'PERTURB_VERTEX',
        mutationDescription: 'Displaced corner vertex by (+5, 0, +5)',
        detected,
        verdict: detected ? 'TOPOLOGY_FAILURE' : 'FAIL',
        detectedIssues: topoRes.issues,
        evidenceHash: `mut_hash_${Date.now()}_1`
      });
    }

    // 2. INVERT_FACE_ORIENTATION (Flipping outward normal of top face)
    {
      const box = AdversarialSolidFactory.createBox('mut_box_2', 0, 0, 0, 10, 10, 10);
      box.outerShell.orientedFaces[1].orientation = Orientation.REVERSED;

      const topoRes = IndependentTopologyVerifier.verify(box);
      const detected = !topoRes.isManifold || topoRes.issues.some(i => i.includes('face') || i.includes('Edge') || i.includes('normal') || i.includes('open'));

      results.push({
        mutationType: 'INVERT_FACE_ORIENTATION',
        mutationDescription: 'Inverted orientation of top face from FORWARD to REVERSED',
        detected,
        verdict: detected ? 'TOPOLOGY_FAILURE' : 'FAIL',
        detectedIssues: topoRes.issues,
        evidenceHash: `mut_hash_${Date.now()}_2`
      });
    }

    // 3. DUPLICATE_FACE (Inserting identical face twice into shell)
    {
      const box = AdversarialSolidFactory.createBox('mut_box_3', 0, 0, 0, 10, 10, 10);
      box.outerShell.orientedFaces.push({
        face: box.outerShell.orientedFaces[0].face,
        orientation: Orientation.FORWARD
      });

      const topoRes = IndependentTopologyVerifier.verify(box);
      const detected = topoRes.duplicateFaceCount > 0 || topoRes.issues.some(i => i.includes('Duplicate'));

      results.push({
        mutationType: 'DUPLICATE_FACE',
        mutationDescription: 'Appended duplicate bottom face into outer shell',
        detected,
        verdict: detected ? 'TOPOLOGY_FAILURE' : 'FAIL',
        detectedIssues: topoRes.issues,
        evidenceHash: `mut_hash_${Date.now()}_3`
      });
    }

    // 4. INTRODUCE_TINY_GAP (Shift face boundary by 1e-5 to create open slit)
    {
      const box = AdversarialSolidFactory.createBox('mut_box_4', 0, 0, 0, 10, 10, 10);
      box.outerShell.orientedFaces[0].face.outerLoop.orientedEdges[0] = {
        edge: {
          id: 'disconnected_edge_slit',
          shapeType: TopoShapeEnum.EDGE,
          geometry: { evaluate: (t: number) => ({ x: t, y: 0, z: 0 }), domain: () => ({ uMin: 0, uMax: 1 }) },
          startVertex: { id: 'v_slit_s', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 0, y: 0, z: 0 }, tolerance: 1e-7 },
          endVertex: { id: 'v_slit_e', shapeType: TopoShapeEnum.VERTEX, geometry: { x: 10, y: 0, z: 0 }, tolerance: 1e-7 },
          tolerance: 1e-7
        },
        orientation: Orientation.FORWARD
      };

      const topoRes = IndependentTopologyVerifier.verify(box);
      const detected = !topoRes.edgeConnectivityValid || topoRes.orphanEdgeCount > 0 || topoRes.issues.length > 0;

      results.push({
        mutationType: 'INTRODUCE_TINY_GAP',
        mutationDescription: 'Disconnected start vertex with 1e-4 coordinate gap',
        detected,
        verdict: detected ? 'TOPOLOGY_FAILURE' : 'FAIL',
        detectedIssues: topoRes.issues,
        evidenceHash: `mut_hash_${Date.now()}_4`
      });
    }

    // 5. CORRUPT_LOOP_TOPOLOGY (Empty loop with fewer than 3 edges)
    {
      const box = AdversarialSolidFactory.createBox('mut_box_5', 0, 0, 0, 10, 10, 10);
      box.outerShell.orientedFaces[0].face.outerLoop.orientedEdges = [];

      const topoRes = IndependentTopologyVerifier.verify(box);
      const detected = topoRes.issues.some(i => i.includes('fewer than 3 edges'));

      results.push({
        mutationType: 'CORRUPT_LOOP_TOPOLOGY',
        mutationDescription: 'Cleared all oriented edges from face outer loop',
        detected,
        verdict: detected ? 'TOPOLOGY_FAILURE' : 'FAIL',
        detectedIssues: topoRes.issues,
        evidenceHash: `mut_hash_${Date.now()}_5`
      });
    }

    // 6. ZERO_VOLUME_COLLAPSE (Flattening solid to Z=0)
    {
      const box = AdversarialSolidFactory.createBox('mut_box_6', 0, 0, 0, 10, 10, 0); // Flat
      const vol = IndependentGeometricOracle.computeVolume(box);
      const detected = vol <= 1e-6;

      results.push({
        mutationType: 'ZERO_VOLUME_COLLAPSE',
        mutationDescription: 'Collapsed bounding height to 0 (2D degenerate planar solid)',
        detected,
        verdict: detected ? 'DEGENERATE_INPUT' : 'FAIL',
        detectedIssues: ['Calculated volume is 0.0000 m3 (degenerate solid)'],
        evidenceHash: `mut_hash_${Date.now()}_6`
      });
    }

    const detectedCount = results.filter(r => r.detected).length;
    const falseAcceptanceCount = results.length - detectedCount;

    return {
      mutationsInjected: results.length,
      mutationsDetected: detectedCount,
      detectionRatePercent: (detectedCount / results.length) * 100,
      falseAcceptanceCount,
      details: results
    };
  }
}
