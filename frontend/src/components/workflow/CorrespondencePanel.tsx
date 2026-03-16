import { useEffect, useState } from 'react';
import { correspondenceAPI } from '@/lib/correspondenceApi';
import { resolveMergeFields, type MergeFieldContext } from '@/lib/mergeFieldResolver';
import { useCorrespondenceSend } from '@/hooks/useCorrespondence';
import type { CorrespondenceTemplate, Correspondence } from '@/types/Correspondence';
import CorrespondencePanelTemplatePicker from './CorrespondencePanelTemplatePicker';
import CorrespondencePanelPreview from './CorrespondencePanelPreview';

interface CorrespondencePanelProps {
  memberId?: number;
  contactId?: string;
  caseId?: string;
  caseContext?: MergeFieldContext;
  initialTemplateCode?: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  final: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-700',
};

/** Correspondence panel -- lists templates, generates letters, shows history. */
export default function CorrespondencePanel({
  memberId,
  contactId,
  caseId,
  caseContext,
  initialTemplateCode,
}: CorrespondencePanelProps) {
  const [templates, setTemplates] = useState<CorrespondenceTemplate[]>([]);
  const [history, setHistory] = useState<Correspondence[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CorrespondenceTemplate | null>(null);
  const [mergeData, setMergeData] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  const [showSendForm, setShowSendForm] = useState(false);
  const [sentVia, setSentVia] = useState<'email' | 'mail'>('email');
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [executedEffects, setExecutedEffects] = useState<string[]>([]);
  const sendMutation = useCorrespondenceSend();

  useEffect(() => {
    async function loadData() {
      try {
        const [tmplData, histData] = await Promise.all([
          correspondenceAPI.listTemplates(),
          correspondenceAPI.listHistory({
            member_id: memberId,
            contact_id: contactId,
            case_id: caseId || undefined,
          }),
        ]);
        setTemplates(tmplData || []);
        setHistory(histData || []);

        // Auto-select template by code if initialTemplateCode is provided
        if (initialTemplateCode && tmplData) {
          const match = tmplData.find(
            (t: CorrespondenceTemplate) => t.templateCode === initialTemplateCode,
          );
          if (match) {
            selectTemplate(match);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load correspondence data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, contactId]);

  function selectTemplate(tmpl: CorrespondenceTemplate) {
    setSelectedTemplate(tmpl);
    setPreview(null);
    setShowSendForm(false);
    setSendSuccess(false);
    setLastGeneratedId(null);

    // If caseContext is available, resolve merge fields automatically
    if (caseContext) {
      const resolved = resolveMergeFields(tmpl.mergeFields, caseContext);
      setMergeData(resolved);
    } else {
      // Pre-fill merge data with empty values
      const data: Record<string, string> = {};
      tmpl.mergeFields.forEach((f) => {
        data[f.name] = '';
      });
      setMergeData(data);
    }
  }

  async function handleGenerate() {
    if (!selectedTemplate) return;

    setGenerating(true);
    setError(null);
    try {
      const result = await correspondenceAPI.generate({
        templateId: selectedTemplate.templateId,
        memberId,
        caseId: caseId || undefined,
        contactId,
        mergeData,
      });
      setPreview(result.bodyRendered);
      setLastGeneratedId(result.correspondenceId);
      setHistory((prev) => [result, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate letter');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!lastGeneratedId) return;
    setError(null);
    try {
      const result = await sendMutation.mutateAsync({
        correspondenceId: lastGeneratedId,
        sentVia,
        contactId: contactId || undefined,
        subject: selectedTemplate?.templateName,
        caseId: caseId || undefined,
        onSendEffects: selectedTemplate?.onSendEffects,
      });

      const effectLabels = result.executedEffects.map((e) =>
        e.type === 'create_commitment'
          ? 'Follow-up commitment created'
          : e.type === 'advance_stage'
            ? 'Stage advance suggested'
            : e.type,
      );
      setExecutedEffects(effectLabels);

      setSendSuccess(true);
      setShowSendForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send correspondence');
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading correspondence...</div>;
  }

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

      {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-xs">{error}</div>}

      {/* Generate Tab */}
      {activeTab === 'generate' && (
        <div className="p-4 space-y-4">
          <CorrespondencePanelTemplatePicker
            templates={templates}
            selectedTemplateId={selectedTemplate?.templateId ?? null}
            mergeData={mergeData}
            onSelectTemplate={selectTemplate}
            onMergeDataChange={(name, value) =>
              setMergeData((prev) => ({ ...prev, [name]: value }))
            }
            onGenerate={handleGenerate}
            generating={generating}
            hasSelectedTemplate={selectedTemplate !== null}
            mergeFields={selectedTemplate?.mergeFields ?? null}
          />

          <CorrespondencePanelPreview
            preview={preview}
            lastGeneratedId={lastGeneratedId}
            sendSuccess={sendSuccess}
            showSendForm={showSendForm}
            sentVia={sentVia}
            isSending={sendMutation.isPending}
            executedEffects={executedEffects}
            onShowSendForm={() => setShowSendForm(true)}
            onHideSendForm={() => setShowSendForm(false)}
            onSetSentVia={setSentVia}
            onSend={handleSend}
          />
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="p-4">
          {history.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-8">No correspondence history</div>
          ) : (
            <div className="space-y-2">
              {history.map((corr) => (
                <div key={corr.correspondenceId} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{corr.subject}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[corr.status]}`}
                    >
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
