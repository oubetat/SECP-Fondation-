import { 
  PatternType, 
  PatternFeature, 
  LinearPatternDefinition, 
  CircularPatternDefinition, 
  VariablePatternDefinition, 
  PatternEvidenceEvent, 
  PatternDiagnosticCode 
} from './PatternTypes';
import { PatternMath } from './PatternMath';
import { PatternBRepValidator, BRepValidationResult } from './PatternBRepValidator';

export class PatternEngine {
  private patterns: Map<string, PatternFeature> = new Map();
  private validator = new PatternBRepValidator();
  private evidenceLedger: PatternEvidenceEvent[] = [];

  public getPatterns(): PatternFeature[] {
    return Array.from(this.patterns.values());
  }

  public getPattern(id: string): PatternFeature | undefined {
    return this.patterns.get(id);
  }

  public getEvidenceLedger(): PatternEvidenceEvent[] {
    return [...this.evidenceLedger];
  }

  /**
   * Creates a Linear Pattern (1D or 2D grid matrix).
   */
  public createLinearPattern(
    name: string,
    sourceFeatureIds: string[],
    linearDef: LinearPatternDefinition,
    inputBRepHash: string = 'brep_root_001',
    suppressionList: number[] = []
  ): PatternFeature {
    const id = `pat_lin_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const instances = PatternMath.computeLinearInstances(linearDef, suppressionList, inputBRepHash);

    const feature: PatternFeature = {
      id,
      name,
      type: 'LINEAR',
      sourceFeatureIds,
      linearDef,
      instances,
      suppressionList,
      dependencies: [...sourceFeatureIds],
      status: 'VALID',
      diagnostics: [],
      inputBRepHash,
      outputBRepHash: `brep_out_${id}_inst${instances.length}`,
      evidenceId: `ev_${id}_create`,
      timestamp: new Date().toISOString()
    };

    const valResult = this.validator.validatePattern(feature);
    if (!valResult.isValid) {
      feature.status = 'BREP_ERROR';
      feature.diagnostics = valResult.diagnostics;
    }

    this.patterns.set(id, feature);
    this.recordEvidence(feature, 'PATTERN_CREATED');

    return feature;
  }

  /**
   * Creates a Circular Pattern.
   */
  public createCircularPattern(
    name: string,
    sourceFeatureIds: string[],
    circularDef: CircularPatternDefinition,
    inputBRepHash: string = 'brep_root_001',
    suppressionList: number[] = []
  ): PatternFeature {
    const id = `pat_circ_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const instances = PatternMath.computeCircularInstances(circularDef, suppressionList, inputBRepHash);

    const feature: PatternFeature = {
      id,
      name,
      type: 'CIRCULAR',
      sourceFeatureIds,
      circularDef,
      instances,
      suppressionList,
      dependencies: [...sourceFeatureIds],
      status: 'VALID',
      diagnostics: [],
      inputBRepHash,
      outputBRepHash: `brep_out_${id}_inst${instances.length}`,
      evidenceId: `ev_${id}_create`,
      timestamp: new Date().toISOString()
    };

    const valResult = this.validator.validatePattern(feature);
    if (!valResult.isValid) {
      feature.status = 'BREP_ERROR';
      feature.diagnostics = valResult.diagnostics;
    }

    this.patterns.set(id, feature);
    this.recordEvidence(feature, 'PATTERN_CREATED');

    return feature;
  }

  /**
   * Creates a Variable Pattern.
   */
  public createVariablePattern(
    name: string,
    sourceFeatureIds: string[],
    variableDef: VariablePatternDefinition,
    inputBRepHash: string = 'brep_root_001',
    suppressionList: number[] = []
  ): PatternFeature {
    const id = `pat_var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const instances = PatternMath.computeVariableInstances(variableDef, suppressionList, inputBRepHash);

    const feature: PatternFeature = {
      id,
      name,
      type: 'VARIABLE',
      sourceFeatureIds,
      variableDef,
      instances,
      suppressionList,
      dependencies: [...sourceFeatureIds],
      status: 'VALID',
      diagnostics: [],
      inputBRepHash,
      outputBRepHash: `brep_out_${id}_inst${instances.length}`,
      evidenceId: `ev_${id}_create`,
      timestamp: new Date().toISOString()
    };

    const valResult = this.validator.validatePattern(feature);
    if (!valResult.isValid) {
      feature.status = 'BREP_ERROR';
      feature.diagnostics = valResult.diagnostics;
    }

    this.patterns.set(id, feature);
    this.recordEvidence(feature, 'PATTERN_CREATED');

    return feature;
  }

  /**
   * Suppresses or unsuppresses an individual instance.
   */
  public toggleInstanceSuppression(patternId: string, instanceIndex: number): PatternFeature {
    const pattern = this.patterns.get(patternId);
    if (!pattern) throw new Error(`Pattern ${patternId} not found.`);

    if (pattern.suppressionList.includes(instanceIndex)) {
      pattern.suppressionList = pattern.suppressionList.filter(idx => idx !== instanceIndex);
    } else {
      pattern.suppressionList.push(instanceIndex);
    }

    return this.recomputePattern(patternId);
  }

  /**
   * Recomputes pattern after parameter changes or source feature changes.
   */
  public recomputePattern(patternId: string, newInputBRepHash?: string): PatternFeature {
    const pattern = this.patterns.get(patternId);
    if (!pattern) throw new Error(`Pattern ${patternId} not found.`);

    if (newInputBRepHash) {
      pattern.inputBRepHash = newInputBRepHash;
    }

    if (pattern.type === 'LINEAR' && pattern.linearDef) {
      pattern.instances = PatternMath.computeLinearInstances(
        pattern.linearDef,
        pattern.suppressionList,
        pattern.inputBRepHash
      );
    } else if (pattern.type === 'CIRCULAR' && pattern.circularDef) {
      pattern.instances = PatternMath.computeCircularInstances(
        pattern.circularDef,
        pattern.suppressionList,
        pattern.inputBRepHash
      );
    } else if (pattern.type === 'VARIABLE' && pattern.variableDef) {
      pattern.instances = PatternMath.computeVariableInstances(
        pattern.variableDef,
        pattern.suppressionList,
        pattern.inputBRepHash
      );
    }

    pattern.outputBRepHash = `brep_out_${pattern.id}_inst${pattern.instances.length}_active${pattern.instances.filter(i=>!i.isSuppressed).length}`;
    
    const valResult = this.validator.validatePattern(pattern);
    if (valResult.isValid) {
      pattern.status = 'VALID';
      pattern.diagnostics = [];
    } else {
      pattern.status = 'BREP_ERROR';
      pattern.diagnostics = valResult.diagnostics;
    }

    this.recordEvidence(pattern, 'PATTERN_RECOMPUTED');
    return pattern;
  }

  /**
   * Records an evidence event for provenance ledger.
   */
  private recordEvidence(pattern: PatternFeature, eventType: any) {
    const eventId = `ev_pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const activeCount = pattern.instances.filter(i => !i.isSuppressed).length;

    const event: PatternEvidenceEvent = {
      eventId,
      eventType,
      patternId: pattern.id,
      patternType: pattern.type,
      inputGeometryHash: pattern.inputBRepHash,
      outputGeometryHash: pattern.outputBRepHash,
      instanceCount: pattern.instances.length,
      suppressedCount: pattern.suppressionList.length,
      timestamp: new Date().toISOString(),
      hash: `hash_${eventId}_${pattern.outputBRepHash}`
    };

    this.evidenceLedger.push(event);
  }
}
