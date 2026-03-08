/**
 * Brazilian national holidays (feriados nacionais).
 * Includes fixed + moveable (Easter-based) holidays.
 */

function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getBrazilianHolidays(year: number): Map<string, string> {
  const easter = easterDate(year);
  const holidays = new Map<string, string>();

  // Fixed holidays
  holidays.set(`${year}-01-01`, "Confraternização Universal");
  holidays.set(`${year}-04-21`, "Tiradentes");
  holidays.set(`${year}-05-01`, "Dia do Trabalho");
  holidays.set(`${year}-09-07`, "Independência do Brasil");
  holidays.set(`${year}-10-12`, "N. Sra. Aparecida");
  holidays.set(`${year}-11-02`, "Finados");
  holidays.set(`${year}-11-15`, "Proclamação da República");
  holidays.set(`${year}-12-25`, "Natal");

  // Moveable holidays (Easter-based)
  holidays.set(fmt(addDaysToDate(easter, -47)), "Carnaval");
  holidays.set(fmt(addDaysToDate(easter, -46)), "Carnaval");
  holidays.set(fmt(addDaysToDate(easter, -2)), "Sexta-feira Santa");
  holidays.set(fmt(easter), "Páscoa");
  holidays.set(fmt(addDaysToDate(easter, 60)), "Corpus Christi");

  return holidays;
}
