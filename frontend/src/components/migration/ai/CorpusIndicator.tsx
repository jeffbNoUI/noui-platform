import { C, BODY } from '@/lib/designSystem';
import type { CorpusContext } from '@/types/Migration';

interface Props {
  context: CorpusContext;
}

export default function CorpusIndicator({ context }: Props) {
  let dotColor: string;
  let label: string;

  if (context.isNovel) {
    dotColor = C.textTertiary;
    label = 'New pattern';
  } else if (context.timesSeen >= 3 && context.approvalRate >= 0.9) {
    dotColor = C.sage;
    label = `Seen in ${context.timesSeen} engagements (${Math.round(context.approvalRate * 100)}% approved)`;
  } else {
    dotColor = C.gold;
    label = `Seen ${context.timesSeen}\u00D7 (${Math.round(context.approvalRate * 100)}% approved)`;
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 20,
        fontSize: 11,
        fontFamily: BODY,
        color: dotColor,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
