import { C, DISPLAY } from '@/lib/designSystem';
import { getGreeting, formatCurrency, vestingYear } from './MemberPortalUtils';

interface MemberPortalHeroProps {
  firstName: string;
  estimatedMonthly: number;
  svcYears: number;
  vested: boolean;
  hireDate: string;
  useDemo: boolean;
}

export default function MemberPortalHero({
  firstName,
  estimatedMonthly,
  svcYears,
  vested,
  hireDate,
  useDemo,
}: MemberPortalHeroProps) {
  return (
    <>
      <div
        style={{
          background: `linear-gradient(135deg, ${C.cardBgAccent} 0%, ${C.cardBgAccentLight} 50%, #2A5478 100%)`,
          padding: '36px 32px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.04,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.4) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
        />

        <div style={{ maxWidth: 1320, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div
                style={{ fontSize: 13, color: C.textOnDarkDim, fontWeight: 500, marginBottom: 6 }}
              >
                Denver Employees Retirement Plan
              </div>
              <h1
                style={{
                  fontFamily: DISPLAY,
                  fontSize: 32,
                  fontWeight: 600,
                  color: C.textOnDark,
                  letterSpacing: '-0.5px',
                  lineHeight: 1.15,
                  marginBottom: 8,
                }}
              >
                {getGreeting()}, {firstName}.
              </h1>
              <p style={{ fontSize: 14, color: C.textOnDarkMuted, maxWidth: 480 }}>
                Your retirement is on track. Here's a snapshot of your benefits as of today.
              </p>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 24,
                alignItems: 'center',
                padding: '16px 28px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    fontFamily: DISPLAY,
                    color: C.textOnDark,
                  }}
                >
                  {formatCurrency(estimatedMonthly)}
                </div>
                <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 2 }}>
                  Est. Monthly Benefit
                </div>
              </div>
              <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    fontFamily: DISPLAY,
                    color: C.textOnDark,
                  }}
                >
                  {svcYears.toFixed(1)}
                </div>
                <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 2 }}>
                  Years of Service
                </div>
              </div>
              <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.12)' }} />
              <div style={{ textAlign: 'center' }}>
                {vested ? (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80' }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#4ADE80' }}>
                        Fully Vested
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 4 }}>
                      Since {vestingYear(hireDate)}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.gold }}>
                      Not Yet Vested
                    </div>
                    <div style={{ fontSize: 11, color: C.textOnDarkDim, marginTop: 4 }}>
                      {(5 - svcYears).toFixed(1)} years remaining
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo mode banner */}
      {useDemo && (
        <div
          style={{
            background: C.goldLight,
            borderBottom: `1px solid ${C.gold}`,
            padding: '10px 32px',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: C.gold,
          }}
        >
          Demo Mode — Showing sample data. Connect backend services for live data.
        </div>
      )}
    </>
  );
}
