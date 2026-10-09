/**
 * SECP Industrial OS v2 — STEP AP242 Native Pipeline
 * PATCH-034/PATCH-329B: STEP AP242 Native Pipeline
 */

import { StepAp242Parser } from './StepAp242Parser';
import { StepAp242Validator } from './StepAp242Validator';
import { StepAp242Mapper } from './StepAp242Mapper';
import { StepAp242Exporter } from './StepAp242Exporter';
import { StepAp242RoundTripVerifier } from './StepAp242RoundTripVerifier';
import { StepAp242PipelineResult } from './StepAp242Types';
import { TopologyLineage } from '../../cad-kernel/document/CADDocument';

// PMI Imports
import { AP242PmiParser } from './pmi/AP242PmiParser';
import { AP242PmiValidator } from './pmi/AP242PmiValidator';
import { AP242PmiExporter } from './pmi/AP242PmiExporter';
import { AP242PmiRoundTripVerifier } from './pmi/AP242PmiRoundTripVerifier';
import { PmiValidationResult, PmiFidelityReport, PmiObject } from './pmi/AP242PmiTypes';

export interface ExtendedStepAp242PipelineResult extends StepAp242PipelineResult {
  pmiValidations?: PmiValidationResult[];
  pmiFidelity?: PmiFidelityReport;
  pmiModel?: PmiObject[];
  topologyMap?: TopologyLineage;
}

export class StepAp242Pipeline {
  /**
   * Executes the full AP242 Native Pipeline:
   * IMPORT -> PARSE -> VALIDATE -> MAP -> EXPORT -> RE-IMPORT -> VERIFY
   */
  public static async execute(content: string, fileName: string): Promise<ExtendedStepAp242PipelineResult> {
    const sourceHash = this.computeHash(content);

    // 1. Parse
    let parsed;
    try {
      parsed = StepAp242Parser.parse(content);
    } catch (e: any) {
      return {
        validation: {
          status: 'INVALID',
          errors: [`PARSE_ERROR: ${e?.message || e}`],
          warnings: [],
          schema: 'UNKNOWN',
          entityCount: 0,
          referenceIntegrity: false,
          sourceHash
        }
      };
    }

    // 2. Validate
    const validation = StepAp242Validator.validate(parsed, sourceHash);
    if (validation.status === 'INVALID' || !validation.referenceIntegrity) {
      return { validation };
    }

    // 3. Map to Native B-Rep
    const mapper = new StepAp242Mapper();
    const { model, lossReports, topologyMap } = mapper.map(parsed);

    // 3.5 PMI Extraction & Validation
    const pmiObjects = AP242PmiParser.extractPmi(parsed, sourceHash, fileName);
    const pmiValidations = AP242PmiValidator.validateCollection(pmiObjects);

    // 4. Export (Round-trip step)
    const exporter = new StepAp242Exporter();
    let exportedContent = exporter.export(model, `rt_${fileName}`);
    
    // Append PMI to exported STEP
    const pmiExportResult = AP242PmiExporter.export(pmiObjects, 5000); // start ID 5000 for PMI
    if (pmiExportResult.text) {
      exportedContent = exportedContent.replace('ENDSEC;\nEND-ISO-10303-21;', `${pmiExportResult.text}\nENDSEC;\nEND-ISO-10303-21;`);
    }

    // 5. Re-import (Round-trip step)
    let rtModel: any[] = [];
    let rtPmiObjects: PmiObject[] = [];
    try {
      const rtParsed = StepAp242Parser.parse(exportedContent);
      const rtMapper = new StepAp242Mapper();
      const rtRes = rtMapper.map(rtParsed);
      rtModel = rtRes.model;
      rtPmiObjects = AP242PmiParser.extractPmi(rtParsed, this.computeHash(exportedContent), `rt_${fileName}`);
    } catch (e: any) {
      lossReports.push({
        status: 'LOST',
        reason: `Re-import failed during round-trip: ${e?.message || e}`,
        severity: 'CRITICAL'
      });
    }

    // 6. Verify Round-trip
    const fidelity = StepAp242RoundTripVerifier.verify(model, rtModel, lossReports);
    const pmiFidelity = AP242PmiRoundTripVerifier.verify(pmiObjects, rtPmiObjects);

    return {
      validation,
      fidelity,
      nativeModel: model,
      pmiValidations,
      pmiFidelity,
      pmiModel: pmiObjects,
      topologyMap
    };
  }

  private static computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      hash = (hash << 5) - hash + content.charCodeAt(i);
      hash |= 0;
    }
    return `sha256-${Math.abs(hash).toString(16)}`;
  }
}
