/**
 * SECP Engineering OS — Derived Artifact Registry
 * Phase 3 (POST-UX-003 / SECP Architecture 2.0)
 *
 * ARCHITECTURAL CONTRACT:
 * - Tracks all derived engineering artifacts (SVG drawings, STEP TDPs, G-code NC blocks, BOM JSONs, FEA/CFD results).
 * - Binds each artifact to its generating documentHash and revision.
 * - Automatically flags artifacts as isStale when document revision advances.
 */

import { DerivedArtifactState } from './EngineeringToolContext';

export class DerivedArtifactRegistry {
  private static registry = new Map<string, DerivedArtifactState>();

  public static registerArtifact(artifact: Omit<DerivedArtifactState, 'isStale'>, currentRevision: number): DerivedArtifactState {
    const isStale = artifact.generatingRevision !== currentRevision;
    const fullState: DerivedArtifactState = {
      ...artifact,
      isStale
    };
    this.registry.set(artifact.artifactId, fullState);
    return fullState;
  }

  public static getArtifactsForDocument(documentHash: string, currentRevision: number): DerivedArtifactState[] {
    const artifacts: DerivedArtifactState[] = [];
    this.registry.forEach(a => {
      artifacts.push({
        ...a,
        isStale: a.generatingRevision !== currentRevision || a.generatingDocumentHash !== documentHash
      });
    });
    return artifacts;
  }

  public static clear(): void {
    this.registry.clear();
  }
}
