const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';
const TIMEOUT_MS = 10_000;

// GPT-OSS é um modelo de raciocínio: as instruções vão todas na mensagem "user" (não em
// "system", que a Groq recomenda evitar nesses modelos) e reasoning_effort "low" mantém o
// gasto de tokens de raciocínio baixo, senão a resposta final é cortada antes de terminar.
const INSTRUCOES = [
  'Você é um assistente de RH industrial que escreve resumos curtos em português do Brasil',
  'para supervisores de frigorífico, a partir de dados agregados e anônimos de bem-estar.',
  'Nunca invente números que não estejam nos dados fornecidos.',
  'Nunca mencione, cite ou infira a identidade de funcionários específicos — os dados são',
  'sempre agregados por setor e turno, nunca individuais.',
  'Não emita diagnóstico clínico nem conselho médico.',
  'Responda em no máximo 3 frases corridas, sem listas nem markdown: uma leitura objetiva',
  'do cenário e uma recomendação prática de ação para a liderança.',
  'Responda só com o resumo final, sem introduções como "aqui está" ou "resumo:".',
].join(' ');

// Gera, via Groq (openai/gpt-oss-120b), um resumo em linguagem natural a partir dos dados
// JÁ CALCULADOS pelo motor determinístico (src/domain/analise-planos.js). A IA só redige o
// texto — os números, alertas e classificações continuam vindo do motor.
export async function gerarResumoComIA(contexto) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada');

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 400,
      reasoning_effort: 'low',
      messages: [
        { role: 'user', content: `${INSTRUCOES}\n\nDados do período (agregados, anônimos):\n${JSON.stringify(contexto, null, 2)}` },
      ],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Groq respondeu ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const texto = data.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('Groq retornou resposta vazia');
  return texto;
}
