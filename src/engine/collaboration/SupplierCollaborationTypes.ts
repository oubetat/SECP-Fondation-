import { EngineeringRole, ExplicitPermission } from './AccessControlTypes';

export type SupplierOrgStatus = 'ACTIVE' | 'ONBOARDING' | 'SUSPENDED' | 'DISQUALIFIED';
export type SupplierTier = 'TIER_1' | 'TIER_2' | 'STRATEGIC' | 'COMMODITY';

export interface SupplierOrganization {
  orgId: string;
  tenantId: string;
  name: string;
  code: string;
  taxIdOrDuns: string;
  status: SupplierOrgStatus;
  tier: SupplierTier;
  capabilities: string[]; // e.g. ['5-AXIS_CNC', 'TITANIUM_MILLING', 'EDM', 'CMM_INSPECTION', 'ANODIZING']
  isoCertifications: string[]; // e.g. ['ISO_9001', 'AS9100D', 'IATF_16949', 'ISO_13485']
  ndaSigned: boolean;
  ndaSignedDate?: number;
  ndaExpiresAt?: number;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  assignedCommodities: string[]; // e.g. ['MACHINED_PARTS', 'FASTENERS', 'CASTINGS']
  securityRating: number; // 0 - 100 score
  createdAt: number;
  updatedAt: number;
}

export type SupplierMemberRole = 
  | 'SUPPLIER_ADMIN'
  | 'SUPPLIER_ENGINEER'
  | 'SUPPLIER_ESTIMATOR'
  | 'SUPPLIER_QUALITY'
  | 'SUPPLIER_OPERATOR';

export type SupplierMemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface SupplierMember {
  memberId: string;
  orgId: string;
  userId: string;
  name: string;
  email: string;
  role: SupplierMemberRole;
  status: SupplierMemberStatus;
  invitedAt: number;
  invitedBy: string;
  expiresAt?: number;
  lastLoginAt?: number;
  twoFactorRequired: boolean;
  twoFactorVerified: boolean;
  verified: boolean;
  customPermissions?: ExplicitPermission[];
}

export interface SupplierInvitation {
  invitationId: string;
  orgId: string;
  email: string;
  role: SupplierMemberRole;
  tokenHash: string;
  invitedBy: string;
  createdAt: number;
  expiresAt: number;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  allowedPackageIds: string[];
}

export interface SupplierWorkspace {
  workspaceId: string;
  orgId: string;
  tenantId: string;
  name: string;
  assignedProjectIds: string[];
  assignedPackageIds: string[];
  activeRfqIds: string[];
  storageQuotaBytes: number;
  usedStorageBytes: number;
  ipWhitelist?: string[];
  createdAt: number;
  updatedAt: number;
}

export type PackageConfidentiality = 'PUBLIC' | 'CONFIDENTIAL' | 'ITAR_RESTRICTED' | 'PROPRIETARY';
export type PackageStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED' | 'REVOKED' | 'ARCHIVED';
export type PackageItemType = 'CAD_MODEL' | '2D_DRAWING' | 'BOM' | 'SPECIFICATION' | 'PMI_GDT' | 'STEP_FILE' | 'NC_CODE';

export interface PackageItem {
  itemId: string;
  type: PackageItemType;
  name: string;
  fileName: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  revisionRef: string; // e.g. "REV-C.1"
  isRedacted: boolean;
  redactionReason?: string;
  geometryMasked?: boolean;
  metadataMasked?: boolean;
  downloadUrl?: string;
}

export interface EngineeringPackage {
  packageId: string;
  projectId: string;
  packageNumber: string; // e.g. "TDP-2026-089"
  title: string;
  description: string;
  version: string;
  status: PackageStatus;
  confidentiality: PackageConfidentiality;
  targetSupplierOrgIds: string[];
  items: PackageItem[];
  securityHash: string; // SHA-256 integrity hash of entire package manifest
  publishedAt?: number;
  publishedBy?: string;
  expiresAt?: number;
  watermarkRequired: boolean;
  watermarkText?: string;
  selectiveRedactionApplied: boolean;
  redactedFields: string[];
  downloadCount: number;
  immutableAfterPublish: boolean;
}

export type RFQStatus = 'OPEN' | 'UNDER_EVALUATION' | 'AWARDED' | 'CLOSED' | 'CANCELLED';

export interface RFQLineItem {
  lineId: string;
  partNumber: string;
  partName: string;
  revision: string;
  quantity: number;
  uom: string; // e.g. "EA", "SET"
  targetUnitPrice?: number;
  materialRequirement: string;
  finishRequirement?: string;
  tolerancesStandard?: string;
  cadItemId?: string;
}

export interface SupplierRFQ {
  rfqId: string;
  projectId: string;
  packageId: string;
  rfqNumber: string; // e.g. "RFQ-SECP-2026-042"
  title: string;
  issueDate: number;
  dueDate: number;
  status: RFQStatus;
  targetSupplierOrgIds: string[];
  lineItems: RFQLineItem[];
  currency: string;
  incoterms: string; // e.g. "FOB", "DDP", "EXW"
  targetDeliveryDate: number;
  termsAndConditions: string;
  awardedSupplierOrgId?: string;
  awardedAt?: number;
  awardedBy?: string;
}

export type QuoteStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';

export interface LineItemQuote {
  lineId: string;
  partNumber: string;
  unitPrice: number;
  quantity: number;
  extendedPrice: number;
  leadTimeDays: number;
  rawMaterialSource: string;
  countryOfOrigin: string;
  toolingNRECost: number;
}

