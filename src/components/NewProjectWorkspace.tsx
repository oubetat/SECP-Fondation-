import React from 'react';
import { motion } from 'framer-motion';
import { Box, Plane, Cpu, Plus, FilePlus } from 'lucide-react';
import { SketchUIIntegration } from '../engine/cad-kernel/ui-integration/SketchUIIntegration';
import { CanonicalEngineeringDocument } from '../engine/cad-kernel/CanonicalDocumentContract';

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  type: string;
  color: string;
}

export function NewProjectWorkspace({
  onSelectProject,
  setCanonicalDocument
}: {
  onSelectProject: (projectType: string | undefined, tab: string) => void;
  setCanonicalDocument: (doc: CanonicalEngineeringDocument) => void;
}) {

  const templates: ProjectTemplate[] = [
    {
      id: 'blank',
      name: 'Blank Workspace',
      description: 'Start from scratch with an empty parametric CAD workspace.',
      icon: FilePlus,
      type: 'BLANK',
      color: 'bg-slate-800 text-slate-300'
    },
    {
      id: 'industrial-drone',
      name: 'Industrial Quadcopter',
      description: 'Load the SECP-001 Industrial Drone production project, complete with CAM and evidence tracking.',
      icon: Plane,
      type: 'INDUSTRIAL_DRONE',
      color: 'bg-indigo-900/40 text-indigo-400 border-indigo-800/50'
    }
  ];

  return (
    <div className="flex-1 h-[calc(100vh-140px)] bg-slate-950 flex flex-col items-center justify-center p-8 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Welcome to SECP Industrial OS</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Select a project template or start a blank workspace to begin designing, simulating, and tracking industrial-grade products.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {templates.map((template) => (
            <motion.button
              key={template.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (template.id === 'blank') {
                  setCanonicalDocument(SketchUIIntegration.createEmptyDocument('DOC_BLANK_001'));
                  onSelectProject('BLANK', 'PATCH-001'); // Default to domain database
                } else if (template.id === 'industrial-drone') {
                  setCanonicalDocument(SketchUIIntegration.createIndustrialDroneDocument('DOC_DRONE_001'));
                  onSelectProject('INDUSTRIAL_DRONE', 'DRONE-HOME');
                }
              }}
              className={`flex flex-col text-left p-6 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors ${
                template.id !== 'blank' ? `border ${template.color.split(' ')[2]}` : ''
              }`}
            >
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 ${template.color.split(' ')[0]} ${template.color.split(' ')[1]}`}>
                <template.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{template.name}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {template.description}
              </p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
