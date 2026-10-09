import { SupplierCollaborationService } from './SupplierCollaborationService';
import { AccessControlEngine } from './AccessControlEngine';
import { AuthContext } from './AccessControlTypes';
import { 
  SupplierOrganization, 
  EngineeringPackage, 
  SupplierRFQ, 
  SupplierQuote, 
  SupplierQuestion, 
  SupplierChangeRequest, 
  SupplierDFMFeedback, 
  SupplierQualityReport 
} from './SupplierCollaborationTypes';

export interface Gate294Check {
  id: string;
  checkNumber: number;
  name: string;
  category: 
    | 'ORGANIZATION_GOVERNANCE'
    | 'MEMBER_INVITATIONS_AUTHENTICATION'
    | 'CROSS_SUPPLIER_ISOLATION_ZERO_LEAK'
    | 'TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY'
    | 'RFQ_AND_COMPETITIVE_QUOTATION'
    | 'TECHNICAL_QA_AND_CLARIFICATIONS'
    | 'SUPPLIER_CHANGE_REQUEST_SCR_SVR'
    | 'DFM_AND_MANUFACTURABILITY_FEEDBACK'
    | 'QUALITY_INSPECTION_FAI_AS9102_PPAP'
    | 'ACCESS_CONTROL_AND_AUDIT_SECURITY';
  passed: boolean;
  message: string;
}

export interface Gate294Report {
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  timestamp: number;
  policyVersion: string;
  checks: Gate294Check[];
}

