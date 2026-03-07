import { BODY } from '@/lib/designSystem';

interface CrmNotificationBadgeProps {
  count: number;
  color?: string;
}

export default function CrmNotificationBadge({ count, color = '#EF4444' }: CrmNotificationBadgeProps) {
  if (count <= 0) return null;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      borderRadius: 9,
      background: color,
      color: '#fff',
      fontSize: 10,
      fontWeight: 700,
      fontFamily: BODY,
      lineHeight: 1,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
