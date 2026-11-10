/** Copia o texto; sem permissão de clipboard, cai num textarea selecionado. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = texto;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand?.("copy") ?? false;
    t.remove();
    return ok;
  }
}
