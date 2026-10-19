import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { cloneAttachmentRow, extensionFor } from "./attachment-sync";

const base = { id: "a1", created_at: "2026-10-19T10:00:00Z", task_id: "t1", category: "final", storage_path: "x/y.mp4", file_type: "video/mp4", uploaded_by: "u1" };

describe("cloneAttachmentRow", () => {
  it("copia o anexo para outra tarefa sem o id nem a data de criação", () => {
    const row = cloneAttachmentRow({ ...base, drive_file_id: null, storage_provider: "supabase" }, "t2");
    expect(row.task_id).toBe("t2");
    expect(row).not.toHaveProperty("id");
    expect(row).not.toHaveProperty("created_at");
    expect(row.storage_path).toBe("x/y.mp4");
  });

  it("arquivo do Drive ganha token e endereço próprios, mas aponta para o mesmo arquivo", () => {
    const a = cloneAttachmentRow({ ...base, drive_file_id: "DRIVE1", storage_provider: "drive", access_token: "velho", public_url: "velho" }, "t2");
    const b = cloneAttachmentRow({ ...base, drive_file_id: "DRIVE1", storage_provider: "drive" }, "t3");
    expect(a.drive_file_id).toBe("DRIVE1");
    expect(a.access_token).not.toBe("velho");
    expect(String(a.public_url)).toContain("/drive-file-proxy/DRIVE1.mp4?t=");
    expect(a.access_token).not.toBe(b.access_token);
  });
});

describe("extensionFor", () => {
  it("devolve a extensão pelo tipo do arquivo", () => {
    expect(extensionFor("video/mp4")).toBe("mp4");
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor(null)).toBe("bin");
  });
});
