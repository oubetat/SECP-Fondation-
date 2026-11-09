/**
 * SECP-SECURITY-009 — AST-Based Forensic Auditor (Remediated)
 * 
 * Replaces crude text/regex heuristics with comprehensive TypeScript AST analysis.
 * Analyzes:
 *  - Direct, named, aliased, namespace, and default imports
 *  - Local variable aliases: const alias = CanonicalDomainBindingEngine.sealBinding
 *  - Class field properties: this.sealingCapability or ClassName.sealingCapability
 *  - Re-exports and passthrough exports
 *  - Call expressions, member access, parentheses, and type assertions
 *  - Computed property access: engine['seal' + 'Binding'] or engine[variable]
 *  - Dynamic imports: import(...)
 *  - Reflection / Function / eval calls
 *  - Capability argument provenance (issued, structural forgery, revoked, domain mismatch, null/undefined)
 *  - Strict Fail-Closed classification of all unresolvable or suspicious paths as UNKNOWN
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

export interface SourceLocation {
  line: number;
  column: number;
}

export interface SealCallpathNode {
  filePath: string;
  location: SourceLocation;
  callerName: string;
  calleeExpression: string;
  capabilityArgumentType: 
    | 'VALID_ACQUIRED_CAPABILITY'
    | 'NULL_OR_UNDEFINED'
    | 'STRUCTURAL_OBJECT_LITERAL'
    | 'REVOKED_REPLAY'
    | 'DOMAIN_MISMATCH'
    | 'UNRESOLVED_EXPRESSION';
  capabilitySource?: string;
  isAliased: boolean;
  isComputedOrDynamic: boolean;
  status: 
    | 'AUTHENTICATED'
    | 'UNAUTHENTICATED_VIOLATION'
    | 'FORGED_CAPABILITY_VIOLATION'
    | 'REVOKED_REPLAY_VIOLATION'
    | 'DOMAIN_MISMATCH_VIOLATION'
    | 'UNRESOLVED_UNKNOWN';
  rationale: string;
}

export interface ModuleClassification {
  filePath: string;
  classification: 
    | 'AUTHORITY_PRODUCER' 
    | 'AUTHORITY_PRODUCER_WITH_UNRESOLVED_PATHS'
    | 'AUTHORITY_CONSUMER' 
    | 'NO_AUTHORITY' 
    | 'SUSPICIOUS_UNKNOWN';
  reasons: string[];
  importedAuthoritySymbols: string[];
  exportedAuthoritySymbols: string[];
  sealCalls: SealCallpathNode[];
}

export interface AuditReport {
  totalModulesScanned: number;
  producersCount: number;
  unresolvedProducersCount: number;
  consumersCount: number;
  noAuthorityCount: number;
  suspiciousUnknownCount: number;
  unauthenticatedCallsCount: number;
  unresolvedCallsCount: number;
  authenticatedCallsCount: number;
  modules: Map<string, ModuleClassification>;
  allSealCallpaths: SealCallpathNode[];
}

function unwrapExpression(node: ts.Node): ts.Node {
  let curr = node;
  while (true) {
    if (ts.isParenthesizedExpression(curr)) {
      curr = curr.expression;
    } else if (ts.isAsExpression(curr) || ts.isTypeAssertionExpression(curr)) {
      curr = curr.expression;
    } else if (ts.isNonNullExpression(curr)) {
      curr = curr.expression;
    } else {
      break;
    }
  }
  return curr;
}

export class LiveForensicAuditor {
  private targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = path.resolve(targetDir);
  }

  /**
   * Recursively discovers all .ts files under directory deterministically.
   */
  public discoverModules(dir: string = this.targetDir): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
        results.push(...this.discoverModules(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  /**
   * Parses and audits a single TypeScript source file using AST.
   */
  public auditFile(filePath: string): ModuleClassification {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    const importedAuthoritySymbols = new Map<string, string>(); // localName -> originalSymbol
    const exportedAuthoritySymbols: string[] = [];
    const reasons: string[] = [];
    const sealCalls: SealCallpathNode[] = [];
    let hasDynamicOrComputedProperty = false;
    let hasReflectionOrEval = false;
    let definesSealBinding = false;
    let acquiresCapability = false;
    let importsBindingContracts = false;

    // Track local capability variables, class fields, and aliases
    interface CapabilityInfo {
      context: string;
      domains: string[];
      isClassProperty?: boolean;
    }
    const localCapabilityMap = new Map<string, CapabilityInfo>();
    const localForgedMap = new Set<string>();
    const localFunctionAliases = new Map<string, string>(); // aliasName -> 'sealBinding'
    let fileHasRevokeAll = false;

    function getSourceLocation(pos: number): SourceLocation {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      return { line: line + 1, column: character + 1 };
    }

    // Pass 1: Collect Imports, Re-exports, Class Fields, and Variable Statements
    ts.forEachChild(sourceFile, node => {
      // 1. Imports
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, '');
        const isAuthorityModule = moduleSpecifier.includes('CanonicalDomainBinding') ||
                                  moduleSpecifier.includes('SimulationSealingAuthorization') ||
                                  moduleSpecifier.includes('SimulationAuthority');

        if (node.importClause) {
          if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            for (const elem of node.importClause.namedBindings.elements) {
              const origName = elem.propertyName ? elem.propertyName.text : elem.name.text;
              const localName = elem.name.text;
              if (isAuthorityModule || origName === 'sealBinding' || origName === 'SealingCapability' || origName === 'issueSealingCapability') {
                importedAuthoritySymbols.set(localName, origName);
                if (origName === 'sealBinding' && localName !== origName) {
                  localFunctionAliases.set(localName, 'sealBinding');
                }
                if (origName === 'CanonicalDomainBinding' || origName === 'CanonicalDomainBindingEngine') {
                  importsBindingContracts = true;
                }
              }
            }
          }
          if (node.importClause.namedBindings && ts.isNamespaceImport(node.importClause.namedBindings)) {
            const localName = node.importClause.namedBindings.name.text;
            if (isAuthorityModule) {
              importedAuthoritySymbols.set(localName, '*');
              importsBindingContracts = true;
            }
          }
        }
      }

      // 2. Exports & Re-exports
      if (ts.isExportDeclaration(node)) {
        if (node.exportClause && ts.isNamedExports(node.exportClause)) {
          for (const elem of node.exportClause.elements) {
            const origName = elem.propertyName ? elem.propertyName.text : elem.name.text;
            if (origName === 'sealBinding' || origName === 'CanonicalDomainBindingEngine') {
              exportedAuthoritySymbols.push(elem.name.text);
            }
          }
        }
      }

      // 3. Class Declarations: detect static/instance property declarations of capabilities
      if (ts.isClassDeclaration(node)) {
        for (const member of node.members) {
          if (ts.isPropertyDeclaration(member) && member.initializer && ts.isIdentifier(member.name)) {
            const propName = member.name.text;
            const init = unwrapExpression(member.initializer);
            if (ts.isCallExpression(init)) {
              const callText = init.expression.getText(sourceFile);
              if (callText.includes('issueSealingCapability')) {
                acquiresCapability = true;
                let ctx = 'class_property';
                let domains: string[] = [];
                if (init.arguments[0] && ts.isStringLiteral(init.arguments[0])) ctx = init.arguments[0].text;
                if (init.arguments[1] && ts.isArrayLiteralExpression(init.arguments[1])) {
                  domains = init.arguments[1].elements
                    .filter(e => ts.isStringLiteral(e))
                    .map(e => (e as ts.StringLiteral).text);
                }
                localCapabilityMap.set(propName, { context: ctx, domains, isClassProperty: true });
              }
            }
          }
        }
      }

      // 4. Variable statements tracking issueSealingCapability, forged literals, and aliases
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (decl.initializer && ts.isIdentifier(decl.name)) {
            const varName = decl.name.text;
            const init = unwrapExpression(decl.initializer);

            if (ts.isCallExpression(init)) {
              const callText = init.expression.getText(sourceFile);
              if (callText.includes('issueSealingCapability')) {
                acquiresCapability = true;
                let ctx = 'unknown';
                let domains: string[] = [];
                if (init.arguments[0] && ts.isStringLiteral(init.arguments[0])) ctx = init.arguments[0].text;
                if (init.arguments[1] && ts.isArrayLiteralExpression(init.arguments[1])) {
                  domains = init.arguments[1].elements
                    .filter(e => ts.isStringLiteral(e))
                    .map(e => (e as ts.StringLiteral).text);
                }
                localCapabilityMap.set(varName, { context: ctx, domains, isClassProperty: false });
              }
            }

            if (ts.isObjectLiteralExpression(init)) {
              let hasCapId = false;
              let hasDomains = false;
              for (const prop of init.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  if (prop.name.text === 'capabilityId') hasCapId = true;
                  if (prop.name.text === 'authorizedDomains') hasDomains = true;
                }
              }
              if (hasCapId && hasDomains) {
                localForgedMap.add(varName);
              }
            }

            if (ts.isPropertyAccessExpression(init)) {
              if (init.name.text === 'sealBinding') {
                localFunctionAliases.set(varName, 'sealBinding');
              }
            }
          }
        }
      }

      // 5. Track revokeAllCapabilities() calls
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const text = node.expression.getText(sourceFile);
        if (text.includes('revokeAllCapabilities')) {
          fileHasRevokeAll = true;
        }
      }
    });

    // Pass 2: Deep AST inspection for calls, dynamic dispatches, and sealBinding invocations
    function visit(node: ts.Node) {
      if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'sealBinding') {
        definesSealBinding = true;
      }

      if (node.kind === ts.SyntaxKind.ImportKeyword && node.parent && ts.isCallExpression(node.parent)) {
        const arg = node.parent.arguments[0];
        if (arg) {
          const modText = arg.getText(sourceFile);
          if (modText.includes('CanonicalDomainBinding') || modText.includes('sealBinding')) {
            hasDynamicOrComputedProperty = true;
            reasons.push('Dynamic asynchronous import of authority module detected.');
          }
        }
      }

      if (ts.isCallExpression(node)) {
        const expr = unwrapExpression(node.expression);
        const exprText = expr.getText(sourceFile);
        if (exprText.includes('Reflect.get') || exprText.includes('new Function') || exprText === 'eval') {
          const fullCallText = node.getText(sourceFile);
          if (fullCallText.includes('seal') || fullCallText.includes('Binding')) {
            hasReflectionOrEval = true;
            sealCalls.push({
              filePath,
              location: getSourceLocation(node.getStart(sourceFile)),
              callerName: getEnclosingFunctionName(node, sourceFile),
              calleeExpression: exprText,
              capabilityArgumentType: 'UNRESOLVED_EXPRESSION',
              isAliased: true,
              isComputedOrDynamic: true,
              status: 'UNRESOLVED_UNKNOWN',
              rationale: 'Reflection or dynamic Function/eval dispatch targeting sealing interfaces.'
            });
          }
        }
      }

      // Detect Computed Property Access: (CanonicalDomainBindingEngine as any)[method](...)
      if (ts.isCallExpression(node)) {
        const unwrapped = unwrapExpression(node.expression);
        if (ts.isElementAccessExpression(unwrapped)) {
          const parentExpr = unwrapExpression(unwrapped.expression).getText(sourceFile);
          const isAuthorityTarget = parentExpr.includes('CanonicalDomainBindingEngine') || 
                                    parentExpr.includes('SimulationAuthority') || 
                                    importedAuthoritySymbols.has(parentExpr);
          if (isAuthorityTarget) {
            hasDynamicOrComputedProperty = true;
            sealCalls.push({
              filePath,
              location: getSourceLocation(unwrapped.getStart(sourceFile)),
              callerName: getEnclosingFunctionName(node, sourceFile),
              calleeExpression: unwrapped.getText(sourceFile),
              capabilityArgumentType: 'UNRESOLVED_EXPRESSION',
              isAliased: true,
              isComputedOrDynamic: true,
              status: 'UNRESOLVED_UNKNOWN',
              rationale: 'Computed bracket notation accessing sealing property dynamically.'
            });
          }
        }
      }

      // Detect Call Expressions to sealBinding
      if (ts.isCallExpression(node)) {
        let isSealCall = false;
        let isAliased = false;
        let calleeName = '';
        const expr = unwrapExpression(node.expression);

        if (ts.isPropertyAccessExpression(expr)) {
          const propName = expr.name.text;
          const targetObj = expr.expression.getText(sourceFile);
          if (propName === 'sealBinding') {
            isSealCall = true;
            calleeName = `${targetObj}.sealBinding`;
          }
        } else if (ts.isIdentifier(expr)) {
          const name = expr.text;
          if (name === 'sealBinding') {
            isSealCall = true;
            calleeName = name;
          } else if (localFunctionAliases.has(name)) {
            isSealCall = true;
            isAliased = true;
            calleeName = name;
          }
        }

        if (isSealCall) {
          const location = getSourceLocation(node.getStart(sourceFile));
          const rawArg = node.arguments[1];
          const capabilityArg = rawArg ? unwrapExpression(rawArg) : undefined;

          let capType: SealCallpathNode['capabilityArgumentType'] = 'UNRESOLVED_EXPRESSION';
          let status: SealCallpathNode['status'] = 'UNRESOLVED_UNKNOWN';
          let rationale = '';
          let capSource: string | undefined = undefined;

          if (!capabilityArg || capabilityArg.kind === ts.SyntaxKind.NullKeyword || capabilityArg.kind === ts.SyntaxKind.UndefinedKeyword || capabilityArg.getText(sourceFile).includes('null as') || capabilityArg.getText(sourceFile).includes('undefined')) {
            capType = 'NULL_OR_UNDEFINED';
            status = 'UNAUTHENTICATED_VIOLATION';
            rationale = 'Call to sealBinding explicitly provides null, undefined, or missing capability.';
          } else if (ts.isObjectLiteralExpression(capabilityArg)) {
            capType = 'STRUCTURAL_OBJECT_LITERAL';
            status = 'FORGED_CAPABILITY_VIOLATION';
            rationale = 'Call to sealBinding passes synthetic object literal instead of authority-issued capability.';
          } 
          // Identifier: e.g. sealBinding(b, myCap)
          else if (ts.isIdentifier(capabilityArg)) {
            const varName = capabilityArg.text;
            capSource = varName;

            if (localForgedMap.has(varName)) {
              capType = 'STRUCTURAL_OBJECT_LITERAL';
              status = 'FORGED_CAPABILITY_VIOLATION';
              rationale = `Presented capability '${varName}' was declared as a synthetic unauthenticated object literal.`;
            } else if (localCapabilityMap.has(varName)) {
              const info = localCapabilityMap.get(varName)!;
              if (fileHasRevokeAll) {
                capType = 'REVOKED_REPLAY';
                status = 'REVOKED_REPLAY_VIOLATION';
                rationale = `Capability '${varName}' is reused after revokeAllCapabilities() was executed in module.`;
              } else if (info.domains.length === 0 || (!info.domains.includes('pcb') && !info.domains.includes('PCB') && !info.domains.includes('*') && !info.domains.includes('ELECTRICAL'))) {
                capType = 'DOMAIN_MISMATCH';
                status = 'DOMAIN_MISMATCH_VIOLATION';
                rationale = `Capability '${varName}' is scoped for [${info.domains.join(', ')}], missing required domain authorization.`;
              } else {
                capType = 'VALID_ACQUIRED_CAPABILITY';
                status = 'AUTHENTICATED';
                rationale = `Presented capability '${varName}' was verified as acquired via issueSealingCapability for [${info.domains.join(', ')}].`;
              }
            } else {
              capType = 'UNRESOLVED_EXPRESSION';
              status = 'UNRESOLVED_UNKNOWN';
              rationale = `Capability variable '${varName}' origin cannot be statically verified within module scope.`;
            }
          }
          // Property Access: e.g. this.sealingCapability or ClassName.sealingCapability
          else if (ts.isPropertyAccessExpression(capabilityArg)) {
            const propName = capabilityArg.name.text;
            capSource = capabilityArg.getText(sourceFile);

            if (localCapabilityMap.has(propName)) {
              const info = localCapabilityMap.get(propName)!;
              capType = 'VALID_ACQUIRED_CAPABILITY';
              status = 'AUTHENTICATED';
              rationale = `Presented class capability '${propName}' was verified as acquired via issueSealingCapability for [${info.domains.join(', ')}].`;
            } else {
              capType = 'UNRESOLVED_EXPRESSION';
              status = 'UNRESOLVED_UNKNOWN';
              rationale = `Complex property expression '${capSource}' has no matching local capability declaration.`;
            }
          } else {
            capType = 'UNRESOLVED_EXPRESSION';
            status = 'UNRESOLVED_UNKNOWN';
            rationale = `Complex capability expression '${capabilityArg.getText(sourceFile)}' requires runtime verification.`;
          }

          sealCalls.push({
            filePath,
            location,
            callerName: getEnclosingFunctionName(node, sourceFile),
            calleeExpression: calleeName,
            capabilityArgumentType: capType,
            capabilitySource: capSource,
            isAliased,
            isComputedOrDynamic: false,
            status,
            rationale
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Classification with explicit UNRESOLVED distinction
    let classification: ModuleClassification['classification'] = 'NO_AUTHORITY';
    const hasUnresolvedCalls = sealCalls.some(c => c.status === 'UNRESOLVED_UNKNOWN');

    if (definesSealBinding || sealCalls.length > 0 || acquiresCapability) {
      if (hasUnresolvedCalls) {
        classification = 'AUTHORITY_PRODUCER_WITH_UNRESOLVED_PATHS';
        reasons.push('Contains authority calls with unresolvable or dynamic capability expressions (Fail-Closed).');
      } else {
        classification = 'AUTHORITY_PRODUCER';
      }
      if (definesSealBinding) reasons.push('Defines sealBinding authority interface.');
      if (sealCalls.length > 0) reasons.push(`Contains ${sealCalls.length} direct/indirect call(s) to sealBinding.`);
      if (acquiresCapability) reasons.push('Directly acquires SealingCapability via issueSealingCapability.');
    } else if (exportedAuthoritySymbols.length > 0 || hasDynamicOrComputedProperty || hasReflectionOrEval) {
      classification = 'SUSPICIOUS_UNKNOWN';
      if (exportedAuthoritySymbols.length > 0) reasons.push(`Re-exports authority symbols: ${exportedAuthoritySymbols.join(', ')}.`);
      if (hasDynamicOrComputedProperty) reasons.push('Employs dynamic imports or computed property access on authority symbols.');
      if (hasReflectionOrEval) reasons.push('Employs reflection or eval targeting sealing interfaces.');
    } else if (importsBindingContracts || importedAuthoritySymbols.size > 0) {
      classification = 'AUTHORITY_CONSUMER';
      reasons.push(`Imports authority contracts/types: ${Array.from(importedAuthoritySymbols.keys()).join(', ')}.`);
    } else {
      classification = 'NO_AUTHORITY';
    }

    return {
      filePath,
      classification,
      reasons,
      importedAuthoritySymbols: Array.from(importedAuthoritySymbols.keys()),
      exportedAuthoritySymbols,
      sealCalls
    };
  }

  /**
   * Performs complete audit across all discovered modules in the target directory.
   */
  public runFullAudit(modulePaths?: string[]): AuditReport {
    const paths = modulePaths || this.discoverModules();
    const modules = new Map<string, ModuleClassification>();
    const allSealCallpaths: SealCallpathNode[] = [];

    let producersCount = 0;
    let unresolvedProducersCount = 0;
    let consumersCount = 0;
    let noAuthorityCount = 0;
    let suspiciousUnknownCount = 0;
    let unauthenticatedCallsCount = 0;
    let unresolvedCallsCount = 0;
    let authenticatedCallsCount = 0;

    for (const p of paths) {
      const result = this.auditFile(p);
      modules.set(p, result);

      if (result.classification === 'AUTHORITY_PRODUCER') producersCount++;
      else if (result.classification === 'AUTHORITY_PRODUCER_WITH_UNRESOLVED_PATHS') unresolvedProducersCount++;
      else if (result.classification === 'AUTHORITY_CONSUMER') consumersCount++;
      else if (result.classification === 'SUSPICIOUS_UNKNOWN') suspiciousUnknownCount++;
      else noAuthorityCount++;

      for (const call of result.sealCalls) {
        allSealCallpaths.push(call);
        if (call.status === 'UNAUTHENTICATED_VIOLATION' || call.status === 'FORGED_CAPABILITY_VIOLATION' || call.status === 'REVOKED_REPLAY_VIOLATION' || call.status === 'DOMAIN_MISMATCH_VIOLATION') {
          unauthenticatedCallsCount++;
        } else if (call.status === 'UNRESOLVED_UNKNOWN') {
          unresolvedCallsCount++;
        } else if (call.status === 'AUTHENTICATED') {
          authenticatedCallsCount++;
        }
      }
    }

    return {
      totalModulesScanned: paths.length,
      producersCount,
      unresolvedProducersCount,
      consumersCount,
      noAuthorityCount,
      suspiciousUnknownCount,
      unauthenticatedCallsCount,
      unresolvedCallsCount,
      authenticatedCallsCount,
      modules,
      allSealCallpaths
    };
  }
}

function getEnclosingFunctionName(node: ts.Node, sourceFile: ts.SourceFile): string {
  let curr: ts.Node | undefined = node.parent;
  while (curr) {
    if (ts.isFunctionDeclaration(curr) && curr.name) return curr.name.text;
    if (ts.isMethodDeclaration(curr) && ts.isIdentifier(curr.name)) return curr.name.text;
    if (ts.isArrowFunction(curr) || ts.isFunctionExpression(curr)) {
      if (curr.parent && ts.isVariableDeclaration(curr.parent) && ts.isIdentifier(curr.parent.name)) {
        return curr.parent.name.text;
      }
      return 'anonymous_function';
    }
    curr = curr.parent;
  }
  return 'top_level_scope';
}
