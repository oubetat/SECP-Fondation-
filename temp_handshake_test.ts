import { initializeAuthorityHandshake } from './src/engine/simulation/SimulationAuthorityInternal';
import { SimulationEngine } from './src/engine/simulation/SimulationEngine';

try {
    const key = initializeAuthorityHandshake();
    console.log('Handshake Success, Key type:', typeof key);
    SimulationEngine.bootAuthority(key);
    console.log('Boot Success');
} catch (e) {
    console.log('Handshake Failed:', e.message);
}
