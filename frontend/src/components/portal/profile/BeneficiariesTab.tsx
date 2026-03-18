import { useState } from 'react';
import { useBeneficiaries } from '@/hooks/useMember';
import { changeRequestAPI } from '@/lib/memberPortalApi';
import type { Beneficiary } from '@/types/Member';
import { C, BODY } from '@/lib/designSystem';
import BeneficiaryForm, { type BeneficiaryFormData } from './BeneficiaryForm';

// ── Props ───────────────────────────────────────────────────────────────────

interface BeneficiariesTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BeneficiariesTab({ memberId }: BeneficiariesTabProps) {
  const { data: beneficiaries, isLoading } = useBeneficiaries(memberId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  if (isLoading) {
    return (
      <div data-testid="beneficiaries-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading beneficiaries...
      </div>
    );
  }

  const beneList = beneficiaries ?? [];
  const totalAllocated = beneList.reduce((sum, b) => sum + b.alloc_pct, 0);
  const remainingPct = 100 - totalAllocated;
  const allocationValid = totalAllocated === 100;

  const handleAddBeneficiary = async (data: BeneficiaryFormData, reason: string) => {
    setSubmitting(true);
    try {
      await changeRequestAPI.create({
        member_id: memberId,
        field_name: 'beneficiary_add',
        current_value: JSON.stringify(
          beneList.map((b) => ({ name: `${b.first_name} ${b.last_name}`, pct: b.alloc_pct })),
        ),
        proposed_value: JSON.stringify(data),
        reason,
      });
      setShowAddForm(false);
      setSubmitSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="beneficiaries-tab">
      {submitSuccess && (
        <div
          data-testid="beneficiary-change-success"
          style={{
            background: C.sageLight,
            color: C.sageDark,
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 14,
            fontFamily: BODY,
            marginBottom: 16,
          }}
        >
          Beneficiary change request submitted for staff review.
        </div>
      )}

      {/* Allocation summary */}
      <div
        data-testid="allocation-summary"
        style={{
          background: allocationValid ? C.sageLight : C.coralLight,
          border: `1px solid ${allocationValid ? C.sage : C.coral}`,
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          fontFamily: BODY,
          fontSize: 14,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ color: allocationValid ? C.sageDark : C.coral }}>
          Total Allocation: {totalAllocated}%
          {!allocationValid &&
            ` (${remainingPct > 0 ? `${remainingPct}% unallocated` : 'exceeds 100%'})`}
        </span>
        {allocationValid && (
          <span style={{ color: C.sageDark, fontWeight: 600 }}>Fully Allocated</span>
        )}
      </div>

      {/* Info banner: all changes require staff review */}
      <div
        style={{
          background: C.goldLight,
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: 13,
          color: C.text,
          fontFamily: BODY,
          marginBottom: 20,
        }}
      >
        All beneficiary changes require staff review before they take effect.
      </div>

      {/* Beneficiary list */}
      {beneList.length === 0 && !showAddForm && (
        <div style={{ fontFamily: BODY, color: C.textSecondary, textAlign: 'center', padding: 20 }}>
          No beneficiaries on file.
        </div>
      )}

      {beneList.map((bene: Beneficiary) => (
        <div
          key={bene.bene_id}
          data-testid={`beneficiary-${bene.bene_id}`}
          style={{
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: 20,
            marginBottom: 12,
            fontFamily: BODY,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>
              {bene.first_name} {bene.last_name}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 4 }}>
              {bene.relationship ?? 'Relationship not specified'}
              {bene.dob && ` \u00b7 DOB: ${bene.dob}`}
            </div>
          </div>
          <div
            data-testid={`beneficiary-alloc-${bene.bene_id}`}
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.navy,
              minWidth: 60,
              textAlign: 'right',
            }}
          >
            {bene.alloc_pct}%
          </div>
        </div>
      ))}

      {/* Add beneficiary form */}
      {showAddForm ? (
        <div
          style={{
            marginTop: 16,
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: 24,
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: '0 0 16px' }}>
            Add Beneficiary
          </h3>
          <BeneficiaryForm
            remainingPct={remainingPct}
            onSubmit={handleAddBeneficiary}
            onCancel={() => setShowAddForm(false)}
            submitting={submitting}
          />
        </div>
      ) : (
        <button
          data-testid="add-beneficiary-btn"
          onClick={() => {
            setShowAddForm(true);
            setSubmitSuccess(false);
          }}
          style={{
            fontFamily: BODY,
            fontSize: 14,
            color: C.sage,
            background: C.sageLight,
            border: `1px solid ${C.sage}`,
            borderRadius: 8,
            padding: '10px 20px',
            cursor: 'pointer',
            fontWeight: 500,
            marginTop: 8,
          }}
        >
          + Add Beneficiary
        </button>
      )}
    </div>
  );
}
