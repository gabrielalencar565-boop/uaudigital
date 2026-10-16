// "Mês do conteúdo": o mês a que o planejamento/design/vídeo pertence, que pode ser diferente do mês do prazo (planejar em outubro o
// conteúdo de novembro). Guardado como o primeiro dia do mês (YYYY-MM-01); sem valor, vale o mês do prazo.

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const monthKey = (year: number, month0: number): string => `${year}-${String(month0 + 1).padStart(2, "0")}-01`;

export function monthLabel(key: string | null | undefined): string {
  if (!key) return "";
  const [y, m] = key.split("-");
  const name = MONTHS[Number(m) - 1];
  return name ? `${name} de ${y}` : "";
}

/** Mês efetivo da tarefa (o que o Magic Number e a pontuação usam): o do conteúdo, se houver; senão o do prazo. */
export function effectiveMonthKey(task: { reference_month?: string | null; due_date?: string | null }): string | null {
  if (task.reference_month) return task.reference_month.slice(0, 7) + "-01";
  return task.due_date ? task.due_date.slice(0, 7) + "-01" : null;
}

/** Meses oferecidos no seletor: do mês anterior ao de hoje até `ahead` meses à frente, mais o mês já escolhido (mesmo fora da janela). */
export function monthOptions(today: Date, ahead = 12, include?: string | null): Array<{ key: string; label: string }> {
  const keys: string[] = [];
  for (let i = -1; i <= ahead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    keys.push(monthKey(d.getFullYear(), d.getMonth()));
  }
  if (include && !keys.includes(include)) keys.push(include);
  return keys.sort().map((key) => ({ key, label: monthLabel(key) }));
}

/**
 * "Mês referente" dos diálogos de criar tarefa só traz o mês (sem ano). Escolhe o ano que deixa esse mês mais perto do mês-base
 * (o mês automático: prazo + antecedência da agência): em dezembro, "Janeiro" é o do ano seguinte. Se for o próprio mês-base,
 * devolve null (a tarefa fica no automático, que o banco preenche).
 */
export function pickToReferenceMonth(pick: string, base: Date): string | null {
  const m0 = parseInt(pick, 10) - 1;
  if (!(m0 >= 0 && m0 <= 11)) return null;
  const baseIndex = base.getFullYear() * 12 + base.getMonth();
  let best = base.getFullYear();
  for (const y of [base.getFullYear() - 1, base.getFullYear(), base.getFullYear() + 1]) {
    if (Math.abs(y * 12 + m0 - baseIndex) < Math.abs(best * 12 + m0 - baseIndex)) best = y;
  }
  return best * 12 + m0 === baseIndex ? null : monthKey(best, m0);
}

/** Mês que vale por padrão: o do prazo (ou de hoje, sem prazo) mais a antecedência da agência. É o que o banco grava em tarefa nova. */
export function automaticMonthDate(due: string | Date | null | undefined, offset: number, today: Date = new Date()): Date {
  const base = due ? (typeof due === "string" ? new Date(`${due.slice(0, 10)}T12:00:00`) : due) : today;
  return new Date(base.getFullYear(), base.getMonth() + Math.max(0, offset), 1);
}
