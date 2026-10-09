import { 
    HybridConflict, 
    ConflictResolutionOption, 
    PatternMode, 
    MirrorMode 
} from './HybridModelingTypes';
import { DirectModelingOperationType, GeometricIntent } from '../direct/DirectModelingTypes';

export interface ConstraintCheckResult {
    hasConflict: boolean;
    conflict?: HybridConflict;
    preservedIntents: GeometricIntent[];
    brokenIntents: GeometricIntent[];
}

export class HybridConstraintResolver {

    public resolveDirectEdit(
        featureId: string,
        operation: DirectModelingOperationType,
        targetEntityIds: string[],
        existingParameters: Record<string, any>,
        activeConstraints: string[],
        patternMode?: PatternMode,
        mirrorMode?: MirrorMode
    ): ConstraintCheckResult {
        const preservedIntents: GeometricIntent[] = [];
        const brokenIntents: GeometricIntent[] = [];

        // Check for pattern conflicts
        if (activeConstraints.includes('PATTERN_MEMBER') && patternMode === undefined) {
            return {
                hasConflict: true,
                conflict: {
                    conflictId: `cfl_${Date.now()}_pattern`,
                    featureId,
                    description: 'Direct edit affects a Pattern member. Choose whether to update all pattern instances or break pattern link.',
                    options: ['Preserve Parametric Intent', 'Preserve Direct Geometry', 'Cancel']
                },
                preservedIntents,
                brokenIntents
            };
        }

        // Check for mirror symmetry conflicts
        if (activeConstraints.includes('MIRROR_MEMBER') && mirrorMode === undefined) {
            return {
                hasConflict: true,
                conflict: {
                    conflictId: `cfl_${Date.now()}_mirror`,
                    featureId,
                    description: 'Direct edit affects a Mirrored feature. Choose whether to modify original symmetric parent or break symmetry.',
                    options: ['Preserve Parametric Intent', 'Preserve Direct Geometry', 'Cancel']
                },
                preservedIntents,
                brokenIntents
            };
        }

        // Check for parameter lock conflicts (e.g., fixed length constraint)
        if (activeConstraints.includes('FIXED_PARAMETRIC_DIMENSION') && operation === DirectModelingOperationType.PUSH_PULL) {
            return {
                hasConflict: true,
                conflict: {
                    conflictId: `cfl_${Date.now()}_fixed_dim`,
                    featureId,
                    description: 'Direct Push/Pull conflicts with fixed parametric dimension parameter.',
                    options: ['Edit Parameters', 'Preserve Direct Geometry', 'Remove Direct Override', 'Cancel']
                },
                preservedIntents,
                brokenIntents
            };
        }

        // Standard intent resolution
        preservedIntents.push(GeometricIntent.PARALLEL, GeometricIntent.PERPENDICULAR);

        return {
            hasConflict: false,
            preservedIntents,
            brokenIntents
        };
    }
}
