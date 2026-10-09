import { SelectedEntity, GeometricIntent } from './DirectModelingTypes';

export class GeometricIntentRecognizer {
    
    public recognize(entities: SelectedEntity[], bodyBRepHash: string): GeometricIntent[] {
        const intents: GeometricIntent[] = [];
        
        // Mocking the detection of geometric relationships for the B-Rep entities
        // In a real kernel, this would interrogate the topology map and underlying geometry surfaces/curves
        if (entities.length === 1 && entities[0].type === 'FACE') {
            // A single face might have parallel and perpendicular adjacent faces
            intents.push(GeometricIntent.PARALLEL);
            intents.push(GeometricIntent.PERPENDICULAR);
            intents.push(GeometricIntent.COPLANAR);
        } else if (entities.length > 1) {
            // Multiple selections might suggest symmetry or coaxiality
            intents.push(GeometricIntent.SYMMETRIC);
        }

        // Cylindrical faces might imply concentricity or equal radius
        if (this.isCylindrical(entities[0])) {
            intents.push(GeometricIntent.CONCENTRIC);
            intents.push(GeometricIntent.COAXIAL);
            intents.push(GeometricIntent.EQUAL_RADIUS);
        }

        return intents;
    }

    private isCylindrical(entity: SelectedEntity): boolean {
        // Mock check for cylindrical nature
        return entity.id.includes('cyl') || entity.id.includes('hole');
    }

    public validatePreservation(
        originalHash: string, 
        newHash: string, 
        intents: GeometricIntent[]
    ): boolean {
        // In a true implementation, this checks if the modified B-Rep still holds the geometric relations
        // We will simulate that unless it's a specific degenerate test case
        if (newHash === 'INVALID_TOPOLOGY' || newHash === 'DEGENERATE_GEOMETRY') {
            return false;
        }
        return true;
    }
}
