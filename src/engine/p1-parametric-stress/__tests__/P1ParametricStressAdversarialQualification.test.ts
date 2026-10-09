import { describe, it, expect, beforeEach } from 'vitest';
import { P1ParametricStressQualificationEngine } from '../P1ParametricStressQualificationEngine';

describe('P1 Parametric Stress & Determinism Adversarial Qualification Test Suite', () => {
  let p1Engine: P1ParametricStressQualificationEngine;

  beforeEach(() => {
    p1Engine = P1ParametricStressQualificationEngine.getInstance();
  });

  describe('1. High-Density Graph Creation & Topological Completeness', () => {
    it('should generate a massive graph of exactly 10,050 nodes with zero dangling references', () => {
      p1Engine.generateHighDensityGraph(10050);
      const order = p1Engine.topologicalSort();
      
      expect(order).toHaveLength(10050);

      // Verify each node has all its dependencies present in the graph
      order.forEach(nodeId => {
        const node = (p1Engine as any).nodes.get(nodeId);
        expect(node).toBeDefined();
        node.dependencies.forEach((depId: string) => {
          expect((p1Engine as any).nodes.has(depId)).toBe(true);
        });
      });
    });
  });

  describe('2. Multi-Run Perfect Determinism & Reproducibility', () => {
    it('should produce identical byte-for-byte state hashes across 5 independent compilations of the 10,050 graph', () => {
      const hashes: string[] = [];

      for (let i = 0; i < 5; i++) {
        p1Engine.generateHighDensityGraph(10050);
        const order = p1Engine.topologicalSort();
        p1Engine.evaluateGraph(order);
        hashes.push(p1Engine.generateStateHash());
      }

      const referenceHash = hashes[0];
      expect(referenceHash).toHaveLength(64); // Valid SHA-256 hex string

      hashes.forEach(h => {
        expect(h).toBe(referenceHash);
      });
    });
  });

  describe('3. Sensitivity to 1-Character Parametric Mutation (Zero Spurious Collisions)', () => {
    it('should change the sealed hash if any single parametric value out of 10,050 is mutated by 0.0001', () => {
      p1Engine.generateHighDensityGraph(10050);
      const order = p1Engine.topologicalSort();
      p1Engine.evaluateGraph(order);
      const originalHash = p1Engine.generateStateHash();

      // Slightly mutate a single parameter in a node deep in the tree
      const targetNode = (p1Engine as any).nodes.get('NODE_DEP_5555');
      expect(targetNode).toBeDefined();
      targetNode.value += 0.0001;
      targetNode.isDirty = true;

      // Recompile from mutated state
      p1Engine.markDirtyDownstream(['NODE_DEP_5555']);
      p1Engine.evaluateGraph(order);

      const mutatedHash = p1Engine.generateStateHash();
      expect(mutatedHash).not.toBe(originalHash);
      expect(mutatedHash).toHaveLength(64);
    });
  });

  describe('4. Multi-Stage Dependency Cycle Isolation', () => {
    it('should throw CYCLE_DETECTED if a dependency loop is introduced between node pairs', () => {
      p1Engine.generateHighDensityGraph(100);

      const n1 = (p1Engine as any).nodes.get('NODE_DEP_20');
      const n2 = (p1Engine as any).nodes.get('NODE_DEP_80');
      expect(n1).toBeDefined();
      expect(n2).toBeDefined();

      n1.dependencies.push('NODE_DEP_80');
      n2.dependencies.push('NODE_DEP_20');

      expect(() => {
        p1Engine.topologicalSort();
      }).toThrow('CYCLE_DETECTED');
    });
  });

  describe('5. Comprehensive Multi-Scenario Qualification Integrity', () => {
    it('should execute full suite and return P1_QUALIFICATION_PASSED with all 5 scenarios passing', () => {
      const report = p1Engine.runParametricStressSuite();

      expect(report.overallVerdict).toBe('P1_QUALIFICATION_PASSED');
      expect(report.verifierStatus).toBe('VERIFIED_IMMUTABLE');
      expect(report.scenarios).toHaveLength(5);

      const normalStress = report.scenarios.find(s => s.scenarioId === 'P1_SCENARIO_01_NORMAL_STRESS');
      const cyclic = report.scenarios.find(s => s.scenarioId === 'P1_SCENARIO_02_CYCLIC_DEPENDENCY');
      const constraint = report.scenarios.find(s => s.scenarioId === 'P1_SCENARIO_03_CONSTRAINT_VIOLATION');
      const leak = report.scenarios.find(s => s.scenarioId === 'P1_SCENARIO_04_MEMORY_LEAK_ISOLATION');
      const tamper = report.scenarios.find(s => s.scenarioId === 'P1_SCENARIO_05_EVIDENCE_TAMPERING');

      expect(normalStress?.status).toBe('PASSED');
      expect(cyclic?.status).toBe('EXPECTED_REJECTION_VERIFIED');
      expect(constraint?.status).toBe('EXPECTED_REJECTION_VERIFIED');
      expect(leak?.status).toBe('PASSED');
      expect(tamper?.status).toBe('EXPECTED_REJECTION_VERIFIED');
    });

    it('should fail qualification if simulated evidence tampering is requested', () => {
      const report = p1Engine.runParametricStressSuite({ simulateTamperedEvidence: true });

      expect(report.overallVerdict).toBe('P1_QUALIFICATION_FAILED');
      expect(report.verifierStatus).toBe('TAMPERED');
    });
  });
});
