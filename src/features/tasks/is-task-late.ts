/** Returns true if the due_date (YYYY-MM-DD) is strictly before today in America/Sao_Paulo. */
export function isTaskLate(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const todaySP = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return dueDate < todaySP;
}
