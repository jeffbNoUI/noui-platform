import { useCallback, useMemo, useState } from 'react';
import { C, BODY, DISPLAY, MONO } from '@/lib/designSystem';
import {
  useReconRuleSets,
  useCreateReconRuleSet,
  useUpdateReconRuleSet,
  useActivateReconRuleSet,
  useArchiveReconRuleSet,
  useReconRuleSetDiff,
} from '@/hooks/useMigrationApi';
import type {
  ReconRuleSet,
  ReconRuleSetStatus,
  ComparisonType,
  RiskSeverity,
  ReconRuleDiffItem,
} from '@/types/Migration';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ReconRuleSetStatus, string> = {
  DRAFT: '#3B82F6',
  ACTIVE: '#10B981',
  SUPERSEDED: '#6B7280',
  ARCHIVED: '#D1D5DB',
};

const STATUS_BG: Record<ReconRuleSetStatus, string> = {
  DRAFT: '#EFF6FF',
  ACTIVE: '#ECFDF5',
  SUPERSEDED: '#F3F4F6',
  ARCHIVED: '#F9FAFB',
};

const COMPARISON_TYPES: ComparisonType[] = [
  'EXACT',
  'TOLERANCE_ABS',
  'TOLERANCE_PCT',
  'ROUND_THEN_COMPARE',
];

const PRIORITY_OPTIONS: RiskSeverity[] = ['P1', 'P2', 'P3'];

// ─── Rule Editor Types ──────────────────────────────────────────────────────

interface EditableRule {
  tier: 1 | 2 | 3;
  calc_name: string;
  comparison_type: ComparisonType;
  tolerance_value: string;
  priority_if_mismatch: RiskSeverity;
  enabled: boolean;
}

interface EditorState {
  open: boolean;
  mode: 'create' | 'edit';
  rulesetId?: string;
  label: string;
  rules: EditableRule[];
  errors: string[];
}

const emptyRule = (): EditableRule => ({
  tier: 1,
  calc_name: '',
  comparison_type: 'TOLERANCE_ABS',
  tolerance_value: '0.01',
  priority_if_mismatch: 'P2',
  enabled: true,
});

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  engagementId: string;
}

