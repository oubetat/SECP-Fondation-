import { MonorepoNode } from '../types/secp';

export const SECP_MONOREPO_TREE: MonorepoNode = {
  name: 'secp',
  path: 'secp',
  type: 'directory',
  children: [
    {
      name: 'apps',
      path: 'secp/apps',
      type: 'directory',
      children: [
        {
          name: 'desktop',
          path: 'secp/apps/desktop',
          type: 'directory',
          children: [
            {
              name: 'package.json',
              path: 'secp/apps/desktop/package.json',
              type: 'file',
              language: 'json',
              content: `{
  "name": "@secp/desktop",
  "version": "0.1.0",
  "description": "SECP Desktop Application Shell (Tauri / Native CAD Host)",
  "main": "main.js"
}`
            }
          ]
        },
        {
          name: 'web',
          path: 'secp/apps/web',
          type: 'directory',
          children: [
            {
              name: 'package.json',
              path: 'secp/apps/web/package.json',
              type: 'file',
              language: 'json',
              content: `{
  "name": "@secp/web",
  "version": "0.1.0",
  "description": "SECP Web Application Client (Vite + React)"
}`
            }
          ]
        }
      ]
    },
    {
      name: 'packages',
      path: 'secp/packages',
      type: 'directory',
      children: [
        {
          name: 'engineering-types',
          path: 'secp/packages/engineering-types',
          type: 'directory',
          children: [
            {
              name: 'index.ts',
              path: 'secp/packages/engineering-types/src/index.ts',
              type: 'file',
              language: 'typescript',
              content: `export interface Point3D { x: number; y: number; z: number; }
export interface BoundingBox { min: Point3D; max: Point3D; }
export interface MaterialProperties {
  id: string;
  name: string;
  elasticModulusGPa: number;
  poissonsRatio: number;
  densityKgM3: number;
  yieldStrengthMPa: number;
}
export interface StructuralNode {
  id: string;
  position: Point3D;
  restraints: { fx: boolean; fy: boolean; fz: boolean; mx: boolean; my: boolean; mz: boolean };
}`
            }
          ]
        },
        {
          name: 'geometry-api',
          path: 'secp/packages/geometry-api',
          type: 'directory',
          children: [
            {
              name: 'index.ts',
              path: 'secp/packages/geometry-api/src/index.ts',
              type: 'file',
              language: 'typescript',
              content: `import { Point3D, BoundingBox } from '../engineering-types/src';

export class GeometryApi {
  public static calculateBoundingBox(points: Point3D[]): BoundingBox {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); maxZ = Math.max(maxZ, p.z);
    }
    return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
  }
}`
            }
          ]
        },
        {
          name: 'ui',
          path: 'secp/packages/ui',
          type: 'directory',
          children: [
            {
              name: 'index.ts',
              path: 'secp/packages/ui/src/index.ts',
              type: 'file',
              language: 'typescript',
              content: `export const UI_CONFIG = { theme: 'dark-engineering', viewportGridSpacing: 1.0 };`
            }
          ]
        },
        {
          name: 'shared',
          path: 'secp/packages/shared',
          type: 'directory',
          children: [
            {
              name: 'index.ts',
              path: 'secp/packages/shared/src/index.ts',
              type: 'file',
              language: 'typescript',
              content: `export function generateSecpHash(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i); hash |= 0;
  }
  return '0x' + Math.abs(hash).toString(16).padStart(12, '0');
}`
            }
          ]
        }
      ]
    },
    {
      name: 'engines',
      path: 'secp/engines',
      type: 'directory',
      children: [
        {
          name: 'CMakeLists.txt',
          path: 'secp/engines/CMakeLists.txt',
          type: 'file',
          language: 'cmake',
          content: `cmake_minimum_required(VERSION 3.20)
project(SECP_Engines VERSION 0.1.0 LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 20)
add_subdirectory(cad-core)
add_subdirectory(simulation-core)
add_subdirectory(manufacturing-core)`
        },
        {
          name: 'cad-core',
          path: 'secp/engines/cad-core',
          type: 'directory',
          children: [
            {
              name: 'cad_kernel.hpp',
              path: 'secp/engines/cad-core/cad_kernel.hpp',
              type: 'file',
              language: 'cpp',
              content: `#ifndef SECP_CAD_KERNEL_HPP
#define SECP_CAD_KERNEL_HPP
#include <string>
#include <vector>

namespace secp::cad {
struct Vector3D { double x, y, z; };
struct BoundingBox { Vector3D min; Vector3D max; };
class CadKernel {
public:
    CadKernel();
    std::string getVersion() const;
    BoundingBox computeBoundingBox(const std::vector<Vector3D>& vertices) const;
};
}
#endif`
            },
            {
              name: 'cad_kernel.cpp',
              path: 'secp/engines/cad-core/cad_kernel.cpp',
              type: 'file',
              language: 'cpp',
              content: `#include "cad_kernel.hpp"
#include <iostream>

namespace secp::cad {
CadKernel::CadKernel() {
    std::cout << "[SECP C++ CadKernel] Engine initialized." << std::endl;
}
std::string CadKernel::getVersion() const {
    return "SECP-CAD-Kernel v0.1.0-alpha (C++20)";
}
}`
            }
          ]
        },
        {
          name: 'simulation-core',
          path: 'secp/engines/simulation-core',
          type: 'directory',
          children: [
            {
              name: 'simulation_kernel.cpp',
              path: 'secp/engines/simulation-core/simulation_kernel.cpp',
              type: 'file',
              language: 'cpp',
              content: `#include <iostream>
namespace secp::simulation {
class SimulationCore {
public:
    std::string getSolverInfo() const { return "SECP FEA Solver Core v0.1.0"; }
};
}`
            }
          ]
        },
        {
          name: 'manufacturing-core',
          path: 'secp/engines/manufacturing-core',
          type: 'directory',
          children: [
            {
              name: 'gcode_generator.cpp',
              path: 'secp/engines/manufacturing-core/gcode_generator.cpp',
              type: 'file',
              language: 'cpp',
              content: `#include <iostream>
namespace secp::manufacturing {
class ManufacturingCore {
public:
    std::string getEngineInfo() const { return "SECP CAM Toolpath Engine v0.1.0"; }
};
}`
            }
          ]
        }
      ]
    },
    {
      name: 'services',
      path: 'secp/services',
      type: 'directory',
      children: [
        {
          name: 'project-service',
          path: 'secp/services/project-service',
          type: 'directory',
          children: [
            {
              name: 'server.ts',
              path: 'secp/services/project-service/src/server.ts',
              type: 'file',
              language: 'typescript',
              content: `export function startProjectService() { return { status: 'HEALTHY' }; }`
            }
          ]
        },
        {
          name: 'asset-service',
          path: 'secp/services/asset-service',
          type: 'directory',
          children: [
            {
              name: 'server.ts',
              path: 'secp/services/asset-service/src/server.ts',
              type: 'file',
              language: 'typescript',
              content: `export function getAssetServiceHealth() { return { service: 'asset-service', status: 'ONLINE' }; }`
            }
          ]
        },
        {
          name: 'provenance-service',
          path: 'secp/services/provenance-service',
          type: 'directory',
          children: [
            {
              name: 'server.ts',
              path: 'secp/services/provenance-service/src/server.ts',
              type: 'file',
              language: 'typescript',
              content: `export function recordProvenanceAction(author: string, action: string) {
  return { id: 'prov-' + Date.now(), author, action, status: 'VERIFIED' };
}`
            }
          ]
        }
      ]
    },
    {
      name: 'database',
      path: 'secp/database',
      type: 'directory',
      children: [
        {
          name: 'schema.sql',
          path: 'secp/database/schema.sql',
          type: 'file',
          language: 'sql',
          content: `CREATE TABLE IF NOT EXISTS secp_projects (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS secp_cad_assets (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES secp_projects(id)
);
CREATE TABLE IF NOT EXISTS secp_provenance_logs (
    id VARCHAR(64) PRIMARY KEY,
    action_type VARCHAR(64) NOT NULL
);`
        },
        {
          name: 'connection.ts',
          path: 'secp/database/connection.ts',
          type: 'file',
          language: 'typescript',
          content: `export async function checkDatabaseConnection() {
  return { connected: true, database: 'secp_engineering_db', latencyMs: 14 };
}`
        }
      ]
    },
    {
      name: 'tests',
      path: 'secp/tests',
      type: 'directory',
      children: [
        {
          name: 'ci_runner.test.ts',
          path: 'secp/tests/ci_runner.test.ts',
          type: 'file',
          language: 'typescript',
          content: `import { runCiTestSuite } from './ci_runner.test';
// Automated integration suite for SECP Phase 0`
        }
      ]
    },
    {
      name: 'docs',
      path: 'secp/docs',
      type: 'directory',
      children: [
        {
          name: 'PATCH-SECP-000.md',
          path: 'secp/docs/PATCH-SECP-000.md',
          type: 'file',
          language: 'markdown',
          content: `# PATCH-SECP-000 — Project Foundation
Phase 0 Architecture Specification for Smart Engineering CAD Platform (SECP)`
        }
      ]
    }
  ]
};
