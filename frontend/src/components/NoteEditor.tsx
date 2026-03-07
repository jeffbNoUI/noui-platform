import { useState } from 'react';
import { useCreateNote } from '@/hooks/useCRM';
import type { CreateNoteRequest } from '@/types/CRM';

interface NoteEditorProps {
  interactionId: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

const NOTE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'benefits', label: 'Benefits' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'payment', label: 'Payment' },
  { value: 'enrollment', label: 'Enrollment' },
  { value: 'service_credit', label: 'Service Credit' },
  { value: 'dro', label: 'DRO' },
  { value: 'death_benefit', label: 'Death Benefit' },
  { value: 'disability', label: 'Disability' },
  { value: 'document', label: 'Document' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other', label: 'Other' },
];

const OUTCOME_OPTIONS = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'callback_scheduled', label: 'Callback Scheduled' },
  { value: 'info_provided', label: 'Information Provided' },
  { value: 'work_item_created', label: 'Work Item Created' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'voicemail_left', label: 'Voicemail Left' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'in_progress', label: 'In Progress' },
];

const SENTIMENT_OPTIONS = [
  { value: 'positive', label: 'Positive', icon: '+', color: 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100' },
  { value: 'neutral', label: 'Neutral', icon: '=', color: 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100' },
  { value: 'negative', label: 'Negative', icon: '-', color: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' },
  { value: 'frustrated', label: 'Frustrated', icon: '!', color: 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100' },
];

const OUTCOMES_REQUIRING_NEXT_STEP = ['callback_scheduled', 'escalated', 'work_item_created', 'in_progress'];

export default function NoteEditor({ interactionId, onSaved, onCancel }: NoteEditorProps) {
  const createNote = useCreateNote();

  const [category, setCategory] = useState('general');
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [sentiment, setSentiment] = useState<string | undefined>(undefined);
  const [urgentFlag, setUrgentFlag] = useState(false);

  const showNextStep = OUTCOMES_REQUIRING_NEXT_STEP.includes(outcome);

  const canSubmit = summary.trim().length > 0 && outcome.length > 0 && !createNote.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const req: CreateNoteRequest = {
      interactionId,
      category,
      summary: summary.trim(),
      outcome,
      nextStep: showNextStep && nextStep.trim() ? nextStep.trim() : undefined,
      sentiment,
      urgentFlag,
      aiSuggested: false,
    };

    createNote.mutate(req, {
      onSuccess: () => {
        setSummary('');
        setOutcome('');
        setNextStep('');
        setSentiment(undefined);
        setUrgentFlag(false);
        setCategory('general');
        onSaved?.();
      },
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Add Note</h2>
        <p className="text-sm text-gray-500">
          Record interaction details for this contact.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
        {/* Category */}
        <div>
          <label htmlFor="note-category" className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            id="note-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
          <label htmlFor="note-summary" className="block text-sm font-medium text-gray-700 mb-1">
            Summary <span className="text-red-500">*</span>
          </label>
          <textarea
            id="note-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Describe the interaction and key details..."
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Outcome */}
        <div>
          <label htmlFor="note-outcome" className="block text-sm font-medium text-gray-700 mb-1">
            Outcome <span className="text-red-500">*</span>
          </label>
          <select
            id="note-outcome"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
        {showNextStep && (
          <div>
            <label htmlFor="note-next-step" className="block text-sm font-medium text-gray-700 mb-1">
              Next Step
            </label>
            <textarea
              id="note-next-step"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="Describe the next action required..."
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}

        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sentiment
          </label>
          <div className="flex gap-2">
            {SENTIMENT_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSentiment(sentiment === s.value ? undefined : s.value)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                  sentiment === s.value
                    ? s.color + ' ring-2 ring-offset-1 ring-brand-400'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="text-base font-bold">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Urgent flag */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUrgentFlag(!urgentFlag)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
              urgentFlag ? 'bg-red-600' : 'bg-gray-200'
            }`}
            role="switch"
            aria-checked={urgentFlag}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                urgentFlag ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">
            Mark as Urgent
          </span>
          {urgentFlag && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              This note will be flagged for immediate attention
            </span>
          )}
        </div>

        {/* AI suggested indicator (read-only, shown when applicable) */}
        <div className="rounded-md bg-violet-50 border border-violet-200 px-3 py-2 text-sm text-violet-700">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium">AI Assist</span>
          </div>
          <p className="mt-1 text-xs text-violet-600">
            AI-suggested notes will be marked automatically when generated by the assistant.
            Manually created notes are not flagged as AI-suggested.
          </p>
        </div>

        {/* Error display */}
        {createNote.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {createNote.error.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createNote.isPending ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </form>
    </div>
  );
}
