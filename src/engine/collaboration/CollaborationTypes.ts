export type UserStatus = 'ONLINE' | 'OFFLINE' | 'IDLE' | 'EDITING' | 'REVIEWING' | 'LOCKED' | 'DISCONNECTED';

export interface CollaborationSession {
  sessionId: string;
  projectId: string;
  userId: string;
  deviceId: string;
  connectionState: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
  joinedAt: number;
  lastActivityAt: number;
  status: 'ACTIVE' | 'EXPIRED' | 'RECOVERED';
}

export interface UserPresence {
  userId: string;
  sessionId: string;
  status: UserStatus;
  lastSeenAt: number;
  activeObjectId?: string;
  metadata?: Record<string, any>;
}

export type OperationType = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'MOVE' 
  | 'REORDER' 
  | 'SUPPRESS' 
  | 'UNSUPPRESS' 
  | 'RENAME' 
  | 'REVISE';

export interface CollaborationChangeEvent {
  eventId: string;
  userId: string;
  sessionId: string;
  objectId: string;
  baseVersion: number;
  newVersion: number;
  operation: OperationType;
  payload: any;
  timestamp: number;
  isOptimistic?: boolean;
}

export type ConflictType = 
  | 'OBJECT_CONFLICT' 
  | 'GEOMETRY_CONFLICT' 
  | 'PARAMETER_CONFLICT' 
  | 'FEATURE_TREE_CONFLICT' 
  | 'METADATA_CONFLICT' 
  | 'REVISION_CONFLICT' 
  | 'DOCUMENT_CONFLICT' 
  | 'PLM_CONFLICT';

export type ResolutionStrategy = 
  | 'KEEP_A' 
  | 'KEEP_B' 
  | 'MERGE' 
  | 'MANUAL_RESOLUTION' 
  | 'REBASE' 
  | 'ABORT';

export interface CollaborationConflict {
  conflictId: string;
  type: ConflictType;
  objectId: string;
  competingEvents: CollaborationChangeEvent[];
  status: 'PENDING' | 'RESOLVED' | 'ABORTED' | 'ESCALATED';
  resolution?: {
    strategy: ResolutionStrategy;
    resolvedBy: string;
    resolvedAt: number;
    resultVersion: number;
  };
}

export interface ObjectLock {
  lockId: string;
  objectId: string;
  userId: string;
  sessionId: string;
  type: 'SOFT' | 'HARD';
  createdAt: number;
  expiresAt: number;
  reason?: string;
}

export interface ProjectCollabState {
  projectId: string;
  activeUsers: UserPresence[];
  activeEdits: Record<string, string>; // objectId -> userId
  locks: ObjectLock[];
  versionMap: Record<string, number>; // objectId -> currentVersion
  history: CollaborationChangeEvent[];
}
