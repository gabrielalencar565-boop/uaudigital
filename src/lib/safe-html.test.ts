import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./safe-html";

describe("sanitizeHtml", () => {
  it("removes inline event handlers and scripts", () => {
    const out = sanitizeHtml('<p>oi</p><img src="x" onerror="alert(1)"><script>alert(2)</script><svg onload="alert(3)"></svg>');
    expect(out).not.toMatch(/onerror|onload|<script|alert/i);
    expect(out).toContain("<p>oi</p>");
  });

  it("removes javascript: links but keeps http(s) links", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a><a href="https://ok.com">y</a>');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('href="https://ok.com"');
  });

  it("drops iframes, forms and style tags", () => {
    const out = sanitizeHtml('<iframe src="https://evil.com"></iframe><form action="/x"><input></form><style>*{display:none}</style>');
    expect(out).not.toMatch(/<iframe|<form|<style/i);
  });

  it("keeps editor formatting and link-preview card attributes", () => {
    const html =
      '<div data-link-preview="1" contenteditable="false" style="border:1px solid #ccc"><a href="https://a.com" target="_blank">a</a><strong>b</strong><button type="button">x</button></div>';
    const out = sanitizeHtml(html);
    expect(out).toContain('data-link-preview="1"');
    expect(out).toContain('contenteditable="false"');
    expect(out).toContain("<strong>b</strong>");
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it("handles empty input", () => {
    expect(sanitizeHtml("")).toBe("");
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
  });
});
