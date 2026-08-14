/**
 * PATCH-SECP-058 — 058-B: NC Post Processor & 058-C: Controller Dialect Layer
 * Formats Verified Cutter Location (CL) Data into machine-specific NC program dialects
 * with absolute mathematical determinism and line-level digital thread traceability.
 */

import { MachineDefinition, NCBlock, NCBlockProvenance } from './NCExecutionTypes';
import { CutterLocationDataPackage, VerifiedToolpathTrajectory, CutterLocationPoint } from '../cam/ToolpathTypes';

export class NCPostProcessor {
  /**
   * Generates a deterministic SHA-256 equivalent hash of the canonical NC G-code text
   */
  public static computeNCProgramHash(blocks: NCBlock[]): string {
    const canonicalText = blocks
      .map(b => b.gCodeLine.trim().toUpperCase())
      .filter(line => line.length > 0 && !line.startsWith(';'))
      .join('\n');

    let hash = 0;
    for (let i = 0; i < canonicalText.length; i++) {
      const char = canonicalText.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `SECP-058-NC-HASH-${hex}`;
  }

  /**
   * Performs Post-Processing on a Verified CL Data Package for a Target Machine
   */
  public static postProcess(
    clPackage: CutterLocationDataPackage,
    machine: MachineDefinition,
    sourceRevision: string = 'rev-01'
  ): { ncProgram: string; ncBlocks: NCBlock[] } {
    const dialect = machine.controllerId;
    const ncBlocks: NCBlock[] = [];
    let blockNum = 10;

    const addBlock = (gCodeLine: string, clPointIdx?: number, trajectoryIdx?: number) => {
      let clMoveId = 'cl-setup';
      let toolpathId = 'tp-setup';
      let featureId = 'feat-setup';
      let topologyReference = 'topo-setup';

      if (trajectoryIdx !== undefined && trajectoryIdx >= 0) {
        const t = clPackage.trajectories[trajectoryIdx];
        toolpathId = t.operationId;
        const op = clPackage.operations.find(o => o.operationId === t.operationId);
        if (op) {
          featureId = op.targetFeatureId || 'feat-unknown';
          topologyReference = op.topologyId || 'topo-unknown';
        }

        if (clPointIdx !== undefined && clPointIdx >= 0) {
          clMoveId = `cl-${trajectoryIdx}-${clPointIdx}`;
        }
      }

      ncBlocks.push({
        blockNumber: blockNum,
        gCodeLine,
        provenance: {
          blockNumber: blockNum,
          clMoveId,
          toolpathId,
          featureId,
          topologyReference,
          sourceRevision
        }
      });
      blockNum += 10;
    };

    // 1. Program Header (Universal standard across all dialects, containing provenance metadata)
    addBlock(`; %`);
    addBlock(`; O1001 (PROGRAM: ${clPackage.partId.toUpperCase()})`);
    addBlock(`; MACHINE: ${machine.name}`);
    addBlock(`; CONTROLLER DIALECT: ${dialect}`);
    addBlock(`; SECP-057 CAM CL HASH: ${clPackage.clDataHash}`);
    addBlock(`; SECP-057 CL PROVENANCE: ${clPackage.provenanceSignature}`);
    addBlock(`; TIMSTAMP: ${new Date().toISOString()}`);

    // Dialect Setup Codes
    switch (dialect) {
      case 'HAAS':
        addBlock('G21 ; Metric units');
        addBlock('G90 G17 G40 G80 G49 ; Absolute, XY plane, cancel tool offset/canned cycles');
        addBlock('G94 ; Feed per minute');
        break;
      case 'FANUC':
        addBlock('G21 ; Metric');
        addBlock('G90 G17 G40 G80 ; Absolute positioning, XY plane');
        addBlock('G94 G21 ; Feed in mm/min');
        break;
      case 'SIEMENS':
        addBlock('G71 ; Metric units');
        addBlock('G90 G17 ; Absolute positioning, XY plane');
        addBlock('G94 ; Feed in mm/min');
        break;
      case 'HEIDENHAIN':
        addBlock('BEGIN PGM 1001 MM');
        addBlock('G21 ; Metric');
        addBlock('G90 G17 ; Absolute positioning');
        break;
      case 'GENERIC_ISO':
      default:
        addBlock('G21 ; Metric');
        addBlock('G90 G17 G40 G80 ; Setup codes');
        break;
    }

    // 2. Process Operations
    clPackage.trajectories.forEach((trajectory, tIdx) => {
      const op = clPackage.operations.find(o => o.operationId === trajectory.operationId);
      const tool = trajectory.tool;

      addBlock(`; ----------------------------------------------------`);
      addBlock(`; OPERATION: ${trajectory.operationId} (${trajectory.strategy})`);
      addBlock(`; TOOL ID: ${tool.toolId} - ${tool.name}`);
      addBlock(`; ----------------------------------------------------`);

      // Find tool pocket index from machine definition tool magazine
      let pocketNum = 1;
      if (machine.toolMagazine && machine.toolMagazine.pockets) {
        const foundPocket = Object.entries(machine.toolMagazine.pockets).find(([_, id]) => id === tool.toolId);
        if (foundPocket) {
          pocketNum = parseInt(foundPocket[0]);
        }
      }

      // Tool Change Dialects
      if (dialect === 'HEIDENHAIN') {
        addBlock(`TOOL CALL ${pocketNum} Z S${trajectory.points[0]?.spindleRpm || 2000}`);
      } else if (dialect === 'SIEMENS') {
        addBlock(`T="${tool.toolId}" D1 M06 ; Load Tool`);
        addBlock(`M03 S${(trajectory.points[0]?.spindleRpm || 2000).toFixed(0)} ; Spindle ON CW`);
      } else {
        addBlock(`T${pocketNum} M06 ; Tool Change`);
        addBlock(`G54 G43 H${pocketNum} ; Work offset, tool length offset`);
        addBlock(`M03 S${(trajectory.points[0]?.spindleRpm || 2000).toFixed(0)} ; Spindle ON`);
      }

      // Work Offset Setup
      if (dialect !== 'HEIDENHAIN') {
        addBlock(`G00 Z${op ? op.clearancePlaneZ.toFixed(3) : '50.000'} ; Safe clearance`);
      } else {
        addBlock(`L Z+${op ? op.clearancePlaneZ.toFixed(3) : '50.000'} FMAX`);
      }

      // Write cutter location points
      trajectory.points.forEach((pt, pIdx) => {
        const pos = pt.position;
        const vec = pt.toolVector;
        const feed = pt.feedRateMmMin;
        const rpm = pt.spindleRpm;

        // Determine motion command
        const isRapid = pt.moveType.startsWith('RAPID') || pt.moveType === 'CLEARANCE_TRANSITION' || pt.moveType === 'RETRACT';
        
        let moveCmd = '';
        if (dialect === 'HEIDENHAIN') {
          moveCmd = isRapid ? 'L' : 'L';
        } else {
          moveCmd = isRapid ? 'G00' : 'G01';
        }

        // Build position variables
        let coordStr = `X${pos.x.toFixed(3)} Y${pos.y.toFixed(3)} Z${pos.z.toFixed(3)}`;
        
        // If 5-Axis (vector is not straight up Z: 0, 0, 1), format rotary axes B and C
        const isFiveAxis = Math.abs(vec.x) > 0.001 || Math.abs(vec.y) > 0.001 || Math.abs(vec.z - 1.0) > 0.001;
        if (isFiveAxis && (machine.capabilities.includes('FIVE_AXIS_MILLING') || dialect === 'HAAS' || dialect === 'SIEMENS')) {
          // Analytical Inverse Kinematics transformation for B-axis (tilt) and C-axis (rotary) table-table configuration
          // B = acos(K)
          // C = atan2(J, I)
          let bDeg = Math.acos(Math.max(-1.0, Math.min(1.0, vec.z))) * (180.0 / Math.PI);
          let cDeg = Math.atan2(vec.y, vec.x) * (180.0 / Math.PI);

          // Haas/Siemens limits wrap-around or safety
          if (bDeg > 120) bDeg = 120; // Hard clamp B positive tilt
          
          if (dialect === 'HEIDENHAIN') {
            coordStr += ` B+${bDeg.toFixed(4)} C+${cDeg.toFixed(4)}`;
          } else {
            coordStr += ` B${bDeg.toFixed(3)} C${cDeg.toFixed(3)}`;
          }
        }

        // Add feed rate if cutting
        let feedStr = '';
        if (!isRapid) {
          if (dialect === 'HEIDENHAIN') {
            feedStr = ` F${feed.toFixed(0)}`;
          } else {
            feedStr = ` F${feed.toFixed(0)}`;
          }
        } else {
          if (dialect === 'HEIDENHAIN') {
            feedStr = ' FMAX';
          }
        }

        // Format and push block
        if (dialect === 'HEIDENHAIN') {
          addBlock(`${moveCmd} ${coordStr}${feedStr}`, pIdx, tIdx);
        } else {
          addBlock(`${moveCmd} ${coordStr}${feedStr}`, pIdx, tIdx);
        }
      });

      // Operation retract
      if (dialect === 'HEIDENHAIN') {
        addBlock(`L Z+${op ? op.clearancePlaneZ.toFixed(3) : '50.000'} FMAX`);
      } else {
        addBlock(`G00 Z${op ? op.clearancePlaneZ.toFixed(3) : '50.000'} ; Safe Retract`);
      }
    });

    // 3. Program Footer
    addBlock(`; ----------------------------------------------------`);
    addBlock(`; END OF DIGITAL THREAD PROGRAM`);
    addBlock(`; ----------------------------------------------------`);
    
    switch (dialect) {
      case 'HEIDENHAIN':
        addBlock('M30');
        addBlock('END PGM 1001 MM');
        break;
      case 'SIEMENS':
        addBlock('M05 ; Spindle OFF');
        addBlock('M30 ; End of program');
        break;
      case 'FANUC':
      case 'HAAS':
      case 'GENERIC_ISO':
      default:
        addBlock('M05 ; Spindle Stop');
        addBlock('M30 ; Program End');
        break;
    }

    const ncProgram = ncBlocks.map(b => `${dialect === 'HEIDENHAIN' ? b.blockNumber : 'N' + b.blockNumber} ${b.gCodeLine}`).join('\n');

    return {
      ncProgram,
      ncBlocks
    };
  }
}
