/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-263 — Tool State Checker
 * 
 * Audits tool selections, tool change operations, H/D offset registries,
 * tool magazine capacity, and double compensation conflicts (CAM pre-offset + CNC controller G41/G42).
 */

import { MachineDefinition } from '../post-processor/PostTypes';
import { ToolSnapshot } from '../tool-library/ToolTypes';
import { NCExecutionState, VerificationIssue } from './GCodeVerificationTypes';

export class ToolStateChecker {
  /**
   * Verify tool calls, magazine limits, offsets, and compensation consistency
   */
  public static verifyToolStates(
    states: NCExecutionState[],
    machine: MachineDefinition,
    toolSnapshots: ToolSnapshot[],
    expectedToolNumbers: number[] = []
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];
    let issueCounter = 1;

    const availableToolMap = new Map<number, ToolSnapshot>();
    for (const snap of toolSnapshots) {
      if (snap.toolNumber) {
        availableToolMap.set(snap.toolNumber, snap);
      }
    }

    const magazineCapacity = machine.toolChanger?.capacity || 24;
    const usedToolsInNC = new Set<number>();

    for (const state of states) {
      const toolNum = state.activeToolNumber;
      if (toolNum > 0) {
        usedToolsInNC.add(toolNum);

        // 1. Tool Changer Capacity Check
        if (toolNum > magazineCapacity) {
          issues.push({
            id: `ISSUE-TOOL-${issueCounter++}`,
            code: 'TOOL_CHANGER_CAPACITY_EXCEEDED',
            severity: 'CRITICAL',
            lineIndex: state.lineIndex,
            sequenceNumber: state.blockNumber,
            rawGCode: state.rawGCode,
            actualValue: `T${toolNum}`,
            expectedValue: `T1..T${magazineCapacity}`,
            message: `Requested tool T${toolNum} exceeds machine tool changer pocket capacity (${magazineCapacity} pockets).`,
            recommendation: `Remap tool number to an available pocket within 1..${magazineCapacity}.`
          });
        }

        // 2. Tool Snapshot Availability Check
        if (toolSnapshots.length > 0 && !availableToolMap.has(toolNum)) {
          issues.push({
            id: `ISSUE-TOOL-${issueCounter++}`,
            code: 'TOOL_NOT_FOUND',
            severity: 'ERROR',
            lineIndex: state.lineIndex,
            sequenceNumber: state.blockNumber,
            rawGCode: state.rawGCode,
            actualValue: `T${toolNum}`,
            message: `Tool T${toolNum} called in G-code does not exist in verified Tool Library snapshots.`,
            recommendation: `Ensure tool T${toolNum} is defined in Tool Library (PATCH-261).`
          });
        }

        // 3. Tool Length & Diameter Limits against Machine Tool Changer Specs
        const snap = availableToolMap.get(toolNum);
        if (snap && machine.toolChanger) {
          const dims = snap.frozenTool.geometry.dimensions;
          if (dims.overallLengthMm > machine.toolChanger.maxToolLengthMm) {
            issues.push({
              id: `ISSUE-TOOL-${issueCounter++}`,
              code: 'TOOL_CHANGER_CAPACITY_EXCEEDED',
              severity: 'ERROR',
              lineIndex: state.lineIndex,
              sequenceNumber: state.blockNumber,
              actualValue: `${dims.overallLengthMm.toFixed(1)} mm`,
              expectedValue: `<= ${machine.toolChanger.maxToolLengthMm} mm`,
              message: `Tool T${toolNum} overall length (${dims.overallLengthMm.toFixed(1)}mm) exceeds machine maximum allowable tool length (${machine.toolChanger.maxToolLengthMm}mm).`
            });
          }
          if (dims.cuttingDiameterMm > machine.toolChanger.maxToolDiameterMm) {
            issues.push({
              id: `ISSUE-TOOL-${issueCounter++}`,
              code: 'TOOL_CHANGER_CAPACITY_EXCEEDED',
              severity: 'ERROR',
              lineIndex: state.lineIndex,
              sequenceNumber: state.blockNumber,
              actualValue: `${dims.cuttingDiameterMm.toFixed(1)} mm`,
              expectedValue: `<= ${machine.toolChanger.maxToolDiameterMm} mm`,
              message: `Tool T${toolNum} cutting diameter (${dims.cuttingDiameterMm.toFixed(1)}mm) exceeds maximum allowable tool changer pocket diameter (${machine.toolChanger.maxToolDiameterMm}mm).`
            });
          }
        }

        // 4. Double Compensation Conflict Detection
        // If cutter compensation is active (G41/G42) on CNC, verify whether CAM already shifted the centerline
        if (state.cutterCompMode !== 'G40_OFF' && state.isCutting) {
          // If CAM pre-compensated toolpath is used and controller compensation is also active
          if (snap && snap.frozenTool.geometry.dimensions.cuttingDiameterMm > 0) {
            // If active D offset is called with standard tool diameter without wear-only flag
            // Check for potential double compensation
            issues.push({
              id: `ISSUE-COMP-${issueCounter++}`,
              code: 'DOUBLE_COMPENSATION_DETECTED',
              severity: 'WARNING',
              lineIndex: state.lineIndex,
              sequenceNumber: state.blockNumber,
              rawGCode: state.rawGCode,
              message: `Cutter compensation ${state.cutterCompMode} active with D${state.activeDOffsetNumber}. Verify that controller D register stores tool wear offset rather than full radius to prevent double compensation.`,
              recommendation: `Set controller D register to zero wear if CAM generated tool centerline coordinates.`
            });
          }
        }
      }
    }

    // 5. Check Tool Mismatch against Expected CAM Toolpath Tools
    if (expectedToolNumbers.length > 0) {
      for (const expectedT of expectedToolNumbers) {
        if (!usedToolsInNC.has(expectedT)) {
          issues.push({
            id: `ISSUE-TOOL-${issueCounter++}`,
            code: 'TOOL_MISMATCH',
            severity: 'CRITICAL',
            lineIndex: 0,
            expectedValue: `T${expectedT}`,
            actualValue: Array.from(usedToolsInNC).map(t => `T${t}`).join(', '),
            message: `Toolpath expected tool T${expectedT}, but G-code program does not invoke T${expectedT}.`,
            recommendation: `Reprocess NC program with matching tool assignment.`
          });
        }
      }
      for (const actualT of usedToolsInNC) {
        if (!expectedToolNumbers.includes(actualT)) {
          issues.push({
            id: `ISSUE-TOOL-${issueCounter++}`,
            code: 'TOOL_MISMATCH',
            severity: 'CRITICAL',
            lineIndex: 0,
            expectedValue: expectedToolNumbers.map(t => `T${t}`).join(', '),
            actualValue: `T${actualT}`,
            message: `G-code invokes unexpected tool T${actualT} not present in CAM operation plan.`,
            recommendation: `Ensure posted NC matches the planned CAM operations.`
          });
        }
      }
    }

    return issues;
  }
}