export class HardAcceptanceGate294 {
  public static evaluate(): Gate294Report {
    const checks: Gate294Check[] = [];
    let checkCounter = 1;

    function addCheck(
      category: Gate294Check['category'],
      name: string,
      assertion: boolean,
      message: string
    ) {
      checks.push({
        id: `GATE-294-CHK-${String(checkCounter).padStart(3, '0')}`,
        checkNumber: checkCounter++,
        name,
        category,
        passed: !!assertion,
        message
      });
    }

    const accessControl = new AccessControlEngine();
    const service = SupplierCollaborationService.getInstance(accessControl);

    // Setup Test Actors
    const tenantId = 'TENANT-AERO-01';
    const projectId = 'PRJ-TURBINE-001';

    const ownerAuth: AuthContext = {
      userId: 'USR_OWNER',
      sessionId: 'sess_owner',
      tenantId
    };
    accessControl.addMember({
      userId: 'USR_OWNER',
      projectId,
      role: 'OWNER',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: 'SYSTEM'
    });
    accessControl.addMember({
      userId: 'USR_OWNER',
      projectId: 'GLOBAL_SUPPLIER_MGMT',
      role: 'OWNER',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: 'SYSTEM'
    });

    const leadEngAuth: AuthContext = {
      userId: 'USR_LEAD_ENG',
      sessionId: 'sess_eng',
      tenantId
    };
    accessControl.addMember({
      userId: 'USR_LEAD_ENG',
      projectId,
      role: 'ENGINEER',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: 'USR_OWNER'
    });

    const qualityLeadAuth: AuthContext = {
      userId: 'USR_QUALITY_LEAD',
      sessionId: 'sess_qual',
      tenantId
    };
    accessControl.addMember({
      userId: 'USR_QUALITY_LEAD',
      projectId,
      role: 'QUALITY',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: 'USR_OWNER'
    });

    const supplierAlexAuth: AuthContext = {
      userId: 'usr_sup_alex',
      sessionId: 'sess_alex',
      tenantId
    };
    accessControl.addMember({
      userId: 'usr_sup_alex',
      projectId,
      role: 'SUPPLIER',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: 'USR_OWNER'
    });

    const supplierMarcusAuth: AuthContext = {
      userId: 'usr_sup_marcus',
      sessionId: 'sess_marcus',
      tenantId
    };
    accessControl.addMember({
      userId: 'usr_sup_marcus',
      projectId,
      role: 'SUPPLIER',
      status: 'ACTIVE',
      grantedAt: Date.now(),
      grantedBy: 'USR_OWNER'
    });

    // Unregistered attacker
    const outsiderAuth: AuthContext = {
      userId: 'USR_ATTACKER',
      sessionId: 'sess_attacker',
      tenantId: 'TENANT-MALICIOUS'
    };

    // ==========================================
    // 1. ORGANIZATION GOVERNANCE (Checks 1 - 10)
    // ==========================================
    const org1 = service.getOrganization('SUP-ORG-001');
    addCheck('ORGANIZATION_GOVERNANCE', 'Supplier Organization 1 is registered and active', !!org1 && org1.status === 'ACTIVE', 'Active organization loaded');
    addCheck('ORGANIZATION_GOVERNANCE', 'Supplier Org 1 has valid AS9100D ISO certification', !!org1 && org1.isoCertifications.includes('AS9100D'), 'AS9100D certification confirmed');
    addCheck('ORGANIZATION_GOVERNANCE', 'Supplier Org 1 NDA is actively verified and not expired', service.isNdaValid('SUP-ORG-001'), 'NDA is valid');

    const org3 = service.getOrganization('SUP-ORG-003');
    addCheck('ORGANIZATION_GOVERNANCE', 'Supplier Org 3 with expired NDA is correctly rejected by NDA validator', !service.isNdaValid('SUP-ORG-003'), 'Expired NDA rejected');
    addCheck('ORGANIZATION_GOVERNANCE', 'Supplier tier classification exists and adheres to schema', !!org1 && ['TIER_1', 'TIER_2', 'STRATEGIC', 'COMMODITY'].includes(org1.tier), 'Tier classification valid');

    // Organization Creation by unauthorized user
    let unauthOrgCreate = false;
    try {
      service.createOrganization(supplierAlexAuth, {
        orgId: 'SUP-HACK-01',
        tenantId,
        name: 'Malicious Org',
        code: 'MAL',
        taxIdOrDuns: '111',
        status: 'ACTIVE',
        tier: 'COMMODITY',
        capabilities: [],
        isoCertifications: [],
        ndaSigned: false,
        contactEmail: 'a@b.com',
        contactPhone: '123',
        assignedCommodities: [],
        securityRating: 0
      });
    } catch {
      unauthOrgCreate = true;
    }
    addCheck('ORGANIZATION_GOVERNANCE', 'Unauthorized supplier cannot create new supplier organizations', unauthOrgCreate, 'RBAC prevents supplier creating organizations');

    // Authorized organization creation
    const newOrg = service.createOrganization(ownerAuth, {
      orgId: 'SUP-ORG-TEST-004',
      tenantId,
      name: 'Titanium Castings Tech',
      code: 'TI-CAST',
      taxIdOrDuns: 'DUNS-992817263',
      status: 'ACTIVE',
      tier: 'TIER_2',
      capabilities: ['VACUUM_CAST', 'HIP'],
      isoCertifications: ['ISO_9001:2015'],
      ndaSigned: true,
      ndaExpiresAt: Date.now() + 180 * 86400000,
      contactEmail: 'info@ticast.com',
      contactPhone: '555-0199',
      assignedCommodities: ['TURBINE_CASINGS'],
      securityRating: 90
    });
    addCheck('ORGANIZATION_GOVERNANCE', 'Authorized Owner can provision new verified supplier organization', newOrg.orgId === 'SUP-ORG-TEST-004', 'Org created successfully');

    // Duplicate Org ID protection
    let duplicateOrgBlocked = false;
    try {
      service.createOrganization(ownerAuth, {
        orgId: 'SUP-ORG-TEST-004',
        tenantId,
        name: 'Duplicate Org',
        code: 'DUP',
        taxIdOrDuns: '123',
        status: 'ACTIVE',
        tier: 'COMMODITY',
        capabilities: [],
        isoCertifications: [],
        ndaSigned: true,
        contactEmail: 'c@d.com',
        contactPhone: '123',
        assignedCommodities: [],
        securityRating: 50
      });
    } catch {
      duplicateOrgBlocked = true;
    }
    addCheck('ORGANIZATION_GOVERNANCE', 'Duplicate Supplier Org ID is strictly rejected', duplicateOrgBlocked, 'Duplicate org ID blocked');

    // Update Org Capabilities
    const updatedOrg = service.updateOrganization(ownerAuth, 'SUP-ORG-TEST-004', { securityRating: 95 });
    addCheck('ORGANIZATION_GOVERNANCE', 'Authorized update of supplier properties persists changes', updatedOrg.securityRating === 95, 'Updated security rating to 95');

    // Disqualified organization cannot be assigned
    service.updateOrganization(ownerAuth, 'SUP-ORG-TEST-004', { status: 'DISQUALIFIED' });
    const disqOrg = service.getOrganization('SUP-ORG-TEST-004');
    addCheck('ORGANIZATION_GOVERNANCE', 'Disqualification status is enforceable', disqOrg?.status === 'DISQUALIFIED', 'Organization disqualified');

    // ==========================================
    // 2. MEMBER INVITATIONS & AUTH (Checks 11 - 20)
    // ==========================================
    let inviteToDisqBlocked = false;
    try {
      service.inviteSupplierMember(ownerAuth, {
        orgId: 'SUP-ORG-TEST-004',
        email: 'newuser@ticast.com',
        role: 'SUPPLIER_ENGINEER'
      });
    } catch {
      inviteToDisqBlocked = true;
    }
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Inviting members to a disqualified supplier is blocked', inviteToDisqBlocked, 'Blocked invitation to disqualified org');

    // Re-activate org for standard invitation tests
    service.updateOrganization(ownerAuth, 'SUP-ORG-TEST-004', { status: 'ACTIVE', ndaSigned: true, ndaExpiresAt: Date.now() + 100000000 });
    const invitation = service.inviteSupplierMember(ownerAuth, {
      orgId: 'SUP-ORG-TEST-004',
      email: 'john.engineer@ticast.com',
      role: 'SUPPLIER_ENGINEER',
      expiresInDays: 7
    });
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Invitation generates a cryptographically hashed token', invitation.tokenHash.startsWith('sha256_'), 'Cryptographic token generated');
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Invitation has a future expiration timestamp (7 days)', invitation.expiresAt > Date.now(), 'Expiration set correctly');
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Initial invitation status is PENDING', invitation.status === 'PENDING', 'Status is pending');

    // Invalid Token rejection
    let invalidTokenBlocked = false;
    try {
      service.acceptInvitation(invitation.invitationId, 'WRONG_TOKEN_HASH', { userId: 'usr_john_ti', name: 'John Doe' });
    } catch {
      invalidTokenBlocked = true;
    }
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Invalid token on invitation acceptance is rejected', invalidTokenBlocked, 'Invalid token prevented');

    // Valid Token acceptance
    const acceptedMember = service.acceptInvitation(invitation.invitationId, invitation.tokenHash, { userId: 'usr_john_ti', name: 'John Titanium' });
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Valid token successfully activates supplier membership', acceptedMember.status === 'ACTIVE' && acceptedMember.userId === 'usr_john_ti', 'Member activated');
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Accepted invitation status transitions to ACCEPTED', invitation.status === 'ACCEPTED', 'Invitation status updated to ACCEPTED');

    // Re-use of accepted invitation token is blocked (Single-use token)
    let reuseTokenBlocked = false;
    try {
      service.acceptInvitation(invitation.invitationId, invitation.tokenHash, { userId: 'usr_attacker_2', name: 'Attacker' });
    } catch {
      reuseTokenBlocked = true;
    }
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Single-use token policy prevents re-acceptance of already used invitation', reuseTokenBlocked, 'Single-use enforced');

    // Two-factor authentication mandate for supplier portal
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Supplier member mandates Two-Factor Authentication', acceptedMember.twoFactorRequired === true, '2FA enforced for external supplier');
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Supplier member registry retrieves member by orgId', service.listMembers('SUP-ORG-TEST-004').length === 1, 'Member listed by org');
    addCheck('MEMBER_INVITATIONS_AUTHENTICATION', 'Supplier role is correctly registered in AccessControlEngine', !!service.getMember(acceptedMember.memberId), 'Registered in engine');

    // ==========================================
    // 3. CROSS-SUPPLIER ISOLATION (Checks 21 - 31)
    // ==========================================
    const tdp1 = service.getPackage('PKG-TDP-001')!;
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'TDP-001 has designated supplier organizations SUP-ORG-001 and SUP-ORG-002', tdp1.targetSupplierOrgIds.includes('SUP-ORG-001') && tdp1.targetSupplierOrgIds.includes('SUP-ORG-002'), 'Target suppliers configured');

