/**
 * SECP Industrial OS v2 — AP242 PMI Parser
 * PATCH-035/PATCH-329B: AP242 PMI Parser
 */

import { StepParsedFile, StepEntity } from '../StepAp242Types';
import { getRefId } from '../StepAp242Parser';
import { PmiObject, DimensionPmi, DatumPmi, FeatureControlFramePmi } from './AP242PmiTypes';

export class AP242PmiParser {
  public static extractPmi(parsed: StepParsedFile, sourceHash: string, sourceFile: string): PmiObject[] {
    const pmiObjects: PmiObject[] = [];

    for (const [id, entity] of Array.from(parsed.data.entities.entries())) {
      if (entity.type === 'DIMENSIONAL_CHARACTERISTIC_REPRESENTATION') {
        pmiObjects.push(this.parseDimension(entity, parsed, sourceHash, sourceFile));
      } else if (entity.type === 'DATUM_FEATURE' || entity.type === 'DATUM') {
        pmiObjects.push(this.parseDatum(entity, parsed, sourceHash, sourceFile));
      } else if (entity.type === 'GEOMETRIC_TOLERANCE_WITH_DATUM_REFERENCE') {
        pmiObjects.push(this.parseGeometricTolerance(entity, parsed, sourceHash, sourceFile));
      } else if (entity.type === 'ANNOTATION_OCCURRENCE' || entity.type === 'TEXT_LITERAL') {
        pmiObjects.push(this.parseGraphical(entity, parsed, sourceHash, sourceFile));
      }
    }

    return pmiObjects;
  }

  private static parseDimension(entity: StepEntity, parsed: StepParsedFile, hash: string, file: string): DimensionPmi {
    const type = entity.parameters[1] as string || 'LINEAR';
    const nominal = parseFloat(entity.parameters[2] as string) || 0;
    const unit = entity.parameters[3] as string || 'mm';
    const tolArray = entity.parameters[4] as any[];
    
    let tolerance;
    if (tolArray && tolArray.length > 0 && tolArray[0] !== 'NONE') {
      tolerance = {
        type: tolArray[0] as any,
        upperTolerance: parseFloat(tolArray[1] || '0'),
        lowerTolerance: parseFloat(tolArray[2] || '0')
      };
    }

    const rawRefs = Array.isArray(entity.parameters[5]) ? entity.parameters[5] : [];
    const refIds = rawRefs.map((r: any) => getRefId(r) ?? r).filter((r: any) => r !== undefined);

    return {
      id: `pmi_dim_${entity.id}`,
      category: 'DIMENSION',
      semanticType: type,
      dimensionType: type as any,
      nominalValue: nominal,
      value: nominal,
      unit,
      tolerance,
      geometryReferences: refIds.map((r: any) => `geom_${r}`),
      sourceEntity: `DIMENSIONAL_CHARACTERISTIC_REPRESENTATION`,
      sourceFile: file,
      sourceHash: hash,
      schemaVersion: 'AP242',
      supportStatus: 'SUPPORTED',
      criticality: 'MEDIUM',
      isSemantic: true
    };
  }

  private static parseDatum(entity: StepEntity, parsed: StepParsedFile, hash: string, file: string): DatumPmi {
    const label = entity.parameters[1] as string || '?';
    const rawRefs = Array.isArray(entity.parameters[3]) ? entity.parameters[3] : [];
    const refIds = rawRefs.map((r: any) => getRefId(r) ?? r).filter((r: any) => r !== undefined);

    return {
      id: `pmi_datum_${entity.id}`,
      category: 'DATUM',
      semanticType: 'DATUM',
      datumLabel: label,
      geometryReferences: refIds.map((r: any) => `geom_${r}`),
      sourceEntity: entity.type,
      sourceFile: file,
      sourceHash: hash,
      schemaVersion: 'AP242',
      supportStatus: 'SUPPORTED',
      criticality: 'HIGH',
      isSemantic: true
    };
  }

  private static parseGeometricTolerance(entity: StepEntity, parsed: StepParsedFile, hash: string, file: string): FeatureControlFramePmi {
    const char = entity.parameters[1] as string;
    const val = parseFloat(entity.parameters[2] as string) || 0;
    const unit = entity.parameters[3] as string || 'mm';
    const datumRefsStr = entity.parameters[6] as string;
    const datumRefs = datumRefsStr ? datumRefsStr.split('|').map(s => s.split(':')[0]) : [];
    
    const rawRefs = Array.isArray(entity.parameters[7]) ? entity.parameters[7] : [];
    const refIds = rawRefs.map((r: any) => getRefId(r) ?? r).filter((r: any) => r !== undefined);

    return {
      id: `pmi_fcf_${entity.id}`,
      category: 'FEATURE_CONTROL_FRAME',
      semanticType: char,
      geometricCharacteristic: char,
      value: val,
      unit,
      datumReferences: datumRefs,
      geometryReferences: refIds.map((r: any) => `geom_${r}`),
      sourceEntity: entity.type,
      sourceFile: file,
      sourceHash: hash,
      schemaVersion: 'AP242',
      supportStatus: 'SUPPORTED',
      criticality: 'HIGH',
      isSemantic: true
    };
  }

  private static parseGraphical(entity: StepEntity, parsed: StepParsedFile, hash: string, file: string): PmiObject {
    const rawRefs = Array.isArray(entity.parameters[2]) ? entity.parameters[2] : [];
    const refIds = rawRefs.map((r: any) => getRefId(r) ?? r).filter((r: any) => r !== undefined);

    return {
      id: `pmi_graphical_${entity.id}`,
      category: 'GRAPHICAL_PMI',
      semanticType: 'TEXT',
      geometryReferences: refIds.map((r: any) => `geom_${r}`),
      sourceEntity: entity.type,
      sourceFile: file,
      sourceHash: hash,
      schemaVersion: 'AP242',
      supportStatus: 'PARTIAL',
      criticality: 'LOW',
      isSemantic: false
    };
  }
}
