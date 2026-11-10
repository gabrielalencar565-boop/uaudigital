import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LinkOrDateDialog, type LinkPane } from "./LinkOrDateDialog";

const base = { post_type: "video", is_extra_demand: false, status_global: "backlog", stage_current: "edicao_videos", assignee_id: "m1", watchers: [], parent_task_id: null, periodic_stage_key: null };
const rows = [
  { ...base, id: "t-luana-12", title: "[Luana] - Vídeo - Nov", due_date: "2026-11-12", client_id: "luana" },
  { ...base, id: "t-luana-19", title: "[Luana] - Vídeo - Nov (2)", due_date: "2026-11-19", client_id: "luana" },
  { ...base, id: "t-carol-12", title: "[Carol] - Vídeo - Nov", due_date: "2026-11-12", client_id: "carol" },
  { ...base, id: "t-luana-extra", title: "[Luana] - Vídeo - Extra", due_date: "2026-11-16", client_id: "luana", is_extra_demand: true },
  { ...base, id: "t-luana-design", title: "[Luana] - Design - Nov", due_date: "2026-11-17", client_id: "luana", stage_current: "design", post_type: "design" },
];

vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  for (const m of ["select", "eq", "is", "not", "gte"]) chain[m] = () => chain;
  chain.lte = () => chain;
  chain.limit = () => Promise.resolve({ data: rows, error: null });
  return { supabase: { from: () => chain } };
});

const videoPane: LinkPane = {
  key: "edicao_videos", stageLabel: "Vídeo", defaultDate: "2026-11-12",
  search: { clientId: "luana", stage: "edicao_videos", postType: "video", referenceDate: "2026-11-12", excludeId: "planning" },
  existingTask: { id: "t-luana-12", due_date: "2026-11-12", title: "[Luana] - Vídeo - Nov" },
};
const designPane: LinkPane = {
  key: "design", stageLabel: "Design", defaultDate: "",
  search: { clientId: "luana", stage: "design", referenceDate: "2026-11-17", excludeId: "planning" },
  existingTask: null,
};

function setup(panes: LinkPane[]) {
  const onConfirm = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <LinkOrDateDialog open onClose={() => {}} panes={panes} clientName="Luana" clientsMap={{ luana: "Luana", carol: "Carol" }} membersMap={{ m1: { name: "João Guilherme" } }} onConfirm={onConfirm} />
    </QueryClientProvider>,
  );
  return { onConfirm };
}

const candidateButton = (title: string) => screen.getAllByTitle(title).find((el) => el.tagName === "BUTTON") as HTMLElement;

describe("LinkOrDateDialog (agenda de vínculo)", () => {
  it("um painel: mostra toda a agenda do mês e destaca só as tarefas da mesma cliente e etapa (sem demanda extra)", async () => {
    const { onConfirm } = setup([videoPane]);
    await screen.findByTitle("[Luana] - Vídeo - Nov (2)");
    expect(screen.getByTitle("[Luana] - Vídeo - Nov (2)").tagName).toBe("BUTTON");
    expect(screen.getByTitle("[Carol] - Vídeo - Nov").tagName).toBe("DIV");
    expect(screen.getByTitle("[Luana] - Vídeo - Extra").tagName).toBe("DIV");
    expect(screen.getByTitle("[Luana] - Design - Nov").tagName).toBe("DIV");
    expect(screen.getByText(/Vincular a Vídeo - Nov · 12\/11/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vincular" }));
    expect(onConfirm).toHaveBeenCalledWith({ edicao_videos: { kind: "link", taskId: "t-luana-12", date: "2026-11-12" } });
  });

  it("um painel: troca de candidata ao clicar em outra tarefa em destaque", async () => {
    const { onConfirm } = setup([videoPane]);
    fireEvent.click(await screen.findByTitle("[Luana] - Vídeo - Nov (2)"));
    fireEvent.click(screen.getByRole("button", { name: "Vincular" }));
    expect(onConfirm).toHaveBeenCalledWith({ edicao_videos: { kind: "link", taskId: "t-luana-19", date: "2026-11-19" } });
  });

  it("um painel: clicar num dia livre escolhe só a data", async () => {
    const { onConfirm } = setup([videoPane]);
    await screen.findByTitle("[Luana] - Vídeo - Nov (2)");
    fireEvent.click(screen.getByText("25"));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledWith({ edicao_videos: { kind: "date", date: "2026-11-25" } });
  });

  it("tela dividida (Vídeo e Design): só conclui quando as duas agendas têm escolha", async () => {
    const { onConfirm } = setup([videoPane, designPane]);
    await waitFor(() => expect(screen.getAllByTitle("[Luana] - Vídeo - Nov (2)").length).toBe(2));
    const concluir = screen.getByRole("button", { name: "Concluir" }) as HTMLButtonElement;
    // Vídeo já vem escolhido (tarefa existente); Design ainda não
    expect(concluir.disabled).toBe(true);
    // escolhe o Design existente da Luana (candidata só no painel de Design)
    fireEvent.click(candidateButton("[Luana] - Design - Nov"));
    expect(concluir.disabled).toBe(false);
    fireEvent.click(concluir);
    expect(onConfirm).toHaveBeenCalledWith({
      edicao_videos: { kind: "link", taskId: "t-luana-12", date: "2026-11-12" },
      design: { kind: "link", taskId: "t-luana-design", date: "2026-11-17" },
    });
  });
});
