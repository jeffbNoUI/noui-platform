interface CorrespondencePanelPreviewProps {
  preview: string | null;
  lastGeneratedId: string | null;
  sendSuccess: boolean;
  showSendForm: boolean;
  sentVia: 'email' | 'mail';
  isSending: boolean;
  executedEffects: string[];
  onShowSendForm: () => void;
  onHideSendForm: () => void;
  onSetSentVia: (via: 'email' | 'mail') => void;
  onSend: () => void;
}

export default function CorrespondencePanelPreview({
  preview,
  lastGeneratedId,
  sendSuccess,
  showSendForm,
  sentVia,
  isSending,
  executedEffects,
  onShowSendForm,
  onHideSendForm,
  onSetSentVia,
  onSend,
}: CorrespondencePanelPreviewProps) {
  return (
    <>
      {/* Preview */}
      {preview && (
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-600 mb-2">Preview</div>
          <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {preview}
          </pre>
        </div>
      )}

      {/* Send section -- appears after generation */}
      {lastGeneratedId && !sendSuccess && (
        <div className="border border-gray-200 rounded-lg p-3">
          {!showSendForm ? (
            <button
              onClick={onShowSendForm}
              className="w-full px-3 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
            >
              Send
            </button>
          ) : (
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-600">Send via</div>
              <div className="flex gap-2">
                <button
                  onClick={() => onSetSentVia('email')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border ${
                    sentVia === 'email'
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Email
                </button>
                <button
                  onClick={() => onSetSentVia('mail')}
                  className={`flex-1 px-3 py-1.5 text-xs font-medium rounded border ${
                    sentVia === 'mail'
                      ? 'border-green-400 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Mail
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onSend}
                  disabled={isSending}
                  className="flex-1 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : 'Confirm Send'}
                </button>
                <button
                  onClick={onHideSendForm}
                  className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Send success */}
      {sendSuccess && (
        <div className="border border-green-200 rounded-lg p-3 bg-green-50 text-green-700 text-xs font-medium text-center space-y-1">
          <div>Correspondence sent successfully</div>
          {executedEffects.length > 0 && (
            <div className="text-[10px] text-green-600">
              {executedEffects.map((label, i) => (
                <div key={i}>
                  {'\u2713'} {label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
