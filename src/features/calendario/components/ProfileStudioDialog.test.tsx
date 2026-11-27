import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProfileStudioDialog } from "./ProfileStudioDialog";

const state = vi.hoisted(() => ({ rows: [] as any[], saved: [] as any[] }));

vi.mock("../hooks/use-profile-month", () => ({
  useProfileMonths: () => ({ data: state.rows }),
  useSaveProfileMonth: () => ({ isPending: false, mutate: (input: any, options: any) => { state.saved.push(input); options.onSuccess("novo-id"); } }),
  usePreviousFeedPublications: () => ({ data: [], isLoading: false, isError: false }),
  uploadProfileImage: vi.fn(),
}));
vi.mock("../hooks/use-calendar-data", () => ({
  useTaskAttachmentsMap: () => ({ data: new Map(), isLoading: false }),
  useCoverAttachmentsById: () => ({ data: new Map() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// p01–p03 e p05 são do dia 01/12; p04 é de outro dia
const tiles = ["01", "02", "03", "04", "05"].map((n) => ({ id: `p${n}`, thumb: null, date: n === "04" ? "2026-12-02" : "2026-12-01", isCarousel: false, isVideo: false }));
const pick = (n: number) => screen.getAllByRole("button", { name: /^Fixar o post de/ })[n - 1] as HTMLButtonElement;
const onClose = vi.fn();
const setup = () => render(
  <ProfileStudioDialog
    clientId="c1" clientName="Uau Digital" clientLogoUrl="logo.png" username="uau.digital" month="2026-12-01" cycleStart="2026-12-01"
    calendarIds={["cal"]} currentTiles={tiles} toThumb={(u) => u} onClose={onClose}
  />,
);

beforeEach(() => { state.rows = []; state.saved = []; onClose.mockClear(); });

describe("Estúdio do feed", () => {
  it("monta o perfil e salva destaques e fixados na ordem escolhida, sem bio", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Novo destaque/ }));
    fireEvent.change(screen.getByLabelText("Nome do destaque 1"), { target: { value: "Natal" } });
    fireEvent.click(pick(3));
    fireEvent.click(pick(1));
    const preview = screen.getByRole("region", { name: "Prévia do perfil" });
    expect(within(preview).getByText("Natal")).toBeTruthy();
    expect(preview.querySelectorAll("[data-pinned]").length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await waitFor(() => expect(state.saved.length).toBe(1));
    expect(state.saved[0]).toMatchObject({
      savedId: null, month: "2026-12-01",
      draft: { photo_url: "logo.png", display_name: "Uau Digital", highlights: [{ title: "Natal", cover_url: null }], pinned_publication_ids: ["p03", "p01"] },
    });
    expect(Object.keys(state.saved[0].draft)).not.toContain("bio");
    expect(screen.getByText("Salvo.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar perfil" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("não deixa fixar um quarto post", () => {
    setup();
    for (const n of [1, 2, 3]) fireEvent.click(pick(n));
    expect(pick(5).disabled).toBe(true);
  });

  it("depois do primeiro, só libera posts programados para o mesmo dia", () => {
    setup();
    expect(pick(4).disabled).toBe(false);
    fireEvent.click(pick(1));
    expect(pick(4).disabled).toBe(true);
    expect(pick(2).disabled).toBe(false);
    expect(screen.getByText(/Liberados só os posts de 01\/12/)).toBeTruthy();
    fireEvent.click(pick(1)); // desafixou: pode escolher outro dia
    fireEvent.click(pick(4));
    expect(pick(1).disabled).toBe(true);
  });

  it("se as datas dos fixados deixarem de bater, avisa e não deixa salvar", () => {
    state.rows = [{ id: "dez", month: "2026-12-01", photo_url: null, display_name: "Uau", highlights: [], pinned_publication_ids: ["p01", "p04"] }];
    setup();
    fireEvent.change(screen.getByLabelText("Nome no perfil"), { target: { value: "Uau!" } });
    expect(screen.getByRole("alert").textContent).toMatch(/dias diferentes/);
    expect((screen.getByRole("button", { name: "Salvar perfil" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Desafixar o 2º" }));
    expect((screen.getByRole("button", { name: "Salvar perfil" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reorganiza e desafixa pelos fixados, e salva na nova ordem", async () => {
    setup();
    for (const n of [1, 2, 3]) fireEvent.click(pick(n));
    fireEvent.click(screen.getByRole("button", { name: "Mover o 3º para a esquerda" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover o 1º para a direita" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar perfil" }));
    await waitFor(() => expect(state.saved[0].draft.pinned_publication_ids).toEqual(["p03", "p01", "p02"]));
    fireEvent.click(screen.getByRole("button", { name: "Desafixar o 2º" }));
    expect(within(screen.getByRole("list", { name: "Ordem dos fixados" })).getAllByRole("listitem").length).toBe(2);
  });

  it("pede confirmação para sair com mudanças não salvas", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Nome no perfil"), { target: { value: "Uau no Natal" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Sair sem salvar?")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("mês novo avisa de onde copiou", () => {
    state.rows = [{ id: "nov", month: "2026-11-01", photo_url: null, display_name: "Uau", highlights: [], pinned_publication_ids: [] }];
    setup();
    expect(screen.getByText(/copiado de novembro de 2026/)).toBeTruthy();
  });
});
