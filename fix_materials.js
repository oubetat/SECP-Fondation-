const fs = require('fs');
let code = fs.readFileSync('src/components/CadViewport3D.tsx', 'utf8');

// 1. Group recreation
code = code.replace(
`      const group = meshesGroupRef.current;
      
      // Ensure group is attached to scene
      if (sceneRef.current && !sceneRef.current.children.includes(group)) {
        sceneRef.current.add(group);
      }

      // Clear previous meshes
      while (group.children.length > 0) {
        group.remove(group.children[0]);
      }`,
`      // Safely recreate group to avoid caching/rendering issues
      if (sceneRef.current && sceneRef.current.children.includes(meshesGroupRef.current)) {
        sceneRef.current.remove(meshesGroupRef.current);
      }
      const group = new THREE.Group();
      meshesGroupRef.current = group;
      if (sceneRef.current) {
        sceneRef.current.add(group);
      }`
);

// 2. Material Helper
const matHelper = `
      const getMat = (opts) => {
        if (showSectionPlane && clippingPlaneRef.current) {
          opts.clippingPlanes = [clippingPlaneRef.current];
        }
        return new THREE.MeshStandardMaterial(opts);
      };
`;

code = code.replace(
`      if (engineSimActive) {`,
matHelper + `\n      if (engineSimActive) {`
);

// 3. Replace MeshPhongMaterial blocks
code = code.replace(/const blockMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const blockMat = getMat({ color: 0x475569, metalness: 0.3, roughness: 0.4, wireframe: wireframeMode });`);
code = code.replace(/const headCoverMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const headCoverMat = getMat({ color: 0xd97706, metalness: 0.4, roughness: 0.2, wireframe: wireframeMode });`);
code = code.replace(/const plugMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const plugMat = getMat({ color: 0xf8fafc, metalness: 0.8, roughness: 0.2 });`);
code = code.replace(/const pipeMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const pipeMat = getMat({ color: 0x64748b, metalness: 0.6, roughness: 0.3 });`);
code = code.replace(/const steelMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const steelMat = getMat({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.1, wireframe: wireframeMode });`);
code = code.replace(/const flywheelMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const flywheelMat = getMat({ color: 0x06b6d4, metalness: 0.5, roughness: 0.2, wireframe: wireframeMode });`);
code = code.replace(/const pulleyMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const pulleyMat = getMat({ color: 0x334155, metalness: 0.5, roughness: 0.3 });`);
code = code.replace(/const pistonMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const pistonMat = getMat({ color: 0xf1f5f9, metalness: 0.6, roughness: 0.2, wireframe: wireframeMode });`);
code = code.replace(/const rodMat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/, `const rodMat = getMat({ color: 0xf59e0b, metalness: 0.7, roughness: 0.2, wireframe: wireframeMode });`);
code = code.replace(/const mat = new THREE\.MeshPhongMaterial\(\{[\s\S]*?\}\);/g, `const mat = getMat({ color: new THREE.Color(comp ? comp.colorHex : (activeSolid.colorHex || '#3b82f6')), metalness: 0.3, roughness: 0.3, wireframe: wireframeMode });`);

// Fix activeSolid / comp fallback syntax issue with the regex above
code = code.replace(/comp \? comp\.colorHex : \(activeSolid\.colorHex \|\| '#3b82f6'\)/g, `typeof comp !== 'undefined' ? comp.colorHex : (activeSolid?.colorHex || '#3b82f6')`);

fs.writeFileSync('src/components/CadViewport3D.tsx', code);
