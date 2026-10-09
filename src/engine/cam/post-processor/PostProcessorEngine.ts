/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-262 — Real CAM Post Processor Engine
 * 
 * Orchestrates the complete pipeline:
 * CAM Operations & Kinematics -> Intermediate Representation (IR) -> Modal Resolution ->
 * Formatting -> NC Program -> Multi-Constraint Validation -> Bidirectional Source Mapping -> Cryptographic Evidence.
 */

import {
  PostProcessorDefinition,
  PostConfiguration,
  MachineDefinition,
  NCProgram,
  NCBlock,
  NCSourceMap,
  NCSourceMapEntry,
  PostProcessingEvidence
} from './PostTypes';
import { NCIntermediateRepresentationBuilder, CAMOperationData } from './NCIntermediateRepresentation';
import { ModalStateManager } from './ModalStateManager';
import { NCFormatter } from './NCFormatter';
import { PostValidator } from './PostValidator';
import { PostEvidenceGenerator } from './PostEvidenceGenerator';
import { generateDeterministicHash } from '../../../lib/hash';

export interface PostProcessRequest {
  programName: string;
  programComment?: string;
  operations: CAMOperationData[];
  machine: MachineDefinition;
  postDefinition: PostProcessorDefinition;
  configuration: PostConfiguration;
  toolpathHash?: string;
  kinematicsHash?: string;
}

export interface PostProcessResult {
  program: NCProgram;
  evidence: PostProcessingEvidence;
}

export interface NCDiffLine {
  lineNumber: number;
  type: 'IDENTICAL' | 'ADDED' | 'REMOVED' | 'MODIFIED';
  textA?: string;
  textB?: string;
}

export class PostProcessorEngine {
  /**
   * Main execution entry point for post-processing
   */
  public static async execute(request: PostProcessRequest): Promise<PostProcessResult> {
    const { programName, programComment, operations, machine, postDefinition, configuration } = request;

    // 1. Build NC Intermediate Representation (IR)
    const ir = await NCIntermediateRepresentationBuilder.buildIR(
      programName,
      programComment || `Program ${programName}`,
      operations
    );

    // 2. Initialize Modal State Manager
    const modalMgr = new ModalStateManager(configuration.units, configuration.selectedWorkOffset);

    // 3. Format IR Events to NC Blocks and build Source Map
    const blocks: NCBlock[] = [];
    const sourceEntries: NCSourceMapEntry[] = [];
    const opRanges: Record<string, { startLine: number; endLine: number; toolNumber: number }> = {};

    let sequence = 1;
    let currentOpId: string | null = null;
    let opStartLine = 1;

    for (let i = 0; i < ir.events.length; i++) {
      const event = ir.events[i];

      // Track operation boundaries
      if (event.type === 'OPERATION_START' && event.sourceOperationId) {
        currentOpId = event.sourceOperationId;
        opStartLine = blocks.length + 1;
      }

      const block = NCFormatter.formatEventToBlock(event, sequence, postDefinition, configuration, modalMgr);
      if (block) {
        blocks.push(block);

        // Build source map entry
        sourceEntries.push({
          ncLineIndex: blocks.length - 1,
          blockSequence: block.sequenceNumber,
          gcodeLine: block.rawText,
          sourceOperationId: block.sourceOperationId,
          sourceOperationName: block.sourceOperationName,
          sourceToolpathSegmentId: block.sourceToolpathSegmentId,
          toolSnapshotId: block.toolSnapshotId,
          machinePose: event.targetPosition
        });

        sequence++;
      }

      if (event.type === 'OPERATION_END' && currentOpId) {
        const matchingOp = operations.find(o => o.operationId === currentOpId);
        opRanges[currentOpId] = {
          startLine: opStartLine,
          endLine: blocks.length,
          toolNumber: matchingOp ? matchingOp.toolNumber : 1
        };
        currentOpId = null;
      }
    }

    // 4. Construct complete raw G-code text
    const rawGCodeText = blocks.map(b => b.rawText).join('\n');

    // 5. Build Source Map
    const sourceMapHash = await generateDeterministicHash({
      programId: programName,
      entriesCount: sourceEntries.length,
      firstEntry: sourceEntries[0]?.gcodeLine || '',
      lastEntry: sourceEntries[sourceEntries.length - 1]?.gcodeLine || ''
    });

    const sourceMap: NCSourceMap = {
      programId: programName,
      entries: sourceEntries,
      operationBlockRanges: opRanges,
      mappingHash: sourceMapHash
    };

    // 6. Validate Output against Machine & Controller Rules
    const validationResult = PostValidator.validate(ir, blocks, machine, postDefinition);

    // 7. Estimate Cycle Time
    const rapidFeedMmMin = 15000;
    const rapidTimeSec = (ir.totalRapidDistanceMm / rapidFeedMmMin) * 60;
    const cuttingTimeSec = (ir.totalCuttingDistanceMm / 1500) * 60; // avg feed 1500
    const toolChangeTimeSec = (ir.toolsUsed.length - 1) * machine.toolChanger.toolChangeTimeSec;
    const estimatedCycleTimeSec = Number((rapidTimeSec + cuttingTimeSec + toolChangeTimeSec + 5).toFixed(1));

    // 8. Calculate NC Program Hash
    const ncProgramHash = await generateDeterministicHash({
      programName,
      dialect: postDefinition.controllerDialect,
      machineId: machine.machineId,
      units: configuration.units,
      rawGCodeText,
      totalBlocks: blocks.length,
      irHash: ir.irHash
    });

    const program: NCProgram = {
      programId: `PROG_${programName}`,
      programName,
      postProcessorId: postDefinition.postId,
      postProcessorVersion: postDefinition.version,
      controllerDialect: postDefinition.controllerDialect,
      machineId: machine.machineId,
      units: configuration.units,
      blocks,
      rawGCodeText,
      totalLines: blocks.length,
      totalBlocks: blocks.length,
      estimatedCycleTimeSec,
      sourceMap,
      validationStatus: validationResult.isValid ? 'VALIDATED' : 'LIMIT_EXCEEDED',
      validationErrors: validationResult.errors,
      validationWarnings: validationResult.warnings,
      ncProgramHash,
      configHash: configuration.configHash,
      timestamp: Date.now(),
      origin: 'POSTED'
    };

    // 9. Generate Cryptographic Evidence
    const toolSnapshotsHashes = operations.map(o => o.toolSnapshot.snapshotId || 'TOOL_HASH');
    const evidence = await PostEvidenceGenerator.generateEvidence(
      program,
      postDefinition,
      configuration,
      machine,
      toolSnapshotsHashes,
      request.toolpathHash || ir.irHash,
      request.kinematicsHash
    );

    return { program, evidence };
  }

  /**
   * Compares two NC programs line by line (NC Diff)
   */
  public static compareNC(programA: string, programB: string): NCDiffLine[] {
    const linesA = programA.split('\n');
    const linesB = programB.split('\n');
    const maxLen = Math.max(linesA.length, linesB.length);
    const diff: NCDiffLine[] = [];

    for (let i = 0; i < maxLen; i++) {
      const a = linesA[i];
      const b = linesB[i];

      if (a === undefined) {
        diff.push({ lineNumber: i + 1, type: 'ADDED', textB: b });
      } else if (b === undefined) {
        diff.push({ lineNumber: i + 1, type: 'REMOVED', textA: a });
      } else if (a === b) {
        diff.push({ lineNumber: i + 1, type: 'IDENTICAL', textA: a, textB: b });
      } else {
        diff.push({ lineNumber: i + 1, type: 'MODIFIED', textA: a, textB: b });
      }
    }

    return diff;
  }
}
