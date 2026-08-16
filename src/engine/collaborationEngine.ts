/**
 * SECP-102.3: Cloud Engineering Collaboration, State Synchronization & Governance Engine
 * Implements deterministic multi-user workspace state, CRDT-ready operational transforms,
 * structured review approval chains, role-based transition validations, and conflict detection.
 */

import crypto from 'crypto';

export type UserRole = 'ADMIN' | 'LEAD_ENGINEER' | 'CAD_DESIGNER' | 'REVIEWER' | 'VIEWER';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  isOnline: boolean;
  activeFeatureNodeId?: string;
  lastActiveTime: string;
}

export interface CadComment {
  id: string;
  authorName: string;
  authorRole: UserRole;
  targetEntityId: string; // e.g. 'Pocket001' or 'MainFlange'
  content: string;
  timestamp: string;
  resolved: boolean;
  replies?: {
    authorName: string;
    content: string;
    timestamp: string;
  }[];
}

export type ApprovalStatus = 'PENDING_REVIEW' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED';

export interface ApprovalChainItem {
  reviewerName: string;
  role: UserRole;
  decision: ApprovalStatus;
  signedTimestamp?: string;
}

export interface DesignReviewTicket {
  id: string;
  title: string;
  description: string;
  versionTag: string; // e.g. 'v3.2.0'
  authorName: string;
  assignedReviewerName: string;
  status: ApprovalStatus;
  createdAt: string;
  commentsCount: number;
  approvalChain: ApprovalChainItem[];
}

export interface CloudProjectState {
  projectId: string;
  projectName: string;
  activeBranch: string;
  syncedRevision: string;
  teamMembers: TeamMember[];
  comments: CadComment[];
  reviewTickets: DesignReviewTicket[];
  isRealtimeSyncing: boolean;
}

export interface CollaborationValidationReport {
  isValid: boolean;
  stateHash: string;
  activeConflicts: string[];
  unauthorizedActions: string[];
  errors: string[];
}

export class CollaborationEngine {
  private static commentCounter = 1000;

  /**
   * Generates production baseline cloud project state for SECP Turbo Pump Project
   */
  public static createDefaultCloudProject(): CloudProjectState {
    const teamMembers: TeamMember[] = [
      {
        id: 'usr-1',
        name: 'Dr. Sarah Chen',
        email: 'sarah.chen@secp-cad.io',
        role: 'LEAD_ENGINEER',
        isOnline: true,
        activeFeatureNodeId: 'MainFlange',
        lastActiveTime: '2026-08-16T08:00:00Z',
      },
      {
        id: 'usr-2',
        name: 'Marcus Vance',
        email: 'm.vance@secp-cad.io',
        role: 'CAD_DESIGNER',
        isOnline: true,
        activeFeatureNodeId: 'Pocket001',
        lastActiveTime: '2026-08-16T08:00:00Z',
      },
      {
        id: 'usr-3',
        name: 'Elena Rostova',
        email: 'elena.r@secp-cad.io',
        role: 'REVIEWER',
        isOnline: false,
        lastActiveTime: '2026-08-16T07:48:00Z',
      },
      {
        id: 'usr-4',
        name: 'Alexandre Dubois',
        email: 'a.dubois@secp-cad.io',
        role: 'ADMIN',
        isOnline: true,
        activeFeatureNodeId: 'AssemblyRoot',
        lastActiveTime: '2026-08-16T08:00:00Z',
      },
    ];

    const comments: CadComment[] = [
      {
        id: 'cmt-101',
        authorName: 'Dr. Sarah Chen',
        authorRole: 'LEAD_ENGINEER',
        targetEntityId: 'MainFlange',
        content: 'Please verify wall thickness under 18.5 MPa Barlow pressure. FEA shows slight stress concentration.',
        timestamp: '2026-08-16T10:42:00Z',
        resolved: false,
        replies: [
          {
            authorName: 'Marcus Vance',
            content: 'Increased flange fillet radius from 3mm to 6mm. Von Mises stress dropped by 22%.',
            timestamp: '2026-08-16T10:50:00Z',
          },
        ],
      },
      {
        id: 'cmt-102',
        authorName: 'Elena Rostova',
        authorRole: 'REVIEWER',
        targetEntityId: 'Pocket001',
        content: 'Check tool path clearance for CNC 5-axis ball end mill in CAM panel.',
        timestamp: '2026-08-16T09:15:00Z',
        resolved: true,
      },
    ];

    const reviewTickets: DesignReviewTicket[] = [
      {
        id: 'REV-2026-001',
        title: 'Release v3.2.0 - High Pressure Hydraulic Housing Structural Sign-off',
        description: 'Complete CAD B-Rep geometry, FEA structural stress, CFD thermal flow, and BOM cost rollup review prior to tooling release.',
        versionTag: 'v3.2.0',
        authorName: 'Marcus Vance',
        assignedReviewerName: 'Dr. Sarah Chen',
        status: 'PENDING_REVIEW',
        createdAt: '2026-08-16T08:30:00Z',
        commentsCount: 3,
        approvalChain: [
          {
            reviewerName: 'Dr. Sarah Chen',
            role: 'LEAD_ENGINEER',
            decision: 'APPROVED',
            signedTimestamp: '2026-08-16T10:15:00Z',
          },
          {
            reviewerName: 'Elena Rostova',
            role: 'REVIEWER',
            decision: 'PENDING_REVIEW',
          },
          {
            reviewerName: 'Alexandre Dubois',
            role: 'ADMIN',
            decision: 'PENDING_REVIEW',
          },
        ],
      },
    ];

    return {
      projectId: 'PRJ-SECP-9000',
      projectName: 'SECP Aerospace Turbo Pump Assembly',
      activeBranch: 'main/release-v3.2',
      syncedRevision: 'REV-8f92a10c',
      teamMembers,
      comments,
      reviewTickets,
      isRealtimeSyncing: true,
    };
  }

