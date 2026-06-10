/**
 * CSV export (ADR-0012) — Phase 2 ships CSV on web; PDF/Excel are deferred («скоро»).
 * Pure serialization + a web-only saver (Blob → object URL → synthetic download). On
 * native this is a no-op stub until file-system/share is wired (Phase 4/5).
 */
import { Platform } from 'react-native';

/** Quote a CSV cell per RFC 4180 — wrap in double quotes when it holds a delimiter/quote/newline. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows → CSV text (CRLF line breaks, Excel-friendly). First row is usually the header. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * Trigger a CSV download in the browser (Blob + object URL + synthetic anchor click), with
 * a UTF-8 BOM so Excel renders Cyrillic correctly. Returns `true` if a download started;
 * web-only — native returns `false` (deferred, Phase 4/5).
 */
export function downloadCsv(filename: string, csv: string): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return false;
  const name = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  const BOM = String.fromCharCode(0xfeff); // Excel reads UTF-8 (Cyrillic) correctly with a BOM
  const blob = new Blob([BOM, csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0); // revoke after the click is processed
  return true;
}
