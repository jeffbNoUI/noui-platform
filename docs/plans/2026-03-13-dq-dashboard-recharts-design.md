# Data Quality Dashboard + Recharts Migration — Design

**Date:** 2026-03-13
**Session:** 6 of Production Foundations
**Status:** Approved

## Goal

Add missing DQ visualizations (score trend chart, category breakdown chart) to the DataQualityPanel and migrate all existing hand-rolled SVG charts to Recharts for a consistent, premium charting experience.

## Approach

Install Recharts as the standard charting library. Build two new DQ chart components, wire them into the existing DataQualityPanel, then migrate the two existing SVG charts (BenefitProjectionChart, ContributionBars) to Recharts. RingGauge stays as raw SVG (radial gauge, not a chart pattern Recharts improves).

## Deliverables

### New DQ Components
1. **DQScoreTrendChart** — Recharts AreaChart showing score over time with 95% reference line, gradient fill, custom tooltip, ResponsiveContainer
2. **DQCategoryChart** — Recharts horizontal BarChart for category score breakdown (completeness, consistency, validity)
3. **Wire into DataQualityPanel** — trend chart between KPI cards and category scores, category chart replaces progress bars

### Recharts Migration
4. **BenefitProjectionChart** — convert from raw SVG to Recharts AreaChart (projected, conservative, contributed lines)
5. **ContributionBars** — convert from raw SVG to Recharts BarChart (employee/employer stacked bars)

### Tests
6. **DataQualityPanel.test.tsx** — score rendering, check list, issue actions, severity filter, empty states
7. **DQScoreTrendChart.test.tsx** — renders chart, handles empty data, shows reference line
8. **DQCategoryChart.test.tsx** — renders bars, handles empty categories
9. **DataQualityCard.test.tsx** — renders score, handles loading, shows issues
10. **Update existing chart tests** for Recharts migration

## Files

| Action | File |
|--------|------|
| Install | `recharts` dependency |
| New | `components/admin/DQScoreTrendChart.tsx` |
| New | `components/admin/DQCategoryChart.tsx` |
| New | `components/admin/__tests__/DataQualityPanel.test.tsx` |
| New | `components/admin/__tests__/DQScoreTrendChart.test.tsx` |
| New | `components/admin/__tests__/DQCategoryChart.test.tsx` |
| New | `components/dashboard/__tests__/DataQualityCard.test.tsx` |
| Modify | `components/admin/DataQualityPanel.tsx` |
| Modify | `components/portal/BenefitProjectionChart.tsx` |
| Modify | `components/portal/ContributionBars.tsx` |
| Update | `components/portal/__tests__/BenefitProjectionChart.test.tsx` |
| Update | `components/portal/__tests__/ContributionBars.test.tsx` |

## Design Decisions

- Design system colors (`C.sage`, `C.coral`, `C.gold`, etc.) applied via Recharts stroke/fill props
- ResponsiveContainer wraps all charts for fluid sizing
- Custom tooltips styled to match "Institutional Warmth" design system
- RingGauge stays as raw SVG — 38 lines, clean, not a chart pattern Recharts improves
- Horizontal BarChart for categories — more readable than pie/donut for 3 scores

## Acceptance Criteria

- `npx tsc --noEmit` clean
- `npm run build` clean
- All existing 327 tests still pass (zero regressions)
- 10-15+ new tests passing
- Trend chart visible in DQ panel
- Charts render gracefully with empty data
- No duplicate code — reuse existing hooks and types
- Consistent Recharts usage across all chart components
