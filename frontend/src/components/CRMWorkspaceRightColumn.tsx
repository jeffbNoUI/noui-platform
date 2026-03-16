import CommitmentTracker from '@/components/CommitmentTracker';
import OutreachQueue from '@/components/OutreachQueue';
import NoteEditor from '@/components/NoteEditor';

interface CRMWorkspaceRightColumnProps {
  contactId: string;
  selectedInteractionId: string;
  showNoteEditor: boolean;
  onShowNoteEditor: () => void;
  onNoteSaved: () => void;
  onNoteCancel: () => void;
}

export default function CRMWorkspaceRightColumn({
  contactId,
  selectedInteractionId,
  showNoteEditor,
  onShowNoteEditor,
  onNoteSaved,
  onNoteCancel,
}: CRMWorkspaceRightColumnProps) {
  return (
    <div className="space-y-6">
      <CommitmentTracker contactId={contactId} />

      <OutreachQueue contactId={contactId} />

      {/* Note editor (shown when an interaction is selected) */}
      {selectedInteractionId && (
        <>
          {!showNoteEditor ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Interaction selected:{' '}
                    <span className="font-mono text-xs text-gray-500">{selectedInteractionId}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onShowNoteEditor}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
                >
                  Add Note
                </button>
              </div>
            </div>
          ) : (
            <NoteEditor
              interactionId={selectedInteractionId}
              onSaved={onNoteSaved}
              onCancel={onNoteCancel}
            />
          )}
        </>
      )}
    </div>
  );
}
