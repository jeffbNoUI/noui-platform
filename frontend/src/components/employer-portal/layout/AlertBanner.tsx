import { C, BODY } from '@/lib/designSystem';
import type { EmployerAlert, AlertType } from '@/types/Employer';

interface AlertBannerProps {
  alerts: EmployerAlert[];
}

const ALERT_STYLES: Record<AlertType, { bg: string; border: string; text: string }> = {
  CRITICAL: { bg: C.coralLight, border: C.coral, text: C.coral },
  DEADLINE: { bg: C.goldLight, border: C.gold, text: C.gold },
  TASK: { bg: C.skyLight, border: C.sky, text: C.sky },
  POLICY_CHANGE: { bg: C.sageLight, border: C.sage, text: C.sage },
};

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div style={{ fontFamily: BODY, maxWidth: 1320, margin: '0 auto', padding: '16px 32px 0' }}>
      {alerts.map((alert) => {
        const style = ALERT_STYLES[alert.alertType] ?? ALERT_STYLES.TASK;
        return (
          <div
            key={alert.id}
            role="alert"
            style={{
              background: style.bg,
              borderLeft: `4px solid ${style.border}`,
              borderRadius: 6,
              padding: '10px 16px',
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: style.text }}>{alert.title}</div>
            {alert.body && (
              <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>{alert.body}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
