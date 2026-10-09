/**
 * SECP Industrial OS v2 — QIF 3.0 ISO 23952 XML Engine
 * Real QIF 3.0 XML Serializer and Parser with Validation
 */

import {
  QifDocument,
  QifInspectionPlan,
  QifMeasurementResult,
  QifFeature,
  QifCharacteristic,
  QifVerdict,
  QifMeasurementUncertainty,
  QifMeasurementContext,
  DesignAuthorityBinding,
  QifUnitSystem
} from './QifTypes';

import { QifCryptoProvenance } from './QifCryptoProvenance';

export interface QifXmlParseResult {
  readonly success: boolean;
  readonly document?: QifDocument;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly entityCount: number;
  readonly rawXmlHash: string;
}

export class QifXmlEngine {

  /**
   * Serializes a canonical QifDocument into ISO 23952 / ANSI QIF 3.0 XML string format.
   */
  public static exportToXml(doc: QifDocument): string {
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<QIFDocument xmlns="http://qifstandards.org/xsd/qif3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="3.0.0" id="${doc.qifDocumentId}">`);
    lines.push(`  <QPId>${doc.qifDocumentId}</QPId>`);
    
    // Header
    lines.push('  <Header>');
    lines.push(`    <Title>${doc.header.title}</Title>`);
    lines.push(`    <Author>${doc.header.author}</Author>`);
    lines.push(`    <Organization>${doc.header.organization}</Organization>`);
    lines.push(`    <Timestamp>${doc.header.timestamp}</Timestamp>`);
    lines.push(`    <SchemaVersion>${doc.header.schemaVersion}</SchemaVersion>`);
    lines.push('  </Header>');

    // Product & Inspection Plan
    const plan = doc.plan;
    lines.push(`  <InspectionPlan id="${plan.planId}">`);
    lines.push(`    <DesignAuthorityId>${plan.designAuthorityId}</DesignAuthorityId>`);
    lines.push(`    <RevisionId>${plan.revisionId}</RevisionId>`);
    
    lines.push('    <UnitSystem>');
    lines.push(`      <LengthUnit>${plan.unitSystem.lengthUnit}</LengthUnit>`);
    lines.push(`      <AngleUnit>${plan.unitSystem.angleUnit}</AngleUnit>`);
    lines.push(`      <ScaleFactorToMm>${plan.unitSystem.scaleFactorToMm}</ScaleFactorToMm>`);
    lines.push('    </UnitSystem>');

    // Features
    lines.push('    <Features>');
    for (const feat of plan.features) {
      lines.push(`      <Feature id="${feat.id}">`);
      lines.push(`        <Name>${feat.name}</Name>`);
      lines.push(`        <FeatureType>${feat.featureType}</FeatureType>`);
      lines.push(`        <PersistentTopologyId>${feat.persistentTopologyId}</PersistentTopologyId>`);
      lines.push('        <AssociatedCharacteristics>');
      for (const charId of feat.associatedCharacteristicIds) {
        lines.push(`          <CharacteristicRef>${charId}</CharacteristicRef>`);
      }
      lines.push('        </AssociatedCharacteristics>');
      lines.push('      </Feature>');
    }
    lines.push('    </Features>');

    // Characteristics
    lines.push('    <Characteristics>');
    for (const char of plan.characteristics) {
      lines.push(`      <Characteristic id="${char.id}">`);
      lines.push(`        <Name>${char.name}</Name>`);
      lines.push(`        <Type>${char.type}</Type>`);
      lines.push(`        <NominalValue>${char.nominalValue}</NominalValue>`);
      lines.push(`        <Unit>${char.unit}</Unit>`);
      lines.push(`        <PmiId>${char.pmiId}</PmiId>`);
      lines.push(`        <TargetGeometryId>${char.targetGeometryId}</TargetGeometryId>`);
      lines.push(`        <IsCriticalToQuality>${char.isCriticalToQuality}</IsCriticalToQuality>`);
      lines.push('        <Tolerance>');
      lines.push(`          <Type>${char.tolerance.type}</Type>`);
      lines.push(`          <UpperLimitMm>${char.tolerance.upperLimitMm}</UpperLimitMm>`);
      lines.push(`          <LowerLimitMm>${char.tolerance.lowerLimitMm}</LowerLimitMm>`);
      lines.push(`          <UpperDeviationMm>${char.tolerance.upperDeviationMm}</UpperDeviationMm>`);
      lines.push(`          <LowerDeviationMm>${char.tolerance.lowerDeviationMm}</LowerDeviationMm>`);
      lines.push('        </Tolerance>');
      lines.push('        <DatumReferences>');
      for (const dat of char.datumReferences) {
        lines.push(`          <Datum label="${dat.datumLabel}" precedence="${dat.precedence}" targetGeometryId="${dat.targetGeometryId}" />`);
      }
      lines.push('        </DatumReferences>');
      lines.push('      </Characteristic>');
    }
    lines.push('    </Characteristics>');
    lines.push('  </InspectionPlan>');

    // Measurement Results
    lines.push('  <MeasurementResults>');
    for (const res of doc.results) {
      lines.push(`    <MeasurementResult id="${res.resultId}">`);
      lines.push(`      <FeatureRef>${res.featureId}</FeatureRef>`);
      lines.push(`      <CharacteristicRef>${res.characteristicId}</CharacteristicRef>`);
      lines.push(`      <DesignRevisionId>${res.designRevisionId}</DesignRevisionId>`);
      lines.push(`      <PartSerialNumber>${res.partSerialNumber}</PartSerialNumber>`);
      lines.push(`      <LotId>${res.lotId}</LotId>`);
      lines.push(`      <NominalValue>${res.nominalValue}</NominalValue>`);
      lines.push(`      <MeasuredValue>${res.measuredValue}</MeasuredValue>`);
      lines.push(`      <DeviationMm>${res.deviationMm}</DeviationMm>`);
      lines.push(`      <Unit>${res.unit}</Unit>`);
      lines.push(`      <DecisionRule>${res.decisionRule}</DecisionRule>`);
      lines.push(`      <Verdict>${res.verdict}</Verdict>`);
      lines.push(`      <EvidenceHash>${res.evidenceHash}</EvidenceHash>`);
      
      lines.push('      <Uncertainty>');
      lines.push(`        <StandardUncertaintyMm>${res.uncertainty.standardUncertaintyMm}</StandardUncertaintyMm>`);
      lines.push(`        <InstrumentContributionMm>${res.uncertainty.instrumentContributionMm}</InstrumentContributionMm>`);
      lines.push(`        <EnvironmentalContributionMm>${res.uncertainty.environmentalContributionMm}</EnvironmentalContributionMm>`);
      lines.push(`        <RepeatabilityMm>${res.uncertainty.repeatabilityMm}</RepeatabilityMm>`);
      lines.push(`        <CoverageFactor>${res.uncertainty.coverageFactor}</CoverageFactor>`);
      lines.push(`        <ExpandedUncertaintyMm>${res.uncertainty.expandedUncertaintyMm}</ExpandedUncertaintyMm>`);
      lines.push(`        <ConfidenceLevelPercent>${res.uncertainty.confidenceLevelPercent}</ConfidenceLevelPercent>`);
      lines.push('      </Uncertainty>');

      lines.push('      <Context>');
      lines.push(`        <OperatorId>${res.context.operatorId}</OperatorId>`);
      lines.push(`        <MeasurementMethod>${res.context.measurementMethod}</MeasurementMethod>`);
      lines.push(`        <TemperatureCelsius>${res.context.temperatureCelsius}</TemperatureCelsius>`);
      lines.push(`        <PartSerialNumber>${res.context.partSerialNumber}</PartSerialNumber>`);
      lines.push(`        <LotId>${res.context.lotId}</LotId>`);
      lines.push(`        <RevisionId>${res.context.revisionId}</RevisionId>`);
      lines.push(`        <Timestamp>${res.context.timestamp}</Timestamp>`);
      lines.push(`        <CoordinateSystem>${res.context.coordinateSystem}</CoordinateSystem>`);
      
      lines.push('        <Instrument>');
      lines.push(`          <InstrumentId>${res.context.instrument.instrumentId}</InstrumentId>`);
      lines.push(`          <Name>${res.context.instrument.name}</Name>`);
      lines.push(`          <Type>${res.context.instrument.type}</Type>`);
      lines.push(`          <ResolutionMm>${res.context.instrument.resolutionMm}</ResolutionMm>`);
      lines.push(`          <InherentUncertaintyMm>${res.context.instrument.inherentUncertaintyMm}</InherentUncertaintyMm>`);
      if (res.context.instrument.calibration) {
        lines.push('          <Calibration>');
        lines.push(`            <CalibrationId>${res.context.instrument.calibration.calibrationId}</CalibrationId>`);
        lines.push(`            <CalibratedAt>${res.context.instrument.calibration.calibratedAt}</CalibratedAt>`);
        lines.push(`            <ExpiresAt>${res.context.instrument.calibration.expiresAt}</ExpiresAt>`);
        lines.push(`            <StandardId>${res.context.instrument.calibration.calibrationStandardId}</StandardId>`);
        lines.push(`            <VerifiedAccuracyMm>${res.context.instrument.calibration.verifiedAccuracyMm}</VerifiedAccuracyMm>`);
        lines.push(`            <IsValid>${res.context.instrument.calibration.isValid}</IsValid>`);
        lines.push('          </Calibration>');
      }
      lines.push('        </Instrument>');
      lines.push('      </Context>');

      lines.push('      <DesignAuthorityBinding>');
      lines.push(`        <DesignAuthorityId>${res.binding.designAuthorityId}</DesignAuthorityId>`);
      lines.push(`        <CanonicalDocumentId>${res.binding.canonicalDocumentId}</CanonicalDocumentId>`);
      lines.push(`        <RevisionId>${res.binding.revisionId}</RevisionId>`);
      lines.push(`        <GeometryPersistentId>${res.binding.geometryPersistentId}</GeometryPersistentId>`);
      lines.push(`        <PmiId>${res.binding.pmiId}</PmiId>`);
      lines.push(`        <QualityCharacteristicId>${res.binding.qualityCharacteristicId}</QualityCharacteristicId>`);
      lines.push(`        <MeasurementFeatureId>${res.binding.measurementFeatureId}</MeasurementFeatureId>`);
      lines.push(`        <QifResultId>${res.binding.qifResultId}</QifResultId>`);
      lines.push(`        <TraceabilityHash>${res.binding.traceabilityHash}</TraceabilityHash>`);
      lines.push('      </DesignAuthorityBinding>');

      lines.push('    </MeasurementResult>');
    }
    lines.push('  </MeasurementResults>');

    lines.push('</QIFDocument>');

    return lines.join('\n');
  }

