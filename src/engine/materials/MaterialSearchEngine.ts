import { MaterialRecord, DatabaseNamespace } from "./dbTypes";
import { MaterialDatabaseService } from "./MaterialDatabaseService";

export interface SearchCriteria {
  canonicalName?: string;
  family?: string;
  grade?: string;
  namespace?: DatabaseNamespace;
  propertyRange?: {
    name: string;
    min?: number;
    max?: number;
  };
}

export class MaterialSearchEngine {
  public static search(criteria: SearchCriteria): MaterialRecord[] {
    const all = MaterialDatabaseService.getAllRecords();
    
    return all.filter(record => {
      if (criteria.canonicalName && !record.canonicalName.toLowerCase().includes(criteria.canonicalName.toLowerCase())) {
        return false;
      }
      if (criteria.family && record.family !== criteria.family) {
        return false;
      }
      if (criteria.grade && record.gradeId !== criteria.grade) {
        return false;
      }
      if (criteria.namespace && record.namespace !== criteria.namespace) {
        return false;
      }
      if (criteria.propertyRange) {
        const prop = record.properties.find(p => p.name === criteria.propertyRange?.name);
        if (!prop) return false;
        if (criteria.propertyRange.min !== undefined && prop.value < criteria.propertyRange.min) return false;
        if (criteria.propertyRange.max !== undefined && prop.value > criteria.propertyRange.max) return false;
      }
      return true;
    });
  }
}
