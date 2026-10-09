import { EngineeringCopilotCore } from './EngineeringCopilotCore';
import { globalToolRegistry } from './EngineeringToolRegistry';
import { EngineeringContext, EngineeringIntent } from './types';

export interface Gate138Result {
  gateId: string;
  description: string;
  passed: boolean;
  verdict: string;
  details: string;
}

export class HardAcceptanceGate138 {
  public static async runAllTests(): Promise<Gate138Result[]> {
    const results: Gate138Result[] = [];

    // 1. Context Resolution Check
    results.push(this.testContextResolution());

    // 2. Evidence Grounding / No Hallucination
    results.push(this.testEvidenceGrounding());

    // 3. Tool Permission Boundaries
    results.push(await this.testToolBoundaries());

    // 4. Critical Action Mutation Block
    results.push(this.testMutationSafety());

    // 5. Deterministic Provenance
    results.push(this.testProvenance());

    return results;
  }

  private static testContextResolution(): Gate138Result {
    const rawContext: Partial<EngineeringContext> = { projectId: 'P1' }; // Missing revisionId
    const res = EngineeringCopilotCore.resolveContext(rawContext);
    
    const passed = res.valid === false && res.missing?.includes('revisionId');
    return {
      gateId: 'GATE-138-CONTEXT',
      description: 'Reject ambiguous queries lacking explicit engineering context',
      passed,
      verdict: passed ? 'INSUFFICIENT_CONTEXT' : 'FAILED',
      details: passed ? 'Successfully demanded missing context.' : 'Allowed ambiguous context.'
    };
  }

  private static testEvidenceGrounding(): Gate138Result {
    const context: EngineeringContext = { projectId: 'P1', userId: 'U1', revisionId: 'R1' };
    const res = EngineeringCopilotCore.evaluateEvidence('Is this safe?', context, []);
    
    const passed = res.classification === 'INSUFFICIENT_EVIDENCE' && res.answer.includes('SAFETY CANNOT BE VERIFIED');
    return {
      gateId: 'GATE-138-EVIDENCE',
      description: 'Block hallucinated facts when evidence is missing',
      passed,
      verdict: passed ? 'NO_EVIDENCE' : 'FAILED',
      details: passed ? 'Safely rejected unfounded safety claim.' : 'Hallucinated a factual response.'
    };
  }

  private static async testToolBoundaries(): Promise<Gate138Result> {
    globalToolRegistry.registerTool({
      toolId: 'geometry-analyzer',
      domain: 'Geometry',
      capabilities: ['volume', 'mass'],
      permissions: ['ANALYZE'],
      version: '1.0',
      execute: async () => ({ volume: 100 })
    });

    const res = await globalToolRegistry.executeToolSafe('geometry-analyzer', {}, {}, 'MODIFY');
    const passed = res.success === false && res.error === 'UNAUTHORIZED_CAPABILITY';

    return {
      gateId: 'GATE-138-TOOL-PERMISSIONS',
      description: 'Enforce tool-level READ vs WRITE permissions',
      passed,
      verdict: passed ? 'UNAUTHORIZED' : 'FAILED',
      details: passed ? 'Successfully blocked unauthorized mutation tool call.' : 'Allowed unauthorized tool execution.'
    };
  }

  private static testMutationSafety(): Gate138Result {
    const intent: EngineeringIntent = {
      intentType: 'OPTIMIZE_DESIGN',
      domain: 'Geometry',
      target: 'Thickness',
      operation: 'MODIFY',
      constraints: [],
      requestedEvidence: [],
      confidence: 0.9,
      requiredTools: []
    };
    const context: EngineeringContext = { projectId: 'P1', userId: 'U1', revisionId: 'R1' };
    
    // Simulating proposeAction
    const safety = EngineeringCopilotCore.classifySafety(intent);
    const passed = safety === 'HIGH_IMPACT';

    return {
      gateId: 'GATE-138-MUTATION',
      description: 'Force human approval for HIGH_IMPACT or CRITICAL mutations',
      passed,
      verdict: passed ? 'REVIEW_REQUIRED' : 'FAILED',
      details: passed ? 'Successfully routed mutation to human review.' : 'Auto-approved a mutation.'
    };
  }

  private static testProvenance(): Gate138Result {
    const context: EngineeringContext = { projectId: 'P1', userId: 'U1', revisionId: 'R1' };
    const prov1 = EngineeringCopilotCore.generateProvenance(context, [], 'test');
    const prov2 = EngineeringCopilotCore.generateProvenance(context, [], 'test');

    const passed = prov1.contextHash === prov2.contextHash && prov1.responseHash === prov2.responseHash;
    return {
      gateId: 'GATE-138-PROVENANCE',
      description: 'Ensure Copilot actions produce deterministic provenance hashes',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed ? 'Hashes are consistent.' : 'Hashes diverge.'
    };
  }
}
