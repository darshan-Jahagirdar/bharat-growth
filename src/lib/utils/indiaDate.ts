const INDIA_TIME_ZONE = 'Asia/Kolkata';

/** Returns a calendar date in India as YYYY-MM-DD, independent of server locale. */
export function getIndiaDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/** Indian financial year runs from 1 April to 31 March. */
export function getIndianFinancialYear(indiaDate: string): string {
  const [yearText, monthText] = indiaDate.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error(`Invalid India date: ${indiaDate}`);
  }

  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
}
