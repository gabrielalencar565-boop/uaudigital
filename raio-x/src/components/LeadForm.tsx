"use client";

import { useState, type FormEvent } from "react";
import { COPY } from "@/data/raiox";
import { isValidInstagram, isValidName, isValidWhatsApp, maskWhatsApp } from "@/lib/validation";

export type LeadInput = { name: string; whatsapp: string; instagram: string; consent: boolean };

type Errors = Partial<Record<keyof LeadInput | "form", string>>;

type Props = {
  initialName?: string;
  onSubmit: (lead: LeadInput) => Promise<void>;
};

function validate(v: LeadInput): Errors {
  const e: Errors = {};
  if (!isValidName(v.name)) e.name = "Coloca seu nome pra gente saber com quem tá falando.";
  if (!v.whatsapp.trim()) e.whatsapp = "Preenche seu WhatsApp com DDD.";
  else if (!isValidWhatsApp(v.whatsapp)) e.whatsapp = "Esse número não parece certo. Confere o DDD e os dígitos.";
  if (!isValidInstagram(v.instagram)) e.instagram = "Esse @ não parece válido. Pode deixar em branco se preferir.";
  if (!v.consent) e.consent = "Marca essa opção pra liberar seu resultado.";
  return e;
}

const inputClass =
  "block h-14 w-full rounded-2xl border-2 border-transparent bg-ink px-4 text-[17px] text-white placeholder:text-muted/70 outline-none focus-visible:outline-none transition-colors focus:border-amarelo aria-[invalid=true]:border-amarelo";

export default function LeadForm({ initialName = "", onSubmit }: Props) {
  const [values, setValues] = useState<LeadInput>({ name: initialName, whatsapp: "", instagram: "", consent: false });
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);

  function set<K extends keyof LeadInput>(key: K, value: LeadInput[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found = validate(values);
    setErrors(found);
    const firstError = (["name", "whatsapp", "instagram", "consent"] as const).find((k) => found[k]);
    if (firstError) {
      document.getElementById(`lead-${firstError}`)?.focus();
      return;
    }
    setSending(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setErrors({ form: err instanceof Error && err.message ? err.message : "Não rolou enviar. Tenta de novo." });
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center py-10">
      <h1 data-autofocus tabIndex={-1} className="title text-[2.5rem]">
        {COPY.lead.title}
      </h1>
      <p className="mt-4 text-lg leading-snug text-white/90">{COPY.lead.text}</p>

      <form noValidate onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <div>
          <label htmlFor="lead-name" className="mb-2 block font-bold">
            Nome
          </label>
          <input
            id="lead-name"
            name="name"
            autoComplete="given-name"
            autoCapitalize="words"
            className={inputClass}
            placeholder="Como você se chama?"
            value={values.name}
            maxLength={80}
            onChange={(e) => set("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "lead-name-error" : undefined}
            required
          />
          <FieldError id="lead-name-error" message={errors.name} />
        </div>

        <div>
          <label htmlFor="lead-whatsapp" className="mb-2 block font-bold">
            WhatsApp
          </label>
          <input
            id="lead-whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            className={inputClass}
            placeholder="(11) 98765-4321"
            value={values.whatsapp}
            onChange={(e) => set("whatsapp", maskWhatsApp(e.target.value))}
            aria-invalid={!!errors.whatsapp}
            aria-describedby={errors.whatsapp ? "lead-whatsapp-error" : undefined}
            required
          />
          <FieldError id="lead-whatsapp-error" message={errors.whatsapp} />
        </div>

        <div>
          <label htmlFor="lead-instagram" className="mb-2 block font-bold">
            @ do Instagram <span className="font-medium text-white/75">(opcional)</span>
          </label>
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[17px] text-muted">
              @
            </span>
            <input
              id="lead-instagram"
              name="instagram"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`${inputClass} pl-9`}
              placeholder="seuperfil"
              value={values.instagram}
              maxLength={60}
              onChange={(e) => set("instagram", e.target.value.replace(/^@+/, ""))}
              aria-invalid={!!errors.instagram}
              aria-describedby={errors.instagram ? "lead-instagram-error" : undefined}
            />
          </div>
          <FieldError id="lead-instagram-error" message={errors.instagram} />
        </div>

        <div>
          <label htmlFor="lead-consent" className="flex cursor-pointer items-start gap-3 rounded-2xl py-1">
            <input
              id="lead-consent"
              name="consent"
              type="checkbox"
              className="mt-0.5 size-6 shrink-0 cursor-pointer accent-amarelo"
              checked={values.consent}
              onChange={(e) => set("consent", e.target.checked)}
              aria-invalid={!!errors.consent}
              aria-describedby={errors.consent ? "lead-consent-error" : undefined}
              required
            />
            <span className="text-[15px] leading-snug text-white/90">{COPY.lead.consent}</span>
          </label>
          <FieldError id="lead-consent-error" message={errors.consent} />
        </div>

        {errors.form ? (
          <p role="alert" className="rounded-2xl border-2 border-amarelo px-4 py-3 font-medium">
            {errors.form}
          </p>
        ) : null}

        <button type="submit" className="btn-primary mt-2" disabled={sending}>
          {sending ? "Liberando seu resultado…" : COPY.lead.cta}
        </button>
        <p className="text-center text-sm text-white/75">Sem spam. Seus dados ficam só com a UAU. 🔒</p>
      </form>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-2 text-[15px] font-bold text-amarelo">
      {message}
    </p>
  );
}
