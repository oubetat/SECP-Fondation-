import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  Filter,
  CheckCircle2,
  Download,
  Star,
  Building2,
  Wrench,
  Clock,
  ExternalLink,
  Plus,
  Box,
  Cpu,
  Activity,
  CircleDot,
  Database,
  Check,
  Zap,
} from 'lucide-react';
import {
  MarketplaceEngine,
  MarketplaceItem,
  MarketplaceCategory,
} from '../engine/marketplaceEngine';

export const MarketplacePanel: React.FC = () => {
  const [catalog] = useState<MarketplaceItem[]>(() => MarketplaceEngine.getCatalogItems());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | 'ALL'>('ALL');

  const [importedItems, setImportedItems] = useState<Record<string, boolean>>({});
  const [rfqSubmitted, setRfqSubmitted] = useState<Record<string, boolean>>({});

  const filteredItems = MarketplaceEngine.filterCatalog(catalog, searchQuery, selectedCategory);

  const categoriesList: { id: MarketplaceCategory | 'ALL'; name: string }[] = [
    { id: 'ALL', name: 'All Categories' },
    { id: 'MOTORS', name: 'Electric Motors' },
    { id: 'SENSORS', name: 'Sensors & Telemetry' },
    { id: 'BEARINGS', name: 'Precision Bearings' },
    { id: 'MATERIALS', name: 'Materials & Billets' },
    { id: 'CAD_MODELS', name: '3D CAD Models' },
    { id: 'MANUFACTURING', name: 'CNC & Fab Hubs' },
  ];

  const handleImportToProject = (id: string) => {
    setImportedItems(prev => ({ ...prev, [id]: true }));
  };

  const handleRequestRfq = (id: string) => {
    setRfqSubmitted(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold tracking-tight">SECP Industrial Engineering Marketplace</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-purple-950 text-purple-400 border border-purple-800 rounded-full">
              PATCH-SECP-028
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Browse verified industrial CAD components, precision motors, sensors, bearings, aerospace materials & request instant manufacturing quotes.
          </p>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search part numbers, motors, bearings, sensors, or suppliers..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {categoriesList.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Marketplace Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map(item => {
          const isImported = importedItems[item.id];
          const isRfqSent = rfqSubmitted[item.id];

          return (
            <div
              key={item.id}
              className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col justify-between gap-4 hover:border-slate-700 transition-all"
            >
              <div className="flex flex-col gap-2">
                {/* Supplier & Verified Badge */}
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" /> {item.supplierName}
                  </span>
                  {item.verifiedBadge && (
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                      <CheckCircle2 className="w-3 h-3 text-purple-400" /> VERIFIED SUPPLIER
                    </span>
                  )}
                </div>

                {/* Item Title & Part Number */}
                <div>
                  <h3 className="text-sm font-bold text-slate-100 leading-snug">{item.name}</h3>
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5">PN: {item.partNumber}</span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 mt-1">{item.description}</p>

                {/* Specs Table */}
                <div className="bg-slate-900 p-3 rounded border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono mt-2">
                  {Object.entries(item.specifications).map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <span className="text-[10px] text-slate-500">{k}:</span>
                      <span className="text-slate-200 font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price, Lead Time & Import CTA */}
              <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Unit Price</span>
                    <span className="text-base font-mono font-bold text-emerald-400">
                      {item.priceUSD === 0 ? 'FREE CAD MODEL' : `$${item.priceUSD} / ${item.unit}`}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block">Lead Time</span>
                    <span className="text-xs font-mono text-slate-300 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-slate-500" /> {item.leadTimeDays === 0 ? 'Instant Download' : `${item.leadTimeDays} business days`}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleImportToProject(item.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      isImported
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
                    }`}
                  >
                    {isImported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                    {isImported ? 'Imported to CAD Project!' : 'Import 3D CAD / Spec'}
                  </button>

                  <button
                    onClick={() => handleRequestRfq(item.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                      isRfqSent
                        ? 'bg-slate-800 text-emerald-400 border-emerald-800'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {isRfqSent ? 'RFQ Sent!' : 'Request Quote'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