export default function ReconRulesPanel({ engagementId }: Props) {
  const { data: ruleSets, isLoading } = useReconRuleSets(engagementId);
  const createMutation = useCreateReconRuleSet();
  const updateMutation = useUpdateReconRuleSet();
  const activateMutation = useActivateReconRuleSet();
  const archiveMutation = useArchiveReconRuleSet();

  const [editor, setEditor] = useState<EditorState>({
    open: false,
    mode: 'create',
    label: '',
    rules: [emptyRule()],
    errors: [],
  });

  const [activateConfirm, setActivateConfirm] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<{
    open: boolean;
    fromId: string;
    toId: string;
  }>({ open: false, fromId: '', toId: '' });

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  // Sort: newest version first
  const sortedSets = useMemo(
    () => (ruleSets ? [...ruleSets].sort((a, b) => b.version - a.version) : []),
    [ruleSets],
  );

  // ─── Validation ─────────────────────────────────────────────────────────

  const validateEditor = useCallback((state: EditorState): string[] => {
    const errors: string[] = [];
    if (!state.label.trim()) errors.push('Label is required');
    if (state.rules.length === 0) errors.push('At least one rule is required');

    const seen = new Set<string>();
    for (const r of state.rules) {
      if (!r.calc_name.trim()) {
        errors.push('All rules must have a calc_name');
        break;
      }
      const key = `${r.tier}_${r.calc_name}`;
      if (seen.has(key)) {
        errors.push(`Duplicate rule: tier ${r.tier}, calc_name "${r.calc_name}"`);
      }
      seen.add(key);
      // Validate tolerance_value is a valid decimal string
      if (!/^\d+(\.\d+)?$/.test(r.tolerance_value.trim())) {
        errors.push(`Invalid tolerance value "${r.tolerance_value}" — must be a decimal string`);
      }
    }
    return errors;
  }, []);

  // ─── Editor open helpers ────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    setEditor({
      open: true,
      mode: 'create',
      label: '',
      rules: [emptyRule()],
      errors: [],
    });
  }, []);

  const openEdit = useCallback((rs: ReconRuleSet) => {
    setEditor({
      open: true,
      mode: 'edit',
      rulesetId: rs.ruleset_id,
      label: rs.label,
      rules: rs.rules.map((r) => ({
        tier: r.tier,
        calc_name: r.calc_name,
        comparison_type: r.comparison_type,
        tolerance_value: r.tolerance_value,
        priority_if_mismatch: r.priority_if_mismatch,
        enabled: r.enabled,
      })),
      errors: [],
    });
  }, []);

  // ─── Save ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const errors = validateEditor(editor);
    if (errors.length > 0) {
      setEditor((prev) => ({ ...prev, errors }));
      return;
    }

    const rulesPayload = editor.rules.map((r) => ({
      tier: r.tier,
      calc_name: r.calc_name.trim(),
      comparison_type: r.comparison_type,
      tolerance_value: r.tolerance_value.trim(),
      priority_if_mismatch: r.priority_if_mismatch,
      enabled: r.enabled,
    }));

    if (editor.mode === 'create') {
      createMutation.mutate(
        {
          engagementId,
          req: { label: editor.label.trim(), rules: rulesPayload },
        },
        {
          onSuccess: () => {
            setEditor((prev) => ({ ...prev, open: false }));
            setFeedback({ type: 'success', message: 'Rule set created successfully.' });
          },
          onError: (err) => setFeedback({ type: 'error', message: err.message }),
        },
      );
    } else if (editor.rulesetId) {
      updateMutation.mutate(
        {
          engagementId,
          rulesetId: editor.rulesetId,
          req: { label: editor.label.trim(), rules: rulesPayload },
        },
        {
          onSuccess: () => {
            setEditor((prev) => ({ ...prev, open: false }));
            setFeedback({ type: 'success', message: 'Rule set updated successfully.' });
          },
          onError: (err) => setFeedback({ type: 'error', message: err.message }),
        },
      );
    }
  }, [editor, engagementId, createMutation, updateMutation, validateEditor]);

  // ─── Activate ───────────────────────────────────────────────────────────

  const handleActivate = useCallback(
    (rulesetId: string) => {
      activateMutation.mutate(
        { engagementId, rulesetId },
        {
          onSuccess: () => {
            setActivateConfirm(null);
            setFeedback({ type: 'success', message: 'Rule set activated.' });
          },
          onError: (err) => setFeedback({ type: 'error', message: err.message }),
        },
      );
    },
    [engagementId, activateMutation],
  );

  // ─── Archive ────────────────────────────────────────────────────────────

  const handleArchive = useCallback(
    (rulesetId: string) => {
      archiveMutation.mutate(
        { engagementId, rulesetId },
        {
          onSuccess: () => setFeedback({ type: 'success', message: 'Rule set archived.' }),
          onError: (err) => setFeedback({ type: 'error', message: err.message }),
        },
      );
    },
    [engagementId, archiveMutation],
  );

  // ─── Rule row helpers ──────────────────────────────────────────────────

  const updateRule = useCallback((index: number, patch: Partial<EditableRule>) => {
    setEditor((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeRule = useCallback((index: number) => {
    setEditor((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  }, []);

  const addRule = useCallback(() => {
    setEditor((prev) => ({ ...prev, rules: [...prev.rules, emptyRule()] }));
  }, []);

  // ─── Loading ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          className="animate-pulse"
          style={{ height: 200, borderRadius: 8, background: C.border }}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: BODY }}>
      {/* Feedback */}
      {feedback && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
            fontWeight: 500,
            color: '#fff',
            background: feedback.type === 'success' ? C.sage : C.coral,
            cursor: 'pointer',
          }}
          onClick={() => setFeedback(null)}
        >
          {feedback.message}
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontFamily: DISPLAY,
            fontSize: 18,
            fontWeight: 600,
            color: C.navy,
            margin: 0,
          }}
        >
          Reconciliation Rule Sets
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setDiffState({ open: true, fromId: '', toId: '' })}
            disabled={!sortedSets || sortedSets.length < 2}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              color: C.navy,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: BODY,
              opacity: sortedSets && sortedSets.length >= 2 ? 1 : 0.5,
            }}
          >
            Compare Versions
          </button>
          <button
            onClick={openCreate}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: C.sage,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Create New Version
          </button>
        </div>
      </div>

      {/* Version list table */}
      {sortedSets.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: C.textSecondary,
            fontSize: 14,
          }}
        >
          No rule sets defined yet. Create the first version to get started.
        </div>
      ) : (
        <div
          style={{
            background: C.cardBg,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.pageBg, borderBottom: `1px solid ${C.border}` }}>
                {['Version', 'Label', 'Status', 'Rules', 'Created', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      textAlign: h === 'Actions' ? 'right' : 'left',
                      fontWeight: 600,
                      color: C.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSets.map((rs) => (
                <tr key={rs.ruleset_id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: '10px 14px', fontFamily: MONO, fontWeight: 600 }}>
                    v{rs.version}
                  </td>
                  <td style={{ padding: '10px 14px', color: C.text }}>{rs.label}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        color: STATUS_COLORS[rs.status],
                        background: STATUS_BG[rs.status],
                      }}
                    >
                      {rs.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: MONO, color: C.textSecondary }}>
                    {rs.rules.length}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: C.textSecondary }}>
                    {new Date(rs.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {rs.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => openEdit(rs)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              border: `1px solid ${C.border}`,
                              background: C.cardBg,
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: 'pointer',
                              color: C.navy,
                              fontFamily: BODY,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setActivateConfirm(rs.ruleset_id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              border: 'none',
                              background: '#10B981',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              fontFamily: BODY,
                            }}
                          >
                            Activate
                          </button>
                        </>
                      )}
                      {rs.status === 'SUPERSEDED' && (
                        <button
                          onClick={() => handleArchive(rs.ruleset_id)}
                          disabled={archiveMutation.isPending}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            background: C.cardBg,
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            color: C.textSecondary,
                            fontFamily: BODY,
                          }}
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Activation confirmation dialog */}
      {activateConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setActivateConfirm(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 420,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              style={{
                fontFamily: DISPLAY,
                fontSize: 16,
                fontWeight: 600,
                color: C.navy,
                margin: '0 0 12px',
              }}
            >
              Activate Rule Set?
            </h4>
            <p
              style={{ fontSize: 13, color: C.textSecondary, margin: '0 0 20px', lineHeight: 1.5 }}
            >
              This will supersede the current active version. The active ruleset will be moved to
              SUPERSEDED status and this version will become the active reconciliation
              configuration.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setActivateConfirm(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.cardBg,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleActivate(activateConfirm)}
                disabled={activateMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#10B981',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                {activateMutation.isPending ? 'Activating...' : 'Confirm Activate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor dialog */}
      {editor.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setEditor((prev) => ({ ...prev, open: false }))}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 800,
              width: '95%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4
              style={{
                fontFamily: DISPLAY,
                fontSize: 16,
                fontWeight: 600,
                color: C.navy,
                margin: '0 0 16px',
              }}
            >
              {editor.mode === 'create' ? 'Create New Rule Set' : 'Edit Rule Set'}
            </h4>

            {/* Validation errors */}
            {editor.errors.length > 0 && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: C.coralLight,
                  color: C.coral,
                  fontSize: 12,
                  marginBottom: 16,
                }}
              >
                {editor.errors.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}

            {/* Label input */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: C.textSecondary,
                  marginBottom: 4,
                }}
              >
                Label
              </label>
              <input
                type="text"
                value={editor.label}
                onChange={(e) => setEditor((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. v3 - adjusted tier 2 thresholds"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontFamily: BODY,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Rules table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {[
                      'Tier',
                      'Calc Name',
                      'Comparison',
                      'Tolerance',
                      'Priority',
                      'Enabled',
                      '',
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 8px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: C.textSecondary,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editor.rules.map((rule, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: '6px 8px' }}>
                        <select
                          value={rule.tier}
                          onChange={(e) =>
                            updateRule(idx, { tier: Number(e.target.value) as 1 | 2 | 3 })
                          }
                          style={{
                            padding: '4px 6px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            fontSize: 12,
                            fontFamily: BODY,
                          }}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="text"
                          value={rule.calc_name}
                          onChange={(e) => updateRule(idx, { calc_name: e.target.value })}
                          placeholder="monthly_benefit"
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            fontSize: 12,
                            fontFamily: MONO,
                            width: 140,
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select
                          value={rule.comparison_type}
                          onChange={(e) =>
                            updateRule(idx, {
                              comparison_type: e.target.value as ComparisonType,
                            })
                          }
                          style={{
                            padding: '4px 6px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            fontSize: 12,
                            fontFamily: BODY,
                          }}
                        >
                          {COMPARISON_TYPES.map((ct) => (
                            <option key={ct} value={ct}>
                              {ct}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="text"
                          value={rule.tolerance_value}
                          onChange={(e) => updateRule(idx, { tolerance_value: e.target.value })}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            fontSize: 12,
                            fontFamily: MONO,
                            width: 80,
                          }}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <select
                          value={rule.priority_if_mismatch}
                          onChange={(e) =>
                            updateRule(idx, {
                              priority_if_mismatch: e.target.value as RiskSeverity,
                            })
                          }
                          style={{
                            padding: '4px 6px',
                            borderRadius: 4,
                            border: `1px solid ${C.border}`,
                            fontSize: 12,
                            fontFamily: BODY,
                          }}
                        >
                          {PRIORITY_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => updateRule(idx, { enabled: e.target.checked })}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <button
                          onClick={() => removeRule(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: C.coral,
                            fontSize: 14,
                            fontWeight: 700,
                            padding: '2px 6px',
                          }}
                          title="Remove rule"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={addRule}
              style={{
                marginTop: 8,
                padding: '6px 12px',
                borderRadius: 4,
                border: `1px dashed ${C.border}`,
                background: 'transparent',
                fontSize: 12,
                color: C.sage,
                cursor: 'pointer',
                fontFamily: BODY,
                fontWeight: 500,
              }}
            >
              + Add Rule
            </button>

            {/* Footer buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                onClick={() => setEditor((prev) => ({ ...prev, open: false }))}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: C.cardBg,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: C.sage,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: BODY,
                }}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editor.mode === 'create'
                    ? 'Create'
                    : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff viewer dialog */}
      {diffState.open && (
        <DiffViewer
          engagementId={engagementId}
          ruleSets={sortedSets}
          fromId={diffState.fromId}
          toId={diffState.toId}
          onFromChange={(id) => setDiffState((prev) => ({ ...prev, fromId: id }))}
          onToChange={(id) => setDiffState((prev) => ({ ...prev, toId: id }))}
          onClose={() => setDiffState({ open: false, fromId: '', toId: '' })}
        />
      )}
    </div>
  );
}

// ─── Diff Viewer ────────────────────────────────────────────────────────────

function DiffViewer({
  engagementId,
  ruleSets,
  fromId,
  toId,
  onFromChange,
  onToChange,
  onClose,
}: {
  engagementId: string;
  ruleSets: ReconRuleSet[];
  fromId: string;
  toId: string;
  onFromChange: (id: string) => void;
  onToChange: (id: string) => void;
  onClose: () => void;
}) {
  const { data: diff, isLoading } = useReconRuleSetDiff(engagementId, toId, fromId);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          maxWidth: 700,
          width: '95%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h4
          style={{
            fontFamily: DISPLAY,
            fontSize: 16,
            fontWeight: 600,
            color: C.navy,
            margin: '0 0 16px',
          }}
        >
          Version Diff
        </h4>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
                display: 'block',
                marginBottom: 4,
              }}
            >
              From
            </label>
            <select
              value={fromId}
              onChange={(e) => onFromChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                fontFamily: BODY,
              }}
            >
              <option value="">Select version...</option>
              {ruleSets.map((rs) => (
                <option key={rs.ruleset_id} value={rs.ruleset_id}>
                  v{rs.version} — {rs.label} ({rs.status})
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textSecondary,
                display: 'block',
                marginBottom: 4,
              }}
            >
              To
            </label>
            <select
              value={toId}
              onChange={(e) => onToChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                fontSize: 13,
                fontFamily: BODY,
              }}
            >
              <option value="">Select version...</option>
              {ruleSets.map((rs) => (
                <option key={rs.ruleset_id} value={rs.ruleset_id}>
                  v{rs.version} — {rs.label} ({rs.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading && fromId && toId && (
          <div style={{ padding: 24, textAlign: 'center', color: C.textSecondary }}>
            Loading diff...
          </div>
        )}

        {diff && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0 && (
              <div
                style={{ padding: 16, textAlign: 'center', color: C.textSecondary, fontSize: 13 }}
              >
                No differences found between these versions.
              </div>
            )}

            {diff.added.map((item) => (
              <DiffRow key={item.rule_id} item={item} />
            ))}
            {diff.removed.map((item) => (
              <DiffRow key={item.rule_id} item={item} />
            ))}
            {diff.modified.map((item) => (
              <DiffRow key={item.rule_id} item={item} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: C.cardBg,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: BODY,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffRow({ item }: { item: ReconRuleDiffItem }) {
  const changeColor =
    item.change === 'added' ? C.sage : item.change === 'removed' ? C.coral : '#F59E0B';
  const changeBg =
    item.change === 'added' ? C.sageLight : item.change === 'removed' ? C.coralLight : '#FEF3C7';
  const changeLabel = item.change.charAt(0).toUpperCase() + item.change.slice(1);

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `1px solid ${C.borderLight}`,
        background: changeBg,
      }}
    >
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: item.fields ? 6 : 0 }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 4,
            color: changeColor,
            background: 'rgba(255,255,255,0.7)',
          }}
        >
          {changeLabel}
        </span>
        <span style={{ fontSize: 12, fontFamily: MONO, color: C.text, fontWeight: 500 }}>
          {item.rule_id}
        </span>
      </div>
      {item.fields && Object.keys(item.fields).length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          {Object.entries(item.fields).map(([field, vals]) => (
            <span key={field} style={{ fontSize: 11, color: C.textSecondary }}>
              <strong>{field}:</strong>{' '}
              <span style={{ color: C.coral, textDecoration: 'line-through' }}>
                {String(vals.old)}
              </span>{' '}
              &rarr; <span style={{ color: '#F59E0B', fontWeight: 600 }}>{String(vals.new)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
