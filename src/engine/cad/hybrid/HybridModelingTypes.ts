import { DirectModelingOperationType, SelectedEntity, GeometricIntent } from '../direct/DirectModelingTypes';

export type EquivalenceStatus = 'EQUIVALENT' | 'PARTIALLY_EQUIVALENT' | 'NON_EQUIVALENT' | 'UNPROVEN';

export type FeatureEditLevel = 
    | 'LEVEL1_PARAMETER' 
    | 'LEVEL2_FEATURE' 
    | 'LEVEL3_FACE' 
    | 'LEVEL4_EDGE' 
    | 'LEVEL5_VERTEX';

export type PatternMode = 'EDIT_INSTANCE' | 'EDIT_PATTERN';
export type MirrorMode = 'MODIFY_ORIGINAL' | 'BREAK_SYMMETRY';

export type HybridNodeType = 'PARAMETRIC' | 'DIRECT_OVERRIDE' | 'HYBRID';

export interface HybridFeatureNode {
    featureId: string;
    name: string;
    nodeType: HybridNodeType;
    sourceFeatureId?: string;
    directOperation?: DirectModelingOperationType;
    parameters: Record<string, any>;
    geometryBeforeHash: string;
    geometryAfterHash: string;
    equivalenceStatus: EquivalenceStatus;
    dependencies: string[];
    evidenceId?: string;
    isPatternInstance?: boolean;
    patternId?: string;
    isMirrorChild?: boolean;
    mirrorId?: string;
}

export type ConflictResolutionOption = 
    | 'Preserve Parametric Intent' 
    | 'Preserve Direct Geometry' 
    | 'Edit Parameters' 
    | 'Remove Direct Override' 
    | 'Cancel';

export interface HybridConflict {
    conflictId: string;
    featureId: string;
    description: string;
    options: ConflictResolutionOption[];
}

export interface HybridTransaction {
    transactionId: string;
    modelRevision: string;
    featureRevision: string;
    bRepHashBefore: string;
    bRepHashAfter: string;
    parametersBefore: Record<string, any>;
    parametersAfter: Record<string, any>;
    directOperation?: DirectModelingOperationType;
    equivalenceResult: EquivalenceStatus;
    constraintChanges: string[];
    dependencyChanges: string[];
    validationResult: 'VALID' | 'INVALID';
    evidenceHash: string;
    timestamp: string;
    status: 'COMMITTED' | 'ROLLED_BACK' | 'FAILED';
    failureReason?: string;
    editLevel?: FeatureEditLevel;
}

export interface EquivalenceMetrics {
    volumeDelta: number;
    surfaceAreaDelta: number;
    faceCountMatch: boolean;
    edgeCountMatch: boolean;
    vertexCountMatch: boolean;
    topologicalCorrespondence: boolean;
    maxGeometricDistance: number;
}

export class HybridModelingError extends Error {
    constructor(public code: string, message: string) {
        super(message);
        this.name = 'HybridModelingError';
    }
}
