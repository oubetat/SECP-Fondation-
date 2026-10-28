import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { CollisionAuthority } from './src/engine/collision-authority/CollisionAuthority';
import { CollisionPersistenceEngine } from './src/engine/collision-authority/persistence/CollisionPersistenceEngine';
import { CollisionTruthThread } from './src/engine/collision-authority/persistence/CollisionTruthThread';
import { CollisionReExecutionEngine } from './src/engine/collision-authority/persistence/CollisionReExecutionEngine';
import { HardAcceptanceGateP0 } from './src/engine/collision-authority/HardAcceptanceGateP0';
import { HardAcceptanceGateP6 } from './src/engine/collision-authority/HardAcceptanceGateP6';
import { HardAcceptanceGateP7 } from './src/engine/collision-authority/HardAcceptanceGateP7';
import { HardAcceptanceGateP8 } from './src/engine/collision-authority/HardAcceptanceGateP8';
import { AIMaterialExplorationEngine } from './src/engine/fem/core/AIMaterialExplorationEngine';
import { FEMModel } from './src/engine/fem/core/FEMTypes';
import { SpatialMaterialField } from './src/engine/fem/core/SpatialMaterialField';

async function startServer() {
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Default Providers
  CollisionAuthority.ensureDefaultProviders();

  // Health and System Status
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'OK',
      system: 'SECP Industrial OS v3 — Spatial Safety & Collision Authority Platform',
      version: '3.0.0',
      authorityState: 'OPERATIONAL',
      defaultProvider: 'EXACT_NARROW_PHASE_PROVIDER_P1',
      supportedDomains: ['ASSEMBLY', 'CAM_MULTI_AXIS', 'KINEMATIC_MECHANISM', 'NC_SIMULATION'],
      truthThreadEvents: CollisionTruthThread.getEvents().length,
      timestampIso: new Date().toISOString()
    });
  });

  // 1. Unified Collision Authority Evaluation Endpoint
  app.post('/api/collision/evaluate', async (req, res) => {
    try {
      const rawInput = req.body || {};
      const cutterDia = rawInput.cutter?.cutterDiameter || rawInput.toolAssembly?.cutterDiameterMm || 12;
      const fluteLen = rawInput.cutter?.fluteLength || rawInput.toolAssembly?.fluteLengthMm || 35;
      const stickoutVal = rawInput.cutter?.stickout || rawInput.toolAssembly?.stickoutMm || 60;
      const shankDia = rawInput.cutter?.shankDiameter || rawInput.toolAssembly?.shankDiameterMm || 12;
      const reqSafe = rawInput.clearanceRequirements?.safeClearance || rawInput.clearanceRequirements?.requiredSafeClearanceMm || 2.0;
      const reqWarn = rawInput.clearanceRequirements?.warningMargin || rawInput.clearanceRequirements?.nearMissWarningMarginMm || 5.0;

      const input = {
        domain: rawInput.domain || 'CAM_MULTI_AXIS',
        coordinateFrame: rawInput.coordinateFrame || 'WCS',
        units: (rawInput.units === 'INCHES' || rawInput.units === 'INCH') ? 'INCHES' : 'MILLIMETERS',
        toleranceProfile: rawInput.toleranceProfile || { linearToleranceMm: 0.001, angularToleranceDeg: 0.01 },
        environmentContext: rawInput.environmentContext || { machineMode: '5_AXIS' },
        documentRevision: rawInput.documentRevision || 1,
        documentId: rawInput.documentId || 'DOC_CANONICAL_001',
        toolAssembly: {
          cutterDiameterMm: cutterDia,
          fluteLengthMm: fluteLen,
          stickoutMm: stickoutVal,
          shankDiameterMm: shankDia,
          holderType: 'CAT40_ER32',
          holderUpperDiameterMm: 50,
          holderLowerDiameterMm: 32,
          holderLengthMm: 70
        },
        clearanceRequirements: {
          requiredSafeClearanceMm: reqSafe,
          nearMissWarningMarginMm: reqWarn,
          enforceFailClosed: true
        },
        trajectory: rawInput.motion?.trajectory ? [
          {
            point: rawInput.motion.trajectory.startPoint || { x: 35, y: 35, z: 45 },
            toolOrientation: rawInput.motion.trajectory.toolOrientation || { x: 0, y: 0, z: 1 },
            motionType: rawInput.motion.motionType || 'FEED'
          },
          {
            point: rawInput.motion.trajectory.endPoint || { x: 35, y: 35, z: 15 },
            toolOrientation: rawInput.motion.trajectory.toolOrientation || { x: 0, y: 0, z: 1 },
            motionType: rawInput.motion.motionType || 'FEED'
          }
        ] : (rawInput.trajectory || []),
        bodies: rawInput.bodies && rawInput.bodies.length > 0 ? rawInput.bodies : [
          {
            id: 'TOOL_HOLDER_ASSEMBLY',
            name: '5-Axis Tool Spindle Assembly',
            category: 'TOOL',
            mesh: { vertices: [], indices: [] },
            isDynamic: true,
            boundingSphere: { center: { x: 35, y: 35, z: 45 }, radius: 25 }
          },
          {
            id: 'WORKPIECE_FIXTURE',
            name: 'Machining Workpiece Solid',
            category: 'WORKPIECE',
            mesh: { vertices: [], indices: [] },
            isDynamic: false,
            boundingSphere: { center: { x: 35, y: 35, z: 0 }, radius: 50 }
          }
        ],
        ...rawInput
      };
      const result = await CollisionAuthority.evaluate(input as any);
      let persistedRecord = null;
      if (!result.failureState.isFailed) {
        persistedRecord = await CollisionPersistenceEngine.persist(input as any, result);
      }
      res.json({
        success: true,
        result,
        persistedRecordId: persistedRecord?.executionId || null
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  // 2. Query Persisted Collision Records
  app.get('/api/collision/records', async (_req, res) => {
    try {
      const recordIds = await CollisionPersistenceEngine.listExecutionIds();
      const records = [];
      for (const id of recordIds.slice(-20)) {
        try {
          const rec = await CollisionPersistenceEngine.reload(id);
          records.push(rec);
        } catch {
          // ignore corrupted or unreadable records
        }
      }
      res.json({ success: true, total: recordIds.length, records });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // 3. Get Single Persisted Record
  app.get('/api/collision/records/:id', async (req, res) => {
    try {
      const record = await CollisionPersistenceEngine.reload(req.params.id);
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err?.message || 'Record not found' });
    }
  });

  // 4. Deterministic Re-Execution & Historical Replay
  app.post('/api/collision/replay', async (req, res) => {
    try {
      const executionId = req.body?.executionId;
      if (!executionId) {
        return res.status(400).json({ success: false, error: 'executionId is required' });
      }
      const divergenceMode = req.body?.divergenceMode || 'NONE';
      const record = await CollisionPersistenceEngine.reload(executionId);
      const reResult = await CollisionAuthority.evaluate(record.input);
      const match = divergenceMode === 'NONE' ? reResult.provenanceHash === record.result.provenanceHash : false;
      res.json({
        success: true,
        match,
        divergenceMode,
        originalHash: record.result.provenanceHash,
        replayedHash: reResult.provenanceHash,
        reason: match ? 'Canonical hash and exact spatial metrics identical.' : `Divergence artificially induced by mode: ${divergenceMode}`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  app.post('/api/collision/replay/:id', async (req, res) => {
    try {
      const divergenceMode = req.body?.divergenceMode || 'NONE';
      const record = await CollisionPersistenceEngine.reload(req.params.id);
      const reResult = await CollisionAuthority.evaluate(record.input);
      const match = divergenceMode === 'NONE' ? reResult.provenanceHash === record.result.provenanceHash : false;
      res.json({
        success: true,
        match,
        divergenceMode,
        originalHash: record.result.provenanceHash,
        replayedHash: reResult.provenanceHash,
        reason: match ? 'Canonical hash and exact spatial metrics identical.' : `Divergence artificially induced by mode: ${divergenceMode}`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // 5. Query Truth Thread Event Ledger & Verify Chain
  app.get('/api/collision/truth-thread', (_req, res) => {
    try {
      const events = CollisionTruthThread.getEvents();
      const chainVerification = CollisionTruthThread.verifyChain(events);
      res.json({
        success: true,
        totalEvents: events.length,
        isChainValid: chainVerification.isValid,
        errors: chainVerification.errors,
        events: events.slice(-50)
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // 6. Hard Acceptance Gate Evaluation Runner
  app.post('/api/gates/run', async (req, res) => {
    try {
      const phase = req.body?.phase || 'all';
      const results: Record<string, any> = {};

      if (phase === 'p0' || phase === 'all') {
        results.p0 = HardAcceptanceGateP0.runAllGates();
      }
      if (phase === 'p6' || phase === 'all') {
        CollisionAuthority.clearProviders();
        CollisionAuthority.ensureDefaultProviders();
        results.p6 = await HardAcceptanceGateP6.execute();
      }
      if (phase === 'p7' || phase === 'all') {
        CollisionAuthority.clearProviders();
        CollisionAuthority.ensureDefaultProviders();
        results.p7 = await HardAcceptanceGateP7.evaluate();
      }
      if (phase === 'p8' || phase === 'all') {
        CollisionAuthority.clearProviders();
        CollisionAuthority.ensureDefaultProviders();
        results.p8 = await HardAcceptanceGateP8.evaluate();
      }

      CollisionAuthority.clearProviders();
      CollisionAuthority.ensureDefaultProviders();

      res.json({ success: true, timestampIso: new Date().toISOString(), results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  });

  // 7. AI Material Exploration Endpoint (Phase V11)
  app.post('/api/material/explore', async (req, res) => {
    try {
      const { model, request } = req.body;
      if (!model || !request) {
        return res.status(400).json({ success: false, error: 'Missing model or exploration request' });
      }

      // Reconstruct Map objects for the engine if they were serialized as plain objects
      const reconstructedModel: FEMModel = {
        ...model,
        nodes: new Map(Object.entries(model.nodes || {})),
        elements: new Map(Object.entries(model.elements || {})),
        materials: new Map(Object.entries(model.materials || {})),
        sections: new Map(Object.entries(model.sections || {})),
        spatialMaterialFields: model.spatialMaterialFields ? new Map(Object.entries(model.spatialMaterialFields).map(([k, v]: [string, any]) => {
           // Basic reconstruction of SpatialMaterialField instance if needed
           const propertySpecs = new Map(Object.entries(v.propertySpecs || {}));
           return [k, new SpatialMaterialField(v.fieldId, v.canonicalGeometryId, v.canonicalRevisionId, v.baseMaterialId, propertySpecs as any, v.domain, v.outOfDomainBehavior, v.coordinateSystem)];
        })) : undefined
      };

      const aiEngine = new AIMaterialExplorationEngine();
      const result = await aiEngine.explore(reconstructedModel, request);

      res.json({
        success: true,
        timestampIso: new Date().toISOString(),
        result
      });
    } catch (err: any) {
      console.error("[AI_EXPLORATION_API_ERROR]", err);
      res.status(500).json({
        success: false,
        error: err?.message || String(err)
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  app.listen(port, () => {
    console.log(`SECP Industrial OS Server running on port ${port}`);
  });
}

startServer();
