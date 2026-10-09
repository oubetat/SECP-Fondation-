/**
 * SECP Industrial OS - PATCH-307 Natural Language CAD Intent Parser
 * Parses natural language engineering prompts into structured CAD specifications,
 * canonical unit representations, explicit assumptions, and construction plans.
 */

import {
  CADIntent,
  CADConstructionPlan,
  UnitSystem,
  DimensionSource,
  CADDimension,
  CADConstraint,
  AmbiguityStatus,
} from './NLCADTypes307';

export class CADIntentParser {
  /**
   * Parse a natural language prompt into a CADIntent object.
   */
  public parsePrompt(
    prompt: string,
    projectId: string = 'PRJ-ENG-307',
    revisionId: string = 'REV-01',
    userId: string = 'ENG-USER-99'
  ): CADIntent {
    const intentId = `INTENT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const normalizedPrompt = prompt.trim();

    // 1. Check unit systems
    const canonicalUnit: UnitSystem = this.detectUnits(normalizedPrompt);

    // 2. Reject non-engineering units
    this.validateEngineeringTerms(normalizedPrompt);

    // 3. Extract entities
    const thickness = this.extractThickness(normalizedPrompt, canonicalUnit);
    const holeCount = this.extractHoleCount(normalizedPrompt);
    const holeDiameter = this.extractHoleDiameter(normalizedPrompt, canonicalUnit);
    const overallDims = this.extractOverallDimensions(normalizedPrompt, canonicalUnit);
    const pcd = this.extractPCD(normalizedPrompt, canonicalUnit);
    const partType = this.extractPartType(normalizedPrompt);

    const dimensions: CADDimension[] = [];
    const constraints: CADConstraint[] = [];
    const assumptions: CADIntent['assumptions'] = [];

    // Process Thickness
    if (thickness !== undefined) {
      dimensions.push({
        dimensionId: `DIM-THICK-${Date.now()}`,
        name: 'Plate Thickness',
        value: thickness,
        unit: canonicalUnit,
        reference: 'Pad_Base',
        source: 'USER_SPECIFIED',
      });
    } else {
      assumptions.push({
        assumptionId: `ASM-THICK-01`,
        parameterName: 'Plate Thickness',
        proposedValue: 8,
        unit: 'mm',
        reason: 'Standard motor mount base plate thickness proposed based on load class.',
        confidence: 'ASSUMED',
      });
    }

    // Process Hole Count & Pattern
    if (holeCount !== undefined) {
      dimensions.push({
        dimensionId: `DIM-HOLES-${Date.now()}`,
        name: 'Mounting Hole Count',
        value: holeCount,
        unit: canonicalUnit,
        reference: 'Pattern_MountingHoles',
        source: 'USER_SPECIFIED',
      });
    }

    // Process Hole Diameter
    if (holeDiameter !== undefined) {
      dimensions.push({
        dimensionId: `DIM-HOLE-DIA-${Date.now()}`,
        name: 'Mounting Hole Diameter',
        value: holeDiameter,
        unit: canonicalUnit,
        reference: 'Hole_Mounting',
        source: 'USER_SPECIFIED',
      });
    } else {
      assumptions.push({
        assumptionId: `ASM-HOLE-DIA-01`,
        parameterName: 'Mounting Hole Diameter',
        proposedValue: 10,
        unit: 'mm',
        reason: 'Default M10 clearance hole diameter (10.5mm nominal / 10mm pitch) proposed.',
        confidence: 'ASSUMED',
      });
    }

    // Process Overall Dimensions
    if (overallDims) {
      dimensions.push({
        dimensionId: `DIM-OUTER-${Date.now()}`,
        name: 'Base Envelope Dimensions',
        value: overallDims[0],
        unit: canonicalUnit,
        reference: 'Sketch_Base',
        source: 'USER_SPECIFIED',
      });
    } else {
      assumptions.push({
        assumptionId: `ASM-DIMS-01`,
        parameterName: 'Base Envelope Dimensions',
        proposedValue: '120mm x 120mm',
        unit: 'mm',
        reason: 'Symmetrical NEMA 23/34 standard flange envelope assumed.',
        confidence: 'ASSUMED',
      });
    }

    // Process PCD (Pitch Circle Diameter)
    if (pcd !== undefined) {
      dimensions.push({
        dimensionId: `DIM-PCD-${Date.now()}`,
        name: 'Pitch Circle Diameter',
        value: pcd,
        unit: canonicalUnit,
        reference: 'Sketch_MountingHoles',
        source: 'USER_SPECIFIED',
      });
    } else {
      assumptions.push({
        assumptionId: `ASM-PCD-01`,
        parameterName: 'Pitch Circle Diameter',
        proposedValue: '70mm',
        unit: 'mm',
        reason: 'Standard NEMA flange PCD of 70mm (35mm radius) assumed.',
        confidence: 'ASSUMED',
      });
    }

    // Dynamic Ambiguity Detection
    let ambiguityStatus: AmbiguityStatus = 'CLEAR';
    let clarificationMessage: string | undefined = undefined;

    const missingParams: string[] = [];
    if (thickness === undefined) missingParams.push('thickness');
    if (holeDiameter === undefined) missingParams.push('mounting hole diameter');
    if (!overallDims) missingParams.push('overall envelope dimensions');

    if (missingParams.length > 0) {
      ambiguityStatus = 'NEEDS_CLARIFICATION';
      clarificationMessage = `Prompt is partially defined. Missing parameters: ${missingParams.join(', ')}. Standard engineering assumptions are applied below. Accept assumptions or refine prompt?`;
    }

    return {
      intentId,
      projectId,
      revisionId,
      userId,
      prompt: normalizedPrompt,
      units: canonicalUnit,
      entities: {
        partType,
        thicknessMm: thickness !== undefined ? this.convertToMm(thickness, canonicalUnit) : 8,
        holeCount: holeCount ?? 3,
        holeDiameterMm: holeDiameter !== undefined ? this.convertToMm(holeDiameter, canonicalUnit) : 10,
        overallDimensionsMm: overallDims ? [this.convertToMm(overallDims[0], canonicalUnit), this.convertToMm(overallDims[1], canonicalUnit), this.convertToMm(overallDims[2], canonicalUnit)] : [120, 120, 8],
        pcdMm: pcd !== undefined ? this.convertToMm(pcd, canonicalUnit) : 70,
      },
      features: ['Sketch_Base', 'Pad_Base', 'Sketch_MountingHoles', 'Hole_Mounting', 'Pattern_MountingHoles'],
      dimensions,
      constraints,
      relationships: ['Pad_Base depends on Sketch_Base', 'Hole_Mounting depends on Pad_Base', 'Pattern depends on Hole_Mounting'],
      manufacturingIntent: '3_AXIS_CNC',
      assumptions,
      ambiguityStatus,
      clarificationMessage,
    };
  }

  /**
   * Generates a structured CAD construction plan from an intent.
   */
  public generateConstructionPlan(intent: CADIntent): CADConstructionPlan {
    const planId = `PLAN-${intent.intentId}`;
    const thickness = intent.entities.thicknessMm ?? 8;
    const holeCount = intent.entities.holeCount ?? 3;
    const holeDia = intent.entities.holeDiameterMm ?? 10;
    const envelopeSize = intent.entities.overallDimensionsMm ? intent.entities.overallDimensionsMm[0] : 120;
    const pcd = intent.entities.pcdMm ?? 70;
    const centerX = pcd / 2;

    return {
      planId,
      intentId: intent.intentId,
      orderedSteps: [
        {
          stepNumber: 1,
          action: 'Create Sketch for Base Flange Plate',
          targetFeatureType: 'SKETCH',
          parameters: {
            id: 'Sketch_Base',
            plane: 'XY_PLANE',
            shape: 'RECTANGLE_CENTRED',
            widthMm: envelopeSize,
            lengthMm: envelopeSize,
            filletRadiusMm: 10,
          },
          dependencies: [],
        },
        {
          stepNumber: 2,
          action: 'Extrude Base Plate Pad',
          targetFeatureType: 'EXTRUDE_PAD',
          parameters: {
            id: 'Pad_Base',
            sketchId: 'Sketch_Base',
            depthMm: thickness,
            direction: 'NORMAL',
          },
          dependencies: ['Step 1 (Sketch_Base)'],
        },
        {
          stepNumber: 3,
          action: 'Create Sketch for First Mounting Hole',
          targetFeatureType: 'SKETCH',
          parameters: {
            id: 'Sketch_MountingHoles',
            plane: 'FACE_TOP_PAD',
            centerX: centerX,
            centerY: 0,
            diameterMm: holeDia,
          },
          dependencies: ['Step 2 (Pad_Base)'],
        },
        {
          stepNumber: 4,
          action: 'Create Through Hole Cut',
          targetFeatureType: 'HOLE',
          parameters: {
            id: 'Hole_Mounting',
            sketchId: 'Sketch_MountingHoles',
            patternCount: holeCount,
            holeType: 'THROUGH_ALL',
            diameterMm: holeDia,
          },
          dependencies: ['Step 3 (Sketch_MountingHoles)'],
        },
        {
          stepNumber: 5,
          action: 'Apply Circular Pattern for Mounting Holes',
          targetFeatureType: 'PATTERN_CIRCULAR',
          parameters: {
            id: 'Pattern_MountingHoles',
            sourceFeature: 'Hole_Mounting',
            count: holeCount,
            angleDegrees: 360,
            centerPoint: [0, 0, 0],
            axis: 'Z_AXIS',
          },
          dependencies: ['Step 4 (Hole_Mounting)'],
        },
      ],
    };
  }

  // --- Helper parsing methods ---

  private detectUnits(prompt: string): UnitSystem {
    const lower = prompt.toLowerCase();
    if (lower.includes('inch') || lower.includes(' in') || lower.includes('"')) return 'in';
    if (lower.includes(' cm')) return 'cm';
    if (lower.includes(' meter') || lower.includes(' m ')) return 'm';
    return 'mm'; // Default canonical
  }

  private validateEngineeringTerms(prompt: string): void {
    const lower = prompt.toLowerCase();
    const illegalUnits = ['banana', 'bananas', 'apple', 'apples', 'footstep', 'hand'];
    for (const illegal of illegalUnits) {
      if (lower.includes(illegal)) {
        throw new Error(`Invalid non-engineering unit or quantity detected in prompt: '${illegal}'. Only valid CAD dimension units (mm, cm, m, in) are accepted.`);
      }
    }
  }

  private extractThickness(prompt: string, unit: UnitSystem): number | undefined {
    // 1. Check keyword followed by number: "thickness of 8 mm"
    const match1 = prompt.match(/(?:thickness|thick|depth|smk|wall)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?/i);
    if (match1) return parseFloat(match1[1]);

    // 2. Check number followed by keyword: "8 mm thickness"
    const match2 = prompt.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?\s*(?:thickness|thick|depth|smk|wall)/i);
    if (match2) return parseFloat(match2[1]);

    return undefined;
  }

  private extractHoleCount(prompt: string): number | undefined {
    const matchDigits = prompt.match(/(\d+)\s*(?:mounting\s*)?(?:hole|holes|bore|bores)/i);
    if (matchDigits) return parseInt(matchDigits[1], 10);

    if (prompt.toLowerCase().includes('three') || prompt.includes('tri')) return 3;
    if (prompt.toLowerCase().includes('four') || prompt.includes('quad')) return 4;
    if (prompt.toLowerCase().includes('six') || prompt.includes('hexa')) return 6;

    return undefined;
  }

  private extractHoleDiameter(prompt: string, unit: UnitSystem): number | undefined {
    // Clean outer/envelope/pitch circular diameter phrases to avoid mismatching hole diameter
    const cleanPrompt = prompt
      .replace(/(?:outer|envelope|base|overall|pitch|pcd)\s*(?:circle\s*)?(?:diameter|dia)/ig, '');

    // 1. "holes with a 10 mm diameter"
    const match1 = cleanPrompt.match(/(?:hole|holes|bore|bores)\s*(?:with|of|dia|diameter|=)?\s*(?:a\s*)?(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?/i);
    if (match1) return parseFloat(match1[1]);

    // 2. "10 mm diameter holes"
    const match2 = cleanPrompt.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?\s*(?:diameter|dia|hole|holes|bore|bores)/i);
    if (match2) return parseFloat(match2[1]);

    // Standard fallback keyword match
    const matchFallback = cleanPrompt.match(/(?:hole|holes|diameter|dia|radius|rad)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in)?/i);
    if (matchFallback) return parseFloat(matchFallback[1]);

    return undefined;
  }

  private extractOverallDimensions(prompt: string, unit: UnitSystem): [number, number, number] | undefined {
    // 1. Match "120 x 120"
    const matchX = prompt.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i);
    if (matchX) {
      const w = parseFloat(matchX[1]);
      const l = parseFloat(matchX[2]);
      const h = matchX[3] ? parseFloat(matchX[3]) : 8;
      return [w, l, h];
    }

    // 2. Match "120 mm outer diameter" or "120 mm diameter"
    const matchOuterDia = prompt.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?\s*(?:outer|base|envelope|overall)?\s*(?:circle\s*)?(?:diameter|dia)/i);
    if (matchOuterDia) {
      const d = parseFloat(matchOuterDia[1]);
      return [d, d, 8];
    }

    // 3. Match "120mm base" or "120 mm size" or "120mm envelope"
    const matchBase = prompt.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?\s*(?:base|envelope|overall|size|width)/i);
    if (matchBase) {
      const d = parseFloat(matchBase[1]);
      return [d, d, 8];
    }

    return undefined;
  }

  private extractPCD(prompt: string, unit: UnitSystem): number | undefined {
    // 1. "pitch circle diameter of 90 mm" or "mounting pitch of 90 mm"
    const match1 = prompt.match(/(?:pitch\s*circle\s*diameter|pcd|pitch|bolt\s*circle|mounting\s*pitch)\s*(?:of|=|:)?\s*(\d+(?:\.\d+)?)/i);
    if (match1) return parseFloat(match1[1]);

    // 2. "90 mm pitch circle diameter" or "90mm mounting pitch" or "90 mm pitch"
    const match2 = prompt.match(/(\d+(?:\.\d+)?)\s*(?:mm|cm|m|inch|in)?\s*(?:mounting\s*|circle\s*|bolt\s*)*pitch/i);
    if (match2) return parseFloat(match2[1]);

    return undefined;
  }

  private extractPartType(prompt: string): string {
    const lower = prompt.toLowerCase();
    if (lower.includes('motor mount') || lower.includes('engine mount')) return 'Motor Mount';
    if (lower.includes('bracket') || lower.includes('support')) return 'Bracket Flange';
    if (lower.includes('flange') || lower.includes('rim')) return 'Flange Plate';
    if (lower.includes('housing')) return 'Enclosure Housing';
    return 'Generic CAD Component';
  }

  private convertToMm(val: number, unit: UnitSystem): number {
    switch (unit) {
      case 'in':
        return val * 25.4;
      case 'cm':
        return val * 10;
      case 'm':
        return val * 1000;
      default:
        return val;
    }
  }
}
