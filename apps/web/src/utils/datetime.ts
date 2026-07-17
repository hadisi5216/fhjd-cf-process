const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const DATE_TIME_WITH_SECONDS_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function parseApiDate(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;

  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDateTime(value?: string) {
  const date = parseApiDate(value);
  return date ? DATE_TIME_FORMATTER.format(date).replace(/\//g, '-') : '-';
}

export function formatDateTimeWithSeconds(value?: string) {
  const date = parseApiDate(value);
  return date ? DATE_TIME_WITH_SECONDS_FORMATTER.format(date).replace(/\//g, '-') : '-';
}

export function getApiDateTime(value?: string) {
  return parseApiDate(value)?.getTime();
}
