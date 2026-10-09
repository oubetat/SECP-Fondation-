import { UnitEngine } from "../../units";
import { 
  ToolDefinition, 
  ToolAssembly, 
  ToolLibraryStatus, 
  ToolHolderInterface, 
  ManufacturingToolType 
} from "./types";

export class ToolDataValidator {
  /**
   * Performs deep geometric and semantic consistency checks on a tool definition.
   */
  public static validateToolDefinition(tool: ToolDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Basic Identifiers
    if (!tool.toolId) errors.push("Missing toolId");
    if (!tool.toolName) errors.push("Missing toolName");
    if (!tool.manufacturer) errors.push("Missing manufacturer");

    // 2. Geometry Sanity Checks
    const geo = tool.geometry;
    if (!geo) {
      errors.push("Missing geometry structure");
      return { isValid: false, errors };
    }

    if (geo.cuttingDiameter <= 0) {
      errors.push(`Invalid cuttingDiameter: ${geo.cuttingDiameter}. Must be greater than 0.`);
    }
    if (geo.cuttingLength <= 0) {
      errors.push(`Invalid cuttingLength: ${geo.cuttingLength}. Must be greater than 0.`);
    }
    if (geo.overallLength <= 0) {
      errors.push(`Invalid overallLength: ${geo.overallLength}. Must be greater than 0.`);
    }

    // Mathematical impossibility check
    if (geo.cuttingLength > geo.overallLength) {
      errors.push(`Geometrically impossible: cuttingLength (${geo.cuttingLength}) cannot be greater than overallLength (${geo.overallLength}).`);
    }

    // Type specific checks
    if (tool.toolType === ManufacturingToolType.DRILL) {
      if (geo.tipAngle === undefined || geo.tipAngle <= 0 || geo.tipAngle >= 180) {
        errors.push(`Drill tipAngle (${geo.tipAngle}) must be between 0 and 180 degrees.`);
      }
    }

    if (tool.toolType === ManufacturingToolType.BALL_NOSE_MILL) {
      if (!geo.ballRadius || geo.ballRadius <= 0) {
        errors.push("Ball nose mill requires a positive ballRadius");
      } else if (Math.abs(geo.ballRadius - geo.cuttingDiameter / 2) > 0.001) {
        errors.push(`Ball radius (${geo.ballRadius}) does not match half of cuttingDiameter (${geo.cuttingDiameter})`);
      }
    }

    // Maximum RPM limits
    if (tool.maximumRPM <= 0) {
      errors.push("maximumRPM must be greater than 0");
    }

    // Provenance Verification
    if (!tool.provenance || !tool.provenance.source) {
      errors.push("Missing tool provenance metadata or source");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates tool assembly parameters and compatibility.
   */
  public static validateAssembly(assembly: ToolAssembly, tool: ToolDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (assembly.toolId !== tool.toolId) {
      errors.push(`Assembly toolId (${assembly.toolId}) does not match Tool Definition toolId (${tool.toolId})`);
    }

    if (assembly.stickoutLength <= 0) {
      errors.push(`Invalid stickoutLength: ${assembly.stickoutLength}. Must be greater than 0.`);
    }

    // Stickout cannot exceed overall tool length
    if (assembly.stickoutLength > tool.geometry.overallLength) {
      errors.push(`Stickout length (${assembly.stickoutLength}) exceeds tool overall length (${tool.geometry.overallLength})`);
    }

    if (assembly.holder) {
      const holder = assembly.holder;
      if (holder.gaugeLength <= 0) {
        errors.push("Holder gaugeLength must be greater than 0");
      }

      // Check assembly gauge length calculation consistency
      const expectedGaugeLength = holder.gaugeLength + assembly.stickoutLength;
      if (Math.abs(assembly.gaugeLength - expectedGaugeLength) > 0.001) {
        errors.push(`Gauge length mismatch! Assembly: ${assembly.gaugeLength}, Calculated (Holder Gauge + Stickout): ${expectedGaugeLength}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates interface compatibility between a machine spindle and a tool holder.
   */
  public static checkMachineInterfaceCompatibility(
    machineInterface: string,
    holderInterface: ToolHolderInterface
  ): boolean {
    if (machineInterface === holderInterface) return true;
    if (machineInterface === "ANY" || holderInterface === ToolHolderInterface.CUSTOM) return true;
    return false;
  }

  /**
   * Parse a raw manufacturer tool catalog and import it.
   */
  public static parseAndImportCatalog(rawData: string): { tools: ToolDefinition[]; importStatus: "SUCCESS" | "IMPORT_INCOMPLETE" | "IMPORT_INVALID"; errors: string[] } {
    const errors: string[] = [];
    const tools: ToolDefinition[] = [];

    try {
      const parsed = JSON.parse(rawData);
      if (!parsed || !Array.isArray(parsed.tools)) {
        errors.push("Invalid catalog format. Missing 'tools' array.");
        return { tools, importStatus: "IMPORT_INVALID", errors };
      }

      for (const t of parsed.tools) {
        const toolDef: ToolDefinition = {
          toolId: t.toolId || "",
          toolRevision: t.toolRevision || 1,
          toolType: (t.toolType as ManufacturingToolType) || ManufacturingToolType.UNKNOWN,
          manufacturer: t.manufacturer || "",
          manufacturerPartNumber: t.manufacturerPartNumber || "",
          catalogNumber: t.catalogNumber || "",
          toolName: t.toolName || "",
          description: t.description || "",
          standard: t.standard || "ANSI",
          status: ToolLibraryStatus.DRAFT,
          geometry: {
            cuttingDiameter: t.cuttingDiameter || 0,
            cuttingLength: t.cuttingLength || 0,
            overallLength: t.overallLength || 0,
            shankDiameter: t.shankDiameter || 0,
            shankLength: t.shankLength || 0,
            tipAngle: t.tipAngle,
            ballRadius: t.ballRadius,
          },
          material: t.material || "HSS",
          coating: t.coating || "UNCOATED",
          cuttingEdges: t.cuttingEdges || [],
          maximumRPM: t.maximumRPM || 10000,
          coolantCompatibility: t.coolantCompatibility || [],
          operationCompatibility: t.operationCompatibility || {},
          materialsCuttingRules: t.materialsCuttingRules || [],
          provenance: {
            source: "CATALOG_IMPORT",
            sourceType: "MANUFACTURER",
            manufacturer: t.manufacturer || "UNKNOWN",
            catalogRevision: 1,
            importTimestamp: new Date().toISOString()
          },
          fingerprint: ""
        };

        const validation = this.validateToolDefinition(toolDef);
        if (validation.isValid) {
          toolDef.status = ToolLibraryStatus.VALIDATED;
          tools.push(toolDef);
        } else {
          errors.push(`Tool ${toolDef.toolId || "Unknown"} validation failed: ${validation.errors.join("; ")}`);
        }
      }
    } catch (e: any) {
      errors.push(`JSON parsing error: ${e.message}`);
      return { tools, importStatus: "IMPORT_INVALID", errors };
    }

    const importStatus = errors.length > 0 ? "IMPORT_INCOMPLETE" : "SUCCESS";
    return { tools, importStatus, errors };
  }
}
