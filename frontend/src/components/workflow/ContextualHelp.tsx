import { useEffect, useState } from 'react';
import { getHelpForStage, type HelpItem } from '@/lib/helpContent';
import { kbAPI } from '@/lib/kbApi';
import type { KBArticle } from '@/types/KnowledgeBase';
import type { ProficiencyLevel } from '@/hooks/useProficiency';

interface ContextualHelpProps {
  stageId: string;
  proficiency: ProficiencyLevel;
  onClose: () => void;
}

/** Normalize a KBArticle (from API) into the HelpItem shape used by the renderer. */
function articleToHelpItem(article: KBArticle): HelpItem {
  return {
    stageId: article.stageId,
    title: article.title,
    context: article.context,
    checklist: article.checklist ?? [],
    rules: (article.rules ?? []).map((r) => ({ code: r.code, description: r.description })),
    nextAction: article.nextAction ?? '',
  };
}

/**
 * Sticky contextual help panel shown in Guided/Assisted modes.
 * - Guided: Full content with "What to check", rules, and "Next Action"
 * - Assisted: Reference-only ("Quick Reference"), no next action
 * - Expert: Not rendered (caller should hide)
 *
 * Data source: Fetches from Knowledge Base API, falls back to local helpContent.ts
 * if the API is unreachable.
 */
export default function ContextualHelp({ stageId, proficiency, onClose }: ContextualHelpProps) {
  const [help, setHelp] = useState<HelpItem | undefined>(() => getHelpForStage(stageId));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchHelp() {
      try {
        const article = await kbAPI.getStageHelp(stageId);
        if (!cancelled) {
          setHelp(articleToHelpItem(article));
        }
      } catch {
        // API unreachable — fall back to local data (already set as initial state)
        if (!cancelled) {
          setHelp(getHelpForStage(stageId));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    setLoading(true);
    fetchHelp();

    return () => {
      cancelled = true;
    };
  }, [stageId]);

  if (!help && !loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-400">
        No help available for this stage.
      </div>
    );
  }

  if (!help) {
    return null;
  }

  const isGuided = proficiency === 'guided';
  const panelTitle = isGuided ? 'Guided Help' : 'Quick Reference';

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-sm">{isGuided ? '\ud83e\udded' : '\ud83d\udcd6'}</span>
          <span className="text-sm font-bold text-gray-700">{panelTitle}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-sm font-medium"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Stage title & context */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">{help.title}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{help.context}</p>
        </div>

        {/* What to check */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-bold text-teal-700">✓ What to check</span>
          </div>
          <ul className="space-y-1.5">
            {help.checklist.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-teal-800 leading-snug">
                <span className="text-teal-400 mt-0.5 flex-shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Rule references */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-xs font-bold text-blue-700">📖 Rule Reference</span>
          </div>
          <div className="space-y-1">
            {help.rules.map((rule, i) => (
              <div key={i} className="text-[11px] text-blue-800">
                <span className="font-semibold">{rule.code}</span>
                <span className="text-blue-600"> — {rule.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Next Action (Guided only) */}
        {isGuided && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-bold text-amber-700">⚡ Next Action</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-snug">{help.nextAction}</p>
          </div>
        )}

        {/* Proficiency hint */}
        <div className="text-[10px] text-gray-400 text-center pt-2 border-t border-gray-100">
          {isGuided
            ? 'Guided mode — all checks and next actions shown'
            : 'Assisted mode — reference only, next actions hidden'}
        </div>
      </div>
    </div>
  );
}
