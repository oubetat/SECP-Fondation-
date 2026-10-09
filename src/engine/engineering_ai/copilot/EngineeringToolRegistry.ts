import { ToolPermission } from './types';

export interface EngineeringTool {
  toolId: string;
  domain: string;
  capabilities: string[];
  permissions: ToolPermission[];
  version: string;
  execute: (input: any, context: any) => Promise<any>;
}

export class EngineeringToolRegistry {
  private tools: Map<string, EngineeringTool> = new Map();

  public registerTool(tool: EngineeringTool) {
    this.tools.set(tool.toolId, tool);
  }

  public getTool(toolId: string): EngineeringTool | undefined {
    return this.tools.get(toolId);
  }

  public async executeToolSafe(toolId: string, input: any, context: any, requiredPermission: ToolPermission): Promise<{ success: boolean; result?: any; error?: string }> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, error: 'TOOL_NOT_FOUND' };
    }

    if (!tool.permissions.includes(requiredPermission)) {
      return { success: false, error: 'UNAUTHORIZED_CAPABILITY' };
    }

    try {
      const result = await tool.execute(input, context);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: `TOOL_FAILURE: ${err.message}` };
    }
  }
}

export const globalToolRegistry = new EngineeringToolRegistry();
