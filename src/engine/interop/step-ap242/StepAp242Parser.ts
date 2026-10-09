/**
 * SECP Industrial OS v2 — STEP AP242 Parser
 * PATCH-034/PATCH-329B: STEP AP242 Deterministic Grammar Parser
 */

import { StepParsedFile, StepEntity, StepHeader, StepData } from './StepAp242Types';

export interface StepRef {
  readonly ref: number;
}

export function isStepRef(val: any): val is StepRef {
  return typeof val === 'object' && val !== null && typeof (val as any).ref === 'number';
}

export function getRefId(val: any): number | undefined {
  if (isStepRef(val)) return val.ref;
  if (typeof val === 'number' && Number.isInteger(val) && val > 0) return val;
  return undefined;
}

export class StepAp242Parser {
  /**
   * Parses ISO 10303-21 Physical File into structured StepParsedFile.
   */
  public static parse(content: string): StepParsedFile {
    if (!content || typeof content !== 'string') {
      throw new Error('STEP_PARSE_ERROR: Empty or invalid content');
    }

    // 1. Strip UTF-8 BOM if present
    let raw = content.startsWith('\uFEFF') ? content.slice(1) : content;

    // 2. Tokenize statements using Part-21 lexer (respecting quotes, escaped quotes, comments)
    const statements = this.tokenizeStatements(raw);

    if (statements.length === 0) {
      throw new Error('STEP_PARSE_ERROR: File contains no statements');
    }

    // 3. Verify ISO-10303-21 header guard
    const firstStmt = statements[0].toUpperCase();
    if (!firstStmt.startsWith('ISO-10303-21')) {
      throw new Error('STEP_PARSE_ERROR: Invalid ISO-10303-21 header');
    }

    // 4. Extract Header & Data statements
    const headerIndex = statements.findIndex(s => s.toUpperCase() === 'HEADER');
    if (headerIndex === -1) throw new Error('STEP_PARSE_ERROR: Missing HEADER section');

    const firstEndSec = statements.findIndex((s, idx) => idx > headerIndex && s.toUpperCase() === 'ENDSEC');
    if (firstEndSec === -1) throw new Error('STEP_PARSE_ERROR: Missing ENDSEC for HEADER');

    const dataIndex = statements.findIndex((s, idx) => idx > firstEndSec && s.toUpperCase() === 'DATA');
    if (dataIndex === -1) throw new Error('STEP_PARSE_ERROR: Missing DATA section');

    const secondEndSec = statements.findIndex((s, idx) => idx > dataIndex && s.toUpperCase() === 'ENDSEC');
    if (secondEndSec === -1) throw new Error('STEP_PARSE_ERROR: Missing ENDSEC for DATA');

    const headerStmts = statements.slice(headerIndex + 1, firstEndSec);
    const dataStmts = statements.slice(dataIndex + 1, secondEndSec);

    const header = this.parseHeaderStatements(headerStmts);
    const data = this.parseDataStatements(dataStmts);

    return { header, data };
  }

  /**
   * Grammar-aware Part-21 statement tokenizer.
   * Splitting occurs strictly on ';' that are OUTSIDE single-quoted strings and C-style comments.
   */
  private static tokenizeStatements(text: string): string[] {
    const statements: string[] = [];
    let current = '';
    let inString = false;
    let inComment = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inComment) {
        if (char === '*' && nextChar === '/') {
          inComment = false;
          i++; // Skip '/'
        }
        continue;
      }

      if (inString) {
        if (char === "'") {
          if (nextChar === "'") {
            // Escaped single quote inside string literal: ''
            current += "'";
            i++; // Skip second quote
          } else {
            inString = false;
            current += "'";
          }
        } else {
          current += char;
        }
        continue;
      }

      // Outside strings and comments
      if (char === '/' && nextChar === '*') {
        inComment = true;
        i++; // Skip '*'
        continue;
      }

      if (char === "'") {
        inString = true;
        current += "'";
        continue;
      }

      if (char === ';') {
        const trimmed = current.trim();
        if (trimmed) statements.push(trimmed);
        current = '';
        continue;
      }

