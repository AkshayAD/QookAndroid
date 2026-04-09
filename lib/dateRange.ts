import { format, isValid, parse, parseISO } from 'date-fns';

function parseCompactDate(value: string): Date | null {
  const parsed = parse(value.toUpperCase(), 'ddMMMyyyy', new Date());
  return isValid(parsed) ? parsed : null;
}

function parseDateValue(value: string, fallbackYear?: number): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const compact = parseCompactDate(trimmed);
  if (compact) {
    return compact;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsedIso = parseISO(trimmed);
    return isValid(parsedIso) ? parsedIso : null;
  }

  const withYear = parse(trimmed, 'MMM d, yyyy', new Date());
  if (isValid(withYear)) {
    return withYear;
  }

  if (fallbackYear !== undefined) {
    const withoutYear = parse(`${trimmed}, ${fallbackYear}`, 'MMM d, yyyy', new Date());
    if (isValid(withoutYear)) {
      return withoutYear;
    }
  }

  return null;
}

export function formatCompactDate(value: Date | string): string {
  const parsed =
    value instanceof Date
      ? value
      : parseDateValue(value) || parseISO(value);

  if (!isValid(parsed)) {
    return String(value).toUpperCase();
  }

  return format(parsed, 'ddMMMyyyy').toUpperCase();
}

export function formatCompactDateRange(start: Date | string, end: Date | string): string {
  return `${formatCompactDate(start)} - ${formatCompactDate(end)}`;
}

export function normalizeCompactDateRangeLabel(range: string): string {
  const trimmed = range.trim();
  if (!trimmed) {
    return '';
  }

  const separator = trimmed.includes(' - ') ? ' - ' : trimmed.includes(' to ') ? ' to ' : null;
  if (!separator) {
    const singleDate = parseDateValue(trimmed);
    return singleDate ? formatCompactDate(singleDate) : trimmed.toUpperCase();
  }

  const [rawStart, rawEnd] = trimmed.split(separator);
  if (!rawStart || !rawEnd) {
    return trimmed.toUpperCase();
  }

  const endDate = parseDateValue(rawEnd);
  const startDate = parseDateValue(rawStart, endDate?.getFullYear());

  if (!startDate || !endDate) {
    return trimmed.toUpperCase();
  }

  return formatCompactDateRange(startDate, endDate);
}
