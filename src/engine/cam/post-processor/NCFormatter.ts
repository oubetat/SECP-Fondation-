export class NCFormatter {
  static formatEventToBlock(event: any, seq: number, def: any, conf: any, modal: any): any {
    let rawText = '';
    const sourceOpId = event.sourceOperationId || 'OP_INIT';
    const sourceOpName = event.sourceOperationName || 'INIT';
    const sourceSegmentId = event.sourceToolpathSegmentId || '';
    const toolSnapshotId = event.toolSnapshot ? `TOOL_${event.toolNumber}` : '';

    switch (event.type) {
      case 'PROGRAM_HEADER':
        rawText = `%\nO${conf.programNumberOrName || '5001'} (${event.commentText || 'NC PROGRAM'})`;
        break;
      case 'SAFETY_BLOCK':
        rawText = 'G90 G21 G17 G40 G49 G80';
        break;
      case 'TOOL_CHANGE':
        rawText = `T${String(event.toolNumber || 1).padStart(2, '0')} M06`;
        break;
      case 'WORK_OFFSET_SELECT':
        rawText = event.workOffset || 'G54';
        break;
      case 'SPINDLE_COMMAND':
        rawText = `S${event.spindleRpm || 4500} ${event.spindleDirection === 'CCW' ? 'M04' : 'M03'}`;
        break;
      case 'COOLANT_COMMAND':
        rawText = 'M08';
        break;
      case 'RAPID_TRAVERSE': {
        let g0 = 'G00';
        if (event.targetPosition) {
          if (event.targetPosition.x !== undefined) g0 += ` X${event.targetPosition.x.toFixed(3)}`;
          if (event.targetPosition.y !== undefined) g0 += ` Y${event.targetPosition.y.toFixed(3)}`;
          if (event.targetPosition.z !== undefined) g0 += ` Z${event.targetPosition.z.toFixed(3)}`;
        }
        rawText = g0;
        break;
      }
      case 'LINEAR_FEED': {
        let g1 = 'G01';
        if (event.targetPosition) {
          if (event.targetPosition.x !== undefined) g1 += ` X${event.targetPosition.x.toFixed(3)}`;
          if (event.targetPosition.y !== undefined) g1 += ` Y${event.targetPosition.y.toFixed(3)}`;
          if (event.targetPosition.z !== undefined) g1 += ` Z${event.targetPosition.z.toFixed(3)}`;
        }
        if (event.feedRate !== undefined) {
          g1 += ` F${event.feedRate.toFixed(1)}`;
        }
        rawText = g1;
        break;
      }
      case 'COOLANT_OFF':
        rawText = 'M09';
        break;
      case 'SPINDLE_STOP':
        rawText = 'M05';
        break;
      case 'PROGRAM_FOOTER':
      case 'PROGRAM_END':
        rawText = "M09\nM05\nM30\n%";
        break;
      case 'OPERATION_START':
        rawText = `(${event.commentText || 'OPERATION START'})`;
        break;
      case 'OPERATION_END':
        rawText = '(OPERATION END)';
        break;
      case 'RTCP_ENABLE':
        rawText = `G234 H${String(event.toolNumber || 1).padStart(2, '0')}`;
        break;
      case 'RTCP_DISABLE':
        rawText = 'G49';
        break;
      default:
        return null;
    }

    return {
      sequenceNumber: seq,
      rawText,
      sourceOperationId: sourceOpId,
      sourceOperationName: sourceOpName,
      sourceToolpathSegmentId: sourceSegmentId,
      toolSnapshotId
    };
  }
}
