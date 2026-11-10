import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { FASES, FASES_LISTA } from "@/data/fases";
import { FORMATOS } from "@/data/formulario";
import { COPY } from "@/data/textos";
import { curta, DIAS_DA_SEMANA, gradeDoMes, postsDatados, rotuloDoPost } from "@/lib/datas";
import type { Plano, PlanoMeta } from "@/lib/plano";

/** PDF para o social media apresentar ao cliente: A4, fundo branco, detalhes nas cores da UAU (roxo, magenta e laranja). */

const fonte = (peso: number) => path.join(process.cwd(), "src/assets", `Bricolage-${peso}.ttf`);
Font.register({
  family: "Bricolage",
  fonts: [
    { src: fonte(400), fontWeight: 400 },
    { src: fonte(700), fontWeight: 700 },
    { src: fonte(800), fontWeight: 800 },
  ],
});
// Não quebra palavras com hífen no meio.
Font.registerHyphenationCallback((palavra) => [palavra]);

const ROXO = "#7B2FE0";
const MAGENTA = "#C9307A";
const LARANJA = "#F2A04A";
const LILAS_CLARO = "#F3EDFD";
const TINTA = "#141217";
const CINZA = "#5A5563";
const LINHA = "#E6E3EC";

/** Emojis coloridos não renderizam no PDF sem fonte própria: tira do texto. */
const semEmoji = (s: string) =>
  s
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const s = StyleSheet.create({
  pagina: { fontFamily: "Bricolage", fontSize: 10, color: TINTA, paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, backgroundColor: "#FFFFFF" },
  faixa: { position: "absolute", top: 0, left: 0, right: 0, height: 8, flexDirection: "row" },
  rotulo: { fontSize: 9, fontWeight: 700, color: ROXO, letterSpacing: 1.2, textTransform: "uppercase" },
  capaTitulo: { fontSize: 34, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1.05, marginTop: 10 },
  nicho: { fontSize: 12, color: CINZA, marginTop: 6 },
  caixaObjetivo: { backgroundColor: LILAS_CLARO, borderRadius: 12, padding: 18, marginTop: 26, borderLeftWidth: 4, borderLeftColor: ROXO },
  objetivoTexto: { fontSize: 15, fontWeight: 800, lineHeight: 1.25, marginTop: 6 },
  metas: { flexDirection: "row", gap: 10, marginTop: 12 },
  meta: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 8, padding: 10 },
  metaTitulo: { fontSize: 10, fontWeight: 800 },
  metaTexto: { fontSize: 9, color: CINZA, marginTop: 3, lineHeight: 1.35 },
  bloco: { marginTop: 22 },
  blocoTitulo: { fontSize: 13, fontWeight: 800, marginBottom: 8 },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  celula: { width: "48%", borderLeftWidth: 3, borderLeftColor: ROXO, paddingLeft: 8, paddingVertical: 2 },
  celulaRotulo: { fontSize: 8, fontWeight: 700, color: CINZA, letterSpacing: 0.8, textTransform: "uppercase" },
  celulaTexto: { fontSize: 10, marginTop: 2, lineHeight: 1.35 },
  fases: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  semanaTitulo: { fontSize: 18, fontWeight: 800, letterSpacing: -0.3 },
  semanaFoco: { fontSize: 11, color: CINZA, marginTop: 2, marginBottom: 10 },
  post: { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINHA, paddingVertical: 10, gap: 12 },
  postLado: { width: 96, gap: 5 },
  postDia: { fontSize: 12, fontWeight: 800 },
  postFormato: { fontSize: 8.5, color: CINZA },
  postCorpo: { flex: 1 },
  gancho: { fontSize: 11.5, fontWeight: 800, lineHeight: 1.25 },
  ideia: { fontSize: 9.5, lineHeight: 1.4, marginTop: 4, color: "#2A2730" },
  cta: { fontSize: 9.5, marginTop: 4 },
  ctaRotulo: { fontWeight: 700, color: ROXO },
  stories: { marginTop: 18, backgroundColor: "#F6F2FD", borderRadius: 10, padding: 14 },
  item: { flexDirection: "row", gap: 6, marginTop: 4 },
  calTitulo: { fontSize: 22, fontWeight: 800, letterSpacing: -0.3, marginTop: 4 },
  calGrade: { marginTop: 10, borderWidth: 1, borderColor: LINHA, borderRadius: 8 },
  calLinha: { flexDirection: "row" },
  calCab: { flex: 1, paddingVertical: 6, paddingHorizontal: 5, fontSize: 7.5, fontWeight: 700, color: CINZA, letterSpacing: 0.8, textTransform: "uppercase" },
  calSemana: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 3, fontSize: 8.5, color: CINZA, borderTopWidth: 1, borderTopColor: LINHA },
  calDia: { flex: 1, minHeight: 122, padding: 4, borderLeftWidth: 1, borderLeftColor: LINHA, gap: 2 },
  calNum: { fontSize: 8, color: CINZA },
  calPost: { borderRadius: 5, paddingHorizontal: 4, paddingVertical: 4 },
  calPostFmt: { fontSize: 6, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 },
  calPostTxt: { fontSize: 7.5, fontWeight: 700, lineHeight: 1.25, marginTop: 2 },
  rodape: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#9A95A6" },
});

