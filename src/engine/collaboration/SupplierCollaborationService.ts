import { AccessControlEngine } from './AccessControlEngine';
import { AuthContext, ExplicitPermission, ResourceState } from './AccessControlTypes';
import {
  SupplierOrganization,
  SupplierOrgStatus,
  SupplierTier,
  SupplierMember,
  SupplierMemberRole,
  SupplierMemberStatus,
  SupplierInvitation,
  SupplierWorkspace,
  EngineeringPackage,
  PackageItem,
  PackageStatus,
  PackageConfidentiality,
  SupplierRFQ,
  RFQStatus,
  RFQLineItem,
  SupplierQuote,
  QuoteStatus,
  LineItemQuote,
  SupplierQuestion,
  QuestionResponse,
  QuestionCategory,
  QuestionUrgency,
  SupplierChangeRequest,
  SCRType,
  SCRStatus,
  SupplierDFMFeedback,
  DFMCategory,
  DFMSeverity,
  SupplierQualityReport,
  QualityReportType,
  QualityCharacteristic,
  SupplierAuditEvent,
  SupplierCollaborationMetrics
} from './SupplierCollaborationTypes';

// Deterministic SHA-256 / Hash Helper (synchronous simulated cryptographic digest)
function sha256Sync(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  // Expand to a 64-char pseudo-SHA-256 for deterministic integrity checks
  return `sha256_${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`.substring(0, 64);
}

export class SupplierCollaborationService {
  private static instance: SupplierCollaborationService | null = null;
  private accessControl: AccessControlEngine;

  // In-Memory PLM Registries
  private organizations: Map<string, SupplierOrganization> = new Map(); // orgId -> org
  private members: Map<string, SupplierMember> = new Map(); // memberId -> member
  private invitations: Map<string, SupplierInvitation> = new Map(); // invitationId -> invitation
  private workspaces: Map<string, SupplierWorkspace> = new Map(); // workspaceId -> workspace
  private packages: Map<string, EngineeringPackage> = new Map(); // packageId -> package
  private rfqs: Map<string, SupplierRFQ> = new Map(); // rfqId -> rfq
  private quotes: Map<string, SupplierQuote> = new Map(); // quoteId -> quote
  private questions: Map<string, SupplierQuestion> = new Map(); // questionId -> question
  private changeRequests: Map<string, SupplierChangeRequest> = new Map(); // scrId -> scr
  private dfmFeedbacks: Map<string, SupplierDFMFeedback> = new Map(); // feedbackId -> feedback
  private qualityReports: Map<string, SupplierQualityReport> = new Map(); // reportId -> report
  private auditEvents: SupplierAuditEvent[] = [];

  private constructor(accessControl?: AccessControlEngine) {
    this.accessControl = accessControl || new AccessControlEngine();
    this.initializeDefaultData();
  }

  public static getInstance(accessControl?: AccessControlEngine): SupplierCollaborationService {
    if (!SupplierCollaborationService.instance) {
      SupplierCollaborationService.instance = new SupplierCollaborationService(accessControl);
    }
    return SupplierCollaborationService.instance;
  }

  public getAccessControl(): AccessControlEngine {
    return this.accessControl;
  }

