import { ElementRegistry } from "./ElementRegistry";
import { ElementVerificationEngine } from "./ElementVerificationEngine";
import { ElementMatrixEvidence, ElementVerificationVerdict } from "./types";

export interface EvidenceReportSummary {
  patch: string;
  timestamp: string;
  totalElementsTested: number;
  verifiedElements: string[];
  verdicts: Record<string, ElementVerificationVerdict>;
  hardGatePassed: boolean;
}

export class ElementEvidenceEngine {
  static generateMatrixEvidence(
    elementId: string,
    elementTypeId: string,
    formulationVersion: string,
    coords: number[][],
    material: any,
    integrationRuleId: string,
    matrixHash: string
  ): ElementMatrixEvidence {
    const coordsStr = JSON.stringify(coords);
    const matStr = JSON.stringify(material);

    return {
      elementId,
      elementTypeId,
      formulationHash: `${elementTypeId}_${formulationVersion}`,
      coordinatesHash: `COORDS_${coords.length}pts_${coordsStr.length}`,
      materialHash: `MAT_${matStr.length}`,
      integrationHash: `RULE_${integrationRuleId}`,
      matrixHash,
      timestamp: new Date().toISOString()
    };
  }

  static runFullEvidenceBattery(): EvidenceReportSummary {
    ElementRegistry.initialize();
    const elements = ElementRegistry.list().map(e => e.elementTypeId);
    const verdicts: Record<string, ElementVerificationVerdict> = {};
    const verifiedElements: string[] = [];

    for (const el of elements) {
      const v = ElementVerificationEngine.runBattery(el);
      verdicts[el] = v;
      if (v.verdict === 'VERIFIED') {
        verifiedElements.push(el);
        ElementRegistry.updateStatus(el, 'VERIFIED');
      }
    }

    const primaryElements = ['BAR2', 'TRI3', 'QUAD4', 'TET4', 'HEX8'];
    const hardGatePassed = primaryElements.every(el => verifiedElements.includes(el));

    return {
      patch: "PATCH-232",
      timestamp: new Date().toISOString(),
      totalElementsTested: elements.length,
      verifiedElements,
      verdicts,
      hardGatePassed
    };
  }
}
