import { ApprovalWorkflowEngine, ApprovalWorkflow, StepStatus } from './ApprovalWorkflowEngine';
import { createHash } from 'crypto';

export interface Gate291Check {
  name: string;
  passed: boolean;
  message: string;
}

export interface Gate291Report {
  passed: boolean;
  checks: Gate291Check[];
}

export class HardAcceptanceGate291 {
  public static evaluate(): Gate291Report {
    const checks: Gate291Check[] = [];
    const engine = new ApprovalWorkflowEngine();

    // Setup target hash
    const initialHash = createHash('sha256').update('PART-001:REV-A:MESH-v1').digest('hex');

    // 1. Immutable workflow setup with Dynamic Risk Routing
    const wf = engine.createWorkflow(
      'WF-TEST-001',
      'ECO_APPROVAL',
      'ECO-002',
      'ECO',
      'DESIGN_ENG_1', // Requester
      85, // High Risk, should route to parallel hybrid POL-HIGH-RISK
      initialHash
    );

    if (wf.policyId === 'POL-HIGH-RISK' && wf.steps.length === 4) {
      checks.push({
        name: 'Dynamic Risk Routing & Policy Match',
        passed: true,
        message: 'Successfully mapped High-Risk Change parameters to the multi-disciplinary parallel hybrid policy (POL-HIGH-RISK).'
      });
    } else {
      checks.push({
        name: 'Dynamic Risk Routing & Policy Match',
        passed: false,
        message: 'Failed: Assigned incorrect simple policy or wrong step resolution.'
      });
    }

    // 2. Separation of duties validation
    try {
      engine.submitDecision(
        'WF-TEST-001',
        'STP-001',
        'DESIGN_ENG_1', // Attempt self-signoff as author
        'ENGINEERING_LEAD',
        'APPROVE',
        'Self-approve',
        initialHash
      );
      checks.push({
        name: 'Separation of Duties & Self-Approval Block',
        passed: false,
        message: 'Failed: Requester bypass self-approval rule and signed off own task.'
      });
    } catch (err: any) {
      checks.push({
        name: 'Separation of Duties & Self-Approval Block',
        passed: true,
        message: `Success: Self-approval attempt caught. Reason: ${err.message}`
      });
    }

    // 3. Unauthorized actor gate
    try {
      engine.submitDecision(
        'WF-TEST-001',
        'STP-001',
        'STRANGER_CON_1', // Random user lacking privileges
        'ENGINEERING_LEAD',
        'APPROVE',
        'Unsafe approve',
        initialHash
      );
      checks.push({
        name: 'Role & User Context Boundary Protection',
        passed: false,
        message: 'Failed: Permitted arbitrary user without policy verification to sign off step.'
      });
    } catch (err: any) {
      checks.push({
        name: 'Role & User Context Boundary Protection',
        passed: true,
        message: `Success: Unauthorized actor blocked. Reason: ${err.message}`
      });
    }

    // 4. Sequence & Hybrid dependency locks
    try {
      // Attempt to sign final step (STP-004) before parallel precursors are satisfied
      engine.submitDecision(
        'WF-TEST-001',
        'STP-004',
        'CHIEF_DESIGNER',
        'PROJECT_AUTHORITY',
        'APPROVE',
        'Premature approve',
        initialHash
      );
      checks.push({
        name: 'Sequence Dependency & Locking Gate',
        passed: false,
        message: 'Failed: Allowed final release authorization before parallel reviews finalized.'
      });
    } catch (err: any) {
      checks.push({
        name: 'Sequence Dependency & Locking Gate',
        passed: true,
        message: `Success: Blocked premature downstream decision. Reason: ${err.message}`
      });
    }

    // 5. Temporary Delegation Rules
    try {
      // Add temporary delegate for Quality sign-off
      engine.addDelegation('WF-TEST-001', 'QUALITY_LEAD', 'QUALITY_DELEGATE', 'QUALITY_LEAD', 'Annual vacation cover.');
      
      // Submit approval using the delegate identity
      engine.submitDecision(
        'WF-TEST-001',
        'STP-002',
        'QUALITY_DELEGATE',
        'QUALITY_LEAD',
        'APPROVE',
        'Delegate signoff valid.',
        initialHash
      );

      const updatedWf = engine.getWorkflow('WF-TEST-001')!;
      const qualityStep = updatedWf.steps.find(s => s.stepId === 'STP-002')!;

      if (qualityStep.status === 'APPROVED') {
        checks.push({
          name: 'Delegation Authority & Validation',
          passed: true,
          message: 'Success: Temporary authorized delegate context evaluated and permitted correctly.'
        });
      } else {
        checks.push({
          name: 'Delegation Authority & Validation',
          passed: false,
          message: 'Failed: Delegate action failed to approve step.'
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Delegation Authority & Validation',
        passed: false,
        message: `Error: ${err.message}`
      });
    }

    // 6. Geometry Drift / State Invalidation
    try {
      const driftingHash = createHash('sha256').update('PART-001:REV-A:ALTERED_MESH-v2').digest('hex');
      // Attempt sign off using an outdated hash
      engine.submitDecision(
        'WF-TEST-001',
        'STP-001',
        'LEAD_INTEGRATOR',
        'ENGINEERING_LEAD',
        'APPROVE',
        'Stale design review',
        driftingHash
      );
      checks.push({
        name: 'Geometry Drift & Hash Detection Guard',
        passed: false,
        message: 'Failed: Permitted review of altered design revision without invalidating pipeline.'
      });
    } catch (err: any) {
      checks.push({
        name: 'Geometry Drift & Hash Detection Guard',
        passed: true,
        message: `Success: Caught CAD artifact mutation mid-flight. Reason: ${err.message}`
      });
    }

    // 7. Rework iteration cycles
    try {
      const fixedHash = createHash('sha256').update('PART-001:REV-A:ALTERED_MESH-v2').digest('hex');
      
      // Inject Rework cycle to update the hash baseline
      engine.triggerReworkCycle('WF-TEST-001', 'CHIEF_DESIGNER', fixedHash);
      const resetWf = engine.getWorkflow('WF-TEST-001')!;

      if (resetWf.cycleNumber === 2 && resetWf.objectHashSnapshot === fixedHash) {
        checks.push({
          name: 'Rework Cycle Reinjection & Loop Control',
          passed: true,
          message: 'Success: Dynamic feedback loop correctly tracked new design cycle and updated active snapshot hash.'
        });
      } else {
        checks.push({
          name: 'Rework Cycle Reinjection & Loop Control',
          passed: false,
          message: 'Failed: Cycle number not incremented or outdated hash preserved.'
        });
      }
    } catch (err: any) {
      checks.push({
        name: 'Rework Cycle Reinjection & Loop Control',
        passed: false,
        message: `Error: ${err.message}`
      });
    }

    const passed = checks.every(c => c.passed);
    return { passed, checks };
  }
}
