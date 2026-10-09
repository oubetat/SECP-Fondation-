const fs = require('fs');
const content = fs.readFileSync('src/engine/cad/pmi/PMIEngine.ts', 'utf8');

const targetFunction = `  public static verifyGeometryAssociation(pmi: PMISemanticDefinition, doc: EngineeringDocument): boolean {
    if (!pmi.featureReferences || pmi.featureReferences.length === 0) {
      return false;
    }
    return pmi.featureReferences.every(ref => {
      if (!ref.sourceId || typeof ref.sourceId !== 'string' || ref.sourceId.trim() === '') {
        return false;
      }
      const sid = ref.sourceId.toLowerCase();
      if (sid.includes('dangling') || sid.includes('missing') || sid.includes('invalid') || sid.includes('unresolved')) {
        return false;
      }
      if (doc.topologyMap && Object.keys(doc.topologyMap).length > 0) {
        return Boolean((doc.topologyMap as any)[ref.sourceId]);
      }
      return true;
    });
  }`;

const replacement = `  public static verifyGeometryAssociation(pmi: PMISemanticDefinition, doc: EngineeringDocument): boolean {
    if (!pmi.featureReferences || pmi.featureReferences.length === 0) {
      return false;
    }
    if (!doc.topologyMap || Object.keys(doc.topologyMap).length === 0) {
      return false;
    }
    return pmi.featureReferences.every(ref => {
      if (!ref.sourceId || typeof ref.sourceId !== 'string' || ref.sourceId.trim() === '') {
        return false;
      }
      const sid = ref.sourceId.toLowerCase();
      if (sid.includes('dangling') || sid.includes('missing') || sid.includes('invalid') || sid.includes('unresolved')) {
        return false;
      }
      const tMap = doc.topologyMap as any;
      let resolved = false;

      if (tMap.faceMap && (ref.sourceId in tMap.faceMap)) resolved = true;
      else if (tMap.edgeMap && (ref.sourceId in tMap.edgeMap)) resolved = true;
      else if (tMap.vertexMap && (ref.sourceId in tMap.vertexMap)) resolved = true;
      else if (tMap.entries) {
        if (tMap.entries instanceof Map) resolved = tMap.entries.has(ref.sourceId);
        else resolved = (ref.sourceId in tMap.entries);
      }
      else if (tMap.elements) {
        if (tMap.elements instanceof Map) resolved = tMap.elements.has(ref.sourceId);
        else resolved = (ref.sourceId in tMap.elements);
      }
      else if (ref.sourceId in tMap) {
        resolved = true;
      }
      
      return resolved;
    });
  }`;

const newContent = content.replace(targetFunction, replacement);
if(newContent === content) {
    // If exact match failed, let's try a regex approach
    console.log("Strict replace failed, trying regex");
    const regex = /public static verifyGeometryAssociation[\s\S]*?return true;\s*}\s*}\);\s*}/m;
    const newContent2 = content.replace(regex, replacement);
    if(newContent2 === content) {
        console.log("Regex replace failed too.");
    } else {
        fs.writeFileSync('src/engine/cad/pmi/PMIEngine.ts', newContent2);
        console.log("Regex replace succeeded.");
    }
} else {
    fs.writeFileSync('src/engine/cad/pmi/PMIEngine.ts', newContent);
    console.log("Strict replace succeeded.");
}
