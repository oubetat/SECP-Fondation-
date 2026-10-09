import { MachiningTool } from './ToolTypes';
import { generateDeterministicHashSync } from '../../evidence/DeterministicHash';

export class ToolEvidenceGenerator {
  public static generateToolEvidence(tool: MachiningTool): any {
    const payload = {
      toolId: tool.id,
      toolUUID: tool.toolUUID,
      geometry: tool.geometry,
      material: tool.material
    };
    
    return {
      toolId: tool.id,
      hash: 'sha256_' + generateDeterministicHashSync(payload),
      payload // Store the source payload for verification
    };
  }
}
