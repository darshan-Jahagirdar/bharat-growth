export function getISTDate(offsetDays = 0): Date {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setUTCDate(istNow.getUTCDate() + offsetDays);
  return istNow;
}

export function formatISTDateISO(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayRange(): { start: string; end: string } {
  const todayIST = formatISTDateISO(getISTDate());
  return {
    start: `${todayIST}T00:00:00+05:30`,
    end: `${todayIST}T23:59:59+05:30`,
  };
}

export function getDateRange(daysBack: number): { start: string; end: string } {
  const startDate = formatISTDateISO(getISTDate(-daysBack));
  const endDate = formatISTDateISO(getISTDate());
  return {
    start: `${startDate}T00:00:00+05:30`,
    end: `${endDate}T23:59:59+05:30`,
  };
}

export function getMonthStart(): string {
  const ist = getISTDate();
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01T00:00:00+05:30`;
}
