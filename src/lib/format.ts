export function formatKes(cents: number, includeDecimals = true): string {
  const value = (cents || 0) / 100;
  return `KSh ${value.toLocaleString('en-KE', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  })}`;
}

export function formatShortDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleDateString('en-KE', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return d.toLocaleString('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DEPARTMENT_LABELS: Record<string, string> = {
  rewarded_ads: 'Rewarded Advertising',
  ai_training: 'AI Data Training',
  voice_intelligence: 'African Voice Intelligence',
  ai_evaluation: 'AI Evaluation',
  market_research: 'Market Research',
};
