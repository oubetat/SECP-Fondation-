/**
 * SECP CAD Hard Acceptance Gate for PATCH-SECP-058
 * Manufacturing Execution & NC Post-Processing Governance Gate:
 * Executes 58 comprehensive, deterministic engineering verifications testing:
 * 058-A — Machine Definition & Capability Model (Predefined machine profiles & limits)
 * 058-B — NC Post Processor (Deterministic translation of CL data to G-code)
 * 058-C — Controller / Dialect Layer (Dialects: Haas, Fanuc, Siemens, Heidenhain, Generic ISO)
 * 058-D — NC Program Verification (Kinematic and safety checks of output blocks)
 * 058-E — NC ↔ CL Traceability (End-to-end line-level digital thread)
 * 058-F — Deterministic NC Package (ManufacturingExecutionPackage & hashes)
 * 058-G — Revision & Change Impact (Change impact severities)
 * 058-H — Execution Readiness Gate (DESIGN_VALID to MACHINE_COMPATIBLE checks)
 * 058-I — Execution Boundary (EXECUTION_READY clear boundary check)
 * 058-J — Governance & Provenance (Regression check & 58 assertions verification)
 */

import { HardAcceptanceGate057 } from './HardAcceptanceGate057';
import { MachineDefinitionEngine } from '../nc/MachineDefinitionEngine';
import { NCPostProcessor } from '../nc/NCPostProcessor';
import { NCProgramVerifier } from '../nc/NCProgramVerifier';
import { NCExecutionBridge } from '../nc/NCExecutionBridge';
import { ManufacturingExecutionPackage, MachineDefinition, NCBlock } from '../nc/NCExecutionTypes';
import { CutterLocationDataPackage, VerifiedToolpathTrajectory } from '../cam/ToolpathTypes';

export interface Gate058Report {
  gateId: 'Gate058';
  patch: 'SECP-058';
  timestamp: string;
  totalVerifications: 58;
  passedCount: number;
  overallStatus: 'PASS' | 'FAIL';
  verifications: Record<string, 'PASS' | 'FAIL'>;
  executionPackage?: ManufacturingExecutionPackage;
  stagesLog: string[];
}

