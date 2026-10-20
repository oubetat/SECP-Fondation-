/**
 * SECP Industrial OS — SECP-PCB-PHASE-2-001
 * Comprehensive Design Rule Check (DRC) and Design For Manufacturing (DFM) Verifier:
 * Validates physical clearance, annular rings, drill diameters, board margins, copper-to-hole clearance,
 * solder mask web slivers, and produces an authoritative capability and limitations matrix.
 */

import { PcbCanonicalModel } from './PcbCanonicalModel';
import { PcbDesignRuleset, PcbDesignRulesManager } from './PcbDesignRules';
import { PcbGeometryKernel, Point2D, GeometricPad } from './PcbGeometryKernel';

export interface DrcDfmViolation {
  ruleId: string;
  category: 'CLEARANCE' | 'WIDTH' | 'DRILL_ANNULAR' | 'BOARD_MARGIN' | 'SOLDER_MASK';
  severity: 'ERROR' | 'WARNING';
  message: string;
  actualValue: number;
  thresholdValue: number;
  unit: string;
  location?: Point2D;
  affectedEntities: string[];
}

export interface DfmCapabilityRecord {
  ruleId: string;
  implementationStatus: 'IMPLEMENTED' | 'PARTIAL' | 'NOT_IMPLEMENTED';
  requiredInputs: string[];
  verificationStatus: 'VERIFIED' | 'FAILED' | 'SKIPPED_DUE_TO_MISSING_DATA' | 'NOT_PROVEN';
  evidenceReference: string;
  knownLimitations: string;
}

export interface DrcDfmReport {
  passed: boolean;
  status: 'PASS' | 'FAIL' | 'INCOMPLETE';
  rulesetId: string;
  rulesetHash: string;
  violationsCount: number;
  warningsCount: number;
  violations: DrcDfmViolation[];
  capabilitiesMatrix: DfmCapabilityRecord[];
  minObservedClearanceMm: number;
  minObservedTraceWidthMm: number;
  minObservedAnnularRingMm: number;
  timestamp: string;
}

