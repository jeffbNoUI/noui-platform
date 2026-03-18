import { C, DISPLAY, BODY } from '@/lib/designSystem';
import { formatCurrency, getGreeting, yearsOfService, isVested } from '../MemberPortalUtils';

export interface BenefitHeroProps {
  firstName: string;
  hireDate: string;
  estimatedMonthly: number;
  useDemo?: boolean;
}

export default function BenefitHero({
  firstName,
  hireDate,
  estimatedMonthly,
  useDemo = false,
}: BenefitHeroProps) {
  const svcYears = yearsOfService(hireDate);
  const vested = isVested(hireDate);

  return (
    <div
      data-testid="benefit-hero"
      data-tour-id="benefit-hero"
      style={{
        background: `linear-gradient(135deg, ${C.cardBgAccent} 0%, ${C.cardBgAccentLight} 100%)`,
        borderRadius: 16,
        padding: '32px 40px',
        color: C.textOnDark,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {useDemo && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '2px 10px',
            fontSize: 11,
            color: C.textOnDarkMuted,
          }}
        >
          Demo Data
        </div>
      )}

      <div style={{ fontFamily: BODY, fontSize: 16, color: C.textOnDarkMuted }}>
        {getGreeting()}, {firstName}.
      </div>

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 48,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        {/* Estimated monthly benefit */}
        <div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 12,
              color: C.textOnDarkDim,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Est. Monthly Benefit
          </div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            {formatCurrency(estimatedMonthly)}
          </div>
        </div>

        {/* Years of service */}
        <div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 12,
              color: C.textOnDarkDim,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Years of Service
          </div>
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              fontWeight: 600,
              lineHeight: 1.1,
              marginTop: 4,
            }}
          >
            {svcYears.toFixed(1)}
          </div>
        </div>

        {/* Vesting status */}
        <div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 12,
              color: C.textOnDarkDim,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            Vesting Status
          </div>
          <div
            style={{
              fontFamily: BODY,
              fontSize: 16,
              fontWeight: 600,
              marginTop: 6,
              color: vested ? '#A8D5BA' : C.gold,
            }}
          >
            {vested ? 'Fully Vested' : `${Math.min(svcYears, 5).toFixed(1)} / 5 years`}
          </div>
        </div>
      </div>
    </div>
  );
}
