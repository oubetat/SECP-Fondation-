/**
 * SECP Industrial OS v3 — PROMPT-053: Capability Mirror Negative Proofs
 * Adversarial negative proof suite verifying that the Frontend CANNOT claim, enable,
 * or execute any capability that the Backend does not support or verify.
 */

import { CanonicalCapabilityResolver } from './CanonicalCapabilityResolver';
import { CapabilityDriftDetector } from './CapabilityDriftDetector';
import { FrontendCapabilityMirror } from './FrontendCapabilityMirror';
import { WorkplaceContext } from './CapabilityMirrorTypes';

export interface NegativeProofResult {
  proofId: string;
  name: string;
  passed: boolean;
  expectedBehavior: string;
  actualBehavior: string;
  details: string;
}

export interface NegativeProofSuiteReport {
  timestamp: string;
  totalCount: number;
  passCount: number;
  allPassed: boolean;
  results: NegativeProofResult[];
}

export class CapabilityMirrorNegativeProofs {
  public static executeAllNegativeProofs(): NegativeProofSuiteReport {
    const timestamp = new Date().toISOString();
    const results: NegativeProofResult[] = [];
    const resolver = CanonicalCapabilityResolver.getInstance();
    const driftDetector = CapabilityDriftDetector.getInstance();
    const mirrorStore = FrontendCapabilityMirror.getInstance();

    driftDetector.clearViolations();

    // 1. CAP-NEG-001: UI claim on bypassed/missing tool (MOLD_TOOLING_SPLIT)
    (() => {
      const toolId = 'MOLD_TOOLING_SPLIT';
      const resolution = resolver.resolveCapability(toolId);
      const audit = driftDetector.auditClaims([{
        capabilityId: toolId,
        claimedBy: 'MoldPanelButton',
        claimedExposed: true,
        claimedEnabled: true,
        claimedStatus: 'PRODUCTION_PROVEN'
      }]);

      const passed = !resolution.isClaimable && audit.hasDrift && audit.violations.length > 0;
      results.push({
        proofId: 'CAP-NEG-001',
        name: 'Bypassed Tool Claim Rejection',
        passed,
        expectedBehavior: 'MOLD_TOOLING_SPLIT must resolve isClaimable=false and trigger a drift violation when claimed as enabled by UI.',
        actualBehavior: `isClaimable=${resolution.isClaimable}, truthState=${resolution.truthState}, driftCount=${audit.driftCount}`,
        details: 'Verified that UI claims on bypassed tools are caught and flagged as drift violations.'
      });
    })();

    // 2. CAP-NEG-002: Querying non-existent capability ID (TURBO_CFD_QUANTUM)
    (() => {
      const toolId = 'TURBO_CFD_QUANTUM';
      const resolution = resolver.resolveCapability(toolId);

      const passed = !resolution.isClaimable && resolution.truthState === 'NOT_SUPPORTED';
      results.push({
        proofId: 'CAP-NEG-002',
        name: 'Unknown Capability Safety Fallback',
        passed,
        expectedBehavior: 'Unknown capability ID must safely default to NOT_SUPPORTED and isClaimable=false.',
        actualBehavior: `truthState=${resolution.truthState}, isClaimable=${resolution.isClaimable}`,
        details: 'Verified fail-safe rejection of unmapped capability queries.'
      });
    })();

    // 3. CAP-NEG-003: UI action execution attempt on disconnected tool (FEATURE_FILLET)
    (() => {
      const toolId = 'FEATURE_FILLET';
      const verifyResult = driftDetector.verifyActionIntent(toolId, 'FilletToolbarButton');

      const passed = !verifyResult.allowed && verifyResult.violation !== undefined;
      results.push({
        proofId: 'CAP-NEG-003',
        name: 'Action Intent Pre-Flight Block',
        passed,
        expectedBehavior: 'Attempting to trigger an action for an unverified/unavailable tool must be blocked with allowed=false.',
        actualBehavior: `allowed=${verifyResult.allowed}, severity=${verifyResult.violation?.severity}`,
        details: 'Pre-flight action verifier blocked execution attempt on bypassed tool.'
      });
    })();

    // 4. CAP-NEG-004: Frontend claiming "PROVEN" on unverified capability
    (() => {
      const toolId = 'FEATURE_FILLET';
      const audit = driftDetector.auditClaims([{
        capabilityId: toolId,
        claimedBy: 'FilletDialog',
        claimedExposed: true,
        claimedEnabled: false,
        claimedStatus: 'PROVEN'
      }]);

      const passed = audit.hasDrift && audit.violations.some(v => v.message.includes('verification status'));
      results.push({
        proofId: 'CAP-NEG-004',
        name: 'Unverified Status Claim Detection',
        passed,
        expectedBehavior: 'Claiming PROVEN or VERIFIED status for an unverified tool must trigger status drift.',
        actualBehavior: `hasDrift=${audit.hasDrift}, violations=${audit.violations.length}`,
        details: 'Verified that status claims are strictly validated against backend verification evidence.'
      });
    })();

    // 5. CAP-NEG-005: Attempting action execution on non-existent capability
    (() => {
      const toolId = 'FAKE_NON_EXISTENT_TOOL';
      const verifyResult = driftDetector.verifyActionIntent(toolId, 'FakeUIAction');

      const passed = !verifyResult.allowed;
      results.push({
        proofId: 'CAP-NEG-005',
        name: 'Non-Existent Action Intent Block',
        passed,
        expectedBehavior: 'Non-existent tool action intent must be rejected.',
        actualBehavior: `allowed=${verifyResult.allowed}`,
        details: 'Non-existent tool execution safely rejected.'
      });
    })();

    // 6. CAP-NEG-006: Contextual inapplicability separation (FEATURE_EXTRUDE without sketch)
    (() => {
      const toolId = 'FEATURE_EXTRUDE';
      const resolution = resolver.resolveCapability(toolId);
      const invalidContext: WorkplaceContext = { hasActiveSketchProfile: false };
      const projection = mirrorStore.projectTool(toolId, invalidContext);

      // Backend supports EXTRUDE (isClaimable=true), but UI context disables it (uiEnabled=false, contextApplicable=false)
      const passed = resolution.isClaimable && !projection.uiEnabled && !projection.contextApplicable;
      results.push({
        proofId: 'CAP-NEG-006',
        name: 'Contextual Inapplicability vs Capability Support',
        passed,
        expectedBehavior: 'FEATURE_EXTRUDE must be claimable in backend, but uiEnabled=false when active sketch profile is missing.',
        actualBehavior: `isClaimable=${resolution.isClaimable}, uiEnabled=${projection.uiEnabled}, contextApplicable=${projection.contextApplicable}`,
        details: 'Proven that contextual unapplicability disables UI interaction without revoking backend capability support status.'
      });
    })();

    const passCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    return {
      timestamp,
      totalCount,
      passCount,
      allPassed: passCount === totalCount,
      results
    };
  }
}
