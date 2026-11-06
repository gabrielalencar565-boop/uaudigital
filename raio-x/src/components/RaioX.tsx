"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AREAS, COPY, QUESTIONS } from "@/data/raiox";
import { trackPixel } from "@/lib/pixel";
import { computeResult, isComplete, shuffledOrder, type Answers } from "@/lib/scoring";
import { clearState, loadState, readUtmFromUrl, saveState, type SavedState, type Step, type UTM } from "@/lib/storage";
import AreaDone from "./AreaDone";
import Intro from "./Intro";
import LeadForm, { type LeadInput } from "./LeadForm";
import Question from "./Question";
import Result from "./Result";

const TOTAL = QUESTIONS.length;
const PER_AREA = TOTAL / AREAS.length;
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

function newOrders(): Record<number, number[]> {
  return Object.fromEntries(QUESTIONS.map((q) => [q.id, shuffledOrder(q.options.length)]));
}

function validOrders(orders: unknown): orders is Record<number, number[]> {
  if (!orders || typeof orders !== "object") return false;
  return QUESTIONS.every((q) => {
    const o = (orders as Record<number, number[]>)[q.id];
    return Array.isArray(o) && o.length === 4 && [...o].sort().join() === "0,1,2,3";
  });
}

const BG: Record<Step["kind"], string> = {
  intro: "#0F0E11",
  question: "#0F0E11",
  areaDone: "#EDECEF",
  lead: "#0F0E11",
  result: "#0F0E11",
};

const BG_CLASS: Record<Step["kind"], string> = {
  intro: "bg-bg text-fg",
  question: "bg-bg text-fg",
  areaDone: "bg-light text-ink",
  lead: "bg-bg text-fg",
  result: "bg-bg text-fg",
};

function stepKey(step: Step) {
  if (step.kind === "question") return `q${step.index}`;
  if (step.kind === "areaDone") return `a${step.areaIndex}`;
  return step.kind;
}

function announce(step: Step): string {
  switch (step.kind) {
    case "question": {
      const q = QUESTIONS[step.index];
      return `Pergunta ${step.index + 1} de ${TOTAL}. ${q.text}`;
    }
    case "areaDone":
      return `${AREAS[step.areaIndex].name} concluído.`;
    case "lead":
      return COPY.lead.title;
    case "result":
      return "Seu resultado está pronto.";
    default:
      return "";
  }
}

