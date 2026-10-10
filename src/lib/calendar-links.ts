// "Add to my calendar" for the client who booked a recording day: a Google Calendar link and an .ics file
// (Apple Calendar, Outlook and everything else). No login or integration needed: it is the client's own calendar.

export type CalendarEvent = {
  /** yyyy-MM-dd */
  date: string;
  /** HH:MM, Brasília time */
  startTime: string;
  durationMinutes: number;
  title: string;
  description: string;
  location?: string | null;
  uid: string;
};

// Brasília time (no daylight saving since 2019), written in UTC for the calendars
const BRT_OFFSET_MINUTES = 3 * 60;

function utcStamp(date: string, minutesOfDayBRT: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, minutesOfDayBRT + BRT_OFFSET_MINUTES, 0));
  return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function eventRange(ev: Pick<CalendarEvent, "date" | "startTime" | "durationMinutes">) {
  const start = Number(ev.startTime.slice(0, 2)) * 60 + Number(ev.startTime.slice(3, 5));
  return { start: utcStamp(ev.date, start), end: utcStamp(ev.date, start + ev.durationMinutes) };
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const { start, end } = eventRange(ev);
  const params = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates: `${start}/${end}`, details: ev.description });
  if (ev.location) params.set("location", ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// RFC 5545 text escaping
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function buildIcs(ev: CalendarEvent, now: Date = new Date()): string {
  const { start, end } = eventRange(ev);
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fluxo//Agenda de Gravacao//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@appfluxo.app.br`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.description)}`,
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(ev: CalendarEvent, filename = "gravacao.ics") {
  const blob = new Blob([buildIcs(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
