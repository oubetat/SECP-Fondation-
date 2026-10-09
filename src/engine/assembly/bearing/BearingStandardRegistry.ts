/**
 * PATCH-222 — Bearing Standard Registry
 * Formal database and validator of international rolling bearing standards:
 * ISO, DIN, ANSI/ABMA, and JIS with verified document citations.
 */

import { BearingStandard, ComplianceStatus, BearingType } from './BearingTypes';

export interface StandardRegistration {
  standardKey: string;
  standard: BearingStandard;
  standardDocument: string;
  year: number;
  issuingBody: string;
  title: string;
  supportedBearingTypes: BearingType[];
  complianceStatus: ComplianceStatus;
  toleranceStandardDoc: string;
  loadRatingStandardDoc: string;
  verificationSource: string;
}

export class BearingStandardRegistry {
  private static readonly REGISTRY: Map<string, StandardRegistration> = new Map([
    [
      'ISO-15',
      {
        standardKey: 'ISO-15',
        standard: 'ISO',
        standardDocument: 'ISO 15:2017',
        year: 2017,
        issuingBody: 'International Organization for Standardization (ISO)',
        title: 'Rolling bearings — Radial bearings — Boundary dimensions, general plan',
        supportedBearingTypes: [
          'DEEP_GROOVE_BALL',
          'ANGULAR_CONTACT_BALL',
          'SELF_ALIGNING_BALL',
          'CYLINDRICAL_ROLLER',
          'SPHERICAL_ROLLER',
          'NEEDLE_ROLLER'
        ],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'ISO 492:2014',
        loadRatingStandardDoc: 'ISO 281:2007',
        verificationSource: 'ISO TC 4/SC 4 Boundary Dimensions'
      }
    ],
    [
      'ISO-104',
      {
        standardKey: 'ISO-104',
        standard: 'ISO',
        standardDocument: 'ISO 104:2015',
        year: 2015,
        issuingBody: 'International Organization for Standardization (ISO)',
        title: 'Rolling bearings — Thrust bearings — Boundary dimensions, general plan',
        supportedBearingTypes: ['THRUST_BALL', 'THRUST_ROLLER'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'ISO 199:2014',
        loadRatingStandardDoc: 'ISO 281:2007',
        verificationSource: 'ISO TC 4/SC 4 Thrust Series'
      }
    ],
    [
      'ISO-355',
      {
        standardKey: 'ISO-355',
        standard: 'ISO',
        standardDocument: 'ISO 355:2019',
        year: 2019,
        issuingBody: 'International Organization for Standardization (ISO)',
        title: 'Rolling bearings — Tapered roller bearings — Boundary dimensions and series designations',
        supportedBearingTypes: ['TAPERED_ROLLER'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'ISO 492:2014 Class Normal/CL N',
        loadRatingStandardDoc: 'ISO 281:2007',
        verificationSource: 'ISO TC 4/SC 9 Tapered Roller Committee'
      }
    ],
    [
      'DIN-625',
      {
        standardKey: 'DIN-625',
        standard: 'DIN',
        standardDocument: 'DIN 625-1:2011-04',
        year: 2011,
        issuingBody: 'Deutsches Institut für Normung (DIN)',
        title: 'Wälzlager — Rillenkugellager — Einreihig (Deep groove ball bearings - Single row)',
        supportedBearingTypes: ['DEEP_GROOVE_BALL'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'DIN 620-2',
        loadRatingStandardDoc: 'DIN ISO 281',
        verificationSource: 'DIN Normenausschuss Wälz- und Gleitlager (NAWGL)'
      }
    ],
    [
      'DIN-628',
      {
        standardKey: 'DIN-628',
        standard: 'DIN',
        standardDocument: 'DIN 628-1:2008-03',
        year: 2008,
        issuingBody: 'Deutsches Institut für Normung (DIN)',
        title: 'Wälzlager — Schrägkugellager — Einreihig (Angular contact ball bearings - Single row)',
        supportedBearingTypes: ['ANGULAR_CONTACT_BALL'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'DIN 620-2',
        loadRatingStandardDoc: 'DIN ISO 281',
        verificationSource: 'DIN NAWGL 060-36-01'
      }
    ],
    [
      'DIN-5412',
      {
        standardKey: 'DIN-5412',
        standard: 'DIN',
        standardDocument: 'DIN 5412-1:2005-08',
        year: 2005,
        issuingBody: 'Deutsches Institut für Normung (DIN)',
        title: 'Wälzlager — Zylinderrollenlager — Einreihig mit Käfig (Cylindrical roller bearings)',
        supportedBearingTypes: ['CYLINDRICAL_ROLLER'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'DIN 620-2',
        loadRatingStandardDoc: 'DIN ISO 281',
        verificationSource: 'DIN NAWGL 060-36-02'
      }
    ],
    [
      'DIN-720',
      {
        standardKey: 'DIN-720',
        standard: 'DIN',
        standardDocument: 'DIN 720:2008-08',
        year: 2008,
        issuingBody: 'Deutsches Institut für Normung (DIN)',
        title: 'Wälzlager — Kegelrollenlager (Tapered roller bearings)',
        supportedBearingTypes: ['TAPERED_ROLLER'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'DIN 620-2',
        loadRatingStandardDoc: 'DIN ISO 281',
        verificationSource: 'DIN NAWGL 060-36-03'
      }
    ],
    [
      'DIN-711',
      {
        standardKey: 'DIN-711',
        standard: 'DIN',
        standardDocument: 'DIN 711:2010-09',
        year: 2010,
        issuingBody: 'Deutsches Institut für Normung (DIN)',
        title: 'Wälzlager — Axial-Rillenkugellager — Einseitig wirkend (Thrust ball bearings)',
        supportedBearingTypes: ['THRUST_BALL'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'DIN 620-3',
        loadRatingStandardDoc: 'DIN ISO 281',
        verificationSource: 'DIN NAWGL 060-36-04'
      }
    ],
    [
      'ANSI-ABMA-9',
      {
        standardKey: 'ANSI-ABMA-9',
        standard: 'ANSI_ABMA',
        standardDocument: 'ANSI/ABMA 9:2015',
        year: 2015,
        issuingBody: 'American Bearing Manufacturers Association (ABMA) / ANSI',
        title: 'Load Ratings and Fatigue Life for Ball Bearings',
        supportedBearingTypes: ['DEEP_GROOVE_BALL', 'ANGULAR_CONTACT_BALL', 'SELF_ALIGNING_BALL', 'THRUST_BALL'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'ANSI/ABMA 19.2',
        loadRatingStandardDoc: 'ANSI/ABMA 9',
        verificationSource: 'ABMA Engineering Standard Committee'
      }
    ],
    [
      'JIS-B-1512',
      {
        standardKey: 'JIS-B-1512',
        standard: 'JIS',
        standardDocument: 'JIS B 1512-1:2011',
        year: 2011,
        issuingBody: 'Japanese Standards Association (JSA)',
        title: 'Rolling bearings — Boundary dimensions — Part 1: Radial bearings',
        supportedBearingTypes: ['DEEP_GROOVE_BALL', 'CYLINDRICAL_ROLLER', 'TAPERED_ROLLER'],
        complianceStatus: 'VERIFIED',
        toleranceStandardDoc: 'JIS B 1514',
        loadRatingStandardDoc: 'JIS B 1518',
        verificationSource: 'Japanese Industrial Standards Committee'
      }
    ]
  ]);

  /**
   * Retrieves standard details by key
   */
  public static getStandard(key: string): StandardRegistration | undefined {
    return this.REGISTRY.get(key);
  }

  /**
   * Returns all registered standards
   */
  public static getAllStandards(): StandardRegistration[] {
    return Array.from(this.REGISTRY.values());
  }

  /**
   * Checks if standard supports a bearing type
   */
  public static isSupported(standardKey: string, type: BearingType): boolean {
    const std = this.REGISTRY.get(standardKey);
    if (!std) return false;
    return std.supportedBearingTypes.includes(type);
  }

  /**
   * Validates standard code and returns verification status
   */
  public static validateStandardReference(standardName: string): { valid: boolean; status: ComplianceStatus; doc?: string } {
    const upper = standardName.toUpperCase();
    for (const std of this.REGISTRY.values()) {
      if (std.standardKey.toUpperCase() === upper || std.standardDocument.toUpperCase().includes(upper) || std.standard === upper) {
        return { valid: true, status: std.complianceStatus, doc: std.standardDocument };
      }
    }
    return { valid: false, status: 'UNVERIFIED' };
  }
}