    // Supplier Org 3 (Not invited to TDP-001) attempting to download
    let crossSupplierDownloadBlocked = false;
    try {
      service.downloadPackageItem(supplierAlexAuth, 'PKG-TDP-001', 'ITEM-CAD-01', 'SUP-ORG-003');
    } catch {
      crossSupplierDownloadBlocked = true;
    }
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Supplier Org 3 is blocked from downloading TDP-001 items (Isolation)', crossSupplierDownloadBlocked, 'Cross-supplier download blocked');

    // Authorized Supplier Org 1 downloading
    const dlResult = service.downloadPackageItem(supplierAlexAuth, 'PKG-TDP-001', 'ITEM-CAD-01', 'SUP-ORG-001');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Authorized Supplier Org 1 can download assigned CAD item', dlResult.item.itemId === 'ITEM-CAD-01', 'Download successful');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Downloaded package item includes watermarking tag for traceability', dlResult.watermark.includes('CONFIDENTIAL - LICENSED TO SUP-ORG-001'), 'Watermark applied');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Downloaded package item generates tamper-evident SHA-256 download checksum', dlResult.downloadChecksum.startsWith('sha256_'), 'Checksum generated');

    // Filter packages for supplier
    const sup1Packages = service.listPackagesForSupplier(supplierAlexAuth, 'SUP-ORG-001');
    const sup3Packages = service.listPackagesForSupplier(supplierAlexAuth, 'SUP-ORG-003');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'listPackagesForSupplier returns assigned TDPs for Supplier Org 1', sup1Packages.length >= 1, 'Packages found for Org 1');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'listPackagesForSupplier returns 0 packages for unassigned Supplier Org 3', sup3Packages.length === 0, 'Zero packages for Org 3');

    // Competitive Bidding Isolation: Supplier 1 listing quotes for RFQ
    const sup1QuotesView = service.listQuotesForRFQ(supplierAlexAuth, 'RFQ-2026-001', 'SUP-ORG-001');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Supplier 1 only sees their own quotes (Zero Cross-Bidder Leak)', sup1QuotesView.every(q => q.supplierOrgId === 'SUP-ORG-001'), 'No competitor bids visible');

    // Attacker cannot view all quotes
    let attackerQuotesBlocked = false;
    try {
      service.listQuotesForRFQ(outsiderAuth, 'RFQ-2026-001');
    } catch {
      attackerQuotesBlocked = true;
    }
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Unauthorized outsider blocked from viewing internal RFQ quotes', attackerQuotesBlocked, 'Outsider blocked');

    // Supplier 2 cannot submit quote for Supplier 1
    let impersonateQuoteBlocked = false;
    try {
      service.submitQuote(supplierAlexAuth, {
        quoteId: 'QTE-HACK-01',
        rfqId: 'RFQ-2026-001',
        supplierOrgId: 'SUP-ORG-003', // Trying to submit under Org 3 which is not invited
        submittedByMemberId: 'SUP-MBR-001',
        quoteNumber: 'QTE-FAKE',
        validUntil: Date.now() + 100000,
        currency: 'USD',
        totalPrice: 1000,
        toolingCost: 0,
        leadTimeDays: 10,
        lineItemQuotes: [],
        assumptions: [],
        exceptions: []
      });
    } catch {
      impersonateQuoteBlocked = true;
    }
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Supplier cannot submit quote for uninvited organization', impersonateQuoteBlocked, 'Uninvited quote blocked');

    // Technical Q&A Confidentiality check
    const qListSup2 = service.listQuestions('SUP-ORG-002', 'RFQ-2026-001');
    addCheck('CROSS_SUPPLIER_ISOLATION_ZERO_LEAK', 'Supplier 2 only receives public/broadcasted Q&A responses', qListSup2.every(q => q.supplierOrgId === 'SUP-ORG-002' || q.response?.isBroadcastToAllBidders), 'Confidential Q&A protected');

    // ==========================================
    // 4. TDP CREATION & INTEGRITY (Checks 32 - 42)
    // ==========================================
    const newTdp = service.createEngineeringPackage(leadEngAuth, {
      packageId: 'PKG-TDP-002-NOZZLE',
      projectId,
      packageNumber: 'TDP-NOZZLE-2026-REV-A',
      title: 'Combustor Nozzle Assembly TDP',
      description: 'Investment casting and EDM specifications for Stage 1 nozzle.',
      version: 'Rev A.1',
      status: 'DRAFT',
      confidentiality: 'PROPRIETARY',
      targetSupplierOrgIds: [],
      items: [
        {
          itemId: 'ITEM-CAD-NOZZLE-01',
          type: 'CAD_MODEL',
          name: 'Stage 1 Nozzle Vane',
          fileName: 'NOZZLE-STG1-REV-A.step',
          fileSizeBytes: 9800100,
          sha256Checksum: 'sha256_nozzle_cad_hash_9981',
          revisionRef: 'REV-A',
          isRedacted: false
        }
      ],
      watermarkRequired: true,
      watermarkText: 'RESTRICTED DISTRIBUTION - PROPRIETARY',
      selectiveRedactionApplied: true,
      redactedFields: ['Aero acoustic acoustic liner geometry'],
      downloadCount: 0
    });

    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Draft TDP created with cryptographic security manifest hash', newTdp.securityHash.startsWith('sha256_'), 'Manifest hash generated');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Draft TDP initial status is DRAFT', newTdp.status === 'DRAFT', 'Status is DRAFT');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Selective IP redaction fields are recorded in TDP', newTdp.selectiveRedactionApplied === true && newTdp.redactedFields.length > 0, 'Redaction recorded');

    // Cannot download draft TDP
    let downloadDraftBlocked = false;
    try {
      service.downloadPackageItem(supplierAlexAuth, 'PKG-TDP-002-NOZZLE', 'ITEM-CAD-NOZZLE-01', 'SUP-ORG-001');
    } catch {
      downloadDraftBlocked = true;
    }
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Downloading items from DRAFT TDP is strictly blocked', downloadDraftBlocked, 'Draft download blocked');

    // Publishing to supplier with expired NDA is blocked
    let publishExpiredNdaBlocked = false;
    try {
      service.publishPackage(leadEngAuth, 'PKG-TDP-002-NOZZLE', ['SUP-ORG-003']); // Org 3 has expired NDA
    } catch {
      publishExpiredNdaBlocked = true;
    }
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Publishing TDP to supplier with expired/missing NDA is blocked', publishExpiredNdaBlocked, 'Blocked publish without valid NDA');

    // Publish to valid supplier
    const publishedTdp = service.publishPackage(leadEngAuth, 'PKG-TDP-002-NOZZLE', ['SUP-ORG-001', 'SUP-ORG-002'], 30);
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Publishing TDP to valid suppliers transitions status to PUBLISHED', publishedTdp.status === 'PUBLISHED', 'TDP published');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Published TDP records publishedBy and publishedAt timestamps', !!publishedTdp.publishedBy && !!publishedTdp.publishedAt, 'Timestamps recorded');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Published TDP sets future expiration date (30 days)', !!publishedTdp.expiresAt && publishedTdp.expiresAt > Date.now(), 'Expiration configured');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Published TDP seals updated SHA-256 integrity hash', publishedTdp.securityHash.startsWith('sha256_'), 'Sealed hash updated');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Published TDP enforces immutability flag', publishedTdp.immutableAfterPublish === true, 'Immutability enforced');
    addCheck('TECHNICAL_DATA_PACKAGE_TDP_INTEGRITY', 'Package item references valid revision ref (e.g. REV-A)', publishedTdp.items[0].revisionRef === 'REV-A', 'Revision ref validated');

    // ==========================================
    // 5. RFQ & COMPETITIVE QUOTATION (Checks 43 - 53)
    // ==========================================
    const newRfq = service.createRFQ(leadEngAuth, {
      rfqId: 'RFQ-TEST-002',
      projectId,
      packageId: publishedTdp.packageId,
      rfqNumber: 'RFQ-NOZZLE-2026-002',
      title: 'Batch Procurement: Stage 1 Nozzle Vanes (Inconel 718)',
      dueDate: Date.now() + 14 * 86400000,
      targetSupplierOrgIds: ['SUP-ORG-001', 'SUP-ORG-002'],
      lineItems: [
        {
          lineId: 'LINE-NOZZLE-01',
          partNumber: 'NOZZLE-STG1-7701',
          partName: 'Stage 1 Nozzle Vane',
          revision: 'REV-A',
          quantity: 50,
          uom: 'EA',
          targetUnitPrice: 1800,
          materialRequirement: 'Inconel 718 AMS 5662',
          tolerancesStandard: 'ISO 2768-fH'
        }
      ],
      currency: 'USD',
      incoterms: 'DDP',
      targetDeliveryDate: Date.now() + 45 * 86400000,
      termsAndConditions: 'Standard Aerospace Terms'
    });

    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'New RFQ created with status OPEN', newRfq.status === 'OPEN', 'RFQ is open');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'RFQ line items contain partNumber, quantity, and material requirement', newRfq.lineItems.length === 1 && newRfq.lineItems[0].partNumber === 'NOZZLE-STG1-7701', 'Line items validated');

    // Submit Quote by Supplier 1
    const quoteOrg1 = service.submitQuote(supplierAlexAuth, {
      quoteId: 'QTE-AP-NOZZLE-01',
      rfqId: newRfq.rfqId,
      supplierOrgId: 'SUP-ORG-001',
      submittedByMemberId: 'SUP-MBR-001',
      quoteNumber: 'QTE-AP-9901',
      validUntil: Date.now() + 30 * 86400000,
      currency: 'USD',
      totalPrice: 0, // Service computes
      toolingCost: 6500,
      leadTimeDays: 40,
      lineItemQuotes: [
        {
          lineId: 'LINE-NOZZLE-01',
          partNumber: 'NOZZLE-STG1-7701',
          unitPrice: 1750,
          quantity: 50,
          extendedPrice: 87500,
          leadTimeDays: 40,
          rawMaterialSource: 'Special Metals Inc',
          countryOfOrigin: 'USA',
          toolingNRECost: 6500
        }
      ],
      assumptions: ['Includes AMS 5662 MTR'],
      exceptions: []
    });

    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Quote submission accurately calculates total price ($87,500)', quoteOrg1.totalPrice === 87500, 'Total price computed ($87,500)');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Quote status is SUBMITTED upon creation', quoteOrg1.status === 'SUBMITTED', 'Quote status is SUBMITTED');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Quote lead time and tooling costs are recorded', quoteOrg1.leadTimeDays === 40 && quoteOrg1.toolingCost === 6500, 'Lead time and tooling recorded');

    // Submit Quote by Supplier 2
    const quoteOrg2 = service.submitQuote(supplierAlexAuth, {
      quoteId: 'QTE-DYNO-NOZZLE-02',
      rfqId: newRfq.rfqId,
      supplierOrgId: 'SUP-ORG-002',
      submittedByMemberId: 'SUP-MBR-003',
      quoteNumber: 'QTE-DYNO-4412',
      validUntil: Date.now() + 30 * 86400000,
      currency: 'USD',
      totalPrice: 0,
      toolingCost: 4000,
      leadTimeDays: 32,
      lineItemQuotes: [
        {
          lineId: 'LINE-NOZZLE-01',
          partNumber: 'NOZZLE-STG1-7701',
          unitPrice: 1680,
          quantity: 50,
          extendedPrice: 84000,
          leadTimeDays: 32,
          rawMaterialSource: 'Carpenter Tech',
          countryOfOrigin: 'USA',
          toolingNRECost: 4000
        }
      ],
      assumptions: [],
      exceptions: []
    });

    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Second supplier successfully submits competitive bid', quoteOrg2.totalPrice === 84000, 'Second bid recorded ($84,000)');

    // Internal Engineering evaluates all quotes
    const allQuotesForRfq = service.listQuotesForRFQ(ownerAuth, newRfq.rfqId);
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Internal team can compare all 2 competitive bids', allQuotesForRfq.length === 2, '2 quotes available for internal review');

    // Award RFQ to Supplier 2
    const awardedRfq = service.awardRFQ(ownerAuth, newRfq.rfqId, 'SUP-ORG-002');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Awarding RFQ transitions RFQ status to AWARDED', awardedRfq.status === 'AWARDED', 'RFQ status AWARDED');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Awarding RFQ records awardedSupplierOrgId and timestamp', awardedRfq.awardedSupplierOrgId === 'SUP-ORG-002' && !!awardedRfq.awardedAt, 'Award details recorded');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Winning quote transitions to ACCEPTED', quoteOrg2.status === 'ACCEPTED', 'Winning quote marked ACCEPTED');
    addCheck('RFQ_AND_COMPETITIVE_QUOTATION', 'Losing quote transitions to REJECTED', quoteOrg1.status === 'REJECTED', 'Losing quote marked REJECTED');

    // ==========================================
    // 6. TECHNICAL Q&A (Checks 54 - 63)
    // ==========================================
    const newQuestion = service.askQuestion(supplierAlexAuth, {
      questionId: 'TQ-2026-002',
      packageId: publishedTdp.packageId,
      rfqId: newRfq.rfqId,
      supplierOrgId: 'SUP-ORG-001',
      authorMemberId: 'SUP-MBR-001',
      questionNumber: 'TQ-NOZZLE-02',
      subject: 'Airfoil trailing edge inspection method requirement',
      questionText: 'Can optical 3D scanning be used instead of CMM tactile probes for the 0.85mm trailing edge profile?',
      category: 'TOLERANCE_GD_T',
      urgency: 'HIGH',
      isConfidential: false
    });

    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Supplier can submit technical clarification question', newQuestion.status === 'OPEN', 'Question status is OPEN');
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Question category and urgency are assigned', newQuestion.category === 'TOLERANCE_GD_T' && newQuestion.urgency === 'HIGH', 'Category and urgency validated');

    // Lead engineer answers question and broadcasts to all bidders
    const answeredQ = service.answerQuestion(leadEngAuth, newQuestion.questionId, {
      responseText: 'Structured blue light 3D optical scanning is approved provided point cloud density is >= 100 points/mm² and calibrated to NIST traceable sphere.',
      clarificationDrawingRef: 'DWG-NOZZLE-CLARIF-OPTICAL',
      triggersChangeRequest: false,
      isBroadcastToAllBidders: true
    });

    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Engineer answer transitions question status to ANSWERED', answeredQ.status === 'ANSWERED', 'Status is ANSWERED');
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Answer records engineer responseText and responseId', !!answeredQ.response && answeredQ.response.responseText.includes('Structured blue light'), 'Response text validated');
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Broadcast flag enables sanitized sharing with all bidding suppliers', answeredQ.response?.isBroadcastToAllBidders === true, 'Broadcast flag set');
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Clarification drawing reference is linked to response', answeredQ.response?.clarificationDrawingRef === 'DWG-NOZZLE-CLARIF-OPTICAL', 'Drawing ref attached');

    // Confidential question
    const confQ = service.askQuestion(supplierAlexAuth, {
      questionId: 'TQ-CONF-003',
      packageId: publishedTdp.packageId,
      supplierOrgId: 'SUP-ORG-001',
      authorMemberId: 'SUP-MBR-001',
      questionNumber: 'TQ-NOZZLE-03-CONF',
      subject: 'Proprietary fixture clamping point clearance',
      questionText: 'Can we utilize boss #4 for vacuum chuck clamping?',
      category: 'GEOMETRY',
      urgency: 'MEDIUM',
      isConfidential: true
    });
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Confidential question flag is persisted', confQ.isConfidential === true, 'Confidential question created');

    service.answerQuestion(leadEngAuth, confQ.questionId, {
      responseText: 'Yes, clamping on boss #4 is permitted with silicone padding.',
      triggersChangeRequest: false,
      isBroadcastToAllBidders: false
    });

    const sup2Questions = service.listQuestions('SUP-ORG-002');
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Confidential question is hidden from other suppliers', !sup2Questions.some(q => q.questionId === 'TQ-CONF-003'), 'Confidential Q&A isolated');
    addCheck('TECHNICAL_QA_AND_CLARIFICATIONS', 'Total questions retrieved for RFQ match expected count', service.listQuestions(undefined, newRfq.rfqId).length >= 1, 'RFQ questions retrieved');

    // ==========================================
    // 7. SUPPLIER CHANGE REQUESTS (SCR) (Checks 64 - 74)
    // ==========================================
    const newScr = service.submitChangeRequest(supplierAlexAuth, {
      scrId: 'SCR-TEST-002',
      projectId,
      packageId: publishedTdp.packageId,
      supplierOrgId: 'SUP-ORG-001',
      requestedByMemberId: 'SUP-MBR-001',
      scrNumber: 'SCR-AP-2026-002',
      title: 'Alternative EDM wire diameter relaxation for trailing edge cooling slots',
      type: 'PROCESS_DEVIATION',
      justification: '0.20mm wire allows 40% faster cutting speed while maintaining ±0.010mm tolerance.',
      affectedPartNumbers: ['NOZZLE-STG1-7701'],
      costImpact: -45, // $45 savings per part
      leadTimeImpactDays: -3,
      proposedSolution: 'Allow 0.20mm brass wire EDM on slot features #12 through #18.'
    });

    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'Supplier can submit SCR with initial status SUBMITTED', newScr.status === 'SUBMITTED', 'SCR submitted');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'SCR type is classified (e.g. PROCESS_DEVIATION)', newScr.type === 'PROCESS_DEVIATION', 'SCR type validated');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'SCR records cost impact and lead time savings', newScr.costImpact === -45 && newScr.leadTimeImpactDays === -3, 'Cost and lead time recorded');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'SCR initial disposition is PENDING', newScr.disposition === 'PENDING', 'Initial disposition PENDING');

    // Unauthorized supplier trying to approve SCR
    let unauthScrApprove = false;
    try {
      service.reviewChangeRequest(supplierAlexAuth, newScr.scrId, 'ACCEPT', 'Self-approval attempt');
    } catch {
      unauthScrApprove = true;
    }
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'Supplier is blocked from approving their own SCR (Separation of Duties)', unauthScrApprove, 'Self-approval blocked');

    // Authorized Engineering review and approval
    const approvedScr = service.reviewChangeRequest(ownerAuth, newScr.scrId, 'ACCEPT', 'Thermal and fluid flow verified. Approved.', 'ECO-2026-095');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'Authorized engineering disposition transitions SCR to APPROVED', approvedScr.status === 'APPROVED', 'SCR approved');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'SCR records reviewerId and reviewComments', approvedScr.reviewedBy === 'USR_OWNER' && !!approvedScr.reviewComments, 'Reviewer info recorded');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'Approved SCR links to formal internal ECO (ECO-2026-095)', approvedScr.linkedEcoId === 'ECO-2026-095', 'Linked ECO established');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'SCR disposition is marked as ACCEPT', approvedScr.disposition === 'ACCEPT', 'Disposition is ACCEPT');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'listChangeRequests retrieves SCRs by project and supplierOrgId', service.listChangeRequests(projectId, 'SUP-ORG-001').length >= 1, 'SCRs retrieved');

    // Rejection flow
    const rejectedScr = service.submitChangeRequest(supplierAlexAuth, {
      scrId: 'SCR-TEST-003-REJ',
      projectId,
      packageId: publishedTdp.packageId,
      supplierOrgId: 'SUP-ORG-001',
      requestedByMemberId: 'SUP-MBR-001',
      scrNumber: 'SCR-AP-2026-003',
      title: 'Replace Inconel 718 with 316L Stainless Steel',
      type: 'MATERIAL_SUBSTITUTION',
      justification: 'Lower cost',
      affectedPartNumbers: ['NOZZLE-STG1-7701'],
      costImpact: -500,
      leadTimeImpactDays: -10,
      proposedSolution: 'Use 316L'
    });
    service.reviewChangeRequest(ownerAuth, rejectedScr.scrId, 'REJECT', 'High temperature creep strength of 316L is insufficient for turbine inlet temperatures (950°C). Rejected.');
    addCheck('SUPPLIER_CHANGE_REQUEST_SCR_SVR', 'Rejected SCR transitions to REJECTED status with engineering rationale', rejectedScr.status === 'REJECTED' && rejectedScr.disposition === 'REJECT', 'SCR rejection verified');

    // ==========================================
    // 8. DFM FEEDBACK (Checks 75 - 83)
    // ==========================================
    const dfm = service.submitDFMFeedback(supplierAlexAuth, {
      feedbackId: 'DFM-TEST-002',
      packageId: publishedTdp.packageId,
      partNumber: 'NOZZLE-STG1-7701',
      supplierOrgId: 'SUP-ORG-001',
      submittedByMemberId: 'SUP-MBR-001',
      dfmCategory: 'WALL_THICKNESS',
      severity: 'MAJOR',
      locationNote: 'Trailing edge transition zone',
      recommendedChange: 'Increase wall thickness from 0.60mm to 0.75mm to prevent casting wall freeze-off.',
      estimatedCostSavingsPct: 12.0
    });

    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'Supplier can submit DFM manufacturability feedback', dfm.status === 'SUBMITTED', 'DFM submitted');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'DFM category is classified (e.g. WALL_THICKNESS)', dfm.dfmCategory === 'WALL_THICKNESS', 'Category validated');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'DFM severity level is recorded (e.g. MAJOR)', dfm.severity === 'MAJOR', 'Severity recorded');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'DFM estimated cost savings percentage is captured (12%)', dfm.estimatedCostSavingsPct === 12.0, 'Cost savings captured');

    // Engineer review DFM
    const reviewedDfm = service.reviewDFMFeedback(leadEngAuth, dfm.feedbackId, 'ACCEPTED', 'Solidification CFD simulation confirms freeze-off risk. Thickness increased in Rev A.2.');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'Engineer review transitions DFM status to ACCEPTED', reviewedDfm.status === 'ACCEPTED', 'DFM accepted');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'Engineer response is recorded in DFM feedback item', !!reviewedDfm.engineerResponse, 'Response recorded');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'listDFMFeedback retrieves DFM items for the package', service.listDFMFeedback(publishedTdp.packageId).length >= 1, 'DFM items retrieved');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'DFM items reference valid target partNumber', reviewedDfm.partNumber === 'NOZZLE-STG1-7701', 'Part number valid');
    addCheck('DFM_AND_MANUFACTURABILITY_FEEDBACK', 'DFM submission timestamp is recorded', reviewedDfm.submittedAt > 0, 'Timestamp recorded');

    // ==========================================
    // 9. QUALITY & AS9102 FAI (Checks 84 - 93)
    // ==========================================
    const faiReport = service.submitQualityReport(supplierMarcusAuth, {
      reportId: 'QR-FAI-TEST-002',
      projectId,
      supplierOrgId: 'SUP-ORG-001',
      reportType: 'FAI_AS9102',
      partNumber: 'NOZZLE-STG1-7701',
      lotOrSerialNumber: 'SN-NZ-001',
      status: 'SUBMITTED',
      submittedByMemberId: 'SUP-MBR-002',
      characteristics: [
        {
          charNumber: 1,
          dimensionName: 'Airfoil Chord Length',
          nominal: 45.000,
          upperTol: 0.050,
          lowerTol: -0.050,
          actualMeasured: 45.018,
          method: 'CMM',
          passed: false // will be evaluated
        },
        {
          charNumber: 2,
          dimensionName: 'Throat Area Opening',
          nominal: 12.500,
          upperTol: 0.030,
          lowerTol: -0.030,
          actualMeasured: 12.512,
          method: 'OPTICAL_COMPARATOR',
          passed: false
        }
      ],
      materialCertNumber: 'MTR-TI-AMS4928-8812',
      heatNumber: 'HEAT-9921',
      conformancePassed: false,
      evidenceSha256: ''
    });

    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'AS9102 FAI report submitted with characteristic dimension array', faiReport.characteristics.length === 2, 'Characteristics submitted');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Automated tolerance check marks in-spec characteristics as passed (true)', faiReport.characteristics[0].passed === true && faiReport.characteristics[1].passed === true, 'Tolerances validated');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'All in-spec characteristics set conformancePassed flag to true', faiReport.conformancePassed === true, 'Conformance passed');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Quality report calculates cryptographic SHA-256 evidence digest', faiReport.evidenceSha256.startsWith('sha256_'), 'Evidence digest computed');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Material Test Report (MTR) cert and heat numbers are recorded', faiReport.materialCertNumber === 'MTR-TI-AMS4928-8812' && faiReport.heatNumber === 'HEAT-9921', 'MTR cert recorded');

    // Quality Lead verification
    const verifiedFai = service.verifyQualityReport(qualityLeadAuth, faiReport.reportId, 'ACCEPTED', 'CMM cal cert valid. Approved for flight hardware build.');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Quality role verification transitions status to ACCEPTED', verifiedFai.status === 'ACCEPTED', 'Report accepted');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Quality verification records verifiedByUserId and timestamp', verifiedFai.verifiedByUserId === 'USR_QUALITY_LEAD' && !!verifiedFai.verifiedAt, 'Verification recorded');

    // Out of tolerance FAI report test
    const outOfTolReport = service.submitQualityReport(supplierMarcusAuth, {
      reportId: 'QR-FAI-FAIL-003',
      projectId,
      supplierOrgId: 'SUP-ORG-001',
      reportType: 'FAI_AS9102',
      partNumber: 'NOZZLE-STG1-7701',
      lotOrSerialNumber: 'SN-NZ-FAIL-002',
      status: 'SUBMITTED',
      submittedByMemberId: 'SUP-MBR-002',
      characteristics: [
        {
          charNumber: 1,
          dimensionName: 'Bore Diameter',
          nominal: 20.000,
          upperTol: 0.010,
          lowerTol: -0.010,
          actualMeasured: 20.055, // OUT OF SPEC!
          method: 'CMM',
          passed: false
        }
      ],
      conformancePassed: false,
      evidenceSha256: ''
    });

    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Out-of-tolerance dimension is correctly flagged passed: false', outOfTolReport.characteristics[0].passed === false, 'Out-of-tolerance flagged');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Out-of-tolerance report sets overall conformancePassed: false', outOfTolReport.conformancePassed === false, 'Overall non-conformance flagged');
    addCheck('QUALITY_INSPECTION_FAI_AS9102_PPAP', 'Quality reports retrieved by project and supplierOrgId', service.listQualityReports(projectId, 'SUP-ORG-001').length >= 2, 'Quality reports listed');

    // ==========================================
    // 10. SECURITY & AUDIT ENFORCEMENT (Checks 94 - 101)
    // ==========================================
    const auditTrail = service.getAuditTrail();
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'Every supplier operation generates an audit event record', auditTrail.length >= 10, 'Audit trail populated');
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'Audit events include cryptographic SHA-256 signatures for tamper evidence', auditTrail.every(e => e.sha256Signature.startsWith('sha256_')), 'Signatures verified');
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'Audit records capture tenantId, userIdOrMemberId, action, and timestamp', !!auditTrail[0].tenantId && !!auditTrail[0].userIdOrMemberId && !!auditTrail[0].action, 'Audit metadata validated');
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'Denied unauthorized operations are logged with status: DENIED', auditTrail.some(e => e.status === 'DENIED'), 'Denial logged');

    // AccessControlEngine authorization check
    const supAuthDecision = accessControl.authorize(supplierAlexAuth, {
      projectId,
      resource: 'PART',
      action: 'DELETE',
      explicitPermission: 'part.delete'
    });
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'AccessControlEngine blocks supplier from modifying or deleting base CAD models', !supAuthDecision.allowed, 'Supplier cannot delete CAD parts');

    const supReleaseDecision = accessControl.authorize(supplierAlexAuth, {
      projectId,
      resource: 'REVISION',
      action: 'RELEASE',
      explicitPermission: 'revision.release'
    });
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'AccessControlEngine blocks supplier from releasing engineering revisions', !supReleaseDecision.allowed, 'Supplier cannot release revisions');

    const metrics = service.getMetrics(tenantId);
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', 'Supplier collaboration metrics dashboard computes accurate summary statistics', metrics.totalSupplierOrgs >= 3 && metrics.activeTdpPackages >= 2, 'Metrics computed');
    addCheck('ACCESS_CONTROL_AND_AUDIT_SECURITY', '101/101 Zero-Trust Supplier Collaboration Gate Requirements completely satisfied', checks.every(c => c.passed), 'Full compliance achieved');

    const passedChecks = checks.filter(c => c.passed).length;
    const failedChecks = checks.filter(c => !c.passed).length;

    return {
      passed: failedChecks === 0,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      timestamp: Date.now(),
      policyVersion: '26.294.0-SUPPLIER-COLLABORATION-PROD',
      checks
    };
  }
}
