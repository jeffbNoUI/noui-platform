const LAYERS = [
  {
    layer: 'L1: Data Connector',
    color: 'bg-gray-700',
    services: ['Data Quality', 'Legacy Adapter', 'Backup/DR'],
  },
  {
    layer: 'L2: Business Intelligence',
    color: 'bg-teal-700',
    services: ['Rules Engine', 'Process Orchestrator', 'Knowledge Base', 'Compliance'],
  },
  {
    layer: 'L3: Relevance Engine',
    color: 'bg-amber-600',
    services: ['Queue Priority', 'Predictive Routing', 'Proficiency Tracking'],
  },
  {
    layer: 'L4: Dynamic Workspace',
    color: 'bg-purple-700',
    services: ['Guided/Expert Mode', 'Notifications', 'Document UI', 'Case Notes'],
  },
];

export default function ServiceMapLayers() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-bold text-gray-700">Four-Layer Architecture</h3>
      </div>
      <div className="grid grid-cols-4 gap-2 p-4">
        {LAYERS.map((l) => (
          <div key={l.layer} className={`rounded-lg p-3 ${l.color}/5 border border-${l.color}/20`}>
            <div className={`text-[11px] font-bold mb-2 ${l.color.replace('bg-', 'text-')}`}>
              {l.layer}
            </div>
            <div className="space-y-1">
              {l.services.map((s) => (
                <div key={s} className="text-[10px] text-gray-500">
                  {s}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
