import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InstagramHeldPostsDialog } from "./InstagramHeldPostsDialog";

const mutate = vi.fn();
const held = [
  { id: "p1", calendar_id: "c", title: "Reels bastidores", caption: null, content_type: "reel", publish_date: "2020-01-10", publish_time: "09:00:00", cover_url: null },
  { id: "p2", calendar_id: "c", title: "Carrossel promoção", caption: null, content_type: "carousel", publish_date: "2020-01-12", publish_time: "12:00:00", cover_url: null },
];
const EMPTY: never[] = [];
let connections: { client_id: string; status: string }[] = [{ client_id: "cli", status: "active" }];

vi.mock("@/features/calendario/hooks/use-instagram", () => ({
  useInstagramConnections: () => ({ data: connections }),
  useHeldPublications: (id: string | null) => ({ data: id ? held : EMPTY }),
  useResolveHeldPublications: () => ({ mutate, isPending: false }),
}));

beforeEach(() => { mutate.mockClear(); connections = [{ client_id: "cli", status: "active" }]; });

describe("InstagramHeldPostsDialog", () => {
  it("lista os posts em espera e aplica só o que foi escolhido", () => {
    render(<InstagramHeldPostsDialog clientId="cli" clientName="Padaria" />);
    expect(screen.getByText("Reels bastidores")).toBeTruthy();
    fireEvent.click(screen.getAllByText("Publicar agora")[0]);
    fireEvent.click(screen.getAllByText("Cancelar")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar escolhas" }));
    expect(mutate).toHaveBeenCalledWith([{ id: "p1", action: "pub" }, { id: "p2", action: "cancel" }]);
  });

  it("não aplica sem nenhuma escolha", () => {
    render(<InstagramHeldPostsDialog clientId="cli" clientName="Padaria" />);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar escolhas" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/pelo menos um post/)).toBeTruthy();
  });

  it("reagendar exige data futura", () => {
    render(<InstagramHeldPostsDialog clientId="cli" clientName="Padaria" />);
    fireEvent.click(screen.getAllByText("Reagendar")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar escolhas" }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/nova data e hora/)).toBeTruthy();
  });

  it("não abre quando a conta não está conectada", () => {
    connections = [{ client_id: "cli", status: "revoked" }];
    render(<InstagramHeldPostsDialog clientId="cli" clientName="Padaria" />);
    expect(screen.queryByText("Reels bastidores")).toBeNull();
  });
});
