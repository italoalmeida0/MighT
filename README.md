# MighT — Visualiza o teu potencial

> **Hack talent debt.** Visualiza o teu potencial e descobre funções e carreiras através do reconhecimento entre pares em três palavras: **Personalidade (Cabeça)**, **Poder (Corpo)** e **Carácter (Braços)**.

MVP mobile-first construído em **Bun + SQLite + SolidJS + Tailwind CSS v4** com foco em fluidez, paridade visual com o Brand Kit oficial da MighT e zero becos sem saída.

---

## Arranque Rápido

Pré-requisito: [Bun](https://bun.sh/) (`>= 1.4`).

```bash
# 1. Instalar dependências
bun install

# 2. Compilar o frontend SPA (gera dist/web/)
bun run build

# 3. Iniciar o servidor unificado (API + SSE + Frontend em http://localhost:3001)
bun run start
```

### Desenvolvimento (opcional)

- **Backend (porta `3001`)**: `bun run dev`
- **Frontend HMR/dev proxy (porta `3000`, proxy `/api/*` → `3001`)**: `bun run dev:web`

### Configuração de IA (opcional)

O MighT inclui síntese de narrativas e taglines em **PT-PT** instantânea e determinística mesmo offline. Caso pretendas usar um modelo LLM externo, define uma das variáveis de ambiente abaixo antes de iniciar o servidor:

- `OPENROUTER_API_KEY` (opcional)
- `OPENAI_API_KEY` (opcional)

---

## Funcionalidades Implementadas

1. **Onboarding & Criador 3D Modular (`< 2 min`)**
   - Entrada sem criação de conta (sessão leve por `X-Session-Id`).
   - Escolha de 3 palavras em **Cabeça (Personalidade)**, **Corpo (Poder)** e **Braços (Carácter)** entre **61 tags oficiais** (com grelha rápida de 30 destaques e pesquisa completa), trocando em tempo real as **9 peças 3D modulares** (`27` combinações possíveis).
   - Ecrã de geração com narrativa personalizada em PT-PT.

2. **Perfil Dual: `Self MighT` (Azul) ↔ `All MighT` (Roxo)**
   - **Self MighT**: a tua autoperceção, tagline gerada e acesso direto às secções **Sobre Mim** (7 blocos editáveis), **Estatísticas**, **O Meu Cartão** e **Descobrir & Rede**.
   - **All MighT**: desbloqueia estritamente após **3 MighTs aceites** (caixa de entrada com consentimento explícito `Aceitar` / `Recusar`), apresentando o anel orbital de **6 pares**, nuvem ponderada (`Peso = contagem ÷ total na dimensão`) e filtro pelos **6 círculos sociais** (`Família`, `Amigos`, `Colegas`, `Escola`, `Comunidade`, `Clientes`).

3. **`MANDA MIGHT` & `PEDE MIGHT` (Give-to-Get + Tempo Real)**
   - Envia um MighT a colegas, amigos ou perfis da rede para desbloquear o pedido de reconhecimento (**`Só depois de enviares`**).
   - Convite sem conta via link (`#/convite/:codigo`) e **QR Code SVG** dinâmico, com receção instantânea na caixa de entrada via **SSE (`/api/events`)**.

4. **Estatísticas & Matriz de Johari**
   - Comparação **Self vs. All MighT** com anel de alinhamento (`%`), destaques de perceção e divisão em **Confirmados**, **Superpoderes secretos** e **Talentos ocultos**.

5. **MighT Card & Exportação PNG Real (`2x`)**
   - Pré-visualização em **Retrato (`1080×1920`)** e **LinkedIn (`1200×627`)** nos temas Azul, Roxo e Metálico, com **descarregamento real em PNG** via Canvas 2D.

6. **Descobrir (30 Perfis) & Mapa de Rede (63 Nós / 1.110 Ligações)**
   - Ranking de perfis sintéticos portugueses por **`% de semelhança`** (interseção ponderada de histogramas), tags em comum, maior diferença e filtro por dimensão.
   - **Mapa de Rede** interativo em SVG com os 63 nós e 1.110 ligações distribuídos por 11 grupos, pesquisa e destaque de ligações enviadas, recebidas e mútuas.

7. **Funções Ideais (`Agora → Próximo → Desafio`)**
   - Recomendações explicáveis cruzando as tuas tags com a `Tabela tag-função` (20 funções em 5 trilhos) e perfis semelhantes, com frase explicativa `«Porque é que isto encaixa em ti»` e enquadramento transparente (**apenas hipóteses**).

8. **Modo Demo para Palco**
   - Gaveta discreta no topo para simular receção ao vivo da sala (`+1 MighT`, `+3 MighTs`), carregar o perfil de demonstração completo ou reiniciar o fluxo do zero.

---

## Estrutura do Projeto

- `shared/types.ts` — Contratos TypeScript partilhados entre servidor e cliente
- `server/` — Servidor Bun (`index.ts`, `routes.ts`, `db.ts`, `engine.ts`, `ai.ts`) e dados semente em `server/data/{tags,network,roles}.json`
- `web/` — Aplicação SolidJS + Tailwind CSS v4 (`src/screens/`, `src/components/`, `src/lib/`, `public/assets/`)
- `plugins/` — Plugins Bun para SolidJS, Tailwind CSS v4 e Iconify
- `build.ts` / `dev-web.ts` — Scripts de build de produção e servidor de desenvolvimento
