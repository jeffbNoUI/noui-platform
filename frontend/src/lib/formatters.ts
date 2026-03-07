export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const date = new Date(normalized);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(dateStr: string): string {
  const normalized = dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00';
  const date = new Date(normalized);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatServiceYears(years: number): string {
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);
  if (months === 0) return `${wholeYears} years`;
  return `${wholeYears} yr ${months} mo`;
}

export function tierLabel(tier: number): string {
  return `Tier ${tier}`;
}

export function statusLabel(code: string): string {
  const labels: Record<string, string> = {
    A: 'Active',
    R: 'Retired',
    T: 'Terminated',
    D: 'Deferred',
    X: 'Deceased',
  };
  return labels[code] || code;
}

export function eligibilityLabel(type: string): string {
  const labels: Record<string, string> = {
    NORMAL: 'Normal Retirement',
    RULE_OF_75: 'Rule of 75',
    RULE_OF_85: 'Rule of 85',
    EARLY: 'Early Retirement',
    DEFERRED: 'Deferred Retirement',
    NONE: 'Not Eligible',
  };
  return labels[type] || type;
}