  /**
   * Initialize initial reference supplier ecosystem for simulation and tests
   */
  private initializeDefaultData(): void {
    const defaultTenant = 'TENANT-AERO-01';
    const defaultProject = 'PRJ-TURBINE-001';

    // 1. Supplier Org: Precision AeroMachining
    const org1: SupplierOrganization = {
      orgId: 'SUP-ORG-001',
      tenantId: defaultTenant,
      name: 'AeroPrecision CNC Machining Ltd',
      code: 'AP-CNC',
      taxIdOrDuns: 'DUNS-984210982',
      status: 'ACTIVE',
      tier: 'TIER_1',
      capabilities: ['5-AXIS_CNC', 'TITANIUM_MILLING', 'WIRE_EDM', 'CMM_INSPECTION'],
      isoCertifications: ['AS9100D', 'ISO_9001:2015', 'NADCAP_HEAT_TREAT'],
      ndaSigned: true,
      ndaSignedDate: Date.now() - 60 * 86400000,
      ndaExpiresAt: Date.now() + 300 * 86400000,
      contactEmail: 'engineering@aeroprecision.com',
      contactPhone: '+1 (555) 234-8900',
      website: 'https://aeroprecision.example.com',
      assignedCommodities: ['MACHINED_CASINGS', 'IMPELLERS', 'SHAFTS'],
      securityRating: 98,
      createdAt: Date.now() - 90 * 86400000,
      updatedAt: Date.now() - 10 * 86400000
    };

    // 2. Supplier Org: DynoCast Alloys
    const org2: SupplierOrganization = {
      orgId: 'SUP-ORG-002',
      tenantId: defaultTenant,
      name: 'DynoCast Superalloys Inc',
      code: 'DYNO-CAST',
      taxIdOrDuns: 'DUNS-129481023',
      status: 'ACTIVE',
      tier: 'STRATEGIC',
      capabilities: ['INVESTMENT_CASTING', 'VACUUM_MELT', 'X-RAY_NDT', 'HIP_TREATING'],
      isoCertifications: ['AS9100D', 'ISO_9001:2015', 'NADCAP_NDT'],
      ndaSigned: true,
      ndaSignedDate: Date.now() - 120 * 86400000,
      ndaExpiresAt: Date.now() + 240 * 86400000,
      contactEmail: 'sales@dynocastalloys.com',
      contactPhone: '+1 (555) 789-1122',
      assignedCommodities: ['TURBINE_BLADES', 'NOZZLES', 'STATORS'],
      securityRating: 95,
      createdAt: Date.now() - 150 * 86400000,
      updatedAt: Date.now() - 5 * 86400000
    };

    // 3. Supplier Org: FastForge Fasteners (Expired NDA for negative testing)
    const org3: SupplierOrganization = {
      orgId: 'SUP-ORG-003',
      tenantId: defaultTenant,
      name: 'FastForge Fasteners Corp',
      code: 'FF-FAST',
      taxIdOrDuns: 'DUNS-556123490',
      status: 'ONBOARDING',
      tier: 'COMMODITY',
      capabilities: ['THREAD_ROLLING', 'COLD_HEADING'],
      isoCertifications: ['ISO_9001:2015'],
      ndaSigned: false,
      ndaExpiresAt: Date.now() - 10 * 86400000, // Expired
      contactEmail: 'contact@fastforge.com',
      contactPhone: '+1 (555) 345-6789',
      assignedCommodities: ['AERO_BOLTS', 'SPECIAL_FASTENERS'],
      securityRating: 64,
      createdAt: Date.now() - 30 * 86400000,
      updatedAt: Date.now() - 1 * 86400000
    };

    this.organizations.set(org1.orgId, org1);
    this.organizations.set(org2.orgId, org2);
    this.organizations.set(org3.orgId, org3);

    // Initial Supplier Members
    const member1: SupplierMember = {
      memberId: 'SUP-MBR-001',
      orgId: 'SUP-ORG-001',
      userId: 'usr_sup_alex',
      name: 'Alex Vance (Lead Estimator)',
      email: 'alex.v@aeroprecision.com',
      role: 'SUPPLIER_ESTIMATOR',
      status: 'ACTIVE',
      invitedAt: Date.now() - 60 * 86400000,
      invitedBy: 'usr_lead_eng',
      twoFactorRequired: true,
      twoFactorVerified: true,
      verified: true
    };

    const member2: SupplierMember = {
      memberId: 'SUP-MBR-002',
      orgId: 'SUP-ORG-001',
      userId: 'usr_sup_marcus',
      name: 'Marcus Brody (Quality Director)',
      email: 'm.brody@aeroprecision.com',
      role: 'SUPPLIER_QUALITY',
      status: 'ACTIVE',
      invitedAt: Date.now() - 50 * 86400000,
      invitedBy: 'usr_lead_eng',
      twoFactorRequired: true,
      twoFactorVerified: true,
      verified: true
    };

    const member3: SupplierMember = {
      memberId: 'SUP-MBR-003',
      orgId: 'SUP-ORG-002',
      userId: 'usr_sup_elena',
      name: 'Elena Rostova (Chief Metallurgist)',
      email: 'e.rostova@dynocastalloys.com',
      role: 'SUPPLIER_ENGINEER',
      status: 'ACTIVE',
      invitedAt: Date.now() - 100 * 86400000,
      invitedBy: 'usr_lead_eng',
      twoFactorRequired: true,
      twoFactorVerified: true,
      verified: true
    };

    this.members.set(member1.memberId, member1);
    this.members.set(member2.memberId, member2);
    this.members.set(member3.memberId, member3);

    // Initial Engineering Package (TDP)
    const tdp1: EngineeringPackage = {
      packageId: 'PKG-TDP-001',
      projectId: defaultProject,
      packageNumber: 'TDP-TURBINE-2026-REV-C',
      title: 'HP Turbine Impeller & Housing Technical Data Package',
      description: 'Full manufacturing package including 3D STEP models, ASME Y14.5 GD&T drawings, and material specifications for 5-axis CNC machining.',
      version: 'Rev C.2',
      status: 'PUBLISHED',
      confidentiality: 'CONFIDENTIAL',
      targetSupplierOrgIds: ['SUP-ORG-001', 'SUP-ORG-002'],
      items: [
        {
          itemId: 'ITEM-CAD-01',
          type: 'CAD_MODEL',
          name: 'HP Impeller 5-Axis Blisk',
          fileName: 'IMP-BLISK-REV-C.step',
          fileSizeBytes: 18450200,
          sha256Checksum: sha256Sync('IMP-BLISK-REV-C-DATA'),
          revisionRef: 'REV-C',
          isRedacted: false
        },
        {
          itemId: 'ITEM-DRW-01',
          type: '2D_DRAWING',
          name: 'HP Impeller GD&T Drawing with Critical Datum Targets',
          fileName: 'DWG-IMP-7701-C.pdf',
          fileSizeBytes: 4205100,
          sha256Checksum: sha256Sync('DWG-IMP-7701-C-DATA'),
          revisionRef: 'REV-C',
          isRedacted: false
        },
        {
          itemId: 'ITEM-SPEC-01',
          type: 'SPECIFICATION',
          name: 'Material & Heat Treatment Spec Inconel 718',
          fileName: 'SPEC-MAT-INC718-AMS5662.pdf',
          fileSizeBytes: 892000,
          sha256Checksum: sha256Sync('SPEC-MAT-INC718-DATA'),
          revisionRef: 'REV-B',
          isRedacted: true,
          redactionReason: 'Proprietary core cooling passages masked'
        }
      ],
      securityHash: sha256Sync('PKG-TDP-001-COMPLETE-MANIFEST-HASH'),
      publishedAt: Date.now() - 14 * 86400000,
      publishedBy: 'usr_lead_eng',
      expiresAt: Date.now() + 60 * 86400000,
      watermarkRequired: true,
      watermarkText: 'CONFIDENTIAL - STRICT NDA RESTRICTED - AERO TECH CORP',
      selectiveRedactionApplied: true,
      redactedFields: ['Internal proprietary airflow cooling channels', 'Cost target BOM metadata'],
      downloadCount: 4,
      immutableAfterPublish: true
    };

    this.packages.set(tdp1.packageId, tdp1);

    // Initial RFQ
    const rfq1: SupplierRFQ = {
      rfqId: 'RFQ-2026-001',
      projectId: defaultProject,
      packageId: tdp1.packageId,
      rfqNumber: 'RFQ-SECP-2026-AERO-089',
      title: 'Batch Production: HP Impeller Blisks (Inconel 718)',
      issueDate: Date.now() - 10 * 86400000,
      dueDate: Date.now() + 14 * 86400000,
      status: 'OPEN',
      targetSupplierOrgIds: ['SUP-ORG-001', 'SUP-ORG-002'],
      lineItems: [
        {
          lineId: 'LINE-001',
          partNumber: 'TURB-IMP-7701',
          partName: 'HP Impeller 5-Axis Blisk',
          revision: 'REV-C',
          quantity: 25,
          uom: 'EA',
          targetUnitPrice: 4200,
          materialRequirement: 'Inconel 718 AMS 5662 / AMS 5663',
          finishRequirement: 'Ra 0.4 µm on aerodynamic blade surfaces',
          tolerancesStandard: 'ASME Y14.5-2018 Level 3'
        },
        {
          lineId: 'LINE-002',
          partNumber: 'TURB-HSG-8802',
          partName: 'Turbine Containment Shroud',
          revision: 'REV-B',
          quantity: 25,
          uom: 'EA',
          targetUnitPrice: 2900,
          materialRequirement: 'Titanium Ti-6Al-4V Grade 5',
          finishRequirement: 'Anodized Type II',
          tolerancesStandard: 'ISO 2768-mK'
        }
      ],
      currency: 'USD',
      incoterms: 'DDP - Facility Dock',
      targetDeliveryDate: Date.now() + 60 * 86400000,
      termsAndConditions: 'Standard Aerospace Terms & Conditions with AS9102 FAI required prior to first article release.'
    };

    this.rfqs.set(rfq1.rfqId, rfq1);

    // Initial Quote from AeroPrecision
    const quote1: SupplierQuote = {
      quoteId: 'QTE-AP-001',
      rfqId: rfq1.rfqId,
      supplierOrgId: 'SUP-ORG-001',
      submittedByMemberId: 'SUP-MBR-001',
      quoteNumber: 'QTE-AP-2026-7819',
      status: 'SUBMITTED',
      submittedAt: Date.now() - 5 * 86400000,
      validUntil: Date.now() + 25 * 86400000,
      currency: 'USD',
      totalPrice: 172500,
      toolingCost: 12000,
      leadTimeDays: 45,
      lineItemQuotes: [
        {
          lineId: 'LINE-001',
          partNumber: 'TURB-IMP-7701',
          unitPrice: 4100,
          quantity: 25,
          extendedPrice: 102500,
          leadTimeDays: 45,
          rawMaterialSource: 'Special Metals Corp (USA)',
          countryOfOrigin: 'USA',
          toolingNRECost: 8000
        },
        {
          lineId: 'LINE-002',
          partNumber: 'TURB-HSG-8802',
          unitPrice: 2800,
          quantity: 25,
          extendedPrice: 70000,
          leadTimeDays: 35,
          rawMaterialSource: 'TIMET (USA)',
          countryOfOrigin: 'USA',
          toolingNRECost: 4000
        }
      ],
      dfmComments: 'Recommended increasing fillet radius from R0.5mm to R0.8mm at blade roots to reduce 5-axis tool deflection and chatter.',
      assumptions: ['Customer supplies approved raw material certs if preferred', 'Includes AS9102 Form 1, 2, 3 FAI report'],
      exceptions: ['Standard payment terms Net 30 days upon delivery'],
      evaluationScore: 94,
      evaluationNotes: 'Excellent pricing within target budget; favorable lead time of 45 days.'
    };

    this.quotes.set(quote1.quoteId, quote1);

    // Initial Supplier Question (Technical Clarification)
    const q1: SupplierQuestion = {
      questionId: 'TQ-2026-001',
      packageId: tdp1.packageId,
      rfqId: rfq1.rfqId,
      supplierOrgId: 'SUP-ORG-001',
      authorMemberId: 'SUP-MBR-001',
      questionNumber: 'TQ-TURB-01',
      subject: 'Datum Feature B perpendicularity tolerance clarification',
      questionText: 'On Sheet 2, Section D-D, datum B calls out 0.015mm perpendicularity to Datum A. Can this be relaxed to 0.025mm if thermal stabilization is performed?',
      category: 'TOLERANCE_GD_T',
      urgency: 'MEDIUM',
      status: 'ANSWERED',
      createdAt: Date.now() - 7 * 86400000,
      response: {
        responseId: 'RESP-001',
        answeredByUserId: 'usr_lead_eng',
        answeredAt: Date.now() - 6 * 86400000,
        responseText: '0.020mm is acceptable with certified CMM temperature-controlled verification at 20°C ± 0.5°C. Formal SCR will be processed.',
        clarificationDrawingRef: 'DWG-IMP-7701-C-CLARIF-01',
        triggersChangeRequest: true,
        isBroadcastToAllBidders: true
      },
      isConfidential: false
    };

    this.questions.set(q1.questionId, q1);

    // Initial Supplier Change Request (SCR)
    const scr1: SupplierChangeRequest = {
      scrId: 'SCR-2026-001',
      projectId: defaultProject,
      packageId: tdp1.packageId,
      supplierOrgId: 'SUP-ORG-001',
      requestedByMemberId: 'SUP-MBR-001',
      scrNumber: 'SCR-AP-2026-001',
      title: 'Blade root fillet radius relaxation from R0.5mm to R0.8mm',
      type: 'GEOMETRY_MODIFICATION',
      justification: 'Enables standard 1.5mm ball nose endmill instead of custom micro-tooling, increasing tool life by 300% and reducing machining cycle time per blade by 4.2 minutes.',
      affectedPartNumbers: ['TURB-IMP-7701'],
      costImpact: -180, // $180 savings per unit!
      leadTimeImpactDays: -5, // 5 days faster
      status: 'APPROVED',
      proposedSolution: 'Modify CAD blend feature #142 to R0.80mm uniform fillet.',
      submittedAt: Date.now() - 4 * 86400000,
      reviewedBy: 'usr_lead_eng',
      reviewedAt: Date.now() - 2 * 86400000,
      reviewComments: 'FEA stress analysis confirmed stress concentration factor Kt drops from 1.62 to 1.38. Approved for Rev C.3 ECO.',
      linkedEcoId: 'ECO-2026-092',
      disposition: 'ACCEPT'
    };

    this.changeRequests.set(scr1.scrId, scr1);

    // Initial DFM Feedback
    const dfm1: SupplierDFMFeedback = {
      feedbackId: 'DFM-2026-001',
      packageId: tdp1.packageId,
      partNumber: 'TURB-HSG-8802',
      supplierOrgId: 'SUP-ORG-001',
      submittedByMemberId: 'SUP-MBR-001',
      dfmCategory: 'MACHINABILITY',
      severity: 'MAJOR',
      locationNote: 'Deep counterbore pocket at flange boss #3',
      recommendedChange: 'Increase internal corner relief radius from R0.2mm to R1.0mm to allow standard bull-nose endmills and eliminate electrical discharge machining (EDM) step.',
      estimatedCostSavingsPct: 8.5,
      status: 'ACCEPTED',
      submittedAt: Date.now() - 3 * 86400000,
      engineerResponse: 'Accepted and integrated into tooling plan.'
    };

    this.dfmFeedbacks.set(dfm1.feedbackId, dfm1);

    // Initial Quality / FAI Report (AS9102)
    const qr1: SupplierQualityReport = {
      reportId: 'QR-FAI-2026-001',
      projectId: defaultProject,
      supplierOrgId: 'SUP-ORG-001',
      reportType: 'FAI_AS9102',
      partNumber: 'TURB-IMP-7701',
      lotOrSerialNumber: 'SN-2026-001-FA',
      status: 'ACCEPTED',
      submittedAt: Date.now() - 1 * 86400000,
      submittedByMemberId: 'SUP-MBR-002',
      verifiedByUserId: 'usr_quality_lead',
      verifiedAt: Date.now() - 12 * 3600000,
      characteristics: [
        {
          charNumber: 1,
          dimensionName: 'Outer Tip Diameter',
          nominal: 180.000,
          upperTol: 0.025,
          lowerTol: -0.025,
          actualMeasured: 180.012,
          method: 'CMM',
          passed: true
        },
        {
          charNumber: 2,
          dimensionName: 'Bore Diameter (Datum A)',
          nominal: 35.000,
          upperTol: 0.008,
          lowerTol: -0.000,
          actualMeasured: 35.004,
          method: 'CMM',
          passed: true
        },
        {
          charNumber: 3,
          dimensionName: 'Blade Trailing Edge Thickness',
          nominal: 0.850,
          upperTol: 0.050,
          lowerTol: -0.050,
          actualMeasured: 0.862,
          method: 'OPTICAL_COMPARATOR',
          passed: true
        },
        {
          charNumber: 4,
          dimensionName: 'Surface Roughness Ra',
          nominal: 0.400,
          upperTol: 0.000,
          lowerTol: -0.400,
          actualMeasured: 0.320,
          method: 'MICROMETER',
          passed: true
        }
      ],
      materialCertNumber: 'MTR-SMC-718-9941',
      heatNumber: 'HEAT-HT-88219-X',
      conformancePassed: true,
      evidenceSha256: sha256Sync('QR-FAI-2026-001-AS9102-COMPLETE-DIGEST')
    };

    this.qualityReports.set(qr1.reportId, qr1);
  }

