import { useState } from 'react';
import { useAddresses, useUpdateAddress } from '@/hooks/useAddresses';
import type { Address } from '@/lib/memberPortalApi';
import { C, BODY } from '@/lib/designSystem';

// ── US state options ────────────────────────────────────────────────────────

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
];

// ── Validation ──────────────────────────────────────────────────────────────

interface ValidationErrors {
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
}

function validateAddress(addr: Partial<Address>): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!addr.line1?.trim()) errors.line1 = 'Street address is required';
  if (!addr.city?.trim()) errors.city = 'City is required';
  if (!addr.state?.trim()) errors.state = 'State is required';
  if (!addr.zip?.trim()) {
    errors.zip = 'ZIP code is required';
  } else if (!/^\d{5}(-\d{4})?$/.test(addr.zip)) {
    errors.zip = 'Invalid ZIP code format';
  }
  return errors;
}

// ── Props ───────────────────────────────────────────────────────────────────

interface AddressesTabProps {
  memberId: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AddressesTab({ memberId }: AddressesTabProps) {
  const { data: addresses, isLoading } = useAddresses(memberId);
  const updateAddress = useUpdateAddress(memberId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Address>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});

  if (isLoading) {
    return (
      <div data-testid="addresses-tab" style={{ fontFamily: BODY, color: C.textSecondary }}>
        Loading addresses...
      </div>
    );
  }

  const addressList = addresses ?? [];

  const startEdit = (addr: Address) => {
    setEditingId(addr.id);
    setEditData({
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
    });
    setErrors({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
    setErrors({});
  };

  const saveEdit = () => {
    const validationErrors = validateAddress(editData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (editingId) {
      updateAddress.mutate({ addressId: editingId, data: editData }, { onSuccess: cancelEdit });
    }
  };

  const updateField = (field: keyof Address, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const typeLabel = (type: string) =>
    type === 'mailing' ? 'Mailing Address' : 'Residential Address';

  return (
    <div data-testid="addresses-tab">
      {addressList.length === 0 && (
        <div style={{ fontFamily: BODY, color: C.textSecondary, padding: 20, textAlign: 'center' }}>
          No addresses on file.
        </div>
      )}

      {addressList.map((addr) => (
        <div
          key={addr.id}
          data-testid={`address-card-${addr.type}`}
          style={{
            background: C.cardBg,
            border: `1px solid ${C.borderLight}`,
            borderRadius: 10,
            padding: 24,
            marginBottom: 16,
            fontFamily: BODY,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.navy, margin: 0 }}>
              {typeLabel(addr.type)}
            </h3>
            {editingId !== addr.id && (
              <button
                data-testid={`address-edit-${addr.type}`}
                onClick={() => startEdit(addr)}
                style={{
                  fontFamily: BODY,
                  fontSize: 13,
                  color: C.sage,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Edit
              </button>
            )}
          </div>

          {editingId === addr.id ? (
            <div data-testid={`address-form-${addr.type}`}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Street Address</label>
                <input
                  data-testid="address-line1"
                  value={editData.line1 ?? ''}
                  onChange={(e) => updateField('line1', e.target.value)}
                  style={inputStyle}
                />
                {errors.line1 && <div style={errorStyle}>{errors.line1}</div>}
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Apt / Suite</label>
                <input
                  data-testid="address-line2"
                  value={editData.line2 ?? ''}
                  onChange={(e) => updateField('line2', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 2 }}>
                  <label style={labelStyle}>City</label>
                  <input
                    data-testid="address-city"
                    value={editData.city ?? ''}
                    onChange={(e) => updateField('city', e.target.value)}
                    style={inputStyle}
                  />
                  {errors.city && <div style={errorStyle}>{errors.city}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>State</label>
                  <select
                    data-testid="address-state"
                    value={editData.state ?? ''}
                    onChange={(e) => updateField('state', e.target.value)}
                    style={{ ...inputStyle, padding: '8px 10px' }}
                  >
                    <option value="">—</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.state && <div style={errorStyle}>{errors.state}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>ZIP</label>
                  <input
                    data-testid="address-zip"
                    value={editData.zip ?? ''}
                    onChange={(e) => updateField('zip', e.target.value)}
                    style={inputStyle}
                  />
                  {errors.zip && <div style={errorStyle}>{errors.zip}</div>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button
                  data-testid="address-cancel"
                  onClick={cancelEdit}
                  style={{
                    fontFamily: BODY,
                    fontSize: 14,
                    color: C.textSecondary,
                    background: 'none',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '8px 18px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  data-testid="address-save"
                  onClick={saveEdit}
                  disabled={updateAddress.isPending}
                  style={{
                    fontFamily: BODY,
                    fontSize: 14,
                    color: '#fff',
                    background: C.sage,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  {updateAddress.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ color: C.text, fontSize: 15, lineHeight: 1.6 }}>
              <div>{addr.line1}</div>
              {addr.line2 && <div>{addr.line2}</div>}
              <div>
                {addr.city}, {addr.state} {addr.zip}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared styles ───────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: C.textTertiary,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 4,
  fontFamily: BODY,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: BODY,
  fontSize: 14,
  color: C.text,
  padding: '8px 12px',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.coral,
  marginTop: 4,
  fontFamily: BODY,
};
