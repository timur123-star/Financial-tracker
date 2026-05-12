export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * 100);
}

export function kopecksToRubles(kopecks: number | bigint | string): number {
  const v = typeof kopecks === 'bigint' ? Number(kopecks) : Number(kopecks);
  return v / 100;
}

export function formatAmount(kopecks: number | bigint | string, symbol: string = '₽'): string {
  const rubles = kopecksToRubles(kopecks);
  const rounded = Number.isInteger(rubles) ? rubles : Math.round(rubles * 100) / 100;
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(rubles) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `${formatted} ${symbol}`;
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeMarkdownV2(s: string): string {
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
