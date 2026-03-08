# Interaction Detail Panel Build

## Goal

Enhance the Member Dashboard's interaction history so users can **click any interaction row** and have a **detail panel visually spawn from that row** — animating outward from the clicked element's position to become the focal point of the screen. The panel shows the full interaction record: complete notes, agent, duration, commitments, and linked correspondence. Clicking outside or pressing Escape dismisses it with a reverse animation back to the source row.

## Plan File

Read the approved implementation plan at `.claude/plans/shiny-inventing-allen.md` before writing any code. It contains the animation strategy (pure CSS + `getBoundingClientRect()`, no new dependencies), component structure, state flow, file list, and step-by-step implementation sequence.

## Key Files

| File | Role |
|------|------|
| `frontend/src/components/dashboard/InteractionHistoryCard.tsx` | **Modify** — add click handler per row, capture `getBoundingClientRect()` |
| `frontend/src/components/dashboard/MemberDashboard.tsx` | **Modify** — own `selectedInteraction` state, render detail panel overlay |
| `frontend/src/hooks/useCRM.ts` | **Reference** — `useDemoInteraction()` hook fetches full `Interaction` object |
| `frontend/src/types/CRM.ts` | **Reference** — `Interaction` (line 196), `Note` (line 239), `Commitment` (line 259) types |
| `frontend/src/components/CommandPalette.tsx` | **Reference** — overlay/modal pattern (`fixed inset-0 z-50`, backdrop, Escape key) |
| `frontend/src/components/workflow/DeckView.tsx` | **Reference** — transform-based animation pattern (`transition-all duration-500`) |

## Files to Create

1. `frontend/src/lib/channelMeta.ts` — extract shared `CHANNEL_ICONS`, `CHANNEL_LABELS`, `OUTCOME_STYLES` maps
2. `frontend/src/hooks/useSpawnAnimation.ts` — reusable animation hook (4-phase state machine, transform computation)
3. `frontend/src/components/dashboard/InteractionDetailPanel.tsx` — detail panel overlay with full interaction content

## Implementation Order

1. Extract channel metadata to shared module
2. Create `useSpawnAnimation` hook
3. Create `InteractionDetailPanel` component
4. Wire up InteractionHistoryCard (click handler + callback)
5. Wire up MemberDashboard (state + panel rendering)
6. Tests

## Instructions

Run `/session-start` first, then read the plan file and begin implementation following the sequence above.
