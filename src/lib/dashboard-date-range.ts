import { getDefaultCurrentQuarterRange, type DateRangeValue } from '@/components/ui/date-range-selector';

const DASHBOARD_SHARED_DATE_RANGE_KEY = 'dashboard-shared-date-range';

const isValidDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidRange = (value: unknown): value is DateRangeValue => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<DateRangeValue>;
  return isValidDate(candidate.startDate) && isValidDate(candidate.endDate);
};

const getFallbackRange = (): DateRangeValue => getDefaultCurrentQuarterRange();

export const getInitialSharedDashboardDateRange = (): DateRangeValue => getFallbackRange();

export const getSharedDashboardDateRangeFromStorage = (): DateRangeValue => {
  if (typeof window === 'undefined') {
    return getFallbackRange();
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_SHARED_DATE_RANGE_KEY);
    if (!raw) {
      return getFallbackRange();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (isValidRange(parsed)) {
      return parsed;
    }
  } catch {
    // ignore storage parsing errors
  }

  return getFallbackRange();
};

export const setSharedDashboardDateRange = (range: DateRangeValue) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!isValidRange(range)) {
    return;
  }

  try {
    window.localStorage.setItem(DASHBOARD_SHARED_DATE_RANGE_KEY, JSON.stringify(range));
  } catch {
    // ignore storage write errors
  }
};
