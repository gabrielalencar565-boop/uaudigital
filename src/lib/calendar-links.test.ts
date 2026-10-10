import { describe, expect, it } from "vitest";
import { buildIcs, eventRange, googleCalendarUrl } from "./calendar-links";

const ev = { date: "2026-10-22", startTime: "14:30", durationMinutes: 120, title: "Gravação — Uau Digital", description: "Linha 1\nLinha 2; com, vírgula", location: "Rua X, 10", uid: "abc" };

describe("calendar links", () => {
  it("turns the chosen time into a Brasília window, written in UTC", () => {
    expect(eventRange({ date: "2026-10-22", startTime: "09:00", durationMinutes: 120 })).toEqual({ start: "20261022T120000Z", end: "20261022T140000Z" });
    expect(eventRange({ date: "2026-10-22", startTime: "14:30", durationMinutes: 90 })).toEqual({ start: "20261022T173000Z", end: "20261022T190000Z" });
    // ends after 21h in Brasília = next day in UTC
    expect(eventRange({ date: "2026-10-22", startTime: "20:00", durationMinutes: 240 })).toEqual({ start: "20261022T230000Z", end: "20261023T030000Z" });
  });

  it("builds a Google Calendar link with title, dates and place", () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Gravação — Uau Digital");
    expect(url.searchParams.get("dates")).toBe("20261022T173000Z/20261022T193000Z");
    expect(url.searchParams.get("location")).toBe("Rua X, 10");
  });

  it("writes a valid .ics with escaped text and a reminder", () => {
    const ics = buildIcs(ev, new Date("2026-10-10T12:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261022T173000Z");
    expect(ics).toContain("DTSTAMP:20261010T120000Z");
    expect(ics).toContain("DESCRIPTION:Linha 1\\nLinha 2\; com\\, vírgula");
    expect(ics).toContain("LOCATION:Rua X\\, 10");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
  });
});
