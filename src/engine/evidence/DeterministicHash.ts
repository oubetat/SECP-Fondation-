/**
 * Deterministic hash utility for engineering evidence and reproducibility.
 * Ensures consistent output for identical object structures regardless of key order.
 */

export function generateDeterministicHashSync(obj: any): string {
  const str = stringifyDeterministic(obj);
  return simpleHash(str);
}

function stringifyDeterministic(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(stringifyDeterministic).join(',') + ']';
  }

  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${stringifyDeterministic(obj[k])}`).join(',') + '}';
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