export class HardAcceptanceGate058 {
  public static async executeGate(): Promise<Gate058Report> {
    const timestamp = new Date().toISOString();
    const verifications: Record<string, 'PASS' | 'FAIL'> = {};
    const stagesLog: string[] = [];
    let passedCount = 0;

    stagesLog.push('=== [SECP-058] Executing Deterministic Manufacturing Execution Core Gate ===');

    // Run regression baseline checks on Gate 057 (which implicitly verifies 045.1 to 056)
    stagesLog.push('Running SECP-057 CAM core regression suite...');
    const gate057Res = await HardAcceptanceGate057.executeGate();
    const isRegressionClean = gate057Res.overallStatus === 'PASS';
    stagesLog.push(`SECP-057 Regression test: ${isRegressionClean ? 'PASSED' : 'FAILED'}`);

    const clPackage: CutterLocationDataPackage | undefined = gate057Res.clDataPackage;
    const haasMachine = MachineDefinitionEngine.getHaasVF2SS();
    const fanucMachine = MachineDefinitionEngine.getFanucRobodrill();

    // 1-8: 058-A — Machine Definition & Capability Model
    try {
      verifications.mchHaasAxesCount = haasMachine.axes.length === 5 ? 'PASS' : 'FAIL';
      if (verifications.mchHaasAxesCount === 'PASS') passedCount++;

      const xLimit = haasMachine.axes.find(a => a.axisId === 'X');
      verifications.mchHaasLinearAxesRange = (xLimit && xLimit.minLimit === -380 && xLimit.maxLimit === 380) ? 'PASS' : 'FAIL';
      if (verifications.mchHaasLinearAxesRange === 'PASS') passedCount++;

      const bLimit = haasMachine.axes.find(a => a.axisId === 'B');
      verifications.mchHaasRotaryBClamp = (bLimit && bLimit.minLimit === -120 && bLimit.maxLimit === 120) ? 'PASS' : 'FAIL';
      if (verifications.mchHaasRotaryBClamp === 'PASS') passedCount++;

      verifications.mchHaasSpindleMaxRpm = haasMachine.spindle.maxRpm === 12000 ? 'PASS' : 'FAIL';
      if (verifications.mchHaasSpindleMaxRpm === 'PASS') passedCount++;

      verifications.mchHaasSpindleModes = haasMachine.spindle.supportedModes.includes('RIGID_TAPPING') ? 'PASS' : 'FAIL';
      if (verifications.mchHaasSpindleModes === 'PASS') passedCount++;

      verifications.mchHaasCapabilities = (haasMachine.capabilities.includes('THREE_AXIS_MILLING') && haasMachine.capabilities.includes('FIVE_AXIS_MILLING')) ? 'PASS' : 'FAIL';
      if (verifications.mchHaasCapabilities === 'PASS') passedCount++;

      const hash1 = MachineDefinitionEngine.computeMachineHash(haasMachine);
      const hash2 = MachineDefinitionEngine.computeMachineHash(haasMachine);
      verifications.mchDeterministicProvenanceHash = hash1 === hash2 ? 'PASS' : 'FAIL';
      if (verifications.mchDeterministicProvenanceHash === 'PASS') passedCount++;

      verifications.mchRobodrillAxesCount = fanucMachine.axes.length === 3 ? 'PASS' : 'FAIL';
      if (verifications.mchRobodrillAxesCount === 'PASS') passedCount++;
    } catch (e) {
      stagesLog.push(`058-A exception: ${(e as Error).message}`);
    }

    // 9-16: 058-B — NC Post Processor
    let testBlocks: NCBlock[] = [];
    let testProgramText = '';
    try {
      if (clPackage) {
        const result = NCPostProcessor.postProcess(clPackage, haasMachine, 'rev-01');
        testBlocks = result.ncBlocks;
        testProgramText = result.ncProgram;

        verifications.ppGenerateBlocksCount = testBlocks.length > 20 ? 'PASS' : 'FAIL';
        if (verifications.ppGenerateBlocksCount === 'PASS') passedCount++;

        verifications.ppVerifyG21Presence = testProgramText.includes('G21') ? 'PASS' : 'FAIL';
        if (verifications.ppVerifyG21Presence === 'PASS') passedCount++;

        verifications.ppVerifyG90Presence = testProgramText.includes('G90') ? 'PASS' : 'FAIL';
        if (verifications.ppVerifyG90Presence === 'PASS') passedCount++;

        verifications.ppToolChangeTxxCall = testProgramText.includes('T1 M06') ? 'PASS' : 'FAIL';
        if (verifications.ppToolChangeTxxCall === 'PASS') passedCount++;

        verifications.ppSpindleCwStartup = testProgramText.includes('M03 S') ? 'PASS' : 'FAIL';
        if (verifications.ppSpindleCwStartup === 'PASS') passedCount++;

        verifications.ppSpindleOffFooter = testProgramText.includes('M05') ? 'PASS' : 'FAIL';
        if (verifications.ppSpindleOffFooter === 'PASS') passedCount++;

        verifications.ppProgramM30Ending = testProgramText.includes('M30') ? 'PASS' : 'FAIL';
        if (verifications.ppProgramM30Ending === 'PASS') passedCount++;

        const hashA = NCPostProcessor.computeNCProgramHash(testBlocks);
        const hashB = NCPostProcessor.computeNCProgramHash(testBlocks);
        verifications.ppNCProgramHashRepeatability = hashA === hashB ? 'PASS' : 'FAIL';
        if (verifications.ppNCProgramHashRepeatability === 'PASS') passedCount++;
      } else {
        stagesLog.push('058-B skip: clPackage is undefined');
      }
    } catch (e) {
      stagesLog.push(`058-B exception: ${(e as Error).message}`);
    }

    // 17-24: 058-C — Controller / Dialect Layer
    try {
      if (clPackage) {
        const fanucRes = NCPostProcessor.postProcess(clPackage, fanucMachine, 'rev-01');
        verifications.diaFanucMetricG21 = fanucRes.ncProgram.includes('G21') ? 'PASS' : 'FAIL';
        if (verifications.diaFanucMetricG21 === 'PASS') passedCount++;

        const heidMachine: MachineDefinition = { ...haasMachine, controllerId: 'HEIDENHAIN' };
        const heidRes = NCPostProcessor.postProcess(clPackage, heidMachine, 'rev-01');
        verifications.diaHeidenhainBeginPgm = heidRes.ncProgram.includes('BEGIN PGM') ? 'PASS' : 'FAIL';
        if (verifications.diaHeidenhainBeginPgm === 'PASS') passedCount++;

        verifications.diaHeidenhainEndPgm = heidRes.ncProgram.includes('END PGM') ? 'PASS' : 'FAIL';
        if (verifications.diaHeidenhainEndPgm === 'PASS') passedCount++;

        const siemensMachine: MachineDefinition = { ...haasMachine, controllerId: 'SIEMENS' };
        const siemensRes = NCPostProcessor.postProcess(clPackage, siemensMachine, 'rev-01');
        verifications.diaSiemensToolD1Call = siemensRes.ncProgram.includes('D1 M06') ? 'PASS' : 'FAIL';
        if (verifications.diaSiemensToolD1Call === 'PASS') passedCount++;

        verifications.diaSiemensSpindleOn = siemensRes.ncProgram.includes('M03') ? 'PASS' : 'FAIL';
        if (verifications.diaSiemensSpindleOn === 'PASS') passedCount++;

        const genericMachine: MachineDefinition = { ...haasMachine, controllerId: 'GENERIC_ISO' };
        const genericRes = NCPostProcessor.postProcess(clPackage, genericMachine, 'rev-01');
        verifications.diaGenericISOSetupCodes = genericRes.ncProgram.includes('G40 G80') ? 'PASS' : 'FAIL';
        if (verifications.diaGenericISOSetupCodes === 'PASS') passedCount++;

        verifications.diaHeidenhainFMaxRapid = heidRes.ncProgram.includes('FMAX') ? 'PASS' : 'FAIL';
        if (verifications.diaHeidenhainFMaxRapid === 'PASS') passedCount++;

        verifications.diaHeidenhainLPositioning = heidRes.ncProgram.includes(' L ') ? 'PASS' : 'FAIL';
        if (verifications.diaHeidenhainLPositioning === 'PASS') passedCount++;
      }
    } catch (e) {
      stagesLog.push(`058-C exception: ${(e as Error).message}`);
    }

    // 25-32: 058-D — NC Program Verification
    try {
      const normalVer = NCProgramVerifier.verifyNCProgram('op-normal', testBlocks, haasMachine);
      verifications.verSpindleRpmPass = normalVer.isValid ? 'PASS' : 'FAIL';
      if (verifications.verSpindleRpmPass === 'PASS') passedCount++;

      // Deliberate Spindle RPM violation
      const unsafeBlocks1: NCBlock[] = [
        { blockNumber: 10, gCodeLine: 'S50000 M03', provenance: testBlocks[0].provenance }
      ];
      const speedVer = NCProgramVerifier.verifyNCProgram('op-speed', unsafeBlocks1, haasMachine);
      verifications.verSpindleRpmExceedsLimit = !speedVer.isValid ? 'PASS' : 'FAIL';
      if (verifications.verSpindleRpmExceedsLimit === 'PASS') passedCount++;

      // Deliberate feedrate violation
      const unsafeBlocks2: NCBlock[] = [
        { blockNumber: 10, gCodeLine: 'G01 F99999 X0 Y0', provenance: testBlocks[0].provenance }
      ];
      const feedVer = NCProgramVerifier.verifyNCProgram('op-feed', unsafeBlocks2, haasMachine);
      verifications.verFeedLimitViolation = !feedVer.isValid ? 'PASS' : 'FAIL';
      if (verifications.verFeedLimitViolation === 'PASS') passedCount++;

      // Coordinate limits violation
      const unsafeBlocksX: NCBlock[] = [{ blockNumber: 10, gCodeLine: 'G01 X9999.0 Y0 Z0', provenance: testBlocks[0].provenance }];
      const unsafeBlocksY: NCBlock[] = [{ blockNumber: 10, gCodeLine: 'G01 X0 Y9999.0 Z0', provenance: testBlocks[0].provenance }];
      const unsafeBlocksZ: NCBlock[] = [{ blockNumber: 10, gCodeLine: 'G01 X0 Y0 Z9999.0', provenance: testBlocks[0].provenance }];

      const verX = NCProgramVerifier.verifyNCProgram('op-x', unsafeBlocksX, haasMachine);
      const verY = NCProgramVerifier.verifyNCProgram('op-y', unsafeBlocksY, haasMachine);
      const verZ = NCProgramVerifier.verifyNCProgram('op-z', unsafeBlocksZ, haasMachine);

      verifications.verCoordinateLimitX = !verX.isValid ? 'PASS' : 'FAIL';
      if (verifications.verCoordinateLimitX === 'PASS') passedCount++;

      verifications.verCoordinateLimitY = !verY.isValid ? 'PASS' : 'FAIL';
      if (verifications.verCoordinateLimitY === 'PASS') passedCount++;

      verifications.verCoordinateLimitZ = !verZ.isValid ? 'PASS' : 'FAIL';
      if (verifications.verCoordinateLimitZ === 'PASS') passedCount++;

      // Unsupported Rotary Axis check (3-axis machine getting B axis command)
      const rotaryCommandBlocks: NCBlock[] = [
        { blockNumber: 10, gCodeLine: 'G01 X10.0 Y10.0 Z10.0 B45.0', provenance: testBlocks[0].provenance }
      ];
      const threeAxisVer = NCProgramVerifier.verifyNCProgram('op-3axis', rotaryCommandBlocks, fanucMachine);
      verifications.verUnsupportedRotaryAxis = !threeAxisVer.isValid ? 'PASS' : 'FAIL';
      if (verifications.verUnsupportedRotaryAxis === 'PASS') passedCount++;

      // Unsafe rapid transition warning (G00 plunge)
      const plungeRapidBlocks: NCBlock[] = [
        { blockNumber: 10, gCodeLine: 'G00 X0 Y0 Z-5.0', provenance: testBlocks[0].provenance }
      ];
      const plungeVer = NCProgramVerifier.verifyNCProgram('op-plunge', plungeRapidBlocks, haasMachine);
      verifications.verUnsafeRapidZWarning = plungeVer.issues.some(i => i.issueType === 'UNSAFE_RAPID_TRANSITION' && i.severity === 'WARNING') ? 'PASS' : 'FAIL';
      if (verifications.verUnsafeRapidZWarning === 'PASS') passedCount++;

    } catch (e) {
      stagesLog.push(`058-D exception: ${(e as Error).message}`);
    }

    // 33-38: 058-E — NC ↔ CL Traceability
    try {
      const activeMotionBlocks = testBlocks.filter(b => b.gCodeLine.startsWith('G01') || b.gCodeLine.startsWith('G00'));
      verifications.trLineToCLPointBinding = activeMotionBlocks.every(b => b.provenance.clMoveId.startsWith('cl-')) ? 'PASS' : 'FAIL';
      if (verifications.trLineToCLPointBinding === 'PASS') passedCount++;

      verifications.trOperationIdPreservation = activeMotionBlocks.every(b => b.provenance.toolpathId !== 'tp-setup') ? 'PASS' : 'FAIL';
      if (verifications.trOperationIdPreservation === 'PASS') passedCount++;

      verifications.trFeatureIdMapping = activeMotionBlocks.every(b => b.provenance.featureId !== 'feat-setup') ? 'PASS' : 'FAIL';
      if (verifications.trFeatureIdMapping === 'PASS') passedCount++;

      verifications.trTopologyIdMapping = activeMotionBlocks.every(b => b.provenance.topologyReference !== 'topo-setup') ? 'PASS' : 'FAIL';
      if (verifications.trTopologyIdMapping === 'PASS') passedCount++;

      verifications.trSourceRevisionPreservation = activeMotionBlocks.every(b => b.provenance.sourceRevision === 'rev-01') ? 'PASS' : 'FAIL';
      if (verifications.trSourceRevisionPreservation === 'PASS') passedCount++;

      verifications.trProvenanceSignatureMatch = testProgramText.includes('SECP-057 CL PROVENANCE') ? 'PASS' : 'FAIL';
      if (verifications.trProvenanceSignatureMatch === 'PASS') passedCount++;
    } catch (e) {
      stagesLog.push(`058-E exception: ${(e as Error).message}`);
    }

    // 39-44: 058-F — Deterministic NC Package
    let execPackage: ManufacturingExecutionPackage | undefined;
    try {
      if (clPackage) {
        execPackage = NCExecutionBridge.buildExecutionPackage(clPackage, haasMachine, 'rev-01');

        verifications.pkgSuccessfulCreation = execPackage !== undefined ? 'PASS' : 'FAIL';
        if (verifications.pkgSuccessfulCreation === 'PASS') passedCount++;

        verifications.pkgCLDataHashMatch = execPackage.clDataHash === clPackage.clDataHash ? 'PASS' : 'FAIL';
        if (verifications.pkgCLDataHashMatch === 'PASS') passedCount++;

        const compHash = NCPostProcessor.computeNCProgramHash(testBlocks);
        verifications.pkgNCProgramHashMatch = execPackage.ncProgramHash === compHash ? 'PASS' : 'FAIL';
        if (verifications.pkgNCProgramHashMatch === 'PASS') passedCount++;

        verifications.pkgExecutionPackageHashCreation = execPackage.executionPackageHash.startsWith('SECP-058-PKG-HASH-') ? 'PASS' : 'FAIL';
        if (verifications.pkgExecutionPackageHashCreation === 'PASS') passedCount++;

        verifications.pkgPostProcessorVersionTracked = execPackage.postProcessorVersion === 'v1.0.0-SECP-058' ? 'PASS' : 'FAIL';
        if (verifications.pkgPostProcessorVersionTracked === 'PASS') passedCount++;

        verifications.pkgTimestampISOFormat = !isNaN(Date.parse(execPackage.timestamp)) ? 'PASS' : 'FAIL';
        if (verifications.pkgTimestampISOFormat === 'PASS') passedCount++;
      }
    } catch (e) {
      stagesLog.push(`058-F exception: ${(e as Error).message}`);
    }

    // 45-50: 058-G — Revision & Change Impact
    try {
      if (execPackage && clPackage) {
        // Test Identical Package Comparison
        const impactIdentical = NCExecutionBridge.analyzeChangeImpact(execPackage, execPackage);
        verifications.impNoChangeScenario = (impactIdentical.impactSeverity === 'NONE' && !impactIdentical.isTopologyChanged) ? 'PASS' : 'FAIL';
        if (verifications.impNoChangeScenario === 'PASS') passedCount++;

        // Test Topology Shift Scenario
        const clShiftedTopo: CutterLocationDataPackage = {
          ...clPackage,
          traceabilityNodes: clPackage.traceabilityNodes.map(n => ({ ...n, topologyId: 'topo-different-face' }))
        };
        const pkgShiftedTopo = NCExecutionBridge.buildExecutionPackage(clShiftedTopo, haasMachine, 'rev-02');
        const impactTopo = NCExecutionBridge.analyzeChangeImpact(execPackage, pkgShiftedTopo);
        verifications.impTopologyShiftScenario = (impactTopo.isTopologyChanged && impactTopo.impactSeverity === 'HIGH_FULL_REGEN') ? 'PASS' : 'FAIL';
        if (verifications.impTopologyShiftScenario === 'PASS') passedCount++;

        // Test Feature Change Scenario
        const clShiftedFeat: CutterLocationDataPackage = {
          ...clPackage,
          traceabilityNodes: clPackage.traceabilityNodes.map(n => ({ ...n, manufacturingFeatureId: 'feat-shifted-boss' }))
        };
        const pkgShiftedFeat = NCExecutionBridge.buildExecutionPackage(clShiftedFeat, haasMachine, 'rev-02');
        const impactFeat = NCExecutionBridge.analyzeChangeImpact(execPackage, pkgShiftedFeat);
        verifications.impFeatureChangeScenario = (impactFeat.isFeatureChanged && impactFeat.impactSeverity === 'HIGH_FULL_REGEN') ? 'PASS' : 'FAIL';
        if (verifications.impFeatureChangeScenario === 'PASS') passedCount++;

        // Test Toolpath Parameters Scenario (e.g., Feed Speeds change clDataHash)
        const clShiftedHash: CutterLocationDataPackage = {
          ...clPackage,
          clDataHash: 'sha256-deliberate-shifted-hash-for-impact-test'
        };
        const pkgShiftedHash = NCExecutionBridge.buildExecutionPackage(clShiftedHash, haasMachine, 'rev-02');
        const impactHash = NCExecutionBridge.analyzeChangeImpact(execPackage, pkgShiftedHash);
        verifications.impToolpathParamRegenScenario = (impactHash.isToolpathChanged && impactHash.impactSeverity === 'MEDIUM_RECALC') ? 'PASS' : 'FAIL';
        if (verifications.impToolpathParamRegenScenario === 'PASS') passedCount++;

        // Test Repost Only Scenario (target machine change causes NC program hash change but identical toolpaths)
        const pkgDifferentMachine = NCExecutionBridge.buildExecutionPackage(clPackage, fanucMachine, 'rev-02');
        const impactRepost = NCExecutionBridge.analyzeChangeImpact(execPackage, pkgDifferentMachine);
        verifications.impRepostOnlyScenario = (impactRepost.isNCProgramChanged && impactRepost.impactSeverity === 'LOW_REPOST') ? 'PASS' : 'FAIL';
        if (verifications.impRepostOnlyScenario === 'PASS') passedCount++;

        verifications.impUpstreamRevisionTracking = (impactRepost.upstreamRevision.old === 'rev-01' && impactRepost.upstreamRevision.new === 'rev-02') ? 'PASS' : 'FAIL';
        if (verifications.impUpstreamRevisionTracking === 'PASS') passedCount++;
      }
    } catch (e) {
      stagesLog.push(`058-G exception: ${(e as Error).message}`);
    }

    // 51-55: 058-H — Execution Readiness Gate
    try {
      if (execPackage) {
        const readyResult = NCExecutionBridge.checkExecutionReadiness(execPackage);
        
        verifications.gatDesignValidStatus = readyResult.designValid ? 'PASS' : 'FAIL';
        if (verifications.gatDesignValidStatus === 'PASS') passedCount++;

        verifications.gatManufacturableStatus = readyResult.manufacturable ? 'PASS' : 'FAIL';
        if (verifications.gatManufacturableStatus === 'PASS') passedCount++;

        verifications.gatToolpathVerifiedStatus = readyResult.toolpathVerified ? 'PASS' : 'FAIL';
        if (verifications.gatToolpathVerifiedStatus === 'PASS') passedCount++;

        verifications.gatNCVerifiedStatus = readyResult.ncVerified ? 'PASS' : 'FAIL';
        if (verifications.gatNCVerifiedStatus === 'PASS') passedCount++;

        verifications.gatMachineCompatibleStatus = readyResult.machineCompatible ? 'PASS' : 'FAIL';
        if (verifications.gatMachineCompatibleStatus === 'PASS') passedCount++;
      }
    } catch (e) {
      stagesLog.push(`058-H exception: ${(e as Error).message}`);
    }

    // 56: 058-I — Execution Boundary
    try {
      if (execPackage) {
        const readyResult = NCExecutionBridge.checkExecutionReadiness(execPackage);
        verifications.bndExecutionReadyStatus = readyResult.executionReady ? 'PASS' : 'FAIL';
        if (verifications.bndExecutionReadyStatus === 'PASS') passedCount++;
      }
    } catch (e) {
      stagesLog.push(`058-I exception: ${(e as Error).message}`);
    }

    // 57-58: 058-J — Governance & Provenance
    try {
      verifications.govRegressionsGateCheck = isRegressionClean ? 'PASS' : 'FAIL';
      if (verifications.govRegressionsGateCheck === 'PASS') passedCount++;

      const isAllChecksPassed = passedCount === 57; // 57 individual assertions + this makes 58
      verifications.govDeterministicPass = isAllChecksPassed ? 'PASS' : 'FAIL';
      if (verifications.govDeterministicPass === 'PASS') passedCount++;
    } catch (e) {
      stagesLog.push(`058-J exception: ${(e as Error).message}`);
    }

    const overallStatus = (passedCount === 58) ? 'PASS' : 'FAIL';

    stagesLog.push(`=== Gate 058 Execution Complete: ${passedCount}/58 Verifications PASSED (${overallStatus}) ===`);

    return {
      gateId: 'Gate058',
      patch: 'SECP-058',
      timestamp,
      totalVerifications: 58,
      passedCount,
      overallStatus,
      verifications,
      executionPackage: execPackage,
      stagesLog
    };
  }
}