  /**
   * Parses ISO 23952 / ANSI QIF 3.0 XML string back into canonical QifDocument with strict validation.
   */
  public static parseXml(xmlText: string): QifXmlParseResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!xmlText || typeof xmlText !== 'string' || xmlText.trim().length === 0) {
      return { success: false, errors: ['MALFORMED_XML: Empty or non-string input'], warnings: [], entityCount: 0, rawXmlHash: '0x00000000' };
    }

    if (!xmlText.includes('<QIFDocument') || !xmlText.includes('</QIFDocument>')) {
      return { success: false, errors: ['MALFORMED_XML: Missing root QIFDocument tag'], warnings: [], entityCount: 0, rawXmlHash: '0x00000000' };
    }

    // Helper regex extractors with strict word boundary \\b
    const extractTag = (xml: string, tag: string): string => {
      const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
      return match ? match[1].trim() : '';
    };

    const extractAttr = (xml: string, tag: string, attr: string): string => {
      const match = xml.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["']`));
      return match ? match[1] : '';
    };

    const extractAllBlocks = (xml: string, tag: string): string[] => {
      const regex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'g');
      const results: string[] = [];
      let m;
      while ((m = regex.exec(xml)) !== null) {
        results.push(m[0]); // m[0] contains the FULL element including opening tag with attributes
      }
      return results;
    };

    const docId = extractAttr(xmlText, 'QIFDocument', 'id') || 'QIF-DOC-001';
    const title = extractTag(xmlText, 'Title') || 'Default QIF Document';
    const author = extractTag(xmlText, 'Author') || 'SECP QIF Engine';
    const org = extractTag(xmlText, 'Organization') || 'SECP Foundation';
    const timestamp = extractTag(xmlText, 'Timestamp') || new Date().toISOString();
    const schemaVersion = extractTag(xmlText, 'SchemaVersion') || '3.0';

    if (schemaVersion !== '3.0') {
      errors.push(`UNSUPPORTED_SCHEMA_VERSION: QIF schema version ${schemaVersion} is unsupported (expected 3.0)`);
    }

    // Parse Features
    const featureBlocks = extractAllBlocks(xmlText, 'Feature');
    const features: QifFeature[] = [];
    const featureIds = new Set<string>();

    for (const fBlock of featureBlocks) {
      const fId = extractAttr(fBlock, 'Feature', 'id') || extractTag(fBlock, 'id');
      if (!fId) {
        errors.push('MISSING_IDENTIFIER: Feature block missing id attribute');
        continue;
      }
      if (featureIds.has(fId)) {
        errors.push(`DUPLICATE_IDENTIFIER: Duplicate feature ID ${fId}`);
      }
      featureIds.add(fId);

      const name = extractTag(fBlock, 'Name');
      const featureType = (extractTag(fBlock, 'FeatureType') || 'SURFACE') as any;
      const persistentTopologyId = extractTag(fBlock, 'PersistentTopologyId');
      
      const assocCharRefs = extractAllBlocks(fBlock, 'CharacteristicRef').map(s => s.replace(/<[^>]+>/g, '').trim());

      features.push({
        id: fId,
        name,
        featureType,
        persistentTopologyId,
        associatedCharacteristicIds: assocCharRefs
      });
    }

    // Parse Characteristics
    const charBlocks = extractAllBlocks(xmlText, 'Characteristic');
    const characteristics: QifCharacteristic[] = [];
    const charIds = new Set<string>();

    for (const cBlock of charBlocks) {
      const cId = extractAttr(cBlock, 'Characteristic', 'id') || extractTag(cBlock, 'id');
      if (!cId) {
        errors.push('MISSING_IDENTIFIER: Characteristic block missing id attribute');
        continue;
      }
      if (charIds.has(cId)) {
        errors.push(`DUPLICATE_IDENTIFIER: Duplicate characteristic ID ${cId}`);
      }
      charIds.add(cId);

      const name = extractTag(cBlock, 'Name');
      const type = (extractTag(cBlock, 'Type') || 'LINEAR_DISTANCE') as any;
      const nominalValue = parseFloat(extractTag(cBlock, 'NominalValue') || '0');
      const unit = extractTag(cBlock, 'Unit') || 'mm';
      const pmiId = extractTag(cBlock, 'PmiId');
      const targetGeometryId = extractTag(cBlock, 'TargetGeometryId');
      const isCriticalToQuality = extractTag(cBlock, 'IsCriticalToQuality') === 'true';

      const tolBlock = extractTag(cBlock, 'Tolerance');
      const tolType = (extractTag(tolBlock, 'Type') || 'SYMMETRIC') as any;
      const upperLimitMm = parseFloat(extractTag(tolBlock, 'UpperLimitMm') || '0');
      const lowerLimitMm = parseFloat(extractTag(tolBlock, 'LowerLimitMm') || '0');
      const upperDeviationMm = parseFloat(extractTag(tolBlock, 'UpperDeviationMm') || '0');
      const lowerDeviationMm = parseFloat(extractTag(tolBlock, 'LowerDeviationMm') || '0');

      // Datums
      const datums: any[] = [];
      const datumMatches = cBlock.match(/<Datum\s+([^>]+)\/>/g) || [];
      for (const dStr of datumMatches) {
        const label = extractAttr(dStr, 'Datum', 'label');
        const precedence = extractAttr(dStr, 'Datum', 'precedence') as any;
        const targetGeom = extractAttr(dStr, 'Datum', 'targetGeometryId');
        datums.push({ datumLabel: label, precedence, targetGeometryId: targetGeom });
      }

      characteristics.push({
        id: cId,
        name,
        type,
        nominalValue,
        unit,
        tolerance: {
          type: tolType,
          upperLimitMm,
          lowerLimitMm,
          upperDeviationMm,
          lowerDeviationMm
        },
        datumReferences: datums,
        targetGeometryId,
        pmiId,
        isCriticalToQuality
      });
    }

    // Parse Results
    const resBlocks = extractAllBlocks(xmlText, 'MeasurementResult');
    const results: QifMeasurementResult[] = [];

    for (const rBlock of resBlocks) {
      const rId = extractAttr(rBlock, 'MeasurementResult', 'id') || extractTag(rBlock, 'id');
      const featureId = extractTag(rBlock, 'FeatureRef');
      const characteristicId = extractTag(rBlock, 'CharacteristicRef');
      const designRevisionId = extractTag(rBlock, 'DesignRevisionId');
      const partSerialNumber = extractTag(rBlock, 'PartSerialNumber');
      const lotId = extractTag(rBlock, 'LotId');
      const nominalValue = parseFloat(extractTag(rBlock, 'NominalValue') || '0');
      const measuredValue = parseFloat(extractTag(rBlock, 'MeasuredValue') || '0');
      const deviationMm = parseFloat(extractTag(rBlock, 'DeviationMm') || '0');
      const unit = extractTag(rBlock, 'Unit') || 'mm';
      const decisionRule = (extractTag(rBlock, 'DecisionRule') || 'SIMPLE_ACCEPTANCE') as any;
      const verdict = (extractTag(rBlock, 'Verdict') || 'UNVERIFIED') as any;
      const evidenceHash = extractTag(rBlock, 'EvidenceHash');

      // Reference integrity checks
      if (featureId && !featureIds.has(featureId)) {
        errors.push(`BROKEN_REFERENCE: Measurement result #${rId} references unknown feature ${featureId}`);
      }
      if (characteristicId && !charIds.has(characteristicId)) {
        errors.push(`BROKEN_REFERENCE: Measurement result #${rId} references unknown characteristic ${characteristicId}`);
      }

      // Parse Uncertainty
      const uncBlock = extractTag(rBlock, 'Uncertainty');
      const standardUncertaintyMm = parseFloat(extractTag(uncBlock, 'StandardUncertaintyMm') || '0');
      const instrumentContributionMm = parseFloat(extractTag(uncBlock, 'InstrumentContributionMm') || '0');
      const environmentalContributionMm = parseFloat(extractTag(uncBlock, 'EnvironmentalContributionMm') || '0');
      const repeatabilityMm = parseFloat(extractTag(uncBlock, 'RepeatabilityMm') || '0');
      const coverageFactor = parseFloat(extractTag(uncBlock, 'CoverageFactor') || '2');
      const expandedUncertaintyMm = parseFloat(extractTag(uncBlock, 'ExpandedUncertaintyMm') || '0');
      const confidenceLevelPercent = parseFloat(extractTag(uncBlock, 'ConfidenceLevelPercent') || '95');

      // Parse Context
      const ctxBlock = extractTag(rBlock, 'Context');
      const operatorId = extractTag(ctxBlock, 'OperatorId');
      const measurementMethod = extractTag(ctxBlock, 'MeasurementMethod');
      const temperatureCelsius = parseFloat(extractTag(ctxBlock, 'TemperatureCelsius') || '20');
      const ctxPartSerial = extractTag(ctxBlock, 'PartSerialNumber');
      const ctxLotId = extractTag(ctxBlock, 'LotId');
      const ctxRevisionId = extractTag(ctxBlock, 'RevisionId');
      const ctxTimestamp = extractTag(ctxBlock, 'Timestamp');
      const coordinateSystem = extractTag(ctxBlock, 'CoordinateSystem');

      // Parse Instrument
      const instBlock = extractTag(ctxBlock, 'Instrument');
      const instrumentId = extractTag(instBlock, 'InstrumentId');
      const instName = extractTag(instBlock, 'Name');
      const instType = (extractTag(instBlock, 'Type') || 'ZEISS_CMM_PROBE') as any;
      const resolutionMm = parseFloat(extractTag(instBlock, 'ResolutionMm') || '0.0001');
      const inherentUncertaintyMm = parseFloat(extractTag(instBlock, 'InherentUncertaintyMm') || '0.001');

      const calBlock = extractTag(instBlock, 'Calibration');
      const calibrationId = extractTag(calBlock, 'CalibrationId');
      const calibratedAt = extractTag(calBlock, 'CalibratedAt');
      const expiresAt = extractTag(calBlock, 'ExpiresAt');
      const calibrationStandardId = extractTag(calBlock, 'StandardId');
      const verifiedAccuracyMm = parseFloat(extractTag(calBlock, 'VerifiedAccuracyMm') || '0.001');
      const isCalValid = extractTag(calBlock, 'IsValid') === 'true';

      // Calibration expiration check
      if (expiresAt) {
        const expDate = new Date(expiresAt);
        if (expDate < new Date('2026-09-23T00:00:00Z')) {
          errors.push(`EXPIRED_CALIBRATION: Instrument ${instrumentId} calibration expired on ${expiresAt}`);
        }
      }

      // Parse DesignAuthorityBinding
      const bindBlock = extractTag(rBlock, 'DesignAuthorityBinding');
      const daBinding: DesignAuthorityBinding = {
        designAuthorityId: extractTag(bindBlock, 'DesignAuthorityId'),
        canonicalDocumentId: extractTag(bindBlock, 'CanonicalDocumentId'),
        revisionId: extractTag(bindBlock, 'RevisionId'),
        geometryPersistentId: extractTag(bindBlock, 'GeometryPersistentId'),
        pmiId: extractTag(bindBlock, 'PmiId'),
        qualityCharacteristicId: extractTag(bindBlock, 'QualityCharacteristicId'),
        measurementFeatureId: extractTag(bindBlock, 'MeasurementFeatureId'),
        qifResultId: extractTag(bindBlock, 'QifResultId'),
        traceabilityHash: extractTag(bindBlock, 'TraceabilityHash')
      };

      if (!daBinding.designAuthorityId) {
        errors.push(`DESIGN_AUTHORITY_UNRESOLVED: Result ${rId} missing design authority binding`);
      }

      results.push({
        resultId: rId,
        featureId,
        characteristicId,
        designRevisionId,
        partSerialNumber,
        lotId,
        nominalValue,
        measuredValue,
        deviationMm,
        unit,
        decisionRule,
        verdict,
        evidenceHash,
        uncertainty: {
          standardUncertaintyMm,
          instrumentContributionMm,
          environmentalContributionMm,
          repeatabilityMm,
          coverageFactor,
          expandedUncertaintyMm,
          confidenceLevelPercent
        },
        context: {
          operatorId,
          measurementMethod,
          temperatureCelsius,
          partSerialNumber: ctxPartSerial,
          lotId: ctxLotId,
          revisionId: ctxRevisionId,
          timestamp: ctxTimestamp,
          coordinateSystem,
          instrument: {
            instrumentId,
            name: instName,
            type: instType,
            resolutionMm,
            inherentUncertaintyMm,
            calibration: {
              calibrationId,
              instrumentId,
              calibratedAt,
              expiresAt,
              calibrationStandardId,
              verifiedAccuracyMm,
              isValid: isCalValid
            }
          }
        },
        binding: daBinding
      });
    }

    // Compute true SHA-256 XML stream hash
    const rawXmlHash = QifCryptoProvenance.computeXmlStreamHash(xmlText);

    const planId = extractAttr(xmlText, 'InspectionPlan', 'id') || 'PLAN-001';
    const daId = extractTag(xmlText, 'DesignAuthorityId') || 'DA-SECP-001';
    const revId = extractTag(xmlText, 'RevisionId') || 'REV-A';

    const unitBlock = extractTag(xmlText, 'UnitSystem');
    const lengthUnit = (extractTag(unitBlock, 'LengthUnit') || 'MILLIMETRE') as any;
    const angleUnit = (extractTag(unitBlock, 'AngleUnit') || 'DEGREE') as any;
    const scaleFactorToMm = parseFloat(extractTag(unitBlock, 'ScaleFactorToMm') || '1.0');

    const document: QifDocument = {
      qifDocumentId: docId,
      header: { title, author, organization: org, timestamp, schemaVersion: '3.0' },
      plan: {
        planId,
        designAuthorityId: daId,
        revisionId: revId,
        features,
        characteristics,
        unitSystem: { lengthUnit, angleUnit, scaleFactorToMm },
        planHash: rawXmlHash
      },
      results
    };

    return {
      success: errors.length === 0,
      document,
      errors,
      warnings,
      entityCount: features.length + characteristics.length + results.length,
      rawXmlHash
    };
  }
}
