import type { StageDescriptor } from '@/lib/workflowComposition';

export const testStages: StageDescriptor[] = [
  {
    id: 'intake',
    label: 'Intake',
    icon: '📋',
    description: 'Case intake and initial review',
    confidence: 'pre-verified',
    conditional: false,
  },
  {
    id: 'verify',
    label: 'Verify Employment',
    icon: '🔍',
    description: 'Verify employment history',
    confidence: 'needs-review',
    conditional: false,
  },
  {
    id: 'eligibility',
    label: 'Eligibility',
    icon: '⚖️',
    description: 'Check eligibility criteria',
    confidence: 'pending',
    conditional: false,
  },
  {
    id: 'dro',
    label: 'DRO Division',
    icon: '💍',
    description: 'Marital share division',
    confidence: 'pending',
    conditional: true,
  },
  {
    id: 'election',
    label: 'Election',
    icon: '📝',
    description: 'Select payment option',
    confidence: 'pending',
    conditional: false,
  },
];
