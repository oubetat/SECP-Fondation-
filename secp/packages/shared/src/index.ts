/**
 * SECP Shared Utilities Package
 */
export function generateSecpHash(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(12, '0');
}

export function formatEngineeringValue(val: number, unit: string): string {
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${unit}`;
}
