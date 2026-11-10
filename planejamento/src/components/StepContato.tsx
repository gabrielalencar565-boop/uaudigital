"use client";

import { COPY } from "@/data/textos";
import type { Contato, Erros } from "@/lib/rascunho";
import { maskWhatsApp } from "@/lib/validation";
import Rich from "./Rich";
import StepShell from "./StepShell";
import { Erro, inputClassRoxo } from "./ui";

type Props = {
  c: Contato;
  set: <K extends keyof Contato>(k: K, v: Contato[K]) => void;
  erros: Erros;
  erroGeral?: string;
  enviando: boolean;
  onVoltar: () => void;
  onEnviar: () => void;
};

export default function StepContato({ c, set, erros, erroGeral, enviando, onVoltar, onEnviar }: Props) {
  return (
    <StepShell
      etapa={0}
      titulo="Seu contato"
      emoji="📩"
      onVoltar={onVoltar}
      onAvancar={onEnviar}
      cta={enviando ? "Salvando…" : COPY.contato.cta}
      enviando={enviando}
    >
      <div className="-mt-4">
        <h1 data-autofocus tabIndex={-1} className="title text-[2.5rem]">
          <Rich text={COPY.contato.titulo} />
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{COPY.contato.texto}</p>
      </div>

      <div>
        <label htmlFor="nome" className="mb-2 block font-semibold">
          Seu nome
        </label>
        <input
          id="nome"
          className={inputClassRoxo}
          value={c.nome}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Como você se chama?"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={80}
          aria-invalid={!!erros.nome}
          aria-describedby={erros.nome ? "nome-erro" : undefined}
        />
        <Erro id="nome-erro" msg={erros.nome} />
      </div>

      <div>
        <label htmlFor="whatsapp" className="mb-2 block font-semibold">
          WhatsApp
        </label>
        <input
          id="whatsapp"
          type="tel"
          inputMode="tel"
          className={inputClassRoxo}
          value={c.whatsapp}
          onChange={(e) => set("whatsapp", maskWhatsApp(e.target.value))}
          placeholder="(11) 98765-4321"
          autoComplete="tel-national"
          aria-invalid={!!erros.whatsapp}
          aria-describedby={erros.whatsapp ? "whatsapp-erro" : undefined}
        />
        <Erro id="whatsapp-erro" msg={erros.whatsapp} />
      </div>

      <div>
        <label htmlFor="instagram" className="mb-2 block font-semibold">
          @ do Instagram <span className="font-normal text-dim">(opcional)</span>
        </label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[17px] text-dim">
            @
          </span>
          <input
            id="instagram"
            className={`${inputClassRoxo} pl-9`}
            value={c.instagram}
            onChange={(e) => set("instagram", e.target.value.replace(/^@+/, ""))}
            placeholder="seuperfil"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={60}
            aria-invalid={!!erros.instagram}
            aria-describedby={erros.instagram ? "instagram-erro" : undefined}
          />
        </div>
        <Erro id="instagram-erro" msg={erros.instagram} />
      </div>

      <div>
        <label htmlFor="consentimento" className="flex cursor-pointer items-start gap-3">
          <input
            id="consentimento"
            type="checkbox"
            className="mt-0.5 size-6 shrink-0 cursor-pointer accent-purple"
            checked={c.consentimento}
            onChange={(e) => set("consentimento", e.target.checked)}
            aria-invalid={!!erros.consentimento}
            aria-describedby={erros.consentimento ? "consentimento-erro" : undefined}
          />
          <span className="text-[15px] leading-snug text-muted">{COPY.contato.consentimento}</span>
        </label>
        <Erro id="consentimento-erro" msg={erros.consentimento} />
      </div>

      {erroGeral ? (
        <p role="alert" className="rounded-2xl border-[1.5px] border-orange px-4 py-3 font-medium">
          {erroGeral}
        </p>
      ) : null}
    </StepShell>
  );
}