export class PcbDrcDfmVerifier {
  public static verify(
    model: PcbCanonicalModel,
    customRuleset?: PcbDesignRuleset
  ): DrcDfmReport {
    const ruleset = customRuleset || PcbDesignRulesManager.getDefaultStandardRuleset();
    const rulesetValidation = PcbDesignRulesManager.validateRuleset(ruleset);
    const violations: DrcDfmViolation[] = [];

    // If ruleset is invalid, fail closed
    if (!rulesetValidation.valid) {
      violations.push({
        ruleId: 'DRC-SYS-001',
        category: 'CLEARANCE',
        severity: 'ERROR',
        message: `Ruleset validation failed: ${rulesetValidation.errors.join('; ')}`,
        actualValue: 0,
        thresholdValue: 0,
        unit: 'mm',
        affectedEntities: ['ruleset']
      });
      return {
        passed: false,
        status: 'FAIL',
        rulesetId: ruleset.rulesetId,
        rulesetHash: rulesetValidation.rulesetHash,
        violationsCount: violations.length,
        warningsCount: 0,
        violations,
        capabilitiesMatrix: [],
        minObservedClearanceMm: 0,
        minObservedTraceWidthMm: 0,
        minObservedAnnularRingMm: 0,
        timestamp: new Date().toISOString()
      };
    }

    const minClearanceLimit = ruleset.rules['DRC-CLR-001']?.value ?? 0.20;
    const minTraceWidthLimit = ruleset.rules['DRC-WID-001']?.value ?? 0.15;
    const minDrillLimit = ruleset.rules['DRC-DRL-001']?.value ?? 0.30;
    const minAnnularRingLimit = ruleset.rules['DRC-ANN-001']?.value ?? 0.125;
    const copperToEdgeLimit = ruleset.rules['DRC-EDG-001']?.value ?? 0.50;
    const copperToHoleLimit = ruleset.rules['DRC-HL-001']?.value ?? 0.35;
    const minSolderMaskSliverLimit = ruleset.rules['DRC-MSK-001']?.value ?? 0.10;

    let minObservedClearance = Infinity;
    let minObservedTraceWidth = Infinity;
    let minObservedAnnularRing = Infinity;

    // Collect all geometric pads
    const pads: GeometricPad[] = [];
    for (const place of model.placements) {
      const fp = model.footprintLibrary?.[place.refDes] ||
        Object.values(model.footprintLibrary || {}).find(f =>
          model.components?.some(c => c.refDes === place.refDes && c.footprintId === f.id)
        );

      if (!fp) continue;

      for (const pin of fp.pins) {
        const netDef = model.schematicNets.find(n =>
          n.pins.some(p => p.refDes === place.refDes && p.pinNumber === pin.pinNumber)
        );
        const transformedCenter = PcbGeometryKernel.transformPoint(
          pin.xMm,
          pin.yMm,
          place.xMm,
          place.yMm,
          place.rotationDeg
        );

        pads.push({
          refDes: place.refDes,
          pinNumber: pin.pinNumber,
          netName: netDef?.name,
          layer: place.layer,
          shape: pin.shape || 'RECT',
          center: transformedCenter,
          widthMm: pin.padWidthMm,
          heightMm: pin.padHeightMm,
          rotationDeg: place.rotationDeg
        });
      }
    }

    // 1. Check Minimum Trace Widths (DRC-WID-001)
    for (const t of model.traces) {
      minObservedTraceWidth = Math.min(minObservedTraceWidth, t.widthMm);
      if (t.widthMm < minTraceWidthLimit) {
        violations.push({
          ruleId: 'DRC-WID-001',
          category: 'WIDTH',
          severity: 'ERROR',
          message: `Trace '${t.id}' (net: ${t.netName}) width ${t.widthMm.toFixed(3)}mm is below DRC minimum ${minTraceWidthLimit}mm`,
          actualValue: t.widthMm,
          thresholdValue: minTraceWidthLimit,
          unit: 'mm',
          location: t.path[0],
          affectedEntities: [t.id, t.netName]
        });
      }
    }

    // 2. Check Minimum Via Drill and Annular Ring (DRC-DRL-001, DRC-ANN-001)
    for (const via of model.vias) {
      if (via.drillDiameterMm < minDrillLimit) {
        violations.push({
          ruleId: 'DRC-DRL-001',
          category: 'DRILL_ANNULAR',
          severity: 'ERROR',
          message: `Via '${via.id}' drill diameter ${via.drillDiameterMm.toFixed(3)}mm is below DFM minimum ${minDrillLimit}mm`,
          actualValue: via.drillDiameterMm,
          thresholdValue: minDrillLimit,
          unit: 'mm',
          location: { x: via.xMm, y: via.yMm },
          affectedEntities: [via.id, via.netName]
        });
      }

      // Annular ring = (padDiameter - drillDiameter) / 2
      const annularRing = (via.padDiameterMm - via.drillDiameterMm) / 2;
      minObservedAnnularRing = Math.min(minObservedAnnularRing, annularRing);
      if (annularRing < minAnnularRingLimit) {
        violations.push({
          ruleId: 'DRC-ANN-001',
          category: 'DRILL_ANNULAR',
          severity: 'ERROR',
          message: `Via '${via.id}' annular ring ${annularRing.toFixed(3)}mm is below DFM minimum ${minAnnularRingLimit}mm`,
          actualValue: annularRing,
          thresholdValue: minAnnularRingLimit,
          unit: 'mm',
          location: { x: via.xMm, y: via.yMm },
          affectedEntities: [via.id, via.netName]
        });
      }
    }

    // 3. Trace-to-Trace Clearance on Same Layer (DRC-CLR-001)
    const traceSegments: {
      traceId: string;
      netName: string;
      layer: string;
      p1: Point2D;
      p2: Point2D;
      widthMm: number;
    }[] = [];

    for (const t of model.traces) {
      for (let i = 0; i < t.path.length - 1; i++) {
        traceSegments.push({
          traceId: t.id,
          netName: t.netName,
          layer: t.layer,
          p1: t.path[i],
          p2: t.path[i + 1],
          widthMm: t.widthMm
        });
      }
    }

    const segCount = traceSegments.length;
    for (let i = 0; i < segCount; i++) {
      for (let j = i + 1; j < segCount; j++) {
        const s1 = traceSegments[i];
        const s2 = traceSegments[j];

        // Same layer, different electrical nets
        if (s1.layer === s2.layer && s1.netName !== s2.netName) {
          const clr = PcbGeometryKernel.traceToTraceClearance(
            s1.p1, s1.p2, s1.widthMm,
            s2.p1, s2.p2, s2.widthMm
          );
          minObservedClearance = Math.min(minObservedClearance, clr);

          if (clr < minClearanceLimit) {
            violations.push({
              ruleId: 'DRC-CLR-001',
              category: 'CLEARANCE',
              severity: 'ERROR',
              message: `Trace clearance violation: ${clr.toFixed(3)}mm between '${s1.netName}' and '${s2.netName}' is below DRC minimum ${minClearanceLimit}mm`,
              actualValue: clr,
              thresholdValue: minClearanceLimit,
              unit: 'mm',
              location: s1.p1,
              affectedEntities: [s1.traceId, s2.traceId, s1.netName, s2.netName]
            });
          }
        }
      }
    }

    // 4. Trace-to-Pad Clearance between different nets (DRC-CLR-001)
    for (const seg of traceSegments) {
      for (const pad of pads) {
        if (!pad.netName || pad.netName === seg.netName) continue;
        // Check layer compatibility
        const isPadOnLayer = (seg.layer === 'TOP_COPPER' && pad.layer === 'TOP') ||
                             (seg.layer === 'BOTTOM_COPPER' && pad.layer === 'BOTTOM');
        if (!isPadOnLayer) continue;

        const clr = PcbGeometryKernel.distSegmentToPad(seg.p1, seg.p2, seg.widthMm / 2, pad);
        minObservedClearance = Math.min(minObservedClearance, clr);

        if (clr < minClearanceLimit) {
          violations.push({
            ruleId: 'DRC-CLR-001',
            category: 'CLEARANCE',
            severity: 'ERROR',
            message: `Trace '${seg.traceId}' (net: ${seg.netName}) is only ${clr.toFixed(3)}mm from pad '${pad.refDes}:${pad.pinNumber}' (net: ${pad.netName}), below DRC ${minClearanceLimit}mm`,
            actualValue: clr,
            thresholdValue: minClearanceLimit,
            unit: 'mm',
            location: pad.center,
            affectedEntities: [seg.traceId, `${pad.refDes}:${pad.pinNumber}`, seg.netName, pad.netName]
          });
        }
      }
    }

    // 5. Copper to Board Edge Clearance (DRC-EDG-001)
    for (const t of model.traces) {
      for (const pt of t.path) {
        const edgeDist = Math.min(
          pt.x - t.widthMm / 2,
          model.boardWidthMm - (pt.x + t.widthMm / 2),
          pt.y - t.widthMm / 2,
          model.boardHeightMm - (pt.y + t.widthMm / 2)
        );
        if (edgeDist < copperToEdgeLimit) {
          violations.push({
            ruleId: 'DRC-EDG-001',
            category: 'BOARD_MARGIN',
            severity: 'ERROR',
            message: `Trace '${t.id}' copper margin to board edge is ${edgeDist.toFixed(3)}mm, below DFM minimum ${copperToEdgeLimit}mm`,
            actualValue: edgeDist,
            thresholdValue: copperToEdgeLimit,
            unit: 'mm',
            location: pt,
            affectedEntities: [t.id, 'board_edge']
          });
        }
      }
    }

    // 6. Copper to Mounting Hole Clearance (DRC-HL-001)
    for (const hole of model.mountingHoles) {
      const holeRadius = hole.diameterMm / 2;
      for (const seg of traceSegments) {
        const dist = PcbGeometryKernel.distPointToSegment({ x: hole.x, y: hole.y }, seg.p1, seg.p2);
        const clr = dist - (holeRadius + seg.widthMm / 2);
        if (clr < copperToHoleLimit) {
          violations.push({
            ruleId: 'DRC-HL-001',
            category: 'CLEARANCE',
            severity: 'ERROR',
            message: `Clearance from hole '${hole.id}' to trace '${seg.traceId}' is ${clr.toFixed(3)}mm, below DFM minimum ${copperToHoleLimit}mm`,
            actualValue: clr,
            thresholdValue: copperToHoleLimit,
            unit: 'mm',
            location: { x: hole.x, y: hole.y },
            affectedEntities: [hole.id, seg.traceId]
          });
        }
      }
    }

    // 7. Solder Mask Web Slivers check between adjacent pads (DRC-MSK-001)
    for (let i = 0; i < pads.length; i++) {
      for (let j = i + 1; j < pads.length; j++) {
        const p1 = pads[i];
        const p2 = pads[j];
        if (p1.layer !== p2.layer) continue;

        const padClearance = PcbGeometryKernel.padToPadClearance(p1, p2);
        // Solder mask web sliver is copper clearance minus twice mask expansion (0.05mm x 2 = 0.1mm)
        const maskSliver = Math.max(0, padClearance - 0.10);
        if (padClearance > 0 && maskSliver < minSolderMaskSliverLimit) {
          violations.push({
            ruleId: 'DRC-MSK-001',
            category: 'SOLDER_MASK',
            severity: 'WARNING',
            message: `Solder mask sliver between '${p1.refDes}:${p1.pinNumber}' and '${p2.refDes}:${p2.pinNumber}' is ${maskSliver.toFixed(3)}mm, below minimum mask dam ${minSolderMaskSliverLimit}mm (risk of solder bridge)`,
            actualValue: maskSliver,
            thresholdValue: minSolderMaskSliverLimit,
            unit: 'mm',
            location: p1.center,
            affectedEntities: [`${p1.refDes}:${p1.pinNumber}`, `${p2.refDes}:${p2.pinNumber}`]
          });
        }
      }
    }

    // 8. Explicit Capabilities Matrix
    const capabilitiesMatrix: DfmCapabilityRecord[] = [
      {
        ruleId: 'DRC-CLR-001',
        implementationStatus: 'IMPLEMENTED',
        requiredInputs: ['traces', 'placements', 'footprintLibrary'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-CLR-001' && v.severity === 'ERROR') ? 'FAILED' : 'VERIFIED',
        evidenceReference: 'PcbGeometryKernel.traceToTraceClearance & distSegmentToPad',
        knownLimitations: 'Calculates physical air-gap between swept capsules and rotated pads on same layer'
      },
      {
        ruleId: 'DRC-WID-001',
        implementationStatus: 'IMPLEMENTED',
        requiredInputs: ['traces.widthMm'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-WID-001' && v.severity === 'ERROR') ? 'FAILED' : 'VERIFIED',
        evidenceReference: 'Trace width boundary evaluation',
        knownLimitations: 'Constant trace width per segment; taper necking rules not currently supported'
      },
      {
        ruleId: 'DRC-DRL-001',
        implementationStatus: 'IMPLEMENTED',
        requiredInputs: ['vias.drillDiameterMm'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-DRL-001' && v.severity === 'ERROR') ? 'FAILED' : 'VERIFIED',
        evidenceReference: 'Via drill check against tooling thresholds',
        knownLimitations: 'Validates circular mechanical drills; slotted drill holes require separate DFM profile'
      },
      {
        ruleId: 'DRC-ANN-001',
        implementationStatus: 'IMPLEMENTED',
        requiredInputs: ['vias.padDiameterMm', 'vias.drillDiameterMm'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-ANN-001' && v.severity === 'ERROR') ? 'FAILED' : 'VERIFIED',
        evidenceReference: '(padDia - drillDia)/2 physical annulus computation',
        knownLimitations: 'Teardrop pad reinforcement not modeled'
      },
      {
        ruleId: 'DRC-EDG-001',
        implementationStatus: 'IMPLEMENTED',
        requiredInputs: ['traces.path', 'boardWidthMm', 'boardHeightMm'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-EDG-001' && v.severity === 'ERROR') ? 'FAILED' : 'VERIFIED',
        evidenceReference: 'AABB and endpoint margin calculation to rout edge',
        knownLimitations: 'Evaluated against rectangular board outline; custom milling cutouts require DXF polygon'
      },
      {
        ruleId: 'DRC-HL-001',
        implementationStatus: 'IMPLEMENTED',
        requiredInputs: ['mountingHoles', 'traces'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-HL-001' && v.severity === 'ERROR') ? 'FAILED' : 'VERIFIED',
        evidenceReference: 'distPointToSegment minus hole radius and trace width/2',
        knownLimitations: 'Assumes unplated holes; plated mounting holes check annular ring'
      },
      {
        ruleId: 'DRC-MSK-001',
        implementationStatus: 'PARTIAL',
        requiredInputs: ['padToPadClearance', 'nominalExpansion=0.05mm'],
        verificationStatus: violations.some(v => v.ruleId === 'DRC-MSK-001') ? 'FAILED' : 'VERIFIED',
        evidenceReference: 'Calculated from copper pad spacing minus double expansion',
        knownLimitations: 'Explicit Gerber solder mask layer geometries not present in canonical model; uses standard formula'
      },
      {
        ruleId: 'DFM-ACD-TRP',
        implementationStatus: 'NOT_IMPLEMENTED',
        requiredInputs: ['acuteAngleSegments'],
        verificationStatus: 'NOT_PROVEN',
        evidenceReference: 'N/A',
        knownLimitations: 'Acid trap detection (traces acute angles < 90 deg) is scheduled for Phase 3 Auto-Routing'
      }
    ];

    const errorCount = violations.filter(v => v.severity === 'ERROR').length;
    const warningCount = violations.filter(v => v.severity === 'WARNING').length;

    return {
      passed: errorCount === 0,
      status: errorCount === 0 ? 'PASS' : 'FAIL',
      rulesetId: ruleset.rulesetId,
      rulesetHash: rulesetValidation.rulesetHash,
      violationsCount: errorCount,
      warningsCount: warningCount,
      violations,
      capabilitiesMatrix,
      minObservedClearanceMm: Number.isFinite(minObservedClearance) ? minObservedClearance : 0,
      minObservedTraceWidthMm: Number.isFinite(minObservedTraceWidth) ? minObservedTraceWidth : 0,
      minObservedAnnularRingMm: Number.isFinite(minObservedAnnularRing) ? minObservedAnnularRing : 0,
      timestamp: new Date().toISOString()
    };
  }
}
