import type { TagItem } from '../shared/types';

export interface GeneratedNarrative {
  description: string;
  tagline: string;
  source: 'ai' | 'deterministic';
}

const HEAD_LEADS: Record<string, string> = {
  adaptavel: 'adapta-se num instante a qualquer mudança',
  esperto: 'lê padrões complexos antes de toda a gente',
  competitivo: 'puxa sempre pelo próximo nível',
  confiante: 'entra na sala com segurança natural',
  curioso: 'faz as perguntas certas antes de aceitar o óbvio',
  extrovertido: 'cria energia imediata à sua volta',
  divertido: 'transforma tensão em leveza e ritmo',
  imaginativo: 'vê caminhos onde outros só veem limites',
  inteligente: 'liga ideias com lucidez invulgar',
  intuitivo: 'sente o pulso da situação sem precisar de mapa',
  logico: 'põe ordem no caos e faz tudo fazer sentido',
  objectivo: 'mantém o foco no essencial sem ruído',
  objetivo: 'mantém o foco no essencial sem ruído',
  optimista: 'olha em frente com um sorriso que contagia',
  otimista: 'olha em frente com um sorriso que contagia',
  apaixonado: 'entrega-se de corpo e alma ao que acredita',
  empatico: 'lê a sala e faz cada pessoa sentir-se em casa',
  persuasivo: 'convence com clareza e presença magnética',
  pratico: 'resolve o que é preciso, a qualquer hora e lugar',
  sensivel: 'lê as nuances humanas que passam ao lado dos outros',
  sabio: 'traz serenidade e perspetiva de longo prazo',
};

const BODY_VERBS: Record<string, string> = {
  vencedor: 'leva cada desafio até à meta',
  conselheiro: 'orienta quem precisa com lucidez rara',
  analisador: 'desmonta o problema até encontrar a raiz',
  comunicador: 'diz o que importa de modo a todos ouvirem',
  compositor: 'alinha peças soltas com harmonia',
  conceptualizador: 'desenha o plano antes do primeiro passo',
  conector: 'junta pontos e pessoas aparentemente distantes',
  criador: 'dá forma ao que ainda não existia',
  concretizador: 'transforma visão em entrega real',
  motivador: 'levanta a equipa quando o ritmo abranda',
  energizador: 'injeta força interior em cada projeto',
  animador: 'mantém o grupo vivo e unido',
  empreendedor: 'arranca projetos do zero sem esperar licença',
  explorador: 'abre trilhos novos onde ninguém foi',
  ilustrador: 'torna ideias abstratas visíveis e memoráveis',
  influenciador: 'move vontades e alinha pessoas à volta de uma causa',
  inovador: 'inventa soluções frescas quando o manual falha',
  investigador: 'confirma cada pista até saber a verdade',
  lider: 'dá direção e faz os outros quererem seguir',
  aprendiz: 'aprende tudo rápido como no primeiro dia',
  moderador: 'equilibra vozes diferentes com justiça',
  organizador: 'cria estrutura onde tudo tem o seu lugar',
  planeador: 'antecipa prazos e dependências sem falhar',
  solucionador: 'tem sempre mais respostas do que dúvidas',
  estratega: 'pensa três passos à frente',
  tradutor: 'transforma complexidade em linguagem simples',
  escritor: 'usa palavras com precisão cirúrgica',
};

const ARMS_CLOSERS: Record<string, string> = {
  altruismo: 'sem nunca deixar ninguém para trás.',
  colaboracao: 'e raramente brilha sozinho — prefere construir em equipa.',
  compaixao: 'com o coração aberto em cada decisão.',
  coragem: 'mesmo quando o caminho exige sair do guião.',
  disciplina: 'com consistência para levar tudo até ao fim.',
  liberdade: 'e sabe exatamente quando voar fora do guião.',
  generosidade: 'partilhando espaço, mérito e tempo com os outros.',
  humildade: 'deixando o resultado falar mais alto do que o ego.',
  integridade: 'mantendo a palavra quando ninguém está a ver.',
  maturidade: 'crescendo com raízes firmes, passo a passo.',
  persistencia: 'sem desistir até ver acontecer.',
  responsabilidade: 'assumindo o peso certo nos momentos decisivos.',
  sinceridade: 'dizendo sempre a verdade acima de tudo.',
  solidariedade: 'estendendo a mão para puxar o grupo consigo.',
  tolerancia: 'criando espaço seguro para todas as perspetivas.',
};

function normalizeKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function buildDeterministicNarrative(
  headTag: TagItem,
  bodyTag: TagItem,
  armsTag: TagItem,
  mode: 'self' | 'all',
  firstName?: string,
): GeneratedNarrative {
  const hKey = normalizeKey(headTag.labelPt);
  const bKey = normalizeKey(bodyTag.labelPt);
  const aKey = normalizeKey(armsTag.labelPt);

  const headPhrase = HEAD_LEADS[hKey] ?? `destaca-se por ser ${headTag.labelPt.toLowerCase()}`;
  const bodyPhrase = BODY_VERBS[bKey] ?? `atua como ${bodyTag.labelPt.toLowerCase()}`;
  const armsPhrase = ARMS_CLOSERS[aKey] ?? `guiado por ${armsTag.labelPt.toLowerCase()}.`;

  const tagline = `${capitalize(headPhrase)}, ${bodyPhrase} ${armsPhrase}`;

  const cleanName = firstName?.trim();
  const subject = cleanName ? `${cleanName}, o` : 'O';
  const description =
    mode === 'self'
      ? `${subject} teu Self MighT combina um perfil ${headTag.labelPt.toLowerCase()} com a força de ${bodyTag.labelPt.toLowerCase()}. Guiado por ${armsTag.labelPt.toLowerCase()}, ${bodyPhrase} ${armsPhrase}`
      : `Nos olhos de quem te conhece, a tua marca mais forte é seres ${headTag.labelPt.toLowerCase()} e atuares como ${bodyTag.labelPt.toLowerCase()}. Os teus círculos reconhecem ${armsTag.labelPt.toLowerCase()} como o traço que sustenta tudo o resto.`;

  return {
    description,
    tagline,
    source: 'deterministic',
  };
}

export async function generateFigureNarrative(
  headTag: TagItem,
  bodyTag: TagItem,
  armsTag: TagItem,
  mode: 'self' | 'all',
  firstName?: string,
): Promise<GeneratedNarrative> {
  const fallback = buildDeterministicNarrative(headTag, bodyTag, armsTag, mode, firstName);

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openRouterKey && !openAiKey) {
    return fallback;
  }

  const endpoint = openRouterKey
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const apiKey = openRouterKey || openAiKey!;
  const model = openRouterKey
    ? process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'
    : process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const prompt = [
    'Escreve em Português Europeu (PT-PT estrito: tu/teu, sem gerúndio brasileiro).',
    `Modo: ${mode === 'self' ? 'Self MighT (autoperceção)' : 'All MighT (perceção dos outros)'}.`,
    firstName ? `Primeiro nome: ${firstName}.` : '',
    `Cabeça (Personalidade): ${headTag.labelPt} — "${headTag.taglinePt}"`,
    `Corpo (Poder/Talento): ${bodyTag.labelPt} — "${bodyTag.taglinePt}"`,
    `Braços (Carácter/Valor): ${armsTag.labelPt} — "${armsTag.taglinePt}"`,
    'Responde APENAS em JSON válido com duas chaves:',
    '1. "description": 2 frases curtas e humanas sobre esta figura MighT.',
    '2. "tagline": 1 frase curta e memorável (máx 95 caracteres) ao estilo de cartão colecionável.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 180,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'És o copywriter oficial da Epic para o MighT. Respondes apenas em JSON válido em PT-PT.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return fallback;
    const data: any = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== 'string') return fallback;

    const parsed = JSON.parse(rawContent);
    if (
      typeof parsed.description === 'string' &&
      parsed.description.trim().length > 15 &&
      typeof parsed.tagline === 'string' &&
      parsed.tagline.trim().length > 10
    ) {
      return {
        description: parsed.description.trim(),
        tagline: parsed.tagline.trim(),
        source: 'ai',
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}
