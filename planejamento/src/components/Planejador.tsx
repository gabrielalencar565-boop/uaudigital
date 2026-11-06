"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COPY } from "@/data/textos";
import { withBase } from "@/lib/base";
import { trackPixel } from "@/lib/pixel";
import { nomeDoNicho } from "@/lib/input";
import { gerarPlanoModelo } from "@/lib/modeloB";
import { mesAtual, type PlanoSalvo } from "@/lib/plano";
import {
  CONTATO_VAZIO,
  RASCUNHO_VAZIO,
  paraFormInput,
  primeiraEtapaIncompleta,
  validarContato,
  validarEtapa,
  type Contato,
  type Erros,
  type Rascunho,
} from "@/lib/rascunho";
import { gravar, guardarPlano, ler, lerPlano, utmDaUrl, type UTM } from "@/lib/storage";
import Generating from "./Generating";
import Intro from "./Intro";
import PlanResult from "./PlanResult";
import StepCliente from "./StepCliente";
import StepContato from "./StepContato";
import StepObjetivo from "./StepObjetivo";
import StepPerfil from "./StepPerfil";
import StepPublico from "./StepPublico";
import StepShell from "./StepShell";

/** Versão demo (artefato estático): monta o plano no navegador, pelos modelos prontos. */
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

type Tela = { tipo: "intro" } | { tipo: "etapa"; i: number } | { tipo: "gerando" } | { tipo: "resultado" };

type Salvo = {
  rascunho: Rascunho;
  contato: Contato;
  leadId?: string;
  utm?: UTM;
  ultimoId?: string;
  tela?: Tela["tipo"];
};

const ETAPAS = [
  { chave: "cliente", Comp: StepCliente },
  { chave: "objetivo", Comp: StepObjetivo },
  { chave: "publico", Comp: StepPublico },
  { chave: "perfil", Comp: StepPerfil },
] as const;

function corDaTela() {
  return { cor: "#0F0E11", classe: "bg-bg" };
}

function chaveDaTela(t: Tela) {
  return t.tipo === "etapa" ? `etapa-${t.i}` : t.tipo;
}

