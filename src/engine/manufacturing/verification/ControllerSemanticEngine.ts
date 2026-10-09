import { ControllerProfile, NCDialect } from "../post/types";
import {
  ParsedNCBlock,
  SemanticErrorCode
} from "./types";

export interface SemanticValidationReport {
  isValid: boolean;
  errors: {
    code: SemanticErrorCode;
    lineNumber: number;
    blockText: string;
    message: string;
  }[];
  warnings: {
    lineNumber: number;
    message: string;
  }[];
  unknownCommands: string[];
  macroCommandsCount: number;
  subprogramsCalled: string[];
}

export class ControllerSemanticEngine {
  private controllerProfile: ControllerProfile;

  constructor(controllerProfile: ControllerProfile) {
    this.controllerProfile = controllerProfile;
  }

  /**
   * Validates all blocks semantically against the controller profile's dialect & capabilities.
   */
  public validateSemantics(blocks: ParsedNCBlock[]): SemanticValidationReport {
    const errors: SemanticValidationReport["errors"] = [];
    const warnings: SemanticValidationReport["warnings"] = [];
    const unknownCommands: string[] = [];
    let macroCount = 0;
    const subprograms: string[] = [];

    const supportedWordsSet = new Set(this.controllerProfile.supportedWords.map(w => w.toUpperCase()));
    const supportedCommandsSet = new Set(this.controllerProfile.supportedCommands.map(c => c.toUpperCase()));

    for (const block of blocks) {
      if (block.isProgramDelimiter) continue;

      const words = block.words;

      // Check for macros (e.g. # variables, IF, WHILE, G65)
      if (block.sourceText.includes("#") || /IF\s*\[/i.test(block.sourceText) || /WHILE\s*\[/i.test(block.sourceText)) {
        macroCount++;
        if (this.controllerProfile.capabilities.supportsMacros !== "SUPPORTED") {
          errors.push({
            code: SemanticErrorCode.MACRO_EXECUTION_REQUIRED,
            lineNumber: block.lineNumber,
            blockText: block.sourceText,
            message: `Macro/Parametric NC expression detected at line ${block.lineNumber}, but controller macros are ${this.controllerProfile.capabilities.supportsMacros}`
          });
        }
      }

      for (const w of words) {
        const letter = w.letter.toUpperCase();
        const rawCode = `${letter}${w.value}`;

        // Word support check
        if (!supportedWordsSet.has(letter)) {
          errors.push({
            code: SemanticErrorCode.UNKNOWN_CONTROLLER_COMMAND,
            lineNumber: block.lineNumber,
            blockText: block.sourceText,
            message: `Word '${letter}' is not supported by controller profile '${this.controllerProfile.name}'`
          });
          unknownCommands.push(letter);
        }

        // Specific command checks (G and M codes)
        if (letter === "G" || letter === "M") {
          const formattedCode = `${letter}${String(w.value).padStart(2, "0")}`;
          const simpleCode = `${letter}${w.value}`;

          const isSupported = supportedCommandsSet.has(formattedCode) ||
                              supportedCommandsSet.has(simpleCode) ||
                              supportedCommandsSet.has(letter);

          if (!isSupported && !["G0", "G1", "G2", "G3", "G00", "G01", "G02", "G03", "M0", "M1", "M2", "M3", "M4", "M5", "M6", "M8", "M9", "M30", "G17", "G18", "G19", "G20", "G21", "G90", "G91", "G94", "G95", "G40", "G43", "G49", "G54", "G80"].includes(formattedCode) && !["G0", "G1", "G2", "G3", "M0", "M1", "M2", "M3", "M4", "M5", "M6", "M8", "M9", "M30"].includes(simpleCode)) {
            errors.push({
              code: SemanticErrorCode.UNKNOWN_CONTROLLER_COMMAND,
              lineNumber: block.lineNumber,
              blockText: block.sourceText,
              message: `Command '${rawCode}' is not supported by controller '${this.controllerProfile.name}'`
            });
            unknownCommands.push(rawCode);
          }

          // Subprogram call check (M98 / G65)
          if ((letter === "M" && Number(w.value) === 98) || (letter === "G" && Number(w.value) === 65)) {
            const pWord = words.find(x => x.letter === "P");
            if (pWord) {
              subprograms.push(String(pWord.value));
            } else {
              errors.push({
                code: SemanticErrorCode.INVALID_SUBPROGRAM_CALL,
                lineNumber: block.lineNumber,
                blockText: block.sourceText,
                message: `Subprogram call '${rawCode}' at line ${block.lineNumber} is missing P parameter`
              });
            }
          }

          // Canned cycle checks
          if (letter === "G" && [81, 82, 83, 84, 85, 86, 87, 88, 89].includes(Number(w.value))) {
            if (!this.controllerProfile.capabilities.supportsCannedCycles) {
              errors.push({
                code: SemanticErrorCode.UNKNOWN_CONTROLLER_COMMAND,
                lineNumber: block.lineNumber,
                blockText: block.sourceText,
                message: `Canned cycle '${rawCode}' used at line ${block.lineNumber}, but canned cycles are disabled in controller profile`
              });
            }
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      unknownCommands,
      macroCommandsCount: macroCount,
      subprogramsCalled: subprograms
    };
  }
}
