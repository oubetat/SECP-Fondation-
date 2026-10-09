import {
  ControllerProfile,
  NCBlock,
  NCProgram,
  NCSyntaxValidationResult,
  PostTrueVerdict
} from "./types";

export class NCSyntaxValidator {
  public static validateProgram(program: NCProgram, controllerProfile: ControllerProfile): NCSyntaxValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const unrecognizedWords: string[] = [];
    const maxLen = controllerProfile.capabilities.maxBlockLength || 256;
    const supportedWordsSet = new Set(controllerProfile.supportedWords);
    const supportedCommandsSet = new Set(controllerProfile.supportedCommands);

    for (let i = 0; i < program.blocks.length; i++) {
      const block = program.blocks[i];
      const line = block.lineText;

      // 1. Line length check
      if (line.length > maxLen) {
        errors.push(`Block ${block.blockNumber} exceeds max block length (${line.length} > ${maxLen})`);
      }

      // 2. Check each word
      for (const word of block.words) {
        if (!supportedWordsSet.has(word.letter)) {
          unrecognizedWords.push(word.rawText);
          errors.push(`Block ${block.blockNumber}: Word letter '${word.letter}' is not supported by controller ${controllerProfile.controllerId}`);
        }

        // Check command support for G and M words
        if (word.letter === "G" || word.letter === "M") {
          const cmdStr = word.rawText;
          // Normalize e.g. G1 to G01 or check both
          const numVal = parseInt(String(word.value).replace(/[^0-9]/g, ""), 10);
          const normalized = `${word.letter}${String(numVal).padStart(2, "0")}`;
          const altNormalized = `${word.letter}${numVal}`;

          if (
            !supportedCommandsSet.has(cmdStr) &&
            !supportedCommandsSet.has(normalized) &&
            !supportedCommandsSet.has(altNormalized)
          ) {
            errors.push(`Block ${block.blockNumber}: Command '${cmdStr}' is not supported in controller profile ${controllerProfile.controllerId}`);
          }
        }

        // 3. Numeric validation
        if (["X", "Y", "Z", "A", "B", "C", "I", "J", "K", "R", "F", "S", "P", "Q"].includes(word.letter)) {
          const num = typeof word.value === "number" ? word.value : parseFloat(String(word.value));
          if (Number.isNaN(num)) {
            errors.push(`Block ${block.blockNumber}: Invalid numeric value '${word.rawText}'`);
          }
        }
      }
    }

    const isValid = errors.length === 0;
    return {
      isValid,
      errors,
      warnings,
      totalBlocksChecked: program.blocks.length,
      unrecognizedWords,
      syntaxVerdict: isValid ? PostTrueVerdict.SYNTAX_VALIDATED : PostTrueVerdict.SYNTAX_INVALID
    };
  }
}
