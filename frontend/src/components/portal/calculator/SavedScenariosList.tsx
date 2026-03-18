import { C, BODY } from '@/lib/designSystem';
import type { SavedScenario } from '@/types/MemberPortal';
import { formatCurrency, formatRelativeDate } from '../MemberPortalUtils';

interface SavedScenariosListProps {
  scenarios: SavedScenario[];
  onSelect?: (scenario: SavedScenario) => void;
  onDelete?: (scenarioId: string) => void;
  onCompare?: (scenarios: SavedScenario[]) => void;
  isDeleting?: boolean;
}

export default function SavedScenariosList({
  scenarios,
  onSelect,
  onDelete,
  onCompare,
}: SavedScenariosListProps) {
  if (scenarios.length === 0) {
    return (
      <div
        data-testid="saved-scenarios-empty"
        style={{
          fontFamily: BODY,
          fontSize: 14,
          color: C.textTertiary,
          textAlign: 'center',
          padding: 32,
        }}
      >
        No saved scenarios yet. Use the calculator to create one.
      </div>
    );
  }

  return (
    <div data-testid="saved-scenarios-list">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: BODY,
            fontSize: 12,
            fontWeight: 600,
            color: C.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Saved Scenarios ({scenarios.length})
        </div>
        {onCompare && scenarios.length >= 2 && (
          <button
            data-testid="compare-scenarios-btn"
            onClick={() => onCompare(scenarios.slice(0, 3))}
            style={{
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${C.sage}`,
              background: 'transparent',
              color: C.sage,
              cursor: 'pointer',
            }}
          >
            Compare
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scenarios.map((s) => (
          <div
            key={s.id}
            data-testid={`scenario-card-${s.id}`}
            onClick={() => onSelect?.(s)}
            style={{
              background: C.cardBg,
              border: `1px solid ${C.borderLight}`,
              borderRadius: 10,
              padding: '14px 16px',
              cursor: onSelect ? 'pointer' : 'default',
              transition: 'border-color 0.15s',
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
            >
              <div>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.navy,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {s.label}
                  {s.is_stale && (
                    <span
                      data-testid={`scenario-stale-${s.id}`}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: C.gold,
                        background: C.goldLight,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      Stale
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 13,
                    color: C.textSecondary,
                    marginTop: 4,
                  }}
                >
                  {formatDateLabel(s.inputs.retirement_date)} &middot;{' '}
                  {s.results.eligibility_type === 'EARLY'
                    ? 'Early'
                    : s.results.eligibility_type === 'NORMAL'
                      ? 'Normal'
                      : 'Ineligible'}{' '}
                  &middot; {s.results.service_years} yrs service
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.sage,
                  }}
                >
                  {formatCurrency(s.results.monthly_benefit)}/mo
                </div>
                <div
                  style={{
                    fontFamily: BODY,
                    fontSize: 11,
                    color: C.textTertiary,
                    marginTop: 2,
                  }}
                >
                  {formatRelativeDate(s.updated_at)}
                </div>
              </div>
            </div>

            {/* Actions */}
            {onDelete && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: `1px solid ${C.borderLight}`,
                }}
              >
                <button
                  data-testid={`scenario-delete-${s.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  style={{
                    fontFamily: BODY,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 12px',
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: C.textTertiary,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
