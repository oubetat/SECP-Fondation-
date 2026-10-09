/**
 * SECP Industrial OS v2 — Provenance Diff Engine
 * Compares Lineages & Classifies Engineering Differences
 */

import { ProvenanceNode, ChangeSignificance } from "./types";

export interface ProvenanceDiffResult {
  artifactIdA: string;
  artifactIdB: string;
  hasDifferences: boolean;
  overallSignificance: ChangeSignificance;
  differences: {
    category: "CAD" | "TOOL" | "MACHINE" | "STRATEGY" | "PARAMETER" | "POST" | "SIMULATION" | "VERIFICATION";
    fieldName: string;
    valueA: any;
    valueB: any;
    significance: ChangeSignificance;
  }[];
}

export class CAMProvenanceDiffEngine {
  public static compareNodes(nodeA: ProvenanceNode, nodeB: ProvenanceNode): ProvenanceDiffResult {
    const differences: ProvenanceDiffResult["differences"] = [];

    // 1. Compare Content Hashes
    if (nodeA.contentHash !== nodeB.contentHash) {
      differences.push({
        category: "STRATEGY",
        fieldName: "contentHash",
        valueA: nodeA.contentHash,
        valueB: nodeB.contentHash,
        significance: ChangeSignificance.ENGINEERING_RELEVANT
      });
    }

    // 2. Compare Payloads
    const contentA = nodeA.payload.content || {};
    const contentB = nodeB.payload.content || {};

    const allKeys = Array.from(new Set([...Object.keys(contentA), ...Object.keys(contentB)]));

    for (const key of allKeys) {
      const valA = contentA[key];
      const valB = contentB[key];

      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        let category: ProvenanceDiffResult["differences"][0]["category"] = "PARAMETER";
        let significance = ChangeSignificance.MANUFACTURING_RELEVANT;

        if (key.includes("cad") || key.includes("geometry")) {
          category = "CAD";
          significance = ChangeSignificance.CRITICAL;
        } else if (key.includes("tool")) {
          category = "TOOL";
          significance = ChangeSignificance.MANUFACTURING_RELEVANT;
        } else if (key.includes("machine") || key.includes("spindle")) {
          category = "MACHINE";
          significance = ChangeSignificance.CRITICAL;
        } else if (key.includes("post") || key.includes("nc")) {
          category = "POST";
          significance = ChangeSignificance.VERIFICATION_RELEVANT;
        }

        differences.push({
          category,
          fieldName: key,
          valueA: valA,
          valueB: valB,
          significance
        });
      }
    }

    let overallSignificance = ChangeSignificance.COSMETIC;
    if (differences.some(d => d.significance === ChangeSignificance.CRITICAL)) {
      overallSignificance = ChangeSignificance.CRITICAL;
    } else if (differences.some(d => d.significance === ChangeSignificance.MANUFACTURING_RELEVANT)) {
      overallSignificance = ChangeSignificance.MANUFACTURING_RELEVANT;
    } else if (differences.some(d => d.significance === ChangeSignificance.ENGINEERING_RELEVANT)) {
      overallSignificance = ChangeSignificance.ENGINEERING_RELEVANT;
    } else if (differences.length > 0) {
      overallSignificance = ChangeSignificance.METADATA_ONLY;
    }

    return {
      artifactIdA: nodeA.identity.artifactId,
      artifactIdB: nodeB.identity.artifactId,
      hasDifferences: differences.length > 0,
      overallSignificance,
      differences
    };
  }
}