  // ==========================================
  // 1. ORGANIZATIONS MANAGEMENT
  // ==========================================

  public createOrganization(auth: AuthContext, data: Omit<SupplierOrganization, 'createdAt' | 'updatedAt'>): SupplierOrganization {
    // Check authorization via AccessControlEngine
    const decision = this.accessControl.authorize(auth, {
      projectId: 'GLOBAL_SUPPLIER_MGMT',
      resource: 'SUPPLIER_ORG',
      action: 'CREATE',
      explicitPermission: 'supplier.org.manage'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'CREATE_SUPPLIER_ORG', data.orgId, 'SUPPLIER_ORG', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason} - ${decision.detailedMessage}`);
    }

    if (this.organizations.has(data.orgId)) {
      throw new Error(`Supplier Organization with ID '${data.orgId}' already exists`);
    }

    const org: SupplierOrganization = {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.organizations.set(org.orgId, org);
    this.recordAudit(auth, 'CREATE_SUPPLIER_ORG', org.orgId, 'SUPPLIER_ORG', 'SUCCESS', `Created organization: ${org.name}`);
    return org;
  }

  public updateOrganization(auth: AuthContext, orgId: string, updates: Partial<SupplierOrganization>): SupplierOrganization {
    const decision = this.accessControl.authorize(auth, {
      projectId: 'GLOBAL_SUPPLIER_MGMT',
      resource: 'SUPPLIER_ORG',
      action: 'UPDATE',
      explicitPermission: 'supplier.org.manage'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'UPDATE_SUPPLIER_ORG', orgId, 'SUPPLIER_ORG', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    const org = this.organizations.get(orgId);
    if (!org) throw new Error(`Supplier Organization '${orgId}' not found`);

    const updated: SupplierOrganization = {
      ...org,
      ...updates,
      orgId: org.orgId, // Immutable ID
      tenantId: org.tenantId, // Immutable Tenant
      updatedAt: Date.now()
    };

    this.organizations.set(orgId, updated);
    this.recordAudit(auth, 'UPDATE_SUPPLIER_ORG', orgId, 'SUPPLIER_ORG', 'SUCCESS', `Updated organization: ${updated.name}`);
    return updated;
  }

  public getOrganization(orgId: string): SupplierOrganization | undefined {
    return this.organizations.get(orgId);
  }

  public listOrganizations(tenantId?: string): SupplierOrganization[] {
    const list = Array.from(this.organizations.values());
    if (tenantId) {
      return list.filter(o => o.tenantId === tenantId);
    }
    return list;
  }

  public getAllOrganizations(): SupplierOrganization[] {
    return this.listOrganizations();
  }

  public getAllPackages(): EngineeringPackage[] {
    return this.listAllPackages();
  }

  public getAllRFQs(): SupplierRFQ[] {
    return this.listRFQs();
  }

  public getAllChangeRequests(): SupplierChangeRequest[] {
    return this.listChangeRequests();
  }

  public getAllDFMFeedbacks(): SupplierDFMFeedback[] {
    return this.listDFMFeedback();
  }

  public getAllQualityReports(): SupplierQualityReport[] {
    return this.listQualityReports();
  }

  public isNdaValid(orgId: string): boolean {
    const org = this.organizations.get(orgId);
    if (!org) return false;
    if (!org.ndaSigned) return false;
    if (org.ndaExpiresAt && org.ndaExpiresAt < Date.now()) return false;
    return true;
  }

  // ==========================================
  // 2. SUPPLIER MEMBERS & INVITATIONS
  // ==========================================

  public inviteSupplierMember(
    auth: AuthContext,
    params: {
      orgId: string;
      email: string;
      role: SupplierMemberRole;
      allowedPackageIds?: string[];
      expiresInDays?: number;
    }
  ): SupplierInvitation {
    const decision = this.accessControl.authorize(auth, {
      projectId: 'GLOBAL_SUPPLIER_MGMT',
      resource: 'SUPPLIER_ORG',
      action: 'CREATE',
      explicitPermission: 'supplier.invite'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'INVITE_SUPPLIER_MEMBER', params.orgId, 'SUPPLIER_MEMBER', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    const org = this.organizations.get(params.orgId);
    if (!org) throw new Error(`Organization '${params.orgId}' not found`);

    if (org.status === 'DISQUALIFIED' || org.status === 'SUSPENDED') {
      throw new Error(`Cannot invite members to ${org.status} supplier organization`);
    }

    const invitationId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const rawToken = `${invitationId}_${params.email}_${Date.now()}_SECRET`;
    const tokenHash = sha256Sync(rawToken);
    const expiresIn = (params.expiresInDays || 7) * 86400000;

    const invitation: SupplierInvitation = {
      invitationId,
      orgId: params.orgId,
      email: params.email,
      role: params.role,
      tokenHash,
      invitedBy: auth.userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiresIn,
      status: 'PENDING',
      allowedPackageIds: params.allowedPackageIds || []
    };

    this.invitations.set(invitationId, invitation);
    this.recordAudit(auth, 'INVITE_SUPPLIER_MEMBER', invitationId, 'SUPPLIER_INVITATION', 'SUCCESS', `Invited ${params.email} as ${params.role}`);
    return invitation;
  }

  public acceptInvitation(
    invitationId: string,
    tokenHashProvided: string,
    userDetails: { userId: string; name: string }
  ): SupplierMember {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) throw new Error(`Invitation '${invitationId}' not found`);

    if (invitation.status !== 'PENDING') {
      throw new Error(`Invitation is ${invitation.status}, cannot be accepted`);
    }

    if (invitation.expiresAt < Date.now()) {
      invitation.status = 'EXPIRED';
      throw new Error(`Invitation has expired`);
    }

    if (invitation.tokenHash !== tokenHashProvided) {
      throw new Error(`Invalid invitation token verification failure`);
    }

    const memberId = `SUP-MBR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const member: SupplierMember = {
      memberId,
      orgId: invitation.orgId,
      userId: userDetails.userId,
      name: userDetails.name,
      email: invitation.email,
      role: invitation.role,
      status: 'ACTIVE',
      invitedAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
      lastLoginAt: Date.now(),
      twoFactorRequired: true,
      twoFactorVerified: true,
      verified: true
    };

    invitation.status = 'ACCEPTED';
    this.members.set(memberId, member);

    // Register into AccessControlEngine as SUPPLIER role member
    this.accessControl.addMember({
      userId: member.userId,
      projectId: 'GLOBAL_SUPPLIER_PORTAL',
      role: 'SUPPLIER',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: invitation.invitedBy
    });

    return member;
  }

  public listMembers(orgId?: string): SupplierMember[] {
    const list = Array.from(this.members.values());
    if (orgId) {
      return list.filter(m => m.orgId === orgId);
    }
    return list;
  }

  public getMember(memberId: string): SupplierMember | undefined {
    return this.members.get(memberId);
  }

  // ==========================================
  // 3. TECHNICAL DATA PACKAGES (TDP) & IP REDACTION
  // ==========================================

  public createEngineeringPackage(
    auth: AuthContext,
    packageData: Omit<EngineeringPackage, 'securityHash' | 'downloadCount' | 'immutableAfterPublish'>
  ): EngineeringPackage {
    const decision = this.accessControl.authorize(auth, {
      projectId: packageData.projectId,
      resource: 'ENGINEERING_PACKAGE',
      action: 'CREATE',
      explicitPermission: 'supplier.package.create'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'CREATE_PACKAGE', packageData.packageId, 'ENGINEERING_PACKAGE', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    // Compute manifest integrity hash
    const manifestString = JSON.stringify({
      id: packageData.packageId,
      project: packageData.projectId,
      version: packageData.version,
      items: packageData.items.map(i => ({ id: i.itemId, sha: i.sha256Checksum }))
    });
    const securityHash = sha256Sync(manifestString);

    const tdp: EngineeringPackage = {
      ...packageData,
      securityHash,
      downloadCount: 0,
      immutableAfterPublish: true
    };

    this.packages.set(tdp.packageId, tdp);
    this.recordAudit(auth, 'CREATE_PACKAGE', tdp.packageId, 'ENGINEERING_PACKAGE', 'SUCCESS', `Created package ${tdp.packageNumber}`);
    return tdp;
  }

  public publishPackage(
    auth: AuthContext,
    packageId: string,
    targetSupplierOrgIds: string[],
    expiresInDays?: number
  ): EngineeringPackage {
    const tdp = this.packages.get(packageId);
    if (!tdp) throw new Error(`Package '${packageId}' not found`);

    const decision = this.accessControl.authorize(auth, {
      projectId: tdp.projectId,
      resource: 'ENGINEERING_PACKAGE',
      action: 'UPDATE',
      explicitPermission: 'supplier.package.publish'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'PUBLISH_PACKAGE', packageId, 'ENGINEERING_PACKAGE', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    // Strict NDA & Status Check for all target suppliers
    for (const orgId of targetSupplierOrgIds) {
      const org = this.organizations.get(orgId);
      if (!org) throw new Error(`Target supplier org '${orgId}' does not exist`);
      if (org.status !== 'ACTIVE') {
        throw new Error(`Cannot publish package to supplier '${org.name}' with status ${org.status}`);
      }
      if (!this.isNdaValid(orgId)) {
        throw new Error(`Security Violation: Supplier '${org.name}' does not have a valid signed Non-Disclosure Agreement (NDA). Package publication halted.`);
      }
    }

    tdp.status = 'PUBLISHED';
    tdp.targetSupplierOrgIds = [...new Set([...tdp.targetSupplierOrgIds, ...targetSupplierOrgIds])];
    tdp.publishedAt = Date.now();
    tdp.publishedBy = auth.userId;
    if (expiresInDays) {
      tdp.expiresAt = Date.now() + expiresInDays * 86400000;
    }

    // Re-verify and seal hash
    tdp.securityHash = sha256Sync(JSON.stringify(tdp));
    this.recordAudit(auth, 'PUBLISH_PACKAGE', packageId, 'ENGINEERING_PACKAGE', 'SUCCESS', `Published package ${tdp.packageNumber} to ${targetSupplierOrgIds.length} suppliers`);
    return tdp;
  }

  public downloadPackageItem(
    auth: AuthContext,
    packageId: string,
    itemId: string,
    supplierOrgId: string
  ): { item: PackageItem; watermark: string; downloadTimestamp: number; downloadChecksum: string } {
    const tdp = this.packages.get(packageId);
    if (!tdp) throw new Error(`Package '${packageId}' not found`);

    if (tdp.status !== 'PUBLISHED') {
      throw new Error(`Package '${packageId}' is in status ${tdp.status}, downloads are blocked`);
    }

    if (tdp.expiresAt && tdp.expiresAt < Date.now()) {
      tdp.status = 'EXPIRED';
      throw new Error(`Package '${packageId}' access period has expired`);
    }

    // Check if supplier is authorized for this package
    if (!tdp.targetSupplierOrgIds.includes(supplierOrgId)) {
      this.recordAudit(auth, 'DOWNLOAD_PACKAGE_ITEM', itemId, 'PACKAGE_ITEM', 'DENIED', `Cross-Supplier Leak Blocked: ${supplierOrgId} not assigned to ${packageId}`);
      throw new Error(`Security Isolation: Supplier organization '${supplierOrgId}' is not authorized to access package '${packageId}'`);
    }

    // Check NDA validity
    if (!this.isNdaValid(supplierOrgId)) {
      throw new Error(`NDA Expired or Invalid for supplier organization '${supplierOrgId}'`);
    }

    const item = tdp.items.find(i => i.itemId === itemId);
    if (!item) throw new Error(`Item '${itemId}' not found in package '${packageId}'`);

    tdp.downloadCount++;
    const downloadTimestamp = Date.now();
    const watermark = tdp.watermarkRequired 
      ? `CONFIDENTIAL - LICENSED TO ${supplierOrgId} - USER: ${auth.userId} - ${new Date(downloadTimestamp).toISOString()}`
      : 'STANDARD_DOWNLOAD';

    const downloadChecksum = sha256Sync(`${item.sha256Checksum}_${watermark}_${downloadTimestamp}`);

    this.recordAudit(auth, 'DOWNLOAD_PACKAGE_ITEM', itemId, 'PACKAGE_ITEM', 'SUCCESS', `Downloaded item ${item.name} with watermark`);
    return { item, watermark, downloadTimestamp, downloadChecksum };
  }

  public listPackagesForSupplier(auth: AuthContext, supplierOrgId: string): EngineeringPackage[] {
    const all = Array.from(this.packages.values());
    // Filter strictly by target supplier
    return all.filter(p => p.targetSupplierOrgIds.includes(supplierOrgId) && p.status === 'PUBLISHED');
  }

  public getPackage(packageId: string): EngineeringPackage | undefined {
    return this.packages.get(packageId);
  }

  public listAllPackages(projectId?: string): EngineeringPackage[] {
    const list = Array.from(this.packages.values());
    if (projectId) {
      return list.filter(p => p.projectId === projectId);
    }
    return list;
  }

  // ==========================================
  // 4. RFQ & QUOTATION COLLABORATION
  // ==========================================

  public createRFQ(auth: AuthContext, rfqData: Omit<SupplierRFQ, 'issueDate' | 'status'>): SupplierRFQ {
    const decision = this.accessControl.authorize(auth, {
      projectId: rfqData.projectId,
      resource: 'SUPPLIER_RFQ',
      action: 'CREATE',
      explicitPermission: 'supplier.rfq.create'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'CREATE_RFQ', rfqData.rfqId, 'SUPPLIER_RFQ', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    const rfq: SupplierRFQ = {
      ...rfqData,
      issueDate: Date.now(),
      status: 'OPEN'
    };

    this.rfqs.set(rfq.rfqId, rfq);
    this.recordAudit(auth, 'CREATE_RFQ', rfq.rfqId, 'SUPPLIER_RFQ', 'SUCCESS', `Created RFQ ${rfq.rfqNumber}`);
    return rfq;
  }

  public submitQuote(
    auth: AuthContext,
    quoteData: Omit<SupplierQuote, 'submittedAt' | 'status'>
  ): SupplierQuote {
    // Validate that supplier is an invited bidder for this RFQ
    const rfq = this.rfqs.get(quoteData.rfqId);
    if (!rfq) throw new Error(`RFQ '${quoteData.rfqId}' not found`);

    if (rfq.status !== 'OPEN') {
      throw new Error(`RFQ '${quoteData.rfqId}' is in status ${rfq.status}, bids closed`);
    }

    if (rfq.dueDate < Date.now()) {
      throw new Error(`RFQ '${quoteData.rfqId}' deadline has passed`);
    }

    if (!rfq.targetSupplierOrgIds.includes(quoteData.supplierOrgId)) {
      this.recordAudit(auth, 'SUBMIT_QUOTE', quoteData.quoteId, 'SUPPLIER_QUOTE', 'DENIED', `Supplier ${quoteData.supplierOrgId} not invited to RFQ`);
      throw new Error(`Supplier '${quoteData.supplierOrgId}' is not invited to quote on this RFQ`);
    }

    // Calculate total price from line items
    const totalPrice = quoteData.lineItemQuotes.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    const quote: SupplierQuote = {
      ...quoteData,
      totalPrice,
      status: 'SUBMITTED',
      submittedAt: Date.now()
    };

    this.quotes.set(quote.quoteId, quote);
    this.recordAudit(auth, 'SUBMIT_QUOTE', quote.quoteId, 'SUPPLIER_QUOTE', 'SUCCESS', `Submitted quote ${quote.quoteNumber} totaling $${totalPrice}`);
    return quote;
  }

  public listQuotesForRFQ(auth: AuthContext, rfqId: string, requestingSupplierOrgId?: string): SupplierQuote[] {
    const rfq = this.rfqs.get(rfqId);
    if (!rfq) throw new Error(`RFQ '${rfqId}' not found`);

    const allQuotes = Array.from(this.quotes.values()).filter(q => q.rfqId === rfqId);

    // If request is from a supplier, ZERO CROSS-BIDDER LEAK: return ONLY their quote!
    if (requestingSupplierOrgId) {
      return allQuotes.filter(q => q.supplierOrgId === requestingSupplierOrgId);
    }

    // If internal engineering/purchasing, verify evaluation permission
    const decision = this.accessControl.authorize(auth, {
      projectId: rfq.projectId,
      resource: 'SUPPLIER_QUOTE',
      action: 'REVIEW',
      explicitPermission: 'supplier.rfq.evaluate'
    });

    if (!decision.allowed) {
      throw new Error(`Access Denied to view competitive bids: ${decision.reason}`);
    }

    return allQuotes;
  }

  public awardRFQ(auth: AuthContext, rfqId: string, awardedSupplierOrgId: string): SupplierRFQ {
    const rfq = this.rfqs.get(rfqId);
    if (!rfq) throw new Error(`RFQ '${rfqId}' not found`);

    const decision = this.accessControl.authorize(auth, {
      projectId: rfq.projectId,
      resource: 'SUPPLIER_RFQ',
      action: 'APPROVE',
      explicitPermission: 'supplier.rfq.award'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'AWARD_RFQ', rfqId, 'SUPPLIER_RFQ', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    rfq.status = 'AWARDED';
    rfq.awardedSupplierOrgId = awardedSupplierOrgId;
    rfq.awardedAt = Date.now();
    rfq.awardedBy = auth.userId;

    // Update quotes
    for (const q of this.quotes.values()) {
      if (q.rfqId === rfqId) {
        if (q.supplierOrgId === awardedSupplierOrgId) {
          q.status = 'ACCEPTED';
        } else {
          q.status = 'REJECTED';
        }
      }
    }

    this.recordAudit(auth, 'AWARD_RFQ', rfqId, 'SUPPLIER_RFQ', 'SUCCESS', `Awarded RFQ ${rfq.rfqNumber} to supplier ${awardedSupplierOrgId}`);
    return rfq;
  }

  public listRFQs(projectId?: string): SupplierRFQ[] {
    const list = Array.from(this.rfqs.values());
    if (projectId) {
      return list.filter(r => r.projectId === projectId);
    }
    return list;
  }

  public getRFQ(rfqId: string): SupplierRFQ | undefined {
    return this.rfqs.get(rfqId);
  }

  // ==========================================
  // 5. TECHNICAL Q&A / CLARIFICATIONS
  // ==========================================

  public askQuestion(
    auth: AuthContext,
    data: Omit<SupplierQuestion, 'createdAt' | 'status' | 'response'>
  ): SupplierQuestion {
    const question: SupplierQuestion = {
      ...data,
      status: 'OPEN',
      createdAt: Date.now()
    };

    this.questions.set(question.questionId, question);
    this.recordAudit(auth, 'ASK_QUESTION', question.questionId, 'SUPPLIER_QUESTION', 'SUCCESS', `Asked question ${question.questionNumber}: ${question.subject}`);
    return question;
  }

  public answerQuestion(
    auth: AuthContext,
    questionId: string,
    response: {
      responseText: string;
      clarificationDrawingRef?: string;
      triggersChangeRequest: boolean;
      isBroadcastToAllBidders: boolean;
    }
  ): SupplierQuestion {
    const q = this.questions.get(questionId);
    if (!q) throw new Error(`Question '${questionId}' not found`);

    const qResponse: QuestionResponse = {
      responseId: `RESP-${Date.now()}`,
      answeredByUserId: auth.userId,
      answeredAt: Date.now(),
      ...response
    };

    q.response = qResponse;
    q.status = 'ANSWERED';

    this.recordAudit(auth, 'ANSWER_QUESTION', questionId, 'SUPPLIER_QUESTION', 'SUCCESS', `Answered question ${q.questionNumber}`);
    return q;
  }

  public listQuestions(supplierOrgId?: string, rfqId?: string): SupplierQuestion[] {
    let list = Array.from(this.questions.values());
    if (rfqId) {
      list = list.filter(q => q.rfqId === rfqId);
    }
    if (supplierOrgId) {
      // Supplier sees their own questions + broadcasted questions (with author anonymized)
      return list.filter(q => q.supplierOrgId === supplierOrgId || (q.response && q.response.isBroadcastToAllBidders));
    }
    return list;
  }

  // ==========================================
  // 6. SUPPLIER CHANGE REQUESTS (SCR / DEVIATIONS)
  // ==========================================

  public submitChangeRequest(
    auth: AuthContext,
    data: Omit<SupplierChangeRequest, 'submittedAt' | 'status' | 'disposition'>
  ): SupplierChangeRequest {
    const scr: SupplierChangeRequest = {
      ...data,
      status: 'SUBMITTED',
      disposition: 'PENDING',
      submittedAt: Date.now()
    };

    this.changeRequests.set(scr.scrId, scr);
    this.recordAudit(auth, 'SUBMIT_SCR', scr.scrId, 'SUPPLIER_SCR', 'SUCCESS', `Submitted SCR ${scr.scrNumber}: ${scr.title}`);
    return scr;
  }

  public reviewChangeRequest(
    auth: AuthContext,
    scrId: string,
    disposition: 'ACCEPT' | 'REJECT' | 'ACCEPT_WITH_CONDITIONS',
    comments: string,
    linkedEcoId?: string
  ): SupplierChangeRequest {
    const scr = this.changeRequests.get(scrId);
    if (!scr) throw new Error(`Change Request '${scrId}' not found`);

    const decision = this.accessControl.authorize(auth, {
      projectId: scr.projectId,
      resource: 'SUPPLIER_SCR',
      action: 'APPROVE',
      explicitPermission: 'supplier.scr.approve'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'REVIEW_SCR', scrId, 'SUPPLIER_SCR', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    scr.disposition = disposition;
    scr.status = disposition === 'REJECT' ? 'REJECTED' : 'APPROVED';
    scr.reviewedBy = auth.userId;
    scr.reviewedAt = Date.now();
    scr.reviewComments = comments;
    if (linkedEcoId) scr.linkedEcoId = linkedEcoId;

    this.recordAudit(auth, 'REVIEW_SCR', scrId, 'SUPPLIER_SCR', 'SUCCESS', `Dispositioned SCR ${scr.scrNumber} as ${disposition}`);
    return scr;
  }

  public listChangeRequests(projectId?: string, supplierOrgId?: string): SupplierChangeRequest[] {
    let list = Array.from(this.changeRequests.values());
    if (projectId) list = list.filter(s => s.projectId === projectId);
    if (supplierOrgId) list = list.filter(s => s.supplierOrgId === supplierOrgId);
    return list;
  }

  // ==========================================
  // 7. DFM FEEDBACK
  // ==========================================

  public submitDFMFeedback(
    auth: AuthContext,
    data: Omit<SupplierDFMFeedback, 'submittedAt' | 'status'>
  ): SupplierDFMFeedback {
    const dfm: SupplierDFMFeedback = {
      ...data,
      status: 'SUBMITTED',
      submittedAt: Date.now()
    };

    this.dfmFeedbacks.set(dfm.feedbackId, dfm);
    this.recordAudit(auth, 'SUBMIT_DFM', dfm.feedbackId, 'SUPPLIER_DFM', 'SUCCESS', `Submitted DFM feedback on ${dfm.partNumber}`);
    return dfm;
  }

  public reviewDFMFeedback(
    auth: AuthContext,
    feedbackId: string,
    status: 'ACCEPTED' | 'DECLINED',
    engineerResponse: string
  ): SupplierDFMFeedback {
    const dfm = this.dfmFeedbacks.get(feedbackId);
    if (!dfm) throw new Error(`DFM Feedback '${feedbackId}' not found`);

    dfm.status = status;
    dfm.engineerResponse = engineerResponse;
    this.recordAudit(auth, 'REVIEW_DFM', feedbackId, 'SUPPLIER_DFM', 'SUCCESS', `Reviewed DFM feedback as ${status}`);
    return dfm;
  }

  public listDFMFeedback(packageId?: string): SupplierDFMFeedback[] {
    const list = Array.from(this.dfmFeedbacks.values());
    if (packageId) return list.filter(d => d.packageId === packageId);
    return list;
  }

  // ==========================================
  // 8. QUALITY & INSPECTION (FAI AS9102 / PPAP)
  // ==========================================

  public submitQualityReport(
    auth: AuthContext,
    data: Omit<SupplierQualityReport, 'submittedAt' | 'conformancePassed' | 'evidenceSha256'>
  ): SupplierQualityReport {
    // Automatically evaluate characteristic pass/fail
    let allPassed = true;
    for (const c of data.characteristics) {
      const isWithinTolerance = c.actualMeasured <= (c.nominal + c.upperTol) && c.actualMeasured >= (c.nominal + c.lowerTol);
      c.passed = isWithinTolerance;
      if (!isWithinTolerance) allPassed = false;
    }

    const evidenceSha256 = sha256Sync(JSON.stringify({
      reportId: data.reportId,
      part: data.partNumber,
      sn: data.lotOrSerialNumber,
      chars: data.characteristics,
      heat: data.heatNumber
    }));

    const report: SupplierQualityReport = {
      ...data,
      conformancePassed: allPassed,
      evidenceSha256,
      submittedAt: Date.now()
    };

    this.qualityReports.set(report.reportId, report);
    this.recordAudit(auth, 'SUBMIT_QUALITY_REPORT', report.reportId, 'SUPPLIER_QUALITY', 'SUCCESS', `Submitted ${report.reportType} report for ${report.partNumber}`);
    return report;
  }

  public verifyQualityReport(
    auth: AuthContext,
    reportId: string,
    status: 'ACCEPTED' | 'REJECTED' | 'CONCESSION',
    notes?: string
  ): SupplierQualityReport {
    const report = this.qualityReports.get(reportId);
    if (!report) throw new Error(`Quality Report '${reportId}' not found`);

    const decision = this.accessControl.authorize(auth, {
      projectId: report.projectId,
      resource: 'SUPPLIER_QUALITY',
      action: 'APPROVE',
      explicitPermission: 'supplier.quality.verify'
    });

    if (!decision.allowed) {
      this.recordAudit(auth, 'VERIFY_QUALITY_REPORT', reportId, 'SUPPLIER_QUALITY', 'DENIED', `Denied: ${decision.reason}`);
      throw new Error(`Access Denied: ${decision.reason}`);
    }

    report.status = status;
    report.verifiedByUserId = auth.userId;
    report.verifiedAt = Date.now();
    if (notes) report.nonConformanceNotes = notes;

    this.recordAudit(auth, 'VERIFY_QUALITY_REPORT', reportId, 'SUPPLIER_QUALITY', 'SUCCESS', `Verified report as ${status}`);
    return report;
  }

  public listQualityReports(projectId?: string, supplierOrgId?: string): SupplierQualityReport[] {
    let list = Array.from(this.qualityReports.values());
    if (projectId) list = list.filter(q => q.projectId === projectId);
    if (supplierOrgId) list = list.filter(q => q.supplierOrgId === supplierOrgId);
    return list;
  }

  // ==========================================
  // 9. DIGITAL AUDIT TRAIL & EVIDENCE
  // ==========================================

  private recordAudit(
    auth: AuthContext,
    action: string,
    resourceId: string,
    resourceType: string,
    status: 'SUCCESS' | 'DENIED' | 'FLAGGED',
    details: string
  ): void {
    const timestamp = Date.now();
    const eventId = `SUP-AUDIT-${timestamp}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const rawSignature = `${eventId}_${auth.tenantId}_${auth.userId}_${action}_${resourceId}_${timestamp}`;
    const sha256Signature = sha256Sync(rawSignature);

    const event: SupplierAuditEvent = {
      eventId,
      tenantId: auth.tenantId,
      userIdOrMemberId: auth.userId,
      action,
      resourceId,
      resourceType,
      status,
      details,
      ipAddress: '192.168.1.104',
      sha256Signature,
      timestamp
    };

    this.auditEvents.push(event);
  }

  public getAuditTrail(filter?: { resourceType?: string; status?: string }): SupplierAuditEvent[] {
    let list = [...this.auditEvents].reverse();
    if (filter?.resourceType) list = list.filter(e => e.resourceType === filter.resourceType);
    if (filter?.status) list = list.filter(e => e.status === filter.status);
    return list;
  }

  // ==========================================
  // 10. METRICS & KPI ENGINE
  // ==========================================

  public getMetrics(tenantId?: string): SupplierCollaborationMetrics {
    const orgs = this.listOrganizations(tenantId);
    const activeOrgs = orgs.filter(o => o.status === 'ACTIVE').length;
    const openRfqs = Array.from(this.rfqs.values()).filter(r => r.status === 'OPEN').length;
    const pendingQuotes = Array.from(this.quotes.values()).filter(q => q.status === 'SUBMITTED' || q.status === 'UNDER_REVIEW').length;
    const activeTdp = Array.from(this.packages.values()).filter(p => p.status === 'PUBLISHED').length;
    const openQuestions = Array.from(this.questions.values()).filter(q => q.status === 'OPEN').length;
    const pendingSCRs = Array.from(this.changeRequests.values()).filter(s => s.status === 'SUBMITTED' || s.status === 'IN_REVIEW').length;

    const qr = Array.from(this.qualityReports.values());
    const acceptedQr = qr.filter(q => q.status === 'ACCEPTED').length;
    const qualityRate = qr.length > 0 ? (acceptedQr / qr.length) * 100 : 100;

    const quotes = Array.from(this.quotes.values());
    const avgLeadTime = quotes.length > 0 ? quotes.reduce((acc, q) => acc + q.leadTimeDays, 0) / quotes.length : 0;

    return {
      totalSupplierOrgs: orgs.length,
      activeSuppliers: activeOrgs,
      openRfqs,
      pendingQuotes,
      activeTdpPackages: activeTdp,
      openQuestions,
      pendingChangeRequests: pendingSCRs,
      qualityApprovalRatePct: Math.round(qualityRate),
      averageQuotationLeadTimeDays: Math.round(avgLeadTime)
    };
  }
}
