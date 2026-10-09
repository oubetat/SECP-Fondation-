/**
 * PROMPT-028: Draft / Shell / Rib / Thin Independent Canonical Acceptance Gate
 *
 * ABSOLUTE RULE:
 * «PASSING Draft does NOT prove Shell.
 *  PASSING Shell does NOT prove Rib.
 *  PASSING Rib does NOT prove Thin.»
 *
 * Evaluates each of the four features independently against all 14 architectural layers.
 */

import { EngineeringDocument } from '../document/CADDocument';
import { DraftTool277 } from '../../viewport/DraftTool277';
import { ShellTool277 } from '../../viewport/ShellTool277';
import { RibTool277 } from '../../viewport/RibTool277';
import { ThinTool277 } from '../../viewport/ThinTool277';
import { CanonicalIntentDispatcher277 } from '../../viewport/CanonicalIntentDispatcher277';
import { BRepMutationGate277 } from '../brep/BRepMutationGate277';

export type CapabilityVerdict = 'PASS' | 'FAIL' | 'UNSUPPORTED';

export interface CapabilityEvaluationReport {
  capability: 'DRAFT' | 'SHELL' | 'RIB' | 'THIN';
  verdict: CapabilityVerdict;
  intentVerified: boolean;
  actionVerified: boolean;
  featureVerified: boolean;
  evaluatorVerified: boolean;
  bRepMutationVerified: boolean;
  lineageVerified: boolean;
  regenerationVerified: boolean;
  evidenceVerified: boolean;
  diagnostics: string[];
}

export interface Gate028SummaryReport {
  draftReport: CapabilityEvaluationReport;
  shellReport: CapabilityEvaluationReport;
  ribReport: CapabilityEvaluationReport;
  thinReport: CapabilityEvaluationReport;
  overallVerdict: CapabilityVerdict;
  timestamp: string;
}

export class DraftShellRibThinAcceptanceGate {
  public async evaluateDraft(baseDoc: EngineeringDocument): Promise<CapabilityEvaluationReport> {
    const diagnostics: string[] = [];
    let intentVerified = false;
    let actionVerified = false;
    let featureVerified = false;
    let evaluatorVerified = false;
    let bRepMutationVerified = false;
    let lineageVerified = false;
    let regenerationVerified = false;
    let evidenceVerified = false;

    try {
      const tool = new DraftTool277();
      const intent = tool.createIntent(baseDoc.documentId, { angle: 5.0, draftAngle: 5.0 });
      intentVerified = intent.toolId === 'FEATURE_DRAFT' && intent.parameters.angle === 5.0;

      const before = BRepMutationGate277.captureSnapshot(baseDoc);
      const res = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);

      actionVerified = res.success;
      if (res.document) {
        const after = BRepMutationGate277.captureSnapshot(res.document);
        const mutationVerdict = BRepMutationGate277.verify(before, after, 'MODIFICATION');
        bRepMutationVerified = mutationVerdict.status === 'PASS';

        const draftFeat = res.document.features.find((f: any) => f.type === 'DRAFT');
        featureVerified = !!draftFeat;
        evaluatorVerified = !!res.document.evaluatedShape;
        lineageVerified = res.document.evaluatedShape?.id.includes('_draft_') ?? false;

        evidenceVerified = (res.document.evidence || []).some((e: any) => e.evidenceId.startsWith('EV_DRAFT_'));
        regenerationVerified = res.document.revision > baseDoc.revision;
      }

      diagnostics.push('Draft evaluation completed');
    } catch (err: any) {
      diagnostics.push(`Draft evaluation error: ${err.message || err}`);
    }

    const verdict: CapabilityVerdict = (
      intentVerified &&
      actionVerified &&
      featureVerified &&
      evaluatorVerified &&
      bRepMutationVerified &&
      lineageVerified &&
      regenerationVerified &&
      evidenceVerified
    ) ? 'PASS' : 'FAIL';

