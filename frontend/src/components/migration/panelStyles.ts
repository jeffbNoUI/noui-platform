// ═══════════════════════════════════════════════════════
// PANEL STYLES — Shared constants for all migration panels
// Single source of truth for panel structure, typography,
// tables, badges, buttons, and loading states.
// ═══════════════════════════════════════════════════════

import React from 'react';
import { C, DISPLAY, BODY } from '../../lib/designSystem';

// ── Layout Constants ──────────────────────────────────

export const SKELETON_LINES = 3;
export const SKELETON_GAP = 12;

// ── Typography ────────────────────────────────────────

export const PANEL_HEADING: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 18,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 16px',
};

export const SECTION_HEADING: React.CSSProperties = {
  fontFamily: DISPLAY,
  fontSize: 15,
  fontWeight: 600,
  color: C.navy,
  margin: '0 0 12px',
};

// ── Card ──────────────────────────────────────────────

export const PANEL_CARD: React.CSSProperties = {
  background: C.cardBg,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 20,
  transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
};

export const PANEL_CARD_HOVER: React.CSSProperties = {
  ...PANEL_CARD,
  boxShadow: C.cardHoverShadow,
  borderColor: C.borderFocus,
};

// ── Table ─────────────────────────────────────────────

export const TABLE_HEADER: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 11,
  fontWeight: 600,
  color: C.textTertiary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '10px 12px',
  borderBottom: `1px solid ${C.border}`,
};

export const TABLE_CELL: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  color: C.text,
  padding: '10px 12px',
  borderBottom: `1px solid ${C.borderLight}`,
};

// ── Empty State ───────────────────────────────────────

export const EMPTY_STATE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  color: C.textSecondary,
  fontFamily: BODY,
  fontSize: 14,
};

// ── Badge ─────────────────────────────────────────────

export const STATUS_BADGE: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 10px',
  borderRadius: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

// ── Buttons ───────────────────────────────────────────

export const BTN_PRIMARY: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  fontWeight: 600,
  color: '#FFFFFF',
  background: C.navy,
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
  transition: 'background 0.15s ease, box-shadow 0.15s ease',
};

export const BTN_SECONDARY: React.CSSProperties = {
  fontFamily: BODY,
  fontSize: 13,
  fontWeight: 600,
  color: C.navy,
  background: 'transparent',
  border: `1px solid ${C.navy}`,
  borderRadius: 6,
  padding: '8px 16px',
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease',
};

// ── Skeleton Helpers ──────────────────────────────────

export function skeletonLine(height: number, width: string): React.CSSProperties {
  return {
    height,
    width,
    borderRadius: 4,
    background: C.borderLight,
  };
}

export function PanelSkeleton(): React.ReactElement {
  return React.createElement(
    'div',
    {
      className: 'animate-pulse',
      style: { display: 'flex', flexDirection: 'column' as const, gap: SKELETON_GAP, padding: 20 },
    },
    React.createElement('div', { style: skeletonLine(14, '100%') }),
    React.createElement('div', { style: skeletonLine(14, '100%') }),
    React.createElement('div', { style: skeletonLine(14, '60%') }),
  );
}

export function PanelEmptyState({
  message,
  icon = '\u{1F4CB}',
}: {
  message: string;
  icon?: string;
}): React.ReactElement {
  return React.createElement(
    'div',
    { style: EMPTY_STATE },
    React.createElement('span', { style: { fontSize: 32, marginBottom: 12 } }, icon),
    React.createElement('span', null, message),
  );
}
