
import initOpenCascade from 'opencascade.js';

console.log('Attempting to load OCCT...');
initOpenCascade().then(oc => {
  console.log('Success! OCCT Loaded.');
  process.exit(0);
}).catch(err => {
  console.error('Failed to load OCCT:', err);
  process.exit(1);
});
