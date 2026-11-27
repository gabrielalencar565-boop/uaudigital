import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FeedSidePanel } from "./FeedSidePanel";

const state = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock("../hooks/use-profile-month", () => ({ useProfileMonths: () => ({ data: state.rows }) }));
vi.mock("./PublicationCard", () => ({ publicationTypeLabel: () => "Post" }));

const feed = ["10", "05", "01"].map((day) => ({ id: `p${day}`, publish_date: `2026-12-${day}`, publish_time: "12:00:00", instagram_status: "not_published", instagram_scheduled: false })) as any[];
const onEditProfile = vi.fn();
const setup = () => render(
  <FeedSidePanel
    publications={feed} feed={feed} draft={{}} onDraftChange={vi.fn()} mediaFor={() => ({ thumb: null, pages: 1, isVideo: false })} outsideCount={0}
    clientId="c1" month="2026-12-01" username="docerio.bdc" clientName="Doce Rio" clientLogoUrl="logo.png" onEditProfile={onEditProfile}
    sensors={[]} saving={false} onSave={vi.fn()} onOpen={vi.fn()} onClose={vi.fn()}
  />,
);
const order = () => screen.getAllByRole("button", { name: /^Post, / }).map((b) => b.getAttribute("aria-label")!.slice(6, 11));
const saved = { id: "m", month: "2026-12-01", photo_url: "natal.png", display_name: "Doce Rio no Natal", highlights: [{ id: "h", title: "Lazer", cover_url: null }], pinned_publication_ids: ["p01", "antigo"] };

beforeEach(() => { state.rows = []; onEditProfile.mockClear(); });

describe("painel do feed ao lado", () => {
  it("mostra o perfil salvo do mês: destaques e fixado no topo, que não se arrasta", () => {
    state.rows = [saved];
    setup();
    expect(screen.getByText("Doce Rio no Natal")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Destaques" })).getByText("Lazer")).toBeTruthy();
    expect(order()).toEqual(["01/12", "10/12", "05/12"]);
    expect(screen.getByRole("button", { name: /01\/12.*\(fixado\)/ })).toBeTruthy();
    expect(screen.getByText(/1 fixado\(s\) de outro período/)).toBeTruthy();
  });

  it("sem perfil salvo neste mês (mesmo com outro mês salvo) fica a ordem por data e o atalho para criar destaque", () => {
    state.rows = [{ ...saved, month: "2026-11-01" }];
    setup();
    expect(screen.getByText("Doce Rio")).toBeTruthy();
    expect(screen.queryByText("Lazer")).toBeNull();
    expect(order()).toEqual(["10/12", "05/12", "01/12"]);
    fireEvent.click(screen.getByRole("button", { name: "Editar destaques no Estúdio do feed" }));
    expect(onEditProfile).toHaveBeenCalled();
  });
});
