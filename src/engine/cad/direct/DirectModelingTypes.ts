export type BRepEntityId = string;

export enum SelectionEntityType {
    VERTEX = 'VERTEX',
    EDGE = 'EDGE',
    FACE = 'FACE',
    BODY = 'BODY',
    FEATURE = 'FEATURE'
}

export interface SelectedEntity {
    id: BRepEntityId;
    type: SelectionEntityType;
    geometryHash?: string;
    topologyHash?: string;
}

export enum DirectModelingOperationType {
    MOVE_FACE = 'MOVE_FACE',
    OFFSET_FACE = 'OFFSET_FACE',
    REPLACE_FACE = 'REPLACE_FACE',
    PUSH_PULL = 'PUSH_PULL',
    MOVE_EDGE = 'MOVE_EDGE',
    MOVE_VERTEX = 'MOVE_VERTEX',
    DELETE_FACE = 'DELETE_FACE',
    DEFEATURE = 'DEFEATURE',
    EDIT_HOLE = 'EDIT_HOLE',
    EDIT_FILLET = 'EDIT_FILLET',
    EDIT_CHAMFER = 'EDIT_CHAMFER'
}

export enum GeometricIntent {
    PARALLEL = 'PARALLEL',
    PERPENDICULAR = 'PERPENDICULAR',
    TANGENT = 'TANGENT',
    CONCENTRIC = 'CONCENTRIC',
    COAXIAL = 'COAXIAL',
    SYMMETRIC = 'SYMMETRIC',
    EQUAL_RADIUS = 'EQUAL_RADIUS',
    COPLANAR = 'COPLANAR'
}

export interface OperationParameters {
    vector?: [number, number, number];
    distance?: number;
    angle?: number;
    targetFaceId?: string;
    targetVertexId?: string;
    targetSurfaceType?: string;
    preserveIntent?: GeometricIntent[];
}

export interface DirectModelingTransaction {
    transactionId: string;
    originalBRepHash: string;
    targetEntities: SelectedEntity[];
    operation: DirectModelingOperationType;
    parameters: OperationParameters;
    status: 'PENDING' | 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';
    failureReason?: string;
    errorCode?: string;
    newBRepHash?: string;
    evidenceId?: string;
    invalidatedDependencies?: string[];
}

export class DirectModelingError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'DirectModelingError';
    }
}
