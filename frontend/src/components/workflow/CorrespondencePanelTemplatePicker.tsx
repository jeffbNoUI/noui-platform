import type { CorrespondenceTemplate } from '@/types/Correspondence';

interface CorrespondencePanelTemplatePickerProps {
  templates: CorrespondenceTemplate[];
  selectedTemplateId: string | null;
  mergeData: Record<string, string>;
  onSelectTemplate: (tmpl: CorrespondenceTemplate) => void;
  onMergeDataChange: (name: string, value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  hasSelectedTemplate: boolean;
  mergeFields: CorrespondenceTemplate['mergeFields'] | null;
}

const stageCategoryColor = 'bg-teal-50 text-teal-600 border border-teal-200';

export default function CorrespondencePanelTemplatePicker({
  templates,
  selectedTemplateId,
  mergeData,
  onSelectTemplate,
  onMergeDataChange,
  onGenerate,
  generating,
  hasSelectedTemplate,
  mergeFields,
}: CorrespondencePanelTemplatePickerProps) {
  return (
    <>
      {/* Template Selection */}
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Select Template</label>
        <div className="space-y-1">
          {templates.map((tmpl) => (
            <button
              key={tmpl.templateId}
              onClick={() => onSelectTemplate(tmpl)}
              className={`w-full text-left px-3 py-2 rounded border text-xs ${
                selectedTemplateId === tmpl.templateId
                  ? 'border-teal-400 bg-teal-50 text-teal-800'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{tmpl.templateName}</span>
                {tmpl.stageCategory && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${stageCategoryColor}`}
                  >
                    {tmpl.stageCategory}
                  </span>
                )}
              </div>
              {tmpl.description && (
                <div className="text-[10px] text-gray-400 mt-0.5">{tmpl.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Merge Fields */}
      {hasSelectedTemplate && mergeFields && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Merge Fields</label>
          <div className="space-y-2">
            {mergeFields.map((field) => (
              <div key={field.name}>
                <label className="text-[10px] text-gray-500 mb-0.5 block">
                  {field.description}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  type="text"
                  value={mergeData[field.name] || ''}
                  onChange={(e) => onMergeDataChange(field.name, e.target.value)}
                  placeholder={`{{${field.name}}}`}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-teal-400"
                />
              </div>
            ))}
          </div>

          <button
            onClick={onGenerate}
            disabled={generating}
            className="mt-3 w-full px-3 py-2 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Letter'}
          </button>
        </div>
      )}
    </>
  );
}