export default function Planejador() {
  const [tela, setTela] = useState<Tela>({ tipo: "intro" });
  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [contato, setContato] = useState<Contato>(CONTATO_VAZIO);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [utm, setUtm] = useState<UTM>({});
  const [salvo, setSalvo] = useState<PlanoSalvo | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | undefined>();
  const [erroResultado, setErroResultado] = useState<string | undefined>();
  const [regerando, setRegerando] = useState(false);
  const [temProgresso, setTemProgresso] = useState(false);
  const [direcao, setDirecao] = useState<"frente" | "tras">("frente");
  const [pronto, setPronto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const primeiraRender = useRef(true);

  // Restaura o que estava salvo no navegador.
  useEffect(() => {
    const s = ler<Salvo>();
    /* eslint-disable react-hooks/set-state-in-effect -- leitura única do localStorage ao montar */
    setUtm({ ...(s?.utm ?? {}), ...utmDaUrl() });
    if (s) {
      setRascunho({ ...RASCUNHO_VAZIO, ...s.rascunho });
      setContato({ ...CONTATO_VAZIO, ...s.contato });
      setLeadId(s.leadId);
      const anterior = s.ultimoId ? lerPlano(s.ultimoId) : null;
      if (s.tela === "resultado" && anterior) {
        setSalvo(anterior);
        setTela({ tipo: "resultado" });
      } else if (s.rascunho && (s.rascunho.cliente || s.rascunho.objetivo)) {
        setTemProgresso(true);
      }
    }
    setPronto(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Salva a cada mudança.
  useEffect(() => {
    if (!pronto) return;
    gravar({ rascunho, contato, leadId, utm, ultimoId: salvo?.id, tela: tela.tipo } satisfies Salvo);
  }, [pronto, rascunho, contato, leadId, utm, salvo, tela.tipo]);

  // Cor do fundo do documento acompanha a tela.
  useEffect(() => {
    const { cor } = corDaTela();
    document.documentElement.style.background = cor;
    document.body.style.background = cor;
  }, [tela]);

  // Foco no título da nova tela e volta pro topo.
  useEffect(() => {
    if (primeiraRender.current) {
      primeiraRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    containerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [tela]);

  // Pixel: CompleteRegistration ao ver o planejamento.
  const idVisto = useRef<string | null>(null);
  useEffect(() => {
    if (tela.tipo === "resultado" && salvo && idVisto.current !== salvo.id) {
      idVisto.current = salvo.id;
      trackPixel("CompleteRegistration");
    }
  }, [tela.tipo, salvo]);

  const ir = useCallback((t: Tela, d: "frente" | "tras" = "frente") => {
    setDirecao(d);
    setErros({});
    setTela(t);
  }, []);

  const setCampo = useCallback(<K extends keyof Rascunho>(k: K, v: Rascunho[K]) => {
    setRascunho((r) => ({ ...r, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: undefined } : e));
  }, []);

  const setContatoCampo = useCallback(<K extends keyof Contato>(k: K, v: Contato[K]) => {
    setContato((c) => ({ ...c, [k]: v }));
    setErros((e) => (e[k] ? { ...e, [k]: undefined } : e));
  }, []);

  function focarPrimeiroErro(e: Erros) {
    const primeiro = Object.keys(e)[0];
    if (!primeiro) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(primeiro) ?? document.getElementById(`${primeiro}-erro`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus({ preventScroll: true });
    });
  }

  function avancar(i: number) {
    const e = validarEtapa(i, rascunho);
    if (Object.keys(e).length) {
      setErros(e);
      focarPrimeiroErro(e);
      return;
    }
    ir({ tipo: "etapa", i: i + 1 });
  }

  async function gerar(origem: "contato" | "resultado") {
    const mostrarErro = (msg: string) => {
      if (origem === "contato") {
        setErroGeral(msg);
        setTela({ tipo: "etapa", i: 4 });
      } else {
        setErroResultado(msg);
        setTela({ tipo: "resultado" });
      }
    };
    setErroGeral(undefined);
    setErroResultado(undefined);
    if (origem === "resultado") setRegerando(true);
    ir({ tipo: "gerando" });
    // A tela de geração fica pelo menos 4 s, mesmo quando o plano sai na hora.
    const minimo = new Promise((r) => setTimeout(r, 4000));
    if (DEMO) {
      await minimo;
      const form = paraFormInput(rascunho);
      const mes = mesAtual();
      const novo: PlanoSalvo = {
        id: crypto.randomUUID(),
        criado_em: new Date().toISOString(),
        plano: gerarPlanoModelo(form, mes),
        meta: { mes, cliente: form.cliente, nicho: nomeDoNicho(form), fonte: "modelo" },
      };
      guardarPlano(novo);
      setSalvo(novo);
      setRegerando(false);
      ir({ tipo: "resultado" });
      return;
    }
    try {
      const res = await fetch(withBase("/api/gerar"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, contato, form: rascunho, utm }),
      });
      const data = (await res.json().catch(() => null)) as
        | ({ ok: true; leadId: string } & PlanoSalvo)
        | { ok: false; erro?: string; leadId?: string }
        | null;
      await minimo;
      if (data?.leadId) setLeadId(data.leadId);
      if (!res.ok || !data || !data.ok) {
        mostrarErro((data && !data.ok && data.erro) || COPY.erroGenerico);
        return;
      }
      const novo: PlanoSalvo = { id: data.id, criado_em: data.criado_em, plano: data.plano, meta: data.meta };
      guardarPlano(novo);
      setSalvo(novo);
      ir({ tipo: "resultado" });
    } catch {
      mostrarErro(COPY.erroGenerico);
    } finally {
      setRegerando(false);
    }
  }

  function enviarContato() {
    const e = validarContato(contato);
    if (Object.keys(e).length) {
      setErros(e);
      focarPrimeiroErro(e);
      return;
    }
    trackPixel("Lead");
    void gerar("contato");
  }

  function comecarDoZero() {
    setRascunho(RASCUNHO_VAZIO);
    setTemProgresso(false);
    ir({ tipo: "etapa", i: 0 });
  }

  function continuar() {
    setTemProgresso(false);
    ir({ tipo: "etapa", i: primeiraEtapaIncompleta(rascunho) });
  }

  function outroCliente() {
    // Limpa as respostas, mas mantém nome e contato.
    setRascunho(RASCUNHO_VAZIO);
    setSalvo(null);
    ir({ tipo: "etapa", i: 0 });
  }

  let conteudo: React.ReactNode = null;
  if (tela.tipo === "intro") {
    conteudo = <Intro onComecar={comecarDoZero} onContinuar={temProgresso ? continuar : undefined} />;
  } else if (tela.tipo === "etapa" && tela.i < 4) {
    const { chave, Comp } = ETAPAS[tela.i];
    const t = COPY.etapas[chave];
    conteudo = (
      <StepShell
        etapa={tela.i}
        titulo={t.titulo}
        emoji={t.emoji}
        pergunta={t.pergunta}
        onVoltar={() => ir(tela.i === 0 ? { tipo: "intro" } : { tipo: "etapa", i: tela.i - 1 }, "tras")}
        onAvancar={() => avancar(tela.i)}
      >
        <Comp r={rascunho} set={setCampo} erros={erros} />
      </StepShell>
    );
  } else if (tela.tipo === "etapa") {
    conteudo = (
      <StepContato
        c={contato}
        set={setContatoCampo}
        erros={erros}
        erroGeral={erroGeral}
        enviando={false}
        onVoltar={() => ir({ tipo: "etapa", i: 3 }, "tras")}
        onEnviar={enviarContato}
      />
    );
  } else if (tela.tipo === "gerando") {
    conteudo = <Generating />;
  } else if (salvo) {
    conteudo = (
      <PlanResult
        salvo={salvo}
        acoes={{ onGerarDeNovo: () => void gerar("resultado"), onOutroCliente: outroCliente, gerando: regerando, erro: erroResultado }}
      />
    );
  }

  const largo = tela.tipo === "resultado";
  return (
    <main className={`min-h-dvh overflow-x-clip text-fg ${corDaTela().classe}`}>
      <div
        ref={containerRef}
        key={chaveDaTela(tela)}
        className={`mx-auto w-full px-5 ${largo ? "max-w-[960px]" : "max-w-[480px]"} ${direcao === "tras" ? "screen-in-back" : "screen-in"}`}
      >
        {conteudo}
      </div>
    </main>
  );
}