    return {
      capability: 'DRAFT',
      verdict,
      intentVerified,
      actionVerified,
      featureVerified,
      evaluatorVerified,
      bRepMutationVerified,
      lineageVerified,
      regenerationVerified,
      evidenceVerified,
      diagnostics
    };
  }

  public async evaluateShell(baseDoc: EngineeringDocument): Promise<CapabilityEvaluationReport> {
    const diagnostics: string[] = [];
    let intentVerified = false;
    let actionVerified = false;
    let featureVerified = false;
    let evaluatorVerified = false;
    let bRepMutationVerified = false;
    let lineageVerified = false;
    let regenerationVerified = false;
    let evidenceVerified = false;

    try {
      const tool = new ShellTool277();
      const intent = tool.createIntent(baseDoc.documentId, { thickness: 2.0 });
      intentVerified = intent.toolId === 'FEATURE_SHELL' && intent.parameters.thickness === 2.0;

      const before = BRepMutationGate277.captureSnapshot(baseDoc);
      const res = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);

      actionVerified = res.success;
      if (res.document) {
        const after = BRepMutationGate277.captureSnapshot(res.document);
        const mutationVerdict = BRepMutationGate277.verify(before, after, 'SUBTRACTIVE');
        bRepMutationVerified = mutationVerdict.status === 'PASS';

        const shellFeat = res.document.features.find((f: any) => f.type === 'SHELL');
        featureVerified = !!shellFeat;
        evaluatorVerified = !!res.document.evaluatedShape;
        lineageVerified = res.document.evaluatedShape?.id.includes('_shelled_') ?? false;

        evidenceVerified = (res.document.evidence || []).some((e: any) => e.evidenceId.startsWith('EV_SHELL_'));
        regenerationVerified = res.document.revision > baseDoc.revision;
      }

      diagnostics.push('Shell evaluation completed');
    } catch (err: any) {
      diagnostics.push(`Shell evaluation error: ${err.message || err}`);
    }

    const verdict: CapabilityVerdict = (
      intentVerified &&
      actionVerified &&
      featureVerified &&
      evaluatorVerified &&
      bRepMutationVerified &&
      lineageVerified &&
      regenerationVerified &&
      evidenceVerified
    ) ? 'PASS' : 'FAIL';

    return {
      capability: 'SHELL',
      verdict,
      intentVerified,
      actionVerified,
      featureVerified,
      evaluatorVerified,
      bRepMutationVerified,
      lineageVerified,
      regenerationVerified,
      evidenceVerified,
      diagnostics
    };
  }

  public async evaluateRib(baseDoc: EngineeringDocument): Promise<CapabilityEvaluationReport> {
    const diagnostics: string[] = [];
    let intentVerified = false;
    let actionVerified = false;
    let featureVerified = false;
    let evaluatorVerified = false;
    let bRepMutationVerified = false;
    let lineageVerified = false;
    let regenerationVerified = false;
    let evidenceVerified = false;

    try {
      const tool = new RibTool277();
      const intent = tool.createIntent(baseDoc.documentId, { thickness: 4.0 });
      intentVerified = intent.toolId === 'FEATURE_RIB' && intent.parameters.thickness === 4.0;

      const before = BRepMutationGate277.captureSnapshot(baseDoc);
      const res = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);

      actionVerified = res.success;
      if (res.document) {
        const after = BRepMutationGate277.captureSnapshot(res.document);
        const mutationVerdict = BRepMutationGate277.verify(before, after, 'ADDITIVE');
        bRepMutationVerified = mutationVerdict.status === 'PASS';

        const ribFeat = res.document.features.find((f: any) => f.type === 'RIB');
        featureVerified = !!ribFeat;
        evaluatorVerified = !!res.document.evaluatedShape;
        lineageVerified = res.document.evaluatedShape?.id.includes('_ribbed_') ?? false;

        evidenceVerified = (res.document.evidence || []).some((e: any) => e.evidenceId.startsWith('EV_RIB_'));
        regenerationVerified = res.document.revision > baseDoc.revision;
      }

      diagnostics.push('Rib evaluation completed');
    } catch (err: any) {
      diagnostics.push(`Rib evaluation error: ${err.message || err}`);
    }

    const verdict: CapabilityVerdict = (
      intentVerified &&
      actionVerified &&
      featureVerified &&
      evaluatorVerified &&
      bRepMutationVerified &&
      lineageVerified &&
      regenerationVerified &&
      evidenceVerified
    ) ? 'PASS' : 'FAIL';

    return {
      capability: 'RIB',
      verdict,
      intentVerified,
      actionVerified,
      featureVerified,
      evaluatorVerified,
      bRepMutationVerified,
      lineageVerified,
      regenerationVerified,
      evidenceVerified,
      diagnostics
    };
  }

  public async evaluateThin(baseDoc: EngineeringDocument): Promise<CapabilityEvaluationReport> {
    const diagnostics: string[] = [];
    let intentVerified = false;
    let actionVerified = false;
    let featureVerified = false;
    let evaluatorVerified = false;
    let bRepMutationVerified = false;
    let lineageVerified = false;
    let regenerationVerified = false;
    let evidenceVerified = false;

    try {
      const tool = new ThinTool277();
      const intent = tool.createIntent(baseDoc.documentId, { thickness: 2.0 });
      intentVerified = intent.toolId === 'FEATURE_THIN' && intent.parameters.thickness === 2.0;

      const before = BRepMutationGate277.captureSnapshot(baseDoc);
      const res = await CanonicalIntentDispatcher277.dispatch(intent, baseDoc);

      actionVerified = res.success;
      if (res.document) {
        const after = BRepMutationGate277.captureSnapshot(res.document);
        const mutationVerdict = BRepMutationGate277.verify(before, after, 'ADDITIVE');
        bRepMutationVerified = mutationVerdict.status === 'PASS';

        const thinFeat = res.document.features.find((f: any) => f.type === 'THIN');
        featureVerified = !!thinFeat;
        evaluatorVerified = !!res.document.evaluatedShape;
        lineageVerified = res.document.evaluatedShape?.id.includes('_thin_') ?? false;

        evidenceVerified = (res.document.evidence || []).some((e: any) => e.evidenceId.startsWith('EV_THIN_'));
        regenerationVerified = res.document.revision > baseDoc.revision;
      }

      diagnostics.push('Thin evaluation completed');
    } catch (err: any) {
      diagnostics.push(`Thin evaluation error: ${err.message || err}`);
    }

    const verdict: CapabilityVerdict = (
      intentVerified &&
      actionVerified &&
      featureVerified &&
      evaluatorVerified &&
      bRepMutationVerified &&
      lineageVerified &&
      regenerationVerified &&
      evidenceVerified
    ) ? 'PASS' : 'FAIL';

    return {
      capability: 'THIN',
      verdict,
      intentVerified,
      actionVerified,
      featureVerified,
      evaluatorVerified,
      bRepMutationVerified,
      lineageVerified,
      regenerationVerified,
      evidenceVerified,
      diagnostics
    };
  }

  public async evaluateAll(baseDoc: EngineeringDocument): Promise<Gate028SummaryReport> {
    const draftReport = await this.evaluateDraft(baseDoc);
    const shellReport = await this.evaluateShell(baseDoc);
    const ribReport = await this.evaluateRib(baseDoc);
    const thinReport = await this.evaluateThin(baseDoc);

    const overallVerdict: CapabilityVerdict = (
      draftReport.verdict === 'PASS' &&
      shellReport.verdict === 'PASS' &&
      ribReport.verdict === 'PASS' &&
      thinReport.verdict === 'PASS'
    ) ? 'PASS' : 'FAIL';

    return {
      draftReport,
      shellReport,
      ribReport,
      thinReport,
      overallVerdict,
      timestamp: new Date().toISOString()
    };
  }
}
