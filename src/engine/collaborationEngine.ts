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
  approvalChain: {
    reviewerName: string;
    role: UserRole;
    decision: ApprovalStatus;
    signedTimestamp?: string;
  }[];
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

export class CollaborationEngine {
  /**
   * Generates mock active cloud project state for SECP Turbo Pump Project
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
        lastActiveTime: 'Just now',
      },
      {
        id: 'usr-2',
        name: 'Marcus Vance',
        email: 'm.vance@secp-cad.io',
        role: 'CAD_DESIGNER',
        isOnline: true,
        activeFeatureNodeId: 'Pocket001',
        lastActiveTime: 'Just now',
      },
      {
        id: 'usr-3',
        name: 'Elena Rostova',
        email: 'elena.r@secp-cad.io',
        role: 'REVIEWER',
        isOnline: false,
        lastActiveTime: '12m ago',
      },
      {
        id: 'usr-4',
        name: 'Alexandre Dubois',
        email: 'a.dubois@secp-cad.io',
        role: 'ADMIN',
        isOnline: true,
        activeFeatureNodeId: 'AssemblyRoot',
        lastActiveTime: 'Just now',
      },
    ];

    const comments: CadComment[] = [
      {
        id: 'cmt-101',
        authorName: 'Dr. Sarah Chen',
        authorRole: 'LEAD_ENGINEER',
        targetEntityId: 'MainFlange',
        content: 'Please verify wall thickness under 18.5 MPa Barlow pressure. FEA shows slight stress concentration.',
        timestamp: '10:42 AM',
        resolved: false,
        replies: [
          {
            authorName: 'Marcus Vance',
            content: 'Increased flange fillet radius from 3mm to 6mm. Von Mises stress dropped by 22%.',
            timestamp: '10:50 AM',
          },
        ],
      },
      {
        id: 'cmt-102',
        authorName: 'Elena Rostova',
        authorRole: 'REVIEWER',
        targetEntityId: 'Pocket001',
        content: 'Check tool path clearance for CNC 5-axis ball end mill in CAM panel.',
        timestamp: '09:15 AM',
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
        createdAt: 'Today, 08:30 AM',
        commentsCount: 3,
        approvalChain: [
          {
            reviewerName: 'Dr. Sarah Chen',
            role: 'LEAD_ENGINEER',
            decision: 'APPROVED',
            signedTimestamp: '10:15 AM',
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
   * Adds a new comment thread to a target CAD node
   */
  public static addComment(
    state: CloudProjectState,
    targetEntityId: string,
    authorName: string,
    authorRole: UserRole,
    content: string
  ): CloudProjectState {
    const newCmt: CadComment = {
      id: `cmt-${Date.now()}`,
      authorName,
      authorRole,
      targetEntityId,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resolved: false,
    };

    return {
      ...state,
      comments: [newCmt, ...state.comments],
    };
  }

  /**
   * Submits a formal review approval or requested change
   */
  public static updateReviewDecision(
    ticket: DesignReviewTicket,
    reviewerName: string,
    decision: ApprovalStatus
  ): DesignReviewTicket {
    const updatedChain = ticket.approvalChain.map(item => {
      if (item.reviewerName === reviewerName) {
        return {
          ...item,
          decision,
          signedTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
}
