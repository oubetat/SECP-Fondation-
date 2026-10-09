
const fs = require('fs');
const path = require('path');

const dir = './src/engine/materials';
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace source objects missing evidenceStatus
    // Look for patterns like source: { ... }
    // This is a bit risky with regex, but let's try a targeted one for the known missing property.
    
    const updatedContent = content.replace(/source:\s*{([^}]*)}/g, (match, p1) => {
      if (p1.includes('sourceId') && !p1.includes('evidenceStatus')) {
        // Add evidenceStatus
        return `source: {${p1.trim()}, evidenceStatus: 'VERIFIED' }`;
      }
      return match;
    });

    if (content !== updatedContent) {
      console.log(`Updated ${filePath}`);
      fs.writeFileSync(filePath, updatedContent);
    }
  }
});
