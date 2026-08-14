/**
 * SECP-056 DFM Intelligence & Manufacturing Decision Engine
 */

import { ManufacturabilityViolation, RuleSeverity, ProcessType } from './ManufacturingTypes';
import {
  ProductionManufacturingFeature,
  ManufacturingAssessment,
  DFMDecisionStatus,
  ManufacturingProvenanceRecord
} from './ProductionManufacturingTypes';
import { ProductionProcessPlanningEngine } from './ProductionProcessPlanningEngine';

export class ProductionDFMDecisionEngine {

  /**
   * Assess Manufacturability across 4 Tiers & Generate Decision Assessment (056-D / 056-E)
   */
  public static evaluateManufacturingAssessment(
    features: ProductionManufacturingFeature[],
    isGeometricallyValid: boolean = true,
    isEngineeringValid: boolean = true,
    preferredProcess: ProcessType = ProcessType.MILLING_3AXIS
  ): ManufacturingAssessment {
    const timestamp = new Date().toISOString();
    const violations: ManufacturabilityViolation[] = [];
    const warnings: string[] = [];

    // 1. Evaluate Rule Violations
    for (const f of features) {
      const p = f.geometry;

      // Deep Pocket Rule
      if (f.type === 'POCKET' && p.depth && p.width) {
        const ratio = p.depth / p.width;
        if (ratio > 5.0) {
          violations.push({
            ruleId: 'DFM-001-DEEP-POCKET',
            ruleName: 'Deep Pocket Aspect Ratio Limit',
            mfgFeatureId: f.featureId,
            processType: ProcessType.MILLING_3AXIS,
            severity: RuleSeverity.CRITICAL,
            description: `Pocket depth-to-width ratio (${ratio.toFixed(1)}) exceeds 3-axis machining limit of 5.0.`,
            measuredValue: ratio,
            requiredValue: 5.0,
            remediationSuggestion: 'Use 5-axis milling or reduce pocket depth.'
          });
        }
      }

      // Sharp Internal Corner Rule
      if (f.type === 'POCKET' && f.dimensions.cornerRadiusMm === 0) {
        violations.push({
          ruleId: 'DFM-002-SHARP-CORNER',
          ruleName: 'Sharp Internal Corner Radius',
          mfgFeatureId: f.featureId,
          processType: ProcessType.MILLING_3AXIS,
          severity: RuleSeverity.CRITICAL,
          description: 'Internal pocket corners with zero radius cannot be machined with standard rotating end mills.',
          measuredValue: 0,
          requiredValue: 1.0,
          remediationSuggestion: 'Add internal corner radius >= 1.0mm (R >= tool radius).'
        });
      }

      // Thin Wall Rule
      if (f.type === 'BOSS' || f.type === 'POCKET') {
        const wall = f.dimensions.wallThicknessMm || p.wallThickness;
        if (wall !== undefined && wall < 1.0) {
          violations.push({
            ruleId: 'DFM-003-THIN-WALL',
            ruleName: 'Minimum Wall Thickness Violation',
            mfgFeatureId: f.featureId,
            processType: ProcessType.MILLING_3AXIS,
            severity: RuleSeverity.CRITICAL,
            description: `Wall thickness (${wall}mm) is less than minimum machinable limit of 1.0mm.`,
            measuredValue: wall,
            requiredValue: 1.0,
            remediationSuggestion: 'Increase wall thickness to at least 1.0mm to prevent chatter or deflection.'
          });
        }
      }

      // 3-Axis Accessibility for Undercut
      if (f.type === 'UNDERCUT' && preferredProcess === ProcessType.MILLING_3AXIS) {
        violations.push({
          ruleId: 'DFM-004-UNDERCUT-ACCESSIBILITY',
          ruleName: '3-Axis Undercut Inaccessibility',
          mfgFeatureId: f.featureId,
          processType: ProcessType.MILLING_3AXIS,
          severity: RuleSeverity.CRITICAL,
          description: 'Undercut feature cannot be accessed with 3-axis tool path orientation.',
          measuredValue: 0,
          requiredValue: 1,
          remediationSuggestion: 'Escalate machine setup to 5-Axis CNC or redesign feature.'
        });
      }
    }

    // 2. Evaluate Process & Accessibility
    const accessEval = ProductionProcessPlanningEngine.evaluateProcessAccessibility(features, preferredProcess);
    const selectedProcess = accessEval.recommendedProcess;

    const machines = ProductionProcessPlanningEngine.getStandardMachineLibrary();
    const selectedMachine = machines.find(m => m.supportedProcesses.includes(selectedProcess)) || machines[0];

    const sampleFeat = features[0] || {
      featureId: 'f-dummy',
      type: 'BOSS',
      sourceFeatureIds: [],
      persistentTopologyIds: [],
      geometry: {},
      dimensions: {},
      tolerances: { dimensionalToleranceMm: 0.05, surfaceFinishRaUm: 1.6 },
      accessibility: { isAccessible3Axis: true, isAccessible5Axis: true, minimumToolReachMm: 20, primaryAccessVector: { x: 0, y: 0, z: 1 } },
      toolRequirements: { toolType: 'END_MILL', minToolDiameterMm: 10, maxToolDiameterMm: 10, minToolReachMm: 20 },
      processCandidates: [selectedProcess],
      provenance: 'p-dummy'
    };

    const selectedTool = ProductionProcessPlanningEngine.selectToolCandidate(sampleFeat);
    const setupPlan = ProductionProcessPlanningEngine.generateSetupPlan(features);

    // 3. Determine 4-Tier Status Spectrum
    let status: DFMDecisionStatus = 'UNMANUFACTURABLE';
    const criticalCount = violations.filter(v => v.severity === RuleSeverity.CRITICAL).length;

    if (!isGeometricallyValid) {
      status = 'UNMANUFACTURABLE';
      warnings.push('B-Rep Geometry is topologically invalid or contains unclosed shells.');
    } else if (!isEngineeringValid) {
      status = 'GEOMETRICALLY_VALID';
      warnings.push('Geometry is valid but engineering parametric constraints or design intent are violated.');
    } else if (criticalCount > 0) {
      status = 'ENGINEERING_VALID';
      warnings.push(`Engineered part contains ${criticalCount} critical DFM process violations.`);
    } else if (accessEval.constrainedFeaturesCount > 0 && selectedProcess === ProcessType.MILLING_3AXIS) {
      status = 'ENGINEERING_VALID';
      warnings.push('Part requires 5-Axis machining due to undercut or deep pocket accessibility.');
    } else {
      // Manufacturable
      status = 'MANUFACTURABLE';
      if (setupPlan.setupCount > 0 && selectedMachine.axisCount >= (selectedProcess === ProcessType.MILLING_5AXIS ? 5 : 3)) {
        status = 'PRODUCTION_READY';
      }
    }

    // Risk Rating
    const risk = criticalCount > 0 ? 'CRITICAL' : violations.length > 0 ? 'HIGH' : setupPlan.setupCount > 2 ? 'MEDIUM' : 'LOW';
    const estimatedComplexity = Math.min(100, Math.max(10, features.length * 12 + setupPlan.setupCount * 10 + (selectedProcess === ProcessType.MILLING_5AXIS ? 25 : 0)));

    // 4. Provenance Record
    const rawPayload = JSON.stringify({
      status,
      proc: selectedProcess,
      featCount: features.length,
      violCount: violations.length,
      setupCount: setupPlan.setupCount
    });

    const resultHash = `sha256-${this.hashString(rawPayload)}`;
    const signature = `sha256-secp-056-${this.hashString(`${resultHash}-${timestamp}`)}`;

    const provenance: ManufacturingProvenanceRecord = {
      systemVersion: 'SECP CAD CORE v1.0 (SECP-056)',
      timestamp,
      featureGraphHash: `sha256-fgraph-${this.hashString(features.map(f => f.featureId).join(','))}`,
      processPlanHash: `sha256-proc-${this.hashString(selectedProcess)}`,
      dfmHash: `sha256-dfm-${this.hashString(status)}`,
      resultHash,
      signature
    };

    return {
      status,
      process: selectedProcess,
      machine: selectedMachine,
      tool: selectedTool,
      setup: setupPlan,
      accessibility: {
        is3AxisFeasible: accessEval.is3AxisFeasible,
        is5AxisFeasible: accessEval.is5AxisFeasible,
        constrainedFeaturesCount: accessEval.constrainedFeaturesCount
      },
      risk,
      violations,
      warnings,
      estimatedComplexity,
      provenance
    };
  }

  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
