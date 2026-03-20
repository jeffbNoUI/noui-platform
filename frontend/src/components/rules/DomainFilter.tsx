interface DomainFilterProps {
  domains: string[];
  selected: string | null;
  onSelect: (domain: string | null) => void;
}

function formatDomain(domain: string): string {
  return domain
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function DomainFilter({ domains, selected, onSelect }: DomainFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
          selected === null
            ? 'bg-iw-sage text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        All
      </button>
      {domains.map((domain) => (
        <button
          key={domain}
          onClick={() => onSelect(domain)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selected === domain
              ? 'bg-iw-sage text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {formatDomain(domain)}
        </button>
      ))}
    </div>
  );
}
