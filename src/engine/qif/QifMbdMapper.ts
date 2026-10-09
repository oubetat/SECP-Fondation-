/**
 * SECP Industrial OS v2 — QIF MBD Mapper
 * Maps SECP Canonical MBD / PMI to QIF 3.0 Document and Inspection Plan
 */

import { AP242SemanticModel } from '../interop/AP242Types';
import {
  QifDocument,
  QifFeature,
  QifCharacteristic,
  QifUnitSystem,
  DesignAuthorityBinding
} from './QifTypes';
import { QifXmlEngine } from './QifXmlEngine';

export class QifMbdMapper {

  /**
   * Converts an AP242 / Canonical MBD Model into a QIF 3.0 Document structure.
   */
  public static mapMbdToQifDocument(
    mbdModel: AP242SemanticModel,
    designAuthorityId: string = 'DA-SECP-001',
    revisionId: string = 'REV-A'
  ): QifDocument {
    const qifDocId = `QIF-DOC-${mbdModel.header?.fileName || 'MODEL'}`;
    
    // Map Unit System
    const unitSys: QifUnitSystem = {
      lengthUnit: mbdModel.unitSystem?.lengthUnit === 'INCH' ? 'INCH' :
                  mbdModel.unitSystem?.lengthUnit === 'METRE' ? 'METRE' : 'MILLIMETRE',
      angleUnit: 'DEGREE',
      scaleFactorToMm: mbdModel.unitSystem?.lengthConversionToMm || 1.0
    };

    // Map Features from BRep Solids / Faces
    const features: QifFeature[] = [];
    const charList: QifCharacteristic[] = [];

    if (mbdModel.solids && mbdModel.solids.length > 0) {
      for (const solid of mbdModel.solids) {
        for (const face of solid.faces) {
          const featId = `FEAT-${face.id}`;
          const assocChars: string[] = [];

          // Find PMI dimensions referencing this face
          for (const dim of mbdModel.dimensions) {
            if (dim.referencedGeometryIds.includes(face.id) || dim.referencedGeometryIds.includes(solid.solidId)) {
              const charId = `CHAR-DIM-${dim.id}`;
              assocChars.push(charId);

              // Check if characteristic already added
              if (!charList.some(c => c.id === charId)) {
                charList.push({
                  id: charId,
                  name: `Linear Dimension ${dim.id}`,
                  type: dim.dimensionType === 'DIAMETER' ? 'DIAMETER' : 'LINEAR_DISTANCE',
                  nominalValue: dim.nominalValue,
                  unit: dim.unit,
                  tolerance: {
                    type: dim.tolerance?.toleranceType === 'BILATERAL' ? 'BILATERAL' : 'SYMMETRIC',
                    upperLimitMm: dim.nominalValue + (dim.tolerance?.upperDeviationMm ?? 0.1),
                    lowerLimitMm: dim.nominalValue + (dim.tolerance?.lowerDeviationMm ?? -0.1),
                    upperDeviationMm: dim.tolerance?.upperDeviationMm ?? 0.1,
                    lowerDeviationMm: dim.tolerance?.lowerDeviationMm ?? -0.1
                  },
                  datumReferences: [],
                  targetGeometryId: face.id,
                  pmiId: dim.id,
                  isCriticalToQuality: true
                });
              }
            }
          }

          // Find GD&T tolerances referencing this face
          for (const gdt of mbdModel.geometricTolerances) {
            if (gdt.referencedGeometryIds.includes(face.id) || gdt.referencedGeometryIds.includes(solid.solidId)) {
              const charId = `CHAR-GDT-${gdt.id}`;
              assocChars.push(charId);

              if (!charList.some(c => c.id === charId)) {
                const datums = gdt.datumReferences.map(d => ({
                  datumLabel: d.datumLabel,
                  precedence: d.precedence,
                  materialCondition: d.materialCondition,
                  targetGeometryId: face.id
                }));

                charList.push({
                  id: charId,
                  name: `GD&T ${gdt.characteristic} ${gdt.id}`,
                  type: gdt.characteristic as any,
                  nominalValue: gdt.toleranceValue,
                  unit: 'mm',
                  tolerance: {
                    type: 'SYMMETRIC',
                    upperLimitMm: gdt.toleranceValue,
                    lowerLimitMm: 0,
                    upperDeviationMm: gdt.toleranceValue,
                    lowerDeviationMm: 0
                  },
                  datumReferences: datums,
                  targetGeometryId: face.id,
                  pmiId: gdt.id,
                  isCriticalToQuality: true
                });
              }
            }
          }

          features.push({
            id: featId,
            name: `Face Feature ${face.id}`,
            featureType: face.surfaceType === 'CYLINDRICAL' ? 'CYLINDER' : 'PLANE',
            persistentTopologyId: `TOPO-FACE-${face.id}`,
            associatedCharacteristicIds: assocChars
          });
        }
      }
    }

    return {
      qifDocumentId: qifDocId,
      header: {
        title: `QIF MBD Model ${mbdModel.header?.fileName || 'Part'}`,
        author: 'SECP QifMbdMapper',
        organization: 'SECP Engineering Authority',
        timestamp: new Date().toISOString(),
        schemaVersion: '3.0'
      },
      plan: {
        planId: `PLAN-${qifDocId}`,
        designAuthorityId,
        revisionId,
        features,
        characteristics: charList,
        unitSystem: unitSys,
        planHash: `0x${Math.abs(qifDocId.length * 100000).toString(16)}`
      },
      results: []
    };
  }
}
