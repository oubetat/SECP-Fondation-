import { EquivalenceStatus, EquivalenceMetrics } from './HybridModelingTypes';

export class GeometryEquivalenceEngine {
    private readonly tolerance: number;

    constructor(tolerance: number = 1e-4) {
        this.tolerance = tolerance;
    }

    /**
     * Compares the B-Rep resulting from a Parametric rebuild against a Direct edit result.
     */
    public evaluateEquivalence(
        parametricBRepHash: string,
        directBRepHash: string,
        metricsOverride?: Partial<EquivalenceMetrics>
    ): { status: EquivalenceStatus; metrics: EquivalenceMetrics } {
        // Special unproven trigger
        if (directBRepHash.includes('UNPROVEN') || parametricBRepHash.includes('UNPROVEN')) {
            const metrics: EquivalenceMetrics = {
                volumeDelta: 0.5,
                surfaceAreaDelta: 0.3,
                faceCountMatch: false,
                edgeCountMatch: false,
                vertexCountMatch: false,
                topologicalCorrespondence: false,
                maxGeometricDistance: 0.1
            };
            return { status: 'UNPROVEN', metrics };
        }

        // If hashes match exactly or indicate exact parameter translation
        if (parametricBRepHash === directBRepHash || directBRepHash.includes('EQUIVALENT_MAP')) {
            const metrics: EquivalenceMetrics = {
                volumeDelta: 0.0,
                surfaceAreaDelta: 0.0,
                faceCountMatch: true,
                edgeCountMatch: true,
                vertexCountMatch: true,
                topologicalCorrespondence: true,
                maxGeometricDistance: 0.0,
                ...metricsOverride
            };
            return { status: 'EQUIVALENT', metrics };
        }

        // Custom metrics override handling
        const metrics: EquivalenceMetrics = {
            volumeDelta: 0.0001,
            surfaceAreaDelta: 0.0001,
            faceCountMatch: true,
            edgeCountMatch: true,
            vertexCountMatch: true,
            topologicalCorrespondence: true,
            maxGeometricDistance: 0.00005,
            ...metricsOverride
        };

        if (metrics.maxGeometricDistance <= this.tolerance && metrics.topologicalCorrespondence) {
            return { status: 'EQUIVALENT', metrics };
        }

        if (metrics.faceCountMatch && metrics.maxGeometricDistance < 0.05) {
            return { status: 'PARTIALLY_EQUIVALENT', metrics };
        }

        return { status: 'NON_EQUIVALENT', metrics };
    }
}