function Pilula({ fase }: { fase: keyof typeof FASES }) {
  const f = FASES[fase];
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: f.cor, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2.5 }}>
      <Text style={{ fontSize: 8, fontWeight: 800, color: f.corTexto }}>{f.nome}</Text>
    </View>
  );
}

function Rodape() {
  return (
    <View style={s.rodape} fixed>
      <Text>{COPY.resultado.rodapePdf}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/** Calendário do mês (4 semanas × 7 dias), na primeira página dos posts. */
function Calendario({ plano, meta }: { plano: Plano; meta: PlanoMeta }) {
  const grade = gradeDoMes(meta.mes);
  if (!grade) return null;
  const posts = postsDatados(plano, meta.mes);
  return (
    <View wrap={false}>
      <Text style={s.rotulo}>Calendário do mês</Text>
      <Text style={s.calTitulo}>O mês post a post</Text>
      <View style={s.calGrade}>
        <View style={s.calLinha}>
          {DIAS_DA_SEMANA.map((d) => (
            <Text key={d} style={s.calCab}>
              {d}
            </Text>
          ))}
        </View>
        {grade.map((linha, i) => (
          <View key={i}>
            <Text style={s.calSemana}>
              <Text style={{ fontWeight: 800, color: TINTA }}>Semana {i + 1}</Text> · {semEmoji(plano.semanas[i]?.foco ?? "")}
            </Text>
            <View style={s.calLinha}>
              {linha.map((d, j) => (
                <View key={j} style={[s.calDia, j === 0 ? { borderLeftWidth: 0 } : {}, d.foraDoMes ? { backgroundColor: "#F7F6F9" } : {}]}>
                  <Text style={s.calNum}>{d.foraDoMes ? curta(d) : d.dia}</Text>
                  {posts
                    .filter((p) => p.semana === i + 1 && p.data?.dia === d.dia && p.data?.mes === d.mes)
                    .map((p) => {
                      const f = FASES[p.post.fase];
                      return (
                        <View key={p.indice} style={[s.calPost, { backgroundColor: f.cor }]}>
                          <Text style={[s.calPostFmt, { color: f.corTexto }]}>{FORMATOS.find((x) => x.id === p.post.formato)?.curto ?? p.post.formato}</Text>
                          <Text style={[s.calPostTxt, { color: f.corTexto }]}>{semEmoji(p.post.gancho)}</Text>
                        </View>
                      );
                    })}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={[s.fases, { marginTop: 8 }]}>
        {FASES_LISTA.map((f) => (
          <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: f.cor }} />
            <Text style={{ fontSize: 7.5, color: CINZA }}>{f.nome}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PdfDocument({ plano, meta }: { plano: Plano; meta: PlanoMeta }) {
  const mes = meta.mes.charAt(0).toUpperCase() + meta.mes.slice(1);
  return (
    <Document title={`Planejamento de conteúdo · ${meta.mes} · ${meta.cliente}`} author={meta.cliente} creator="Planejamento do Mês em 5 Minutos">
      <Page size="A4" style={s.pagina}>
        <View style={s.faixa} fixed>
          <View style={{ flex: 1, backgroundColor: ROXO }} />
          <View style={{ flex: 1, backgroundColor: MAGENTA }} />
          <View style={{ flex: 1, backgroundColor: LARANJA }} />
        </View>
        <Text style={s.rotulo}>Planejamento de conteúdo · {mes}</Text>
        <Text style={s.capaTitulo}>{semEmoji(meta.cliente)}</Text>
        <Text style={s.nicho}>{semEmoji(meta.nicho)}</Text>

        <View style={s.caixaObjetivo}>
          <Text style={s.rotulo}>Objetivo do mês</Text>
          <Text style={s.objetivoTexto}>{semEmoji(plano.objetivo_mes)}</Text>
          <View style={s.metas}>
            {plano.metas.map((m) => (
              <View key={m.meta} style={s.meta}>
                <Text style={s.metaTitulo}>{semEmoji(m.meta)}</Text>
                <Text style={s.metaTexto}>{semEmoji(m.indicador)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Para quem estamos falando</Text>
          <View style={s.grade}>
            {[
              ["Perfil", plano.publico.perfil],
              ["Dor", plano.publico.dor],
              ["Desejo", plano.publico.desejo],
              ["Objeção principal", plano.publico.objecao_principal],
            ].map(([t, d]) => (
              <View key={t} style={s.celula}>
                <Text style={s.celulaRotulo}>{t}</Text>
                <Text style={s.celulaTexto}>{semEmoji(d)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>Tom de voz</Text>
          <Text style={{ lineHeight: 1.4 }}>{semEmoji(plano.tom_de_voz.descricao)}</Text>
          {plano.tom_de_voz.exemplos.map((e) => (
            <View key={e} style={s.item}>
              <Text style={{ color: ROXO }}>•</Text>
              <Text style={{ flex: 1, lineHeight: 1.35 }}>“{semEmoji(e)}”</Text>
            </View>
          ))}
        </View>

        <View style={s.bloco}>
          <Text style={s.blocoTitulo}>As 6 fases da jornada</Text>
          <View style={s.fases}>
            {FASES_LISTA.map((f) => (
              <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 6, width: "48%", marginBottom: 5 }}>
                <Pilula fase={f.id} />
                <Text style={{ fontSize: 9, color: CINZA }}>{f.funcao}</Text>
              </View>
            ))}
          </View>
        </View>
        <Rodape />
      </Page>

      {gradeDoMes(meta.mes) ? (
        <Page size="A4" style={s.pagina}>
          <View style={s.faixa} fixed>
            <View style={{ flex: 1, backgroundColor: ROXO }} />
            <View style={{ flex: 1, backgroundColor: MAGENTA }} />
            <View style={{ flex: 1, backgroundColor: LARANJA }} />
          </View>
          <Calendario plano={plano} meta={meta} />
          <Rodape />
        </Page>
      ) : null}

      <Page size="A4" style={s.pagina}>
        <View style={s.faixa} fixed>
          <View style={{ flex: 1, backgroundColor: ROXO }} />
          <View style={{ flex: 1, backgroundColor: MAGENTA }} />
          <View style={{ flex: 1, backgroundColor: LARANJA }} />
        </View>
        {plano.semanas.map((semana, i) => (
          <View key={semana.numero} break={i > 0 && plano.semanas[0].posts.length >= 4} style={{ marginBottom: 18 }}>
            {semana.posts.map((p, j) => {
              const f = FORMATOS.find((x) => x.id === p.formato);
              const linha = (
                <View style={s.post}>
                  <View style={s.postLado}>
                    <Text style={s.postDia}>{rotuloDoPost(meta.mes, semana.numero, p)}</Text>
                    <Pilula fase={p.fase} />
                    <Text style={s.postFormato}>{f?.curto ?? p.formato}</Text>
                  </View>
                  <View style={s.postCorpo}>
                    <Text style={s.gancho}>{semEmoji(p.gancho)}</Text>
                    <Text style={s.ideia}>{semEmoji(p.ideia)}</Text>
                    <Text style={s.cta}>
                      <Text style={s.ctaRotulo}>CTA: </Text>
                      {semEmoji(p.cta)}
                    </Text>
                  </View>
                </View>
              );
              // O título da semana vai junto com o primeiro post (nunca fica sozinho no pé da página).
              return (
                <View key={j} wrap={false}>
                  {j === 0 ? (
                    <View>
                      <Text style={s.semanaTitulo}>Semana {semana.numero}</Text>
                      <Text style={s.semanaFoco}>{semEmoji(semana.foco)}</Text>
                    </View>
                  ) : null}
                  {linha}
                </View>
              );
            })}
          </View>
        ))}

        <View style={s.stories} wrap={false}>
          <Text style={s.blocoTitulo}>Stories da semana</Text>
          {plano.stories_recorrentes.map((st) => (
            <View key={st} style={s.item}>
              <Text style={{ color: ROXO }}>•</Text>
              <Text style={{ flex: 1, lineHeight: 1.35 }}>{semEmoji(st)}</Text>
            </View>
          ))}
        </View>
        <Rodape />
      </Page>
    </Document>
  );
}
