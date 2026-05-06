export function getMonthGrid(date: Date): Date[] {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const offset = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(
    firstDayOfMonth.getFullYear(),
    firstDayOfMonth.getMonth(),
    firstDayOfMonth.getDate() - offset,
  );

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export function formatMonthYear(date: Date, locale = "es"): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  });
  const formatted = formatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function isSameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

export function getWeekDays(date: Date): Date[] {
  const currentDay = new Date(date);
  const weekOffset = (currentDay.getDay() + 6) % 7;
  const monday = new Date(currentDay);
  monday.setDate(currentDay.getDate() - weekOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
}

export function formatWeekRange(date: Date): string {
  const days = getWeekDays(date);
  const start = days[0];
  const end = days[days.length - 1];
  const startDay = start.getDate();
  const endDay = end.getDate();
  const endYear = end.getFullYear();

  const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "short" });
  const stripDot = (value: string) => value.replace(/\.$/u, "");

  if (start.getMonth() === end.getMonth() && start.getFullYear() === endYear) {
    return `${startDay} – ${endDay} ${stripDot(monthFormatter.format(end))} ${endYear}`;
  }

  const startMonth = stripDot(monthFormatter.format(start));
  const endMonth = stripDot(monthFormatter.format(end));

  if (start.getFullYear() === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  }

  return `${startDay} ${startMonth} ${start.getFullYear()} – ${endDay} ${endMonth} ${endYear}`;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