export default function RaioX() {
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [answers, setAnswers] = useState<Answers>({});
  const [orders, setOrders] = useState<Record<number, number[]>>({});
  const [name, setName] = useState("");
  const [utm, setUtm] = useState<UTM>({});
  const [pixelCompleted, setPixelCompleted] = useState(false);
  const [resumeStep, setResumeStep] = useState<Step | null>(null);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");
  const [hydrated, setHydrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // Restaura o progresso salvo (só no navegador).
  useEffect(() => {
    const saved = loadState();
    const urlUtm = readUtmFromUrl();
    const savedOrders = validOrders(saved?.orders) ? saved!.orders : newOrders();
    /* eslint-disable react-hooks/set-state-in-effect -- leitura única do localStorage ao montar */
    setOrders(savedOrders);
    setUtm({ ...(saved?.utm ?? {}), ...urlUtm });
    if (saved) {
      setAnswers(saved.answers ?? {});
      setName(saved.name ?? "");
      setPixelCompleted(!!saved.pixelCompleted);
      const s = saved.step;
      if (s.kind === "result" && saved.name && isComplete(saved.answers)) {
        setStep(s);
      } else if (s.kind === "question" || s.kind === "areaDone" || (s.kind === "lead" && isComplete(saved.answers))) {
        setResumeStep(s);
      }
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Salva a cada mudança.
  useEffect(() => {
    if (!hydrated) return;
    const state: SavedState = { step, answers, orders, name, utm, pixelCompleted };
    saveState(state);
  }, [hydrated, step, answers, orders, name, utm, pixelCompleted]);

  // Cor de fundo do documento acompanha a tela (overscroll no iPhone).
  useEffect(() => {
    document.documentElement.style.background = BG[step.kind];
    document.body.style.background = BG[step.kind];
  }, [step.kind]);

  // Foco no título da nova tela + volta pro topo.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const el = containerRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    el?.focus({ preventScroll: true });
  }, [step]);

  const result = useMemo(() => (step.kind === "result" ? computeResult(answers) : null), [step.kind, answers]);

  // Pixel: CompleteRegistration uma vez, ao ver o resultado.
  useEffect(() => {
    if (step.kind === "result" && !pixelCompleted) {
      trackPixel("CompleteRegistration");
      setPixelCompleted(true); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [step.kind, pixelCompleted]);

  const go = useCallback((next: Step, dir: "fwd" | "back" = "fwd") => {
    setDirection(dir);
    setStep(next);
  }, []);

  const startFresh = useCallback(() => {
    setAnswers({});
    setOrders(newOrders());
    setResumeStep(null);
    setPixelCompleted(false);
    go({ kind: "question", index: 0 });
  }, [go]);

  const handleAnswer = useCallback(
    (index: number, optionIndex: number) => {
      const q = QUESTIONS[index];
      setAnswers((a) => ({ ...a, [q.id]: optionIndex }));
      if ((index + 1) % PER_AREA === 0) go({ kind: "areaDone", areaIndex: Math.floor(index / PER_AREA) });
      else go({ kind: "question", index: index + 1 });
    },
    [go],
  );

  const handleBack = useCallback(
    (index: number) => {
      if (index === 0) go({ kind: "intro" }, "back");
      else go({ kind: "question", index: index - 1 }, "back");
    },
    [go],
  );

  const handleAreaContinue = useCallback(
    (areaIndex: number) => {
      if (areaIndex >= AREAS.length - 1) go({ kind: "lead" });
      else go({ kind: "question", index: (areaIndex + 1) * PER_AREA });
    },
    [go],
  );

  const handleLead = useCallback(
    async (lead: LeadInput) => {
      if (!DEMO) {
        let res: Response;
        try {
          res = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...lead, answers, utm }),
          });
        } catch {
          throw new Error("Parece que a internet caiu. Confere a conexão e tenta de novo.");
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Não rolou enviar. Tenta de novo em alguns segundos.");
        }
      }
      trackPixel("Lead");
      setName(lead.name.trim());
      go({ kind: "result" });
    },
    [answers, utm, go],
  );

  const handleRestart = useCallback(() => {
    clearState();
    setAnswers({});
    setOrders(newOrders());
    setName("");
    setPixelCompleted(false);
    setResumeStep(null);
    go({ kind: "intro" }, "back");
  }, [go]);

  let screen: React.ReactNode = null;
  switch (step.kind) {
    case "intro": {
      const resumeLabel =
        resumeStep?.kind === "question"
          ? `Continuar da pergunta ${resumeStep.index + 1}`
          : resumeStep
            ? "Continuar de onde parei"
            : undefined;
      screen = (
        <Intro
          onStart={startFresh}
          resumeLabel={resumeLabel}
          onResume={
            resumeStep
              ? () => {
                  const target = resumeStep;
                  setResumeStep(null);
                  go(target);
                }
              : undefined
          }
        />
      );
      break;
    }
    case "question": {
      const q = QUESTIONS[step.index];
      const area = AREAS.find((a) => a.id === q.area)!;
      screen = (
        <Question
          key={step.index}
          question={q}
          area={area}
          index={step.index}
          total={TOTAL}
          order={orders[q.id] ?? [0, 1, 2, 3]}
          selected={answers[q.id]}
          onAnswer={(opt) => handleAnswer(step.index, opt)}
          onBack={() => handleBack(step.index)}
        />
      );
      break;
    }
    case "areaDone":
      screen = (
        <AreaDone area={AREAS[step.areaIndex]} areaIndex={step.areaIndex} onContinue={() => handleAreaContinue(step.areaIndex)} />
      );
      break;
    case "lead":
      screen = <LeadForm initialName={name} onSubmit={handleLead} />;
      break;
    case "result":
      screen = result ? <Result result={result} name={name} onRestart={handleRestart} /> : null;
      break;
  }

  return (
    <main className={`min-h-dvh overflow-x-clip ${BG_CLASS[step.kind]}`}>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce(step)}
      </p>
      <div
        ref={containerRef}
        key={stepKey(step)}
        className={`mx-auto w-full max-w-[480px] px-5 ${direction === "back" ? "screen-in-back" : "screen-in"}`}
      >
        {screen}
      </div>
    </main>
  );
}