export interface SupplierQuote {
  quoteId: string;
  rfqId: string;
  supplierOrgId: string;
  submittedByMemberId: string;
  quoteNumber: string; // e.g. "QTE-VEND-7821"
  status: QuoteStatus;
  submittedAt: number;
  validUntil: number;
  currency: string;
  totalPrice: number;
  toolingCost: number;
  leadTimeDays: number;
  lineItemQuotes: LineItemQuote[];
  dfmComments?: string;
  assumptions: string[];
  exceptions: string[];
  evaluationScore?: number; // 0-100 evaluated by purchasing/engineering
  evaluationNotes?: string;
}

export type QuestionCategory = 'GEOMETRY' | 'MATERIAL' | 'TOLERANCE_GD_T' | 'FINISH' | 'PACKAGING' | 'COMMERCIAL';
export type QuestionUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKER';
export type QuestionStatus = 'OPEN' | 'ANSWERED' | 'CLOSED' | 'REJECTED';

export interface QuestionResponse {
  responseId: string;
  answeredByUserId: string;
  answeredAt: number;
  responseText: string;
  clarificationDrawingRef?: string;
  triggersChangeRequest: boolean;
  isBroadcastToAllBidders: boolean;
}

export interface SupplierQuestion {
  questionId: string;
  packageId?: string;
  rfqId?: string;
  supplierOrgId: string;
  authorMemberId: string;
  questionNumber: string; // e.g. "TQ-2026-014"
  subject: string;
  questionText: string;
  category: QuestionCategory;
  urgency: QuestionUrgency;
  status: QuestionStatus;
  createdAt: number;
  response?: QuestionResponse;
  isConfidential: boolean;
}

export type SCRType = 'MATERIAL_SUBSTITUTION' | 'TOLERANCE_RELAXATION' | 'GEOMETRY_MODIFICATION' | 'PROCESS_DEVIATION' | 'OBSOLESCENCE';
export type SCRStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';

export interface SupplierChangeRequest {
  scrId: string;
  projectId: string;
  packageId: string;
  supplierOrgId: string;
  requestedByMemberId: string;
  scrNumber: string; // e.g. "SCR-2026-031"
  title: string;
  type: SCRType;
  justification: string;
  affectedPartNumbers: string[];
  costImpact: number; // positive or negative savings
  leadTimeImpactDays: number;
  status: SCRStatus;
  proposedSolution: string;
  submittedAt: number;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewComments?: string;
  linkedEcoId?: string;
  disposition: 'ACCEPT' | 'REJECT' | 'ACCEPT_WITH_CONDITIONS' | 'PENDING';
}

export type DFMCategory = 'MACHINABILITY' | 'DRAFT_ANGLE' | 'WALL_THICKNESS' | 'UNDERCUT' | 'TOOL_ACCESS' | 'SURFACE_FINISH';
export type DFMSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OPPORTUNITY';
export type DFMStatus = 'SUBMITTED' | 'ACCEPTED' | 'DECLINED' | 'PENDING_ENGINEERING_REVIEW';

export interface SupplierDFMFeedback {
  feedbackId: string;
  packageId: string;
  partNumber: string;
  supplierOrgId: string;
  submittedByMemberId: string;
  dfmCategory: DFMCategory;
  severity: DFMSeverity;
  locationNote: string;
  recommendedChange: string;
  estimatedCostSavingsPct: number;
  status: DFMStatus;
  submittedAt: number;
  engineerResponse?: string;
}

export type QualityReportType = 'FAI_AS9102' | 'PPAP_LEVEL_3' | 'MTR_CERTIFICATE' | 'DIMENSIONAL_CMM' | 'NCR';
export type QualityReportStatus = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'CONCESSION';

export interface QualityCharacteristic {
  charNumber: number;
  dimensionName: string;
  nominal: number;
  upperTol: number;
  lowerTol: number;
  actualMeasured: number;
  method: 'CMM' | 'MICROMETER' | 'OPTICAL_COMPARATOR' | 'CALIPER';
  passed: boolean;
}

export interface SupplierQualityReport {
  reportId: string;
  projectId: string;
  supplierOrgId: string;
  reportType: QualityReportType;
  partNumber: string;
  lotOrSerialNumber: string;
  status: QualityReportStatus;
  submittedAt: number;
  submittedByMemberId: string;
  verifiedByUserId?: string;
  verifiedAt?: number;
  characteristics: QualityCharacteristic[];
  materialCertNumber?: string;
  heatNumber?: string;
  conformancePassed: boolean;
  evidenceSha256: string;
  nonConformanceNotes?: string;
}

export interface SupplierAuditEvent {
  eventId: string;
  tenantId: string;
  projectId?: string;
  supplierOrgId?: string;
  userIdOrMemberId: string;
  action: string;
  resourceId: string;
  resourceType: string;
  status: 'SUCCESS' | 'DENIED' | 'FLAGGED';
  details: string;
  ipAddress: string;
  sha256Signature: string;
  timestamp: number;
}

export interface SupplierCollaborationMetrics {
  totalSupplierOrgs: number;
  activeSuppliers: number;
  openRfqs: number;
  pendingQuotes: number;
  activeTdpPackages: number;
  openQuestions: number;
  pendingChangeRequests: number;
  qualityApprovalRatePct: number;
  averageQuotationLeadTimeDays: number;
}
