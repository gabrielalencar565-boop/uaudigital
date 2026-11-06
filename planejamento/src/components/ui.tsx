"use client";

import type { ReactNode } from "react";

export const inputClass =
  "block w-full rounded-2xl border-2 border-borda bg-card px-4 text-[17px] text-white placeholder:text-muted/70 outline-none transition-colors focus:border-amarelo focus-visible:outline-none aria-[invalid=true]:border-amarelo";

export const inputClassRoxo =
  "block h-14 w-full rounded-2xl border-2 border-transparent bg-ink px-4 text-[17px] text-white placeholder:text-muted/70 outline-none transition-colors focus:border-amarelo focus-visible:outline-none aria-[invalid=true]:border-amarelo";

export function Erro({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-2 text-[15px] font-bold text-amarelo">
      {msg}
    </p>
  );
}

type CampoProps = {
  id: string;
  label: string;
  opcional?: boolean;
  dica?: string;
  erro?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multilinha?: boolean;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: "text" | "tel";
  type?: string;
  autoCapitalize?: string;
};

export function Campo({ id, label, opcional, dica, erro, value, onChange, placeholder, multilinha, maxLength = 160, ...resto }: CampoProps) {
  const describedBy = [dica ? `${id}-dica` : "", erro ? `${id}-erro` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-bold">
        {label} {opcional ? <span className="font-medium text-muted">(opcional)</span> : null}
      </label>
      {dica ? (
        <p id={`${id}-dica`} className="-mt-1 mb-2 text-sm text-muted">
          {dica}
        </p>
      ) : null}
      {multilinha ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={3}
          className={`${inputClass} min-h-24 resize-none py-3`}
          aria-invalid={!!erro}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`${inputClass} h-14`}
          aria-invalid={!!erro}
          aria-describedby={describedBy}
          {...resto}
        />
      )}
      <Erro id={`${id}-erro`} msg={erro} />
    </div>
  );
}

/** Cartão grande de escolha única (radio) ou múltipla (checkbox). */
export function Opcao({
  selecionado,
  onClick,
  children,
  multipla,
  compacto,
}: {
  selecionado: boolean;
  onClick: () => void;
  children: ReactNode;
  multipla?: boolean;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      role={multipla ? "checkbox" : "radio"}
      aria-checked={selecionado}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[18px] border-2 text-left font-medium transition-colors duration-150 ${
        compacto ? "min-h-12 px-4 py-2.5 text-[15px]" : "min-h-14 px-4 py-3.5 text-base"
      } ${selecionado ? "border-roxo bg-roxo text-white" : "border-borda bg-card text-white hover:border-[#3a3546]"}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center border-2 ${multipla ? "rounded-md" : "rounded-full"} ${
          selecionado ? "border-white bg-white text-roxo" : "border-[#4a4556]"
        }`}
      >
        {selecionado ? <span className={`block size-2.5 bg-roxo ${multipla ? "rounded-sm" : "rounded-full"}`} /> : null}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export function Grupo({ legenda, erro, id, children, dica }: { legenda: string; erro?: string; id: string; children: ReactNode; dica?: string }) {
  return (
    <fieldset aria-describedby={erro ? `${id}-erro` : undefined}>
      <legend className="mb-2 font-bold">{legenda}</legend>
      {dica ? <p className="-mt-1 mb-3 text-sm text-muted">{dica}</p> : null}
      {children}
      <Erro id={`${id}-erro`} msg={erro} />
    </fieldset>
  );
}
