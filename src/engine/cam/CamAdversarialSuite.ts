/**
 * SECP-098 — CAM Adversarial Suite
 * Tests edge cases, invalid inputs, and forensic rejection modes.
 */

import { ParametricCAMBridge } from './ParametricCAMBridge';
import { MachiningOperationConfig, MachiningParameters, ToolHolderGeometry } from './ToolpathTypes';
import { CuttingToolModel } from './CuttingToolModel';
import { ThreeAxisToolpathEngine } from './ThreeAxisToolpathEngine';
import { ToolpathVerificationEngine } from './ToolpathVerificationEngine';
import { generateDeterministicHash } from '../../lib/hash';

export class CamAdversarialSuite {
  public static async runSuite(): Promise<any> {
    const results: any = {
      passes: [],
      failures: []
    };

    // 1. Invalid Tool Diameter
    try {
      const tool = await CuttingToolModel.createTool('bad-tool', 'Bad Tool', 'FLAT_ENDMILL', -10, 4, 10, 50);
      results.failures.push('Negative tool diameter accepted');
    } catch (e) {
      results.passes.push('Rejected negative tool diameter');
    }

    // 2. NaN/Infinity Parameter Rejection
    try {
      const stock = { xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 20 };
      const opConfig: any = {
        operationId: 'nan-op',
        strategy: 'FACING',
        toolAssembly: { tool: { diameterMm: 10, fingerprint: 'f1' } },
        parameters: { stepoverMm: NaN },
        feedsAndSpeeds: { cuttingFeedMmMin: 1000 },
        fingerprint: 'op1'
      };
      const candidate = await ThreeAxisToolpathEngine.generateToolpathAsync(opConfig, stock, 'topo1');
      const verified = await ToolpathVerificationEngine.verifyToolpathAsync(candidate, 0, { bounds: stock } as any);
      if (verified.verificationReport.isValid) {
        results.failures.push('Accepted NaN in stepover');
      } else {
        results.passes.push('Rejected NaN coordinates in toolpath');
      }
    } catch (e) {
      results.passes.push('Rejected NaN in toolpath generation');
    }

    // 3. Stock Violation Detection
    try {
      const stock = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 10 };
      const candidate: any = {
        operationId: 'violation-op',
        points: [{ position: { x: 1000, y: 1000, z: 1000 }, moveType: 'CUTTING' }],
        totalLengthMm: 0,
        provenance: { trajectoryHash: 'h1' }
      };
      const verified = await ToolpathVerificationEngine.verifyToolpathAsync(candidate, 0, { bounds: stock } as any);
      if (verified.verificationReport.metrics.stockViolations > 0) {
        results.passes.push('Detected stock boundary violation');
      } else {
        results.failures.push('Failed to detect stock violation');
      }
    } catch (e) {
      results.failures.push(`Stock violation test errored: ${e}`);
    }

    // 4. Deterministic Replay
    try {
      const stock = { xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 20 };
      const topologyId = 'topo-01';
      const topologyHash = 'hash-01';
      
      const job1 = await ParametricCAMBridge.generateForensicCAMJob('p1', topologyId, topologyHash, stock);
      const job2 = await ParametricCAMBridge.generateForensicCAMJob('p1', topologyId, topologyHash, stock);
      
      if (job1.provenance[0].outputHash === job2.provenance[0].outputHash) {
        results.passes.push('Deterministic Replay: Identical hashes produced');
      } else {
        results.failures.push('Deterministic Replay: Hash mismatch');
      }
    } catch (e) {
      results.failures.push(`Replay test errored: ${e}`);
    }

    // 5. Zero-Length / Duplicate Point Detection
    try {
      const stock = { xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 20 };
      const candidate: any = {
        operationId: 'duplicate-op',
        points: [
          { position: { x: 10, y: 10, z: 10 }, moveType: 'CUTTING' },
          { position: { x: 10, y: 10, z: 10 }, moveType: 'CUTTING' } // EXACT DUPLICATE
        ],
        totalLengthMm: 0,
        provenance: { trajectoryHash: 'h2' }
      };
      const verified = await ToolpathVerificationEngine.verifyToolpathAsync(candidate, 0, { bounds: stock } as any);
      if (verified.verificationReport.metrics.zeroLengthSegments > 0) {
        results.passes.push('Detected duplicate consecutive points (zero-length segments)');
      } else {
        results.failures.push('Failed to detect duplicate consecutive points');
      }
    } catch (e) {
      results.failures.push(`Duplicate point test errored: ${e}`);
    }

    return results;
  }
}