      // Replace newlines/tabs with space outside strings
      if (char === '\r' || char === '\n' || char === '\t') {
        if (current.length > 0 && !current.endsWith(' ')) {
          current += ' ';
        }
      } else {
        current += char;
      }
    }

    const finalTrim = current.trim();
    if (finalTrim) statements.push(finalTrim);

    return statements;
  }

  private static parseHeaderStatements(headerStmts: string[]): StepHeader {
    let fileDescription: string[] = [];
    let fileName = '';
    let timeStamp = '';
    let author: string[] = [];
    let organization: string[] = [];
    let preprocessorVersion = '';
    let originatingSystem = '';
    let authorization = '';
    let fileSchema: string[] = [];

    for (const stmt of headerStmts) {
      const parenIdx = stmt.indexOf('(');
      if (parenIdx === -1) continue;

      const keyword = stmt.slice(0, parenIdx).trim().toUpperCase();
      const paramsRaw = stmt.slice(parenIdx + 1, stmt.lastIndexOf(')')).trim();
      const parsedParams = this.parseParameters(paramsRaw);

      if (keyword === 'FILE_DESCRIPTION') {
        fileDescription = Array.isArray(parsedParams[0]) ? parsedParams[0].map(String) : [String(parsedParams[0] || '')];
      } else if (keyword === 'FILE_NAME') {
        fileName = String(parsedParams[0] || '');
        timeStamp = String(parsedParams[1] || '');
        author = Array.isArray(parsedParams[2]) ? parsedParams[2].map(String) : [String(parsedParams[2] || '')];
        organization = Array.isArray(parsedParams[3]) ? parsedParams[3].map(String) : [String(parsedParams[3] || '')];
        preprocessorVersion = String(parsedParams[4] || '');
        originatingSystem = String(parsedParams[5] || '');
        authorization = String(parsedParams[6] || '');
      } else if (keyword === 'FILE_SCHEMA') {
        fileSchema = Array.isArray(parsedParams[0]) ? parsedParams[0].map(String) : [String(parsedParams[0] || '')];
      }
    }

    if (fileSchema.length === 0) {
      throw new Error('STEP_PARSE_ERROR: FILE_SCHEMA statement is missing or empty in header');
    }

    return {
      fileDescription,
      fileName,
      timeStamp,
      author,
      organization,
      preprocessorVersion,
      originatingSystem,
      authorization,
      fileSchema
    };
  }

  private static parseDataStatements(dataStmts: string[]): StepData {
    const entities = new Map<number, StepEntity>();

    for (const stmt of dataStmts) {
      const eqIdx = stmt.indexOf('=');
      if (eqIdx === -1 || !stmt.startsWith('#')) continue;

      const idStr = stmt.slice(1, eqIdx).trim();
      const id = parseInt(idStr, 10);
      if (isNaN(id)) continue;

      const rhs = stmt.slice(eqIdx + 1).trim();
      const parenIdx = rhs.indexOf('(');
      if (parenIdx === -1) continue;

      const type = rhs.slice(0, parenIdx).trim().toUpperCase();
      const paramsRaw = rhs.slice(parenIdx + 1, rhs.lastIndexOf(')')).trim();
      const params = this.parseParameters(paramsRaw);

      entities.set(id, { id, type, parameters: params });
    }

    return { entities };
  }

  /**
   * Parses parameters inside STEP entity parentheses, handling strings, lists, typed values, refs, numbers.
   */
  public static parseParameters(raw: string): any[] {
    const params: any[] = [];
    if (!raw) return params;

    let current = '';
    let depth = 0;
    let inString = false;

    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const nextChar = raw[i + 1];

      if (inString) {
        if (char === "'") {
          if (nextChar === "'") {
            current += "'";
            i++;
          } else {
            inString = false;
            current += "'";
          }
        } else {
          current += char;
        }
        continue;
      }

      if (char === "'") {
        inString = true;
        current += "'";
        continue;
      }

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        params.push(this.cleanParam(current));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(this.cleanParam(current));
    }

    return params;
  }

  private static cleanParam(p: string): any {
    p = p.trim();
    if (!p) return null;

    // String literal
    if (p.startsWith("'") && p.endsWith("'")) {
      return p.slice(1, -1);
    }

    // Entity Reference #123
    if (p.startsWith('#')) {
      const refId = parseInt(p.slice(1), 10);
      return isNaN(refId) ? p : { ref: refId };
    }

    // Nested list (...)
    if (p.startsWith('(') && p.endsWith(')')) {
      return this.parseParameters(p.slice(1, -1));
    }

    // STEP Enumerations / Booleans / Unset
    if (p.toUpperCase() === '.T.') return true;
    if (p.toUpperCase() === '.F.') return false;
    if (p === '*' || p === '$') return null;

    // Typed parameter e.g. LENGTH_MEASURE(10.0)
    const parenIdx = p.indexOf('(');
    if (parenIdx > 0 && p.endsWith(')')) {
      const inner = p.slice(parenIdx + 1, -1);
      const parsedInner = this.parseParameters(inner);
      return parsedInner.length === 1 ? parsedInner[0] : parsedInner;
    }

    const num = parseFloat(p);
    return isNaN(num) ? p : num;
  }
}
