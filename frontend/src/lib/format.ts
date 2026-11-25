export function formatKobo(kobo: number, opts: { decimals?: boolean; compact?: boolean } = {}): string {
  const naira = kobo / 100;
  if (opts.compact && Math.abs(naira) >= 1000) {
    return `₦${(naira / 1000).toFixed(naira % 1000 === 0 ? 0 : 1)}k`;
  }
  return `₦${naira.toLocaleString('en-NG', {
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNaira(naira: number): string {
  return `₦${naira.toLocaleString('en-NG')}`;
}

export function parseNairaToKobo(input: string): number {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function koboToNairaString(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

export function shortId(id: string, head = 18, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (!Number.isFinite(then)) return iso;
  if (diff < 45_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function humanReason(reason?: string): string {
  if (!reason) return 'Verification failed';
  return reason.toLowerCase().replace(/_/g, ' ');
}
