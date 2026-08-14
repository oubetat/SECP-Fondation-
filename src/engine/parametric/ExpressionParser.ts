import { UnitEngine, UNIT_DEFINITIONS, UnitCategory } from '../units';

export interface EvaluatedValue {
  value: number;
  unitCategory?: UnitCategory;
  unitSymbol?: string;
}

export class ExpressionParser {
  /**
   * Extract all variable identifier names used in an expression string.
   */
  public static extractVariables(expression: string): string[] {
    // Remove functions min, max, abs, sqrt, sin, cos
    const sanitized = expression.replace(/\b(min|max|abs|sqrt|sin|cos)\b/g, ' ');
    // Match identifiers starting with letter/underscore followed by alphanumeric/underscore
    const matches = sanitized.match(/\b[a-zA-Z_][a-zA-Z0-9_.]*\b/g);
    if (!matches) return [];
    // Filter out pure keywords / numbers
    const vars = new Set<string>();
    for (const token of matches) {
      if (!['true', 'false', 'null', 'undefined', 'Math', 'PI', 'E'].includes(token)) {
        vars.add(token);
      }
    }
    return Array.from(vars);
  }

  /**
   * Evaluate mathematical expression safely given variable values and their units.
   */
  public static evaluate(
    expression: string,
    variableMap: Record<string, EvaluatedValue | number>,
    expectedCategory?: UnitCategory
  ): EvaluatedValue {
    if (!expression || expression.trim() === '') {
      throw new Error('Empty expression');
    }

    const trimmed = expression.trim();

    // Check if expression is pure number or number with unit, e.g. "100mm", "5kg", "25.4"
    const numberWithUnitMatch = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z/]+)?$/);
    if (numberWithUnitMatch) {
      const numVal = parseFloat(numberWithUnitMatch[1]);
      const unitSym = numberWithUnitMatch[2];
      if (unitSym && UNIT_DEFINITIONS[unitSym]) {
        const cat = UNIT_DEFINITIONS[unitSym].category;
        return { value: numVal, unitCategory: cat, unitSymbol: unitSym };
      } else if (!unitSym) {
        return { value: numVal };
      }
    }

    // Extract vars and build scope
    const vars = this.extractVariables(trimmed);
    const scope: Record<string, number> = {};
    let dominantCategory: UnitCategory | undefined;
    let dominantUnitSymbol: string | undefined;

    for (const v of vars) {
      if (!(v in variableMap)) {
        throw new Error(`Undefined variable '${v}' in expression '${expression}'`);
      }
      const raw = variableMap[v];
      if (typeof raw === 'number') {
        scope[v] = raw;
      } else {
        scope[v] = raw.value;
        if (raw.unitCategory) {
          if (!dominantCategory) {
            dominantCategory = raw.unitCategory;
            dominantUnitSymbol = raw.unitSymbol;
          }
        }
      }
    }

    // Tokenize/Validate for safety
    // Replace variable names with numbers in math context
    let jsExpr = trimmed;
    // Replace functions
    jsExpr = jsExpr.replace(/\bmin\b/g, 'Math.min');
    jsExpr = jsExpr.replace(/\bmax\b/g, 'Math.max');
    jsExpr = jsExpr.replace(/\babs\b/g, 'Math.abs');
    jsExpr = jsExpr.replace(/\bsqrt\b/g, 'Math.sqrt');
    jsExpr = jsExpr.replace(/\bsin\b/g, 'Math.sin');
    jsExpr = jsExpr.replace(/\bcos\b/g, 'Math.cos');
    jsExpr = jsExpr.replace(/\bPI\b/g, 'Math.PI');

    // Replace variables sorted by length descending so sub-tokens aren't replaced
    const sortedVars = [...vars].sort((a, b) => b.length - a.length);
    for (const v of sortedVars) {
      const regex = new RegExp(`\\b${v.replace('.', '\\.')}\\b`, 'g');
      jsExpr = jsExpr.replace(regex, `(${scope[v]})`);
    }

    // Sanity check JS expression: allowed chars: digits, operators, parens, Math functions, spaces, decimal dots
    const cleanCheck = jsExpr.replace(/Math\.(min|max|abs|sqrt|sin|cos|PI)/g, '');
    if (/[^0-9\s\+\-\*\/\%\^\(\)\,\.]/.test(cleanCheck)) {
      throw new Error(`Invalid syntax or unhandled characters in expression '${expression}'`);
    }

    // Evaluate in function scope
    let resultNumber: number;
    try {
      // Handle ^ exponent operator
      const evalExpr = jsExpr.replace(/(\d+(?:\.\d+)?|\([^\)]+\))\s*\^\s*(\d+(?:\.\d+)?|\([^\)]+\))/g, 'Math.pow($1, $2)');
      const fn = new Function(`return (${evalExpr});`);
      resultNumber = fn();
    } catch (e: any) {
      throw new Error(`Failed to evaluate expression '${expression}': ${e.message}`);
    }

    if (typeof resultNumber !== 'number' || isNaN(resultNumber) || !isFinite(resultNumber)) {
      throw new Error(`Expression '${expression}' evaluated to invalid number`);
    }

    if (expectedCategory && dominantCategory && expectedCategory !== dominantCategory) {
      throw new Error(`Unit category mismatch: expression category ${dominantCategory} does not match expected ${expectedCategory}`);
    }

    return {
      value: resultNumber,
      unitCategory: dominantCategory || expectedCategory,
      unitSymbol: dominantUnitSymbol
    };
  }

  /**
   * Check if adding two quantities is unit-compatible.
   */
  public static checkUnitCompatibility(
    unitA?: string,
    unitB?: string
  ): { compatible: boolean; category?: UnitCategory; message?: string } {
    if (!unitA || !unitB) {
      return { compatible: true };
    }
    const defA = UNIT_DEFINITIONS[unitA];
    const defB = UNIT_DEFINITIONS[unitB];
    if (!defA || !defB) {
      return { compatible: true };
    }
    if (defA.category !== defB.category) {
      return {
        compatible: false,
        message: `Unit mismatch: '${unitA}' (${defA.category}) is incompatible with '${unitB}' (${defB.category})`
      };
    }
    return { compatible: true, category: defA.category };
  }
}
