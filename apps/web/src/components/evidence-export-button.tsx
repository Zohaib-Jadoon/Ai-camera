'use client';

import { FileDown } from 'lucide-react';

interface EvidenceExportButtonProps {
  alertId: string;
}

export default function EvidenceExportButton({ alertId }: EvidenceExportButtonProps) {
  const handleExport = () => {
    window.open(`/api/alerts/${alertId}/export`);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
    >
      <FileDown className="w-3.5 h-3.5" />
      Export Evidence
    </button>
  );
}
