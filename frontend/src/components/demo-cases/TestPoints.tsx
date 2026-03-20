interface TestPointsProps {
  testPoints: string[];
}

export default function TestPoints({ testPoints }: TestPointsProps) {
  if (testPoints.length === 0) {
    return <p className="text-sm text-gray-500 italic">No test points defined for this case.</p>;
  }

  return (
    <ul className="space-y-2">
      {testPoints.map((point, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-gray-700">{point}</span>
        </li>
      ))}
    </ul>
  );
}
