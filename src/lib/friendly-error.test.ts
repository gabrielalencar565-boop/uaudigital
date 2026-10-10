import { describe, expect, it } from "vitest";
import { friendlyError } from "./friendly-error";

describe("friendlyError", () => {
  it("explains a row-level security refusal", () => {
    expect(friendlyError('new row violates row-level security policy for table "user_roles"')).toBe("Você não tem permissão para fazer essa alteração.");
  });
  it("translates the common database and network errors", () => {
    expect(friendlyError('duplicate key value violates unique constraint "clients_pkey"')).toContain("Já existe");
    expect(friendlyError('insert or update on table "x" violates foreign key constraint "y"')).toContain("ligado a outros dados");
    expect(friendlyError("Failed to fetch")).toContain("Sem conexão");
    expect(friendlyError("JWT expired")).toContain("sessão expirou");
    expect(friendlyError("Edge Function returned a non-2xx status code")).toContain("servidor recusou");
  });
  it("explains the last-administrator guard", () => {
    expect(friendlyError("last_admin")).toContain("último administrador");
  });
  it("leaves messages that are already in Portuguese alone", () => {
    expect(friendlyError("Não foi possível salvar o squad")).toBe("Não foi possível salvar o squad");
    expect(friendlyError("Selecione um cliente")).toBe("Selecione um cliente");
  });
});
