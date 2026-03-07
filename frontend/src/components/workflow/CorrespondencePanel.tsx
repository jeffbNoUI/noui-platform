import { useEffect, useState } from 'react';
import { correspondenceAPI } from '@/lib/correspondenceApi';
import type { CorrespondenceTemplate, Correspondence } from '@/types/Correspondence';

interface CorrespondencePanelProps {
  memberId?: number;
  contactId?: string;
}

/**
 * Correspondence panel — lists available templates, allows generating
 * letters with merge data, and shows correspondence history for a member.
 */
export default function CorrespondencePanel({ memberId, contactId }: CorrespondencePanelProps) {
  const [templates, setTemplates] = useState<CorrespondenceTemplate[]>([]);
  const [history, setHistory] = useState<Correspondence[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CorrespondenceTemplate | null>(null);
  const [mergeData, setMergeData] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  useEffect(() => {
    async function loadData() {
      try {
        const [tmplData, histData] = await Promise.all([
          correspondenceAPI.listTemplates(),
          correspondenceAPI.listHistory({
            member_id: memberId,
            contact_id: contactId,
          }),
        ]);
        setTemplates(tmplData || []);
        setHistory(histData || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load correspondence data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [memberId, contactId]);

  function handleSelectTemplate(tmpl: CorrespondenceTemplate) {
    setSelectedTemplate(tmpl);
    setPreview(null);
    // Pre-fill merge data with empty values
    const data: Record<string, string> = {};
    tmpl.mergeFields.forEach((f) => {
      data[f.name] = '';
    });
    setMergeData(data);
  }

  async function handleGenerate() {
    if (!selectedTemplate) return;

    setGenerating(true);
    setError(null);
    try {
      const result = await correspondenceAPI.generate({
        templateId: selectedTemplate.templateId,
        memberId,
        contactId,
        mergeData,
      });
      setPreview(result.bodyRendered);
      setHistory((prev) => [result, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate letter');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading correspondence...</div>;
  }

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    final: 'bg-blue-100 text-blue-700',
    sent: 'bg-green-100 text-green-700',
    void: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium ${
            activeTab === 'generate'
              ? 'text-teal-700 border-b-2 border-teal-500 bg-teal-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Generate Letter
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium ${
            activeTab === 'history'
              ? 'text-teal-700 border-b-2 border-teal-500 bg-teal-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          History ({history.length})
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-600 text-xs">{error}</div>
      )}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="p-4 space-y-4">
          {/* Template Selection */}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Select Template</label>
            <div className="space-y-1">
              {templates.map((tmpl) => (
                <button
                  key={tmpl.templateId}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className={`w-full text-left px-3 py-2 rounded border text-xs ${
                    selectedTemplate?.templateId === tmpl.templateId
                      ? 'border-teal-400 bg-teal-50 text-teal-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <div className="font-medium">{tmpl.templateName}</div>
                  {tmpl.description && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{tmpl.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Merge Fields */}
          {selectedTemplate && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">
                Merge Fields
              </label>
              <div className="space-y-2">
                {selectedTemplate.mergeFields.map((field) => (
                  <div key={field.name}>
                    <label className="text-[10px] text-gray-500 mb-0.5 block">
                      {field.description}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <input
                      type="text"
                      value={mergeData[field.name] || ''}
                      onChange={(e) =>
                        setMergeData((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      placeholder={`{{${field.name}}}`}
                      className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-teal-400"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="mt-3 w-full px-3 py-2 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Letter'}
              </button>
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="text-xs font-medium text-gray-600 mb-2">Preview</div>
              <pre className="text-[11px] text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {preview}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="p-4">
          {history.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">
              No correspondence history
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((corr) => (
                <div
                  key={corr.correspondenceId}
                  className="border border-gray-100 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{corr.subject}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor[corr.status]}`}>
                      {corr.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Generated {new Date(corr.createdAt).toLocaleDateString()}
                    {corr.sentAt && ` | Sent ${new Date(corr.sentAt).toLocaleDateString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
