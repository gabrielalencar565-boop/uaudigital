"use client";

import { useEffect, useRef, useState } from "react";
import type { Area, Question as QuestionType } from "@/data/raiox";

const LETTERS = ["A", "B", "C", "D"];
const ADVANCE_DELAY = 350;

type Props = {
  question: QuestionType;
  area: Area;
  index: number; // 0..23
  total: number;
  /** Ordem embaralhada dos índices originais das opções. */
  order: number[];
  /** Índice ORIGINAL da opção escolhida antes (ao voltar). */
  selected?: number;
  onAnswer: (originalIndex: number) => void;
  onBack: () => void;
};

export default function Question({ question, area, index, total, order, selected, onAnswer, onBack }: Props) {
  const [picked, setPicked] = useState<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const current = picked ?? selected;
  const progress = ((index + 1) / total) * 100;

  function choose(originalIndex: number) {
    if (picked !== undefined) return; // já está avançando
    setPicked(originalIndex);
    timer.current = setTimeout(() => onAnswer(originalIndex), ADVANCE_DELAY);
  }

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <div className="sticky top-0 z-10 -mx-5 bg-bg/90 px-5 pt-3 pb-4 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-[15px] font-medium text-muted transition-colors hover:text-fg"
          >
            <span aria-hidden="true">←</span> Voltar
          </button>
          <span className="text-sm font-medium text-dim tabular-nums">
            Pergunta {index + 1} de {total}
          </span>
        </div>
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Progresso do raio-x"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${progress}%`, background: "var(--grad)" }} />
        </div>
      </div>

      <p className="eyebrow mt-6">
        {area.number} · {area.name} <span aria-hidden="true">{area.emoji}</span>
      </p>
      <h1 data-autofocus tabIndex={-1} className="mt-4 text-[1.75rem] leading-[1.12] font-semibold tracking-[-0.03em] text-balance">
        {question.text}
      </h1>

      <ul className="mt-7 flex flex-col gap-3">
        {order.map((originalIndex, position) => {
          const option = question.options[originalIndex];
          const isOn = current === originalIndex;
          return (
            <li key={originalIndex}>
              <button
                type="button"
                onClick={() => choose(originalIndex)}
                aria-pressed={isOn}
                className={`flex min-h-16 w-full items-center gap-4 rounded-[20px] border-[1.5px] px-4 py-3.5 text-left text-base leading-snug transition-colors duration-150 ${
                  isOn
                    ? "pop grad-border text-fg shadow-[0_10px_30px_rgba(123,47,224,0.3)]"
                    : "border-line bg-bg2 text-fg hover:border-[#3d3846] active:bg-bg3"
                }`}
              >
                <span
                  aria-hidden="true"
                  style={isOn ? { background: "var(--grad)" } : undefined}
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                    isOn ? "text-white" : "border border-[#3d3846] text-dim"
                  }`}
                >
                  {LETTERS[position]}
                </span>
                <span className="font-medium">{option.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
