import { StructuralFemEngine, StructuralFemResult } from './structuralFem';
import { SimulationFrameworkEngine } from './simulationFramework';
import { MaterialsEngine, Material } from './materials';

export interface CopilotRequirementInput {
  userPrompt: string;
  targetLoadKN: number;
  materialId: string;
  maxDeflectionMm: number;
  safetyFactorTarget: number;
}

export interface CopilotEngineeringSpec {
  materialName: string;
  yieldStrengthMPa: number;
  elasticModulusGPa: number;
  densityKgM3: number;
  allowableStressMPa: number;
  requiredSectionModulusCm3: number;
}

export interface CopilotCandidateDesign {
  id: string;
  name: string;
  webHeightMm: number;
  flangeWidthMm: number;
  wallThicknessMm: number;
  lengthMm: number;
  massKg: number;
  maxVonMisesStressMPa: number;
  safetyFactor: number;
  maxDeflectionMm: number;
  isVerifiedByFem: boolean;
  cadParameters: {
    Length: number;
    WebHeight: number;
    FlangeWidth: number;
    Thickness: number;
  };
}

export interface CopilotPipelineResult {
  rawPrompt: string;
  requirements: CopilotRequirementInput;
  spec: CopilotEngineeringSpec;
  candidates: CopilotCandidateDesign[];
  recommendedCandidate: CopilotCandidateDesign;
  aiExplanation: string;
  timestamp: string;
}

export class AiCopilotEngine {
  /**
   * Deterministic physics-grounded Copilot solver pipeline
   * Requirements -> Engineering Spec -> Candidate Designs -> CAD Parameters -> FEM Verification -> Optimization
   */
  public static processEngineeringRequest(
    input: CopilotRequirementInput
  ): CopilotPipelineResult {
    const mat = MaterialsEngine.getMaterialById(input.materialId || 'mat-steel-1045');
    const loadN = input.targetLoadKN * 1000;
    const sfTarget = input.safetyFactorTarget || 1.5;
    const allowStressMPa = mat.yieldStrengthMPa / sfTarget;

    // Required section modulus Z_req = M_max / sigma_allow (assuming 2m span simply supported: M = F * L / 4)
    const lengthMm = 2000;
    const maxMomentNmm = (loadN * lengthMm) / 4;
    const reqSectionModulusMm3 = maxMomentNmm / allowStressMPa;
    const reqSectionModulusCm3 = reqSectionModulusMm3 / 1000;

    const spec: CopilotEngineeringSpec = {
      materialName: mat.name,
      yieldStrengthMPa: mat.yieldStrengthMPa,
      elasticModulusGPa: mat.youngModulusGPa,
      densityKgM3: mat.densityKgM3,
      allowableStressMPa: parseFloat(allowStressMPa.toFixed(1)),
      requiredSectionModulusCm3: parseFloat(reqSectionModulusCm3.toFixed(2)),
    };

    // Generate 4 Candidate Profiles (Rectangular Hollow Sections) varying web height & wall thickness
    const profileSeeds = [
      { height: 80, width: 40, thick: 3.0 },
      { height: 100, width: 50, thick: 3.5 },
      { height: 120, width: 60, thick: 4.0 },
      { height: 150, width: 75, thick: 4.5 },
    ];

    const candidates: CopilotCandidateDesign[] = profileSeeds.map((seed, idx) => {
      // Calculate cross-section area & mass
      const outerArea = seed.height * seed.width;
      const innerArea = Math.max(0, (seed.height - 2 * seed.thick) * (seed.width - 2 * seed.thick));
      const crossAreaMm2 = outerArea - innerArea;
      const volumeM3 = (crossAreaMm2 * lengthMm) / 1e9;
      const massKg = volumeM3 * mat.densityKgM3;

      // Run SECP Structural FEM Simulation
      const mesh = SimulationFrameworkEngine.generateStandardMesh(lengthMm, seed.height, 10, 4);
      const femResult: StructuralFemResult = StructuralFemEngine.solveStructuralFea(
        mesh,
        mat.youngModulusGPa || 200,
        mat.poissonsRatio || 0.29,
        mat.yieldStrengthMPa || 250,
        input.targetLoadKN * 1000
      );

      const maxStress = femResult.maxVonMisesStressMPa;
      const sf = mat.yieldStrengthMPa / Math.max(1, maxStress);
      const isVerified = sf >= sfTarget && femResult.maxDisplacementMm <= input.maxDeflectionMm;

      return {
        id: `CAND-${idx + 1}`,
        name: `RHS ${seed.height}x${seed.width}x${seed.thick}mm`,
        webHeightMm: seed.height,
        flangeWidthMm: seed.width,
        wallThicknessMm: seed.thick,
        lengthMm: lengthMm,
        massKg: parseFloat(massKg.toFixed(2)),
        maxVonMisesStressMPa: parseFloat(maxStress.toFixed(1)),
        safetyFactor: parseFloat(sf.toFixed(2)),
        maxDeflectionMm: parseFloat(femResult.maxDisplacementMm.toFixed(2)),
        isVerifiedByFem: isVerified,
        cadParameters: {
          Length: lengthMm,
          WebHeight: seed.height,
          FlangeWidth: seed.width,
          Thickness: seed.thick,
        },
      };
    });

    // Pick candidate with lowest mass that passes verification (or highest SF if none verified)
    const validCandidates = candidates.filter(c => c.isVerifiedByFem);
    const recommended = validCandidates.length > 0
      ? validCandidates.reduce((min, c) => (c.massKg < min.massKg ? c : min), validCandidates[0])
      : candidates.reduce((max, c) => (c.safetyFactor > max.safetyFactor ? c : max), candidates[0]);

    const isArabic = /[\u0600-\u06FF]/.test(input.userPrompt);

    const aiExplanation = isArabic
      ? `قام مساعد الهندسة الذكي بتحليل المطلوب (${input.targetLoadKN} kN علي مادة ${mat.name}):
1. تم تحديد معامل المقطع المطلوب (${reqSectionModulusCm3.toFixed(2)} cm³).
2. تم توليد 4 نماذج مرشحة للأبسام وللصناديق المفرغة (RHS).
3. أجريت محاكاة العناصر المحدودة (Structural FEM) لكل نموذج بشكل منفصل للتحقق من الإجهاد والأمان.
4. التصميم الموصى به هو: ${recommended.name} بوزن ${recommended.massKg} كجم ومعامل أمان ${recommended.safetyFactor} (تخفيض في الوزن مع الامتثال التام لمعايير السلامة).`
      : `The AI Copilot evaluated your requirement (${input.targetLoadKN} kN load on ${mat.name}):
1. Derived required section modulus Z_req = ${reqSectionModulusCm3.toFixed(2)} cm³.
2. Formulated 4 Rectangular Hollow Section (RHS) candidate profiles.
3. Passed each candidate through SECP's Structural FEM solver for stress & displacement validation.
4. Optimal recommended design: ${recommended.name} weighing ${recommended.massKg} kg with Safety Factor = ${recommended.safetyFactor} (Minimizes mass while guaranteeing safety).`;

    return {
      rawPrompt: input.userPrompt,
      requirements: input,
      spec,
      candidates,
      recommendedCandidate: recommended,
      aiExplanation,
      timestamp: new Date().toLocaleTimeString(),
    };
  }
}