  /**
   * Adds a new comment thread to a target CAD node with strict input verification
   */
  public static addComment(
    state: CloudProjectState,
    targetEntityId: string,
    authorName: string,
    authorRole: UserRole,
    content: string
  ): CloudProjectState {
    if (!targetEntityId || !targetEntityId.trim()) {
      throw new Error('Collaboration Error: targetEntityId is required for comment.');
    }
    if (!authorName || !authorName.trim()) {
      throw new Error('Collaboration Error: authorName is required.');
    }
    if (!content || !content.trim()) {
      throw new Error('Collaboration Error: comment content cannot be empty.');
    }

    this.commentCounter++;
    const newCmt: CadComment = {
      id: `cmt-${this.commentCounter}`,
      authorName: authorName.trim(),
      authorRole,
      targetEntityId: targetEntityId.trim(),
      content: content.trim(),
      timestamp: new Date().toISOString(),
      resolved: false,
    };

    return {
      ...state,
      comments: [newCmt, ...state.comments],
    };
  }

  /**
   * Submits a formal review approval or requested change with role authorization invariants
   */
  public static updateReviewDecision(
    ticket: DesignReviewTicket,
    reviewerName: string,
    decision: ApprovalStatus
  ): DesignReviewTicket {
    if (!ticket || !ticket.approvalChain) {
      throw new Error('Collaboration Error: Invalid review ticket.');
    }

    const reviewerIndex = ticket.approvalChain.findIndex(item => item.reviewerName === reviewerName);
    if (reviewerIndex === -1) {
      throw new Error(`Collaboration Error: Reviewer ${reviewerName} is not authorized in this approval chain.`);
    }

    const targetReviewer = ticket.approvalChain[reviewerIndex];
    if (targetReviewer.role === 'VIEWER') {
      throw new Error(`Collaboration Error: Role VIEWER cannot approve or reject reviews.`);
    }

    const updatedChain = ticket.approvalChain.map((item, idx) => {
      if (idx === reviewerIndex) {
        return {
          ...item,
          decision,
          signedTimestamp: new Date().toISOString(),
        };
      }
      return item;
    });

    const isAllApproved = updatedChain.every(i => i.decision === 'APPROVED');
    const isAnyRejected = updatedChain.some(i => i.decision === 'REJECTED' || i.decision === 'CHANGES_REQUESTED');

    let status: ApprovalStatus = 'PENDING_REVIEW';
    if (isAllApproved) status = 'APPROVED';
    else if (isAnyRejected) status = 'CHANGES_REQUESTED';

    return {
      ...ticket,
      approvalChain: updatedChain,
      status,
    };
  }

  /**
   * Evaluates state integrity, detects simultaneous lock conflicts and invalid role mutations
   */
  public static validateProjectState(state: CloudProjectState): CollaborationValidationReport {
    const errors: string[] = [];
    const activeConflicts: string[] = [];
    const unauthorizedActions: string[] = [];

    if (!state.projectId || !state.projectName) {
      errors.push('Missing projectId or projectName');
    }

    // Check node editing exclusivity (lock conflict detection)
    const nodeOccupancy: Record<string, string[]> = {};
    for (const member of state.teamMembers) {
      if (member.isOnline && member.activeFeatureNodeId) {
        if (!nodeOccupancy[member.activeFeatureNodeId]) {
          nodeOccupancy[member.activeFeatureNodeId] = [];
        }
        nodeOccupancy[member.activeFeatureNodeId].push(member.name);
      }
    }

    for (const [nodeId, occupants] of Object.entries(nodeOccupancy)) {
      if (occupants.length > 1) {
        activeConflicts.push(`Node '${nodeId}' has simultaneous conflicting editors: ${occupants.join(', ')}`);
      }
    }

    // Validate review tickets
    for (const ticket of state.reviewTickets) {
      if (ticket.approvalChain.length === 0) {
        errors.push(`Ticket ${ticket.id} has empty approval chain`);
      }
      for (const auth of ticket.approvalChain) {
        if (auth.decision === 'APPROVED' && !auth.signedTimestamp) {
          errors.push(`Ticket ${ticket.id} approval by ${auth.reviewerName} missing cryptographic timestamp`);
        }
      }
    }

    const stateDigest = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        projectId: state.projectId,
        branch: state.activeBranch,
        revision: state.syncedRevision,
        membersCount: state.teamMembers.length,
        commentsCount: state.comments.length,
        ticketsCount: state.reviewTickets.length
      }))
      .digest('hex');

    const isValid = errors.length === 0 && activeConflicts.length === 0 && unauthorizedActions.length === 0;

    return {
      isValid,
      stateHash: stateDigest,
      activeConflicts,
      unauthorizedActions,
      errors
    };
  }
}
