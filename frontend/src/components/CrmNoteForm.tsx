import { useState } from 'react';
import { useCreateStructuredNote } from '@/hooks/useCRM';
import CrmNoteFormExtras from '@/components/CrmNoteFormExtras';

interface CrmNoteFormProps {
  contactId: string;
  conversationId?: string;
}

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'payment', label: 'Payment' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'service_credit', label: 'Service Credit' },
  { value: 'forms', label: 'Forms' },
  { value: 'dro', label: 'DRO' },
  { value: 'death_benefit', label: 'Death Benefit' },
  { value: 'disability', label: 'Disability' },
  { value: 'document', label: 'Document' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other', label: 'Other' },
];

const OUTCOME_OPTIONS = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'info_provided', label: 'Info Provided' },
  { value: 'work_item_created', label: 'Work Item Created' },
  { value: 'callback_scheduled', label: 'Callback Scheduled' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'in_progress', label: 'In Progress' },
];

const OUTCOMES_REQUIRING_NEXT_STEP = new Set([
  'escalated',
  'callback_scheduled',
  'work_item_created',
  'in_progress',
  'transferred',
]);

export default function CrmNoteForm({ contactId, conversationId }: CrmNoteFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [category, setCategory] = useState('general');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [sentiment, setSentiment] = useState('neutral');
  const [urgentFlag, setUrgentFlag] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [showNarrative, setShowNarrative] = useState(false);

  const createNote = useCreateStructuredNote();

  const needsNextStep = OUTCOMES_REQUIRING_NEXT_STEP.has(outcome);
  const nextStepMissing = needsNextStep && !nextStep.trim();
  const canSubmit =
    summary.trim().length > 0 && outcome.length > 0 && !nextStepMissing && !createNote.isPending;

  const resetForm = () => {
    setCategory('general');
    setSummary('');
    setOutcome('');
    setNextStep('');
    setSentiment('neutral');
    setUrgentFlag(false);
    setNarrative('');
    setShowNarrative(false);
    setExpanded(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    createNote.mutate(
      {
        contactId,
        agentId: 'agent-sarah',
        category,
        summary: summary.trim(),
        outcome,
        nextStep: needsNextStep && nextStep.trim() ? nextStep.trim() : undefined,
        narrative: narrative.trim() || undefined,
        sentiment,
        urgentFlag,
        conversationId: conversationId || undefined,
      },
      { onSuccess: resetForm },
    );
  };

  if (!expanded) {
    return (
      <div className="border-t border-gray-200 px-4 py-3">
        <button
          onClick={() => setExpanded(true)}
          className="w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Add Note
        </button>
        <p className="mt-1 text-[10px] text-gray-400">
          Internal notes are not visible to members or employers
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200">
      <form onSubmit={handleSubmit} className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">New Note</p>
          <button
            type="button"
            onClick={resetForm}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>

        {/* Category */}
        <div>
          <label
            htmlFor="crm-note-cat"
            className="block text-[11px] font-medium text-gray-600 mb-0.5"
          >
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="crm-note-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {NOTE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Summary */}
        <div>
          <label
            htmlFor="crm-note-sum"
            className="block text-[11px] font-medium text-gray-600 mb-0.5"
          >
            Summary <span className="text-red-500">*</span>
          </label>
          <textarea
            id="crm-note-sum"
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 500))}
            placeholder="Key details of the interaction..."
            rows={3}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-right text-[10px] text-gray-400">{summary.length}/500</p>
        </div>

        {/* Outcome */}
        <div>
          <label
            htmlFor="crm-note-out"
            className="block text-[11px] font-medium text-gray-600 mb-0.5"
          >
            Outcome <span className="text-red-500">*</span>
          </label>
          <select
            id="crm-note-out"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select outcome...</option>
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Next Step (conditional) */}
        {needsNextStep && (
          <div>
            <label
              htmlFor="crm-note-ns"
              className="block text-[11px] font-medium text-gray-600 mb-0.5"
            >
              Next Step <span className="text-red-500">*</span>
            </label>
            <input
              id="crm-note-ns"
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Describe the next action..."
              className={`w-full rounded-md border px-2 py-1.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 ${
                nextStepMissing && outcome
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
              }`}
            />
            {nextStepMissing && outcome && (
              <p className="text-[10px] text-red-500 mt-0.5">
                Required when outcome is not resolved
              </p>
            )}
          </div>
        )}

        <CrmNoteFormExtras
          sentiment={sentiment}
          onSentimentChange={setSentiment}
          urgentFlag={urgentFlag}
          onUrgentFlagChange={setUrgentFlag}
          showNarrative={showNarrative}
          onShowNarrative={() => setShowNarrative(true)}
          narrative={narrative}
          onNarrativeChange={setNarrative}
        />

        {/* Error */}
        {createNote.isError && (
          <p className="rounded-md bg-red-50 border border-red-200 px-2 py-1.5 text-xs text-red-700">
            {createNote.error.message}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createNote.isPending ? 'Saving...' : 'Save Note'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>

        <p className="text-[10px] text-gray-400">
          Internal notes are not visible to members or employers
        </p>
      </form>
    </div>
  );
}
