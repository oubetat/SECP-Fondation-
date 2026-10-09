import React, { useState, useEffect } from 'react';
import { 
  Network, 
  FileText, 
  Share2, 
  ArrowRightLeft, 
  ShieldCheck, 
  Award, 
  Gauge, 
  GitMerge, 
  Layers, 
  RefreshCw,
  Folder,
  Sliders
} from 'lucide-react';
import { SystemArchitectureCanvas } from './SystemArchitectureCanvas';
import { RequirementsTruthView } from './RequirementsTruthView';
import { EngineeringTraceView } from './EngineeringTraceView';
import { InterfaceWorkspace } from './InterfaceWorkspace';
import { EngineeringTruthView } from './EngineeringTruthView';
import { EngineeringCapabilityCenter } from './EngineeringCapabilityCenter';
import { EngineeringStateDashboard } from './EngineeringStateDashboard';
import { CrossDomainTraceView } from './CrossDomainTraceView';
import { EngineeringCertificateView } from './EngineeringCertificateView';
import { ADSEWorkbenchBridge, SystemContextSummary } from '../../engine/adse/workbench/ADSEWorkbenchBridge';

export type SystemsEngineeringTab = 
  | 'CANVAS'
  | 'REQUIREMENTS'
  | 'TRACE'
  | 'INTERFACES'
  | 'TRUTH'
  | 'CAPABILITIES'
  | 'DASHBOARD'
  | 'CROSS_DOMAIN'
  | 'CERTIFICATE';

interface Props {
  initialTab?: SystemsEngineeringTab;
  systemId?: string;
  configurationId?: string;
}

export const SystemsEngineeringWorkspace: React.FC<Props> = ({
  initialTab = 'CANVAS',
  systemId = 'SYS-AVIONICS-P9',
  configurationId = 'CONF-BASELINE'
}) => {
  const bridge = ADSEWorkbenchBridge.getInstance();
  const [activeTab, setActiveTab] = useState<SystemsEngineeringTab>(initialTab);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('COMM-SYS-AVIONICS-P9');
  const [systemContext, setSystemContext] = useState<SystemContextSummary | null>(null);

  const loadContext = async () => {
    const ctx = await bridge.loadSystemContext(systemId, configurationId);
    setSystemContext(ctx);
  };

  useEffect(() => {
    loadContext();
  }, [systemId, configurationId]);

  const handleSelectEntity = (id: string) => {
    setSelectedEntityId(id);
    setActiveTab('TRUTH');
  };

  const tabs: { id: SystemsEngineeringTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'CANVAS', label: 'Architecture Canvas', icon: Network },
    { id: 'REQUIREMENTS', label: 'Requirements Truth', icon: FileText },
    { id: 'TRACE', label: 'Digital Thread Trace', icon: Share2 },
    { id: 'INTERFACES', label: 'Interfaces', icon: ArrowRightLeft },
    { id: 'TRUTH', label: 'Engineering Truth View', icon: ShieldCheck },
    { id: 'CAPABILITIES', label: 'Capability Center', icon: Award },
    { id: 'DASHBOARD', label: 'State Dashboard', icon: Gauge },
    { id: 'CROSS_DOMAIN', label: 'Cross-Domain Trace', icon: GitMerge },
    { id: 'CERTIFICATE', label: 'Engineering Certificate', icon: Award }
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Workspace Sub-Navigation Toolbar */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-20">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-blue-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* System Context Badges */}
        {systemContext && (
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
            <span className="text-slate-400 font-semibold">{systemContext.displayName}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {systemContext.currentRevisionId}
            </span>
          </div>
        )}
      </div>

      {/* Active Tab Viewport */}
      <div className="flex-1 p-4 overflow-hidden">
        {activeTab === 'CANVAS' && (
          <SystemArchitectureCanvas 
            systemId={systemId} 
            configurationId={configurationId} 
            onSelectEntity={handleSelectEntity} 
          />
        )}
        {activeTab === 'REQUIREMENTS' && (
          <RequirementsTruthView onSelectEntity={handleSelectEntity} />
        )}
        {activeTab === 'TRACE' && (
          <EngineeringTraceView onSelectEntity={handleSelectEntity} />
        )}
        {activeTab === 'INTERFACES' && (
          <InterfaceWorkspace onSelectEntity={handleSelectEntity} />
        )}
        {activeTab === 'TRUTH' && (
          <EngineeringTruthView canonicalId={selectedEntityId} />
        )}
        {activeTab === 'CAPABILITIES' && (
          <EngineeringCapabilityCenter />
        )}
        {activeTab === 'DASHBOARD' && (
          <EngineeringStateDashboard configurationId={configurationId} />
        )}
        {activeTab === 'CROSS_DOMAIN' && (
          <CrossDomainTraceView entityId={selectedEntityId} />
        )}
        {activeTab === 'CERTIFICATE' && (
          <EngineeringCertificateView 
            systemId={systemId} 
            configurationId={configurationId} 
          />
        )}
      </div>
    </div>
  );
};
