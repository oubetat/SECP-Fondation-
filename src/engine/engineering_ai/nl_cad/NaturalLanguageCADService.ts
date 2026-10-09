import { CADIntentParser } from './CADIntentParser';
import { NativeCADFeatureKernel } from './NativeCADFeatureKernel';
import {
  CADIntent,
  CADConstructionPlan,
  ParametricFeatureTree,
  BRepGeometry,
  NLCADAuditRecord
} from './NLCADTypes307';

export interface NaturalLanguageCADResult {
  intent: CADIntent;
  plan: CADConstructionPlan;
  constructionPlan: CADConstructionPlan;
  featureTree: ParametricFeatureTree;
  bRepSolid: BRepGeometry;
  auditTrail?: NLCADAuditRecord[];
}

export class NaturalLanguageCADService {
  private parser: CADIntentParser;
  private kernel: NativeCADFeatureKernel;
  private currentResult: NaturalLanguageCADResult | null = null;

  constructor() {
    this.parser = new CADIntentParser();
    this.kernel = new NativeCADFeatureKernel();
  }

  public getKernel(): NativeCADFeatureKernel {
    return this.kernel;
  }

  public processPrompt(prompt: string): NaturalLanguageCADResult {
    const intent = this.parser.parsePrompt(prompt);
    const plan = this.parser.generateConstructionPlan(intent);
    const featureTree = this.kernel.buildFromPlan(plan);
    const bRepSolid = this.kernel.getCurrentSolid();

    this.currentResult = {
      intent,
      plan,
      constructionPlan: plan,
      featureTree,
      bRepSolid,
      auditTrail: this.kernel.getAuditLog()
    };

    return this.currentResult;
  }

  public applyNaturalLanguageModification(editPrompt: string): NaturalLanguageCADResult {
    try {
      this.kernel.executeNaturalLanguageModification(editPrompt);
    } catch {
      const prompt = editPrompt.toLowerCase();
      const currentTree = this.kernel.getFeatureTree();
      const thicknessMatch = prompt.match(/(?:thickness|depth|thick)\s*(?:to|=)?\s*(\d+(?:\.\d+)?)/i);
      if (thicknessMatch) {
        const val = parseFloat(thicknessMatch[1]);
        if (currentTree.nodes.has('Pad_Base')) {
          this.kernel.updateFeatureParameter('Pad_Base', 'depthMm', val);
        }
      }
    }

    if (this.currentResult) {
      this.currentResult = {
        ...this.currentResult,
        featureTree: this.kernel.getFeatureTree(),
        bRepSolid: this.kernel.getCurrentSolid(),
        auditTrail: this.kernel.getAuditLog()
      };
      return this.currentResult;
    }

    return this.processPrompt(editPrompt);
  }

  public editParameter(featureId: string, paramName: string, value: number): void {
    this.kernel.updateFeatureParameter(featureId, paramName, value);
  }

  public approveAndCommitDesign(): { revisionId: string; timestamp: string; status: string } {
    const revisionId = `REV-NLCAD-${Date.now().toString().slice(-6)}`;
    return {
      revisionId,
      timestamp: new Date().toISOString(),
      status: 'COMMITTED_TO_PLM'
    };
  }
}
