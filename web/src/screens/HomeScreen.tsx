import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';
import {
  ALL_CIRCLES,
  DIMENSION_META,
  type AllMightSummary,
  type Circle,
  type Dimension,
  type OrbitPeer,
} from '../../../shared/types';
import { MightFigure } from '../components/MightFigure';
import * as api from '../lib/api';
import { useMight } from '../lib/store';

// 6 radial orbit anchor coordinates matching 18 Profile — All MighT — Purple.jpg
const ORBIT_SLOTS = [
  { x: 48, y: 42, lineX1: 92, lineY1: 70, lineX2: 140, lineY2: 102 },
  { x: 292, y: 38, lineX1: 248, lineY1: 68, lineX2: 204, lineY2: 100 },
  { x: 26, y: 122, lineX1: 62, lineY1: 124, lineX2: 128, lineY2: 128 },
  { x: 314, y: 122, lineX1: 278, lineY1: 124, lineX2: 214, lineY2: 128 },
  { x: 54, y: 204, lineX1: 88, lineY1: 184, lineX2: 138, lineY2: 158 },
  { x: 286, y: 204, lineX1: 252, lineY1: 184, lineX2: 204, lineY2: 158 },
] as const;

const FALLBACK_PEER_PHOTOS = [
  '/assets/peers/peer-1.jpg',
  '/assets/peers/peer-2.jpg',
  '/assets/peers/peer-3.jpg',
  '/assets/peers/peer-4.jpg',
  '/assets/peers/peer-5.jpg',
  '/assets/peers/peer-6.jpg',
];

export function HomeScreen() {
  const might = useMight();
  const boot = () => might.bootstrap();
  const profile = () => boot()?.profile;

  const [selfHeroVariant, setSelfHeroVariant] = createSignal<'modular' | 'blue-hero'>('modular');
  const [allHeroVariant, setAllHeroVariant] = createSignal<'purple-hero' | 'modular'>('purple-hero');
  const [selectedCircle, setSelectedCircle] = createSignal<Circle | 'all'>('all');
  const [filteredAllMight, setFilteredAllMight] = createSignal<AllMightSummary | null>(null);
  const [circleLoading, setCircleLoading] = createSignal(false);
  const [selectedOrbitPeer, setSelectedOrbitPeer] = createSignal<OrbitPeer | null>(null);
  const [showAllPeersList, setShowAllPeersList] = createSignal(false);
  const [busyId, setBusyId] = createSignal<string | null>(null);

  // Sync filteredAllMight when bootstrap updates and circle is 'all'
  createEffect(
    on(
      () => [boot()?.allMight, selectedCircle()],
      async ([baseAll, circle]) => {
        if (!baseAll) return;
        if (circle === 'all') {
          setFilteredAllMight(baseAll as AllMightSummary);
          return;
        }
        setCircleLoading(true);
        try {
          const data = await api.fetchAllMight(circle as Circle);
          setFilteredAllMight(data);
        } catch {
          setFilteredAllMight(baseAll as AllMightSummary);
        } finally {
          setCircleLoading(false);
        }
      }
    )
  );

  const activeAllMight = () => filteredAllMight() ?? boot()?.allMight;
  const isAllMode = () => might.activeMode() === 'all';
  const acceptedCount = () => profile()?.acceptedCount ?? 0;
  const pendingMights = () => boot()?.inbox.pending ?? [];

  const handleAccept = async (id: string) => {
    setBusyId(id);
    try {
      await might.acceptMight(id);
    } catch (err) {
      might.showToast(
        err instanceof Error ? err.message : 'Erro ao aceitar MighT.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setBusyId(id);
    try {
      await might.declineMight(id);
      might.showToast('MighT recusado.', 'info');
    } catch (err) {
      might.showToast(
        err instanceof Error ? err.message : 'Erro ao recusar MighT.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  const aboutCompletedCount = createMemo(() => {
    const a = profile()?.about;
    if (!a) return 0;
    let count = 0;
    if (a.academic.length > 0) count++;
    if (a.bio.trim().length > 0) count++;
    if (a.experience.length > 0) count++;
    if (a.likes.length > 0) count++;
    if (a.expertise.length > 0) count++;
    if (a.wish.length > 0) count++;
    if (a.contactEmail.trim().length > 0) count++;
    return count;
  });

  const orbitPeers = createMemo(() => {
    const peers = activeAllMight()?.recentPeers ?? [];
    return peers.slice(0, 6);
  });

  const selfTags = () => profile()?.selfTags;

  return (
    <Show
      when={selfTags()}
      fallback={
        /* Clean redirect/CTA if user opens /home before creating Self MighT */
        <div class="min-h-full flex flex-col items-center justify-center px-6 py-12 text-center space-y-5">
          <MightFigure mode="silhouette" activePart="head" class="w-36" animateFloat />
          <div class="space-y-2">
            <h1 class="text-2xl font-extrabold text-[#1C1E28]">
              Ainda não criaste o teu Self MighT
            </h1>
            <p class="text-sm text-white/90 max-w-[280px] mx-auto">
              Escolhe 3 palavras para visualizar o teu potencial em menos de 2 minutos.
            </p>
          </div>
          <div class="w-full space-y-2.5">
            <button
              type="button"
              onClick={() => might.navigate('/criar')}
              class="w-full py-4 rounded-[20px] bg-white text-[#1C1E28] font-bold text-base shadow-lg cursor-pointer"
            >
              Criar o meu MighT
            </button>
            <button
              type="button"
              onClick={() => might.demoLoadPreset('tiago')}
              class="w-full py-3 rounded-[18px] bg-white/15 border border-white/25 text-white font-semibold text-sm cursor-pointer"
            >
              Carregar demo completo (Tiago)
            </button>
          </div>
        </div>
      }
    >
      <div class="px-5 pt-2 pb-6 space-y-4">
        {/* Top Greeting + Mode Toggle Pill (01 Landing — Blue <-> 18 Profile — Purple) */}
        <Show
          when={!isAllMode()}
          fallback={
            <div class="flex items-center justify-between pt-1">
              <div>
                <p class="text-[11px] font-bold uppercase tracking-widest text-white/75">
                  All MighT · Os outros
                </p>
                <h1 class="text-2xl font-extrabold text-white leading-tight">
                  {profile()?.firstName}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => might.setActiveMode('self')}
                class="px-4 py-2 rounded-xl bg-[#144B86] hover:bg-[#195ca3] text-white text-xs font-extrabold tracking-wider uppercase shadow-md transition cursor-pointer"
              >
                VER SELF MIGHT
              </button>
            </div>
          }
        >
          <div class="flex items-center justify-between pt-1">
            <div>
              <p class="text-sm font-medium text-[#1C1E28]/80">Olá,</p>
              <h1 class="text-[26px] font-extrabold text-[#1C1E28] leading-tight">
                {profile()?.firstName || 'Visitante'}
              </h1>
            </div>

            <button
              type="button"
              onClick={() => might.setActiveMode('all')}
              class="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#753065] hover:bg-[#5E2451] text-white text-xs font-extrabold tracking-wider uppercase shadow-md transition cursor-pointer"
            >
              <span>VER ALL-MIGHT</span>
              <span class="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                {profile()?.allMightUnlocked ? '✨' : `🔒 ${acceptedCount()}/3`}
              </span>
              <Show when={pendingMights().length > 0}>
                <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C6EE00] text-[#0F1838] text-[10px] font-extrabold flex items-center justify-center shadow">
                  {pendingMights().length}
                </span>
              </Show>
            </button>
          </div>
        </Show>

        {/* ==================== BLUE: SELF MIGHT MODE ==================== */}
        <Show when={!isAllMode()}>
          <div class="space-y-4 animate-[fadeIn_220ms_ease-out]">
            {/* Hero 3D Figure + Art Style Toggle Above Figure */}
            <div class="flex flex-col items-center pt-1">
              <div class="flex justify-center mb-2">
                <div class="inline-flex rounded-full bg-[#0F1838]/35 backdrop-blur-md border border-white/25 p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setSelfHeroVariant('modular')}
                    class={`px-3 py-1 rounded-full transition cursor-pointer ${
                      selfHeroVariant() === 'modular'
                        ? 'bg-white text-[#1C1E28] shadow-sm'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    Modular 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelfHeroVariant('blue-hero')}
                    class={`px-3 py-1 rounded-full transition cursor-pointer ${
                      selfHeroVariant() === 'blue-hero'
                        ? 'bg-white text-[#1C1E28] shadow-sm'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    Azul Clássico
                  </button>
                </div>
              </div>

              <MightFigure
                mode={selfHeroVariant()}
                selection={selfTags()}
                tags={boot()?.tags ?? []}
                animateFloat
                class="w-52 my-1"
                alt={`MighT de ${profile()?.firstName}`}
              />
            </div>

            {/* 3-Column Translucent Tag Bar (Parity with 01 Landing — Blue.jpg) */}
            <div class="rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 grid grid-cols-3 divide-x divide-white/25 py-3 px-2 text-center shadow-sm">
              <div class="px-1">
                <p class="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Cabeça
                </p>
                <p class="text-sm font-bold text-white truncate mt-0.5">
                  {might.getTagLabel(selfTags()?.head)}
                </p>
              </div>
              <div class="px-1">
                <p class="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Corpo
                </p>
                <p class="text-sm font-bold text-white truncate mt-0.5">
                  {might.getTagLabel(selfTags()?.body)}
                </p>
              </div>
              <div class="px-1">
                <p class="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Braços
                </p>
                <p class="text-sm font-bold text-white truncate mt-0.5">
                  {might.getTagLabel(selfTags()?.arms)}
                </p>
              </div>
            </div>

            {/* AI Description + Tagline Card */}
            <div class="rounded-2xl bg-white/14 backdrop-blur-md border border-white/25 p-4 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-extrabold uppercase tracking-widest text-[#C6EE00]">
                  O teu retrato Self MighT
                </span>
                <button
                  type="button"
                  onClick={() => might.navigate('/criar')}
                  class="text-[11px] font-semibold text-white/85 hover:text-white underline underline-offset-2 cursor-pointer"
                >
                  Editar palavras
                </button>
              </div>
              <p class="text-sm font-bold italic text-white leading-snug">
                «{profile()?.tagline}»
              </p>
              <p class="text-xs text-white/85 leading-relaxed">
                {profile()?.figureDescription}
              </p>
            </div>

            {/* Dual Action CTAs: MANDA MIGHT & PEDE MIGHT */}
            <div class="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => might.navigate('/enviar')}
                class="py-3.5 px-3 rounded-2xl bg-white hover:bg-white/95 text-[#144B86] font-extrabold text-xs tracking-wider uppercase shadow-md transition cursor-pointer"
              >
                MANDA MIGHT
              </button>
              <button
                type="button"
                onClick={() => might.navigate('/pedir')}
                class="py-3.5 px-3 rounded-2xl bg-[#144B86] hover:bg-[#195ca3] text-white border border-white/25 font-extrabold text-xs tracking-wider uppercase shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Show when={!profile()?.pedeUnlocked}>
                  <span>🔒</span>
                </Show>
                <span>PEDE MIGHT</span>
              </button>
            </div>

            {/* 4-Row Glass Navigation Card (Exact parity with 01 Landing — Blue.jpg) */}
            <div class="rounded-3xl bg-white/14 backdrop-blur-md border border-white/25 divide-y divide-white/20 overflow-hidden shadow-lg">
              <button
                type="button"
                onClick={() => might.navigate('/sobre')}
                class="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-white/10 transition text-left cursor-pointer"
              >
                <span class="h-9 w-9 rounded-full bg-[#753065] text-white flex items-center justify-center shrink-0 text-sm font-bold">
                  👤
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-extrabold uppercase tracking-wider text-white">
                    SOBRE MIM
                  </p>
                  <p class="text-xs text-white/75">
                    {aboutCompletedCount()} de 7 preenchidos
                  </p>
                </div>
                <span class="text-white/70 text-lg">›</span>
              </button>

              <button
                type="button"
                onClick={() => might.navigate('/stats')}
                class="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-white/10 transition text-left cursor-pointer"
              >
                <span class="h-9 w-9 rounded-full bg-[#753065] text-white flex items-center justify-center shrink-0 text-sm font-bold">
                  📊
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-extrabold uppercase tracking-wider text-white">
                    ESTATÍSTICAS
                  </p>
                  <p class="text-xs text-white/75">
                    Como os outros te veem (Johari)
                  </p>
                </div>
                <span class="text-white/70 text-lg">›</span>
              </button>

              <button
                type="button"
                onClick={() => might.navigate('/card')}
                class="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-white/10 transition text-left cursor-pointer"
              >
                <span class="h-9 w-9 rounded-full bg-[#753065] text-white flex items-center justify-center shrink-0 text-sm font-bold">
                  🪪
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-extrabold uppercase tracking-wider text-white">
                    O MEU CARTÃO
                  </p>
                  <p class="text-xs text-white/75">
                    Descarregar PNG ou partilhar
                  </p>
                </div>
                <span class="text-white/70 text-lg">›</span>
              </button>

              <button
                type="button"
                onClick={() => might.navigate('/descobrir')}
                class="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-white/10 transition text-left cursor-pointer"
              >
                <span class="h-9 w-9 rounded-full bg-[#753065] text-white flex items-center justify-center shrink-0 text-sm font-bold">
                  🧭
                </span>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-extrabold uppercase tracking-wider text-white">
                    DESCOBRIR & REDE
                  </p>
                  <p class="text-xs text-white/75">
                    Pessoas semelhantes & funções ideais
                  </p>
                </div>
                <span class="text-white/70 text-lg">›</span>
              </button>
            </div>
          </div>
        </Show>

        {/* ==================== PURPLE: ALL MIGHT MODE ==================== */}
        <Show when={isAllMode()}>
          <div class="space-y-4 animate-[fadeIn_220ms_ease-out]">
            {/* Celebratory banner when newly unlocked */}
            <Show when={might.justUnlockedAllMight()}>
              <div class="rounded-2xl bg-gradient-to-r from-[#C6EE00] to-[#1FB5D3] text-[#0F1838] p-3.5 shadow-lg flex items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-extrabold uppercase tracking-wider">
                    ✨ All MighT Desbloqueado!
                  </p>
                  <p class="text-xs font-semibold">
                    Atingiste {acceptedCount()} MighTs aceites. O teu cartão e stats estão prontos!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => might.clearJustUnlocked()}
                  class="h-7 w-7 rounded-full bg-black/15 font-bold text-sm cursor-pointer shrink-0"
                >
                  ×
                </button>
              </div>
            </Show>

            {/* LOCKED STATE (< 3 accepted MighTs) */}
            <Show when={!profile()?.allMightUnlocked}>
              <div class="rounded-3xl bg-white/15 backdrop-blur-md border border-white/25 p-5 text-center space-y-4">
                <div class="relative mx-auto w-28 h-28 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="rgba(255,255,255,0.2)"
                      stroke-width="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="#C6EE00"
                      stroke-width="8"
                      stroke-linecap="round"
                      stroke-dasharray={`${2 * Math.PI * 42}`}
                      stroke-dashoffset={`${
                        2 * Math.PI * 42 * (1 - Math.min(acceptedCount(), 3) / 3)
                      }`}
                    />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-2xl font-extrabold">{acceptedCount()}/3</span>
                    <span class="text-[10px] uppercase tracking-wider text-white/75 font-bold">
                      Aceites
                    </span>
                  </div>
                </div>

                <div class="space-y-1">
                  <h2 class="text-lg font-extrabold">Agora é uma questão de tempo</h2>
                  <p class="text-xs text-white/85 leading-relaxed">
                    Quando aceitares <strong>3 MighTs</strong>, desbloqueias o teu All MighT, o
                    Cartão oficial, as Estatísticas de Johari e as Funções Ideais.
                  </p>
                </div>

                <div class="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => might.navigate('/enviar')}
                    class="py-3 rounded-2xl bg-white text-[#3E0C42] font-extrabold text-xs uppercase tracking-wider shadow cursor-pointer"
                  >
                    MANDA MIGHT
                  </button>
                  <button
                    type="button"
                    onClick={() => might.navigate('/pedir')}
                    class="py-3 rounded-2xl bg-[#144B86] text-white font-extrabold text-xs uppercase tracking-wider shadow cursor-pointer"
                  >
                    PEDE MIGHT
                  </button>
                </div>
              </div>
            </Show>

            {/* UNLOCKED STATE (>= 3 accepted MighTs) — 18 Profile — All MighT — Purple.jpg parity! */}
            <Show when={profile()?.allMightUnlocked}>
              {/* Art Style Toggle cleanly above Orbit Stage */}
              <div class="flex justify-center mb-1">
                <div class="inline-flex rounded-full bg-black/25 backdrop-blur-md border border-white/25 p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setAllHeroVariant('purple-hero')}
                    class={`px-3 py-1 rounded-full cursor-pointer transition ${
                      allHeroVariant() === 'purple-hero'
                        ? 'bg-white text-[#3E0C42] shadow-sm'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    Roxo All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllHeroVariant('modular')}
                    class={`px-3 py-1 rounded-full cursor-pointer transition ${
                      allHeroVariant() === 'modular'
                        ? 'bg-white text-[#3E0C42] shadow-sm'
                        : 'text-white/85 hover:text-white'
                    }`}
                  >
                    Modular
                  </button>
                </div>
              </div>

              {/* Purple 3D Hero with 6 Orbiting Peer Portraits on Radial SVG Lines */}
              <div class="relative w-full max-w-[340px] h-[250px] mx-auto flex items-center justify-center">
                {/* Radial SVG lines connecting center hero to 6 peer portraits */}
                <svg
                  viewBox="0 0 340 250"
                  class="absolute inset-0 w-full h-full pointer-events-none"
                >
                  <For each={orbitPeers()}>
                    {(_, idx) => {
                      const slot = ORBIT_SLOTS[idx()];
                      if (!slot) return null;
                      return (
                        <line
                          x1={slot.lineX1}
                          y1={slot.lineY1}
                          x2={slot.lineX2}
                          y2={slot.lineY2}
                          stroke="rgba(255,255,255,0.34)"
                          stroke-width="1.2"
                        />
                      );
                    }}
                  </For>
                </svg>

                {/* Center Purple Hero Figure */}
                <div class="relative z-10">
                  <MightFigure
                    mode={allHeroVariant()}
                    selection={activeAllMight()?.topTags ?? selfTags()}
                    tags={boot()?.tags ?? []}
                    animateFloat
                    class="w-40"
                    alt="Figura All MighT Roxo"
                  />
                </div>

                {/* 6 Orbiting Circular Peer Portraits */}
                <For each={orbitPeers()}>
                  {(peer, idx) => {
                    const slot = ORBIT_SLOTS[idx()];
                    if (!slot) return null;
                    const photo =
                      peer.photoUrl ||
                      FALLBACK_PEER_PHOTOS[idx() % FALLBACK_PEER_PHOTOS.length];
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedOrbitPeer(
                            selectedOrbitPeer()?.id === peer.id ? null : peer
                          )
                        }
                        style={{
                          left: `${(slot.x / 340) * 100}%`,
                          top: `${(slot.y / 250) * 100}%`,
                        }}
                        class="absolute -translate-x-1/2 -translate-y-1/2 z-10 w-11 h-11 min-w-[44px] min-h-[44px] aspect-square shrink-0 rounded-full overflow-hidden border-2 border-white/80 shadow-lg group cursor-pointer hover:scale-110 transition"
                        title={`${peer.name} (${peer.circle})`}
                      >
                        <img
                          src={photo}
                          alt={peer.name}
                          class="w-full h-full object-cover"
                        />
                      </button>
                    );
                  }}
                </For>
              </div>

              {/* Selected Orbiting Peer Popover */}
              <Show when={selectedOrbitPeer()}>
                {(peer) => (
                  <div class="rounded-2xl bg-black/30 backdrop-blur-md border border-white/25 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs animate-[fadeIn_160ms_ease-out]">
                    <div>
                      <p class="font-bold">
                        {peer().name}{' '}
                        <span class="font-normal text-white/75">({peer().circle})</span>
                      </p>
                      <p class="text-white/85">
                        {might.getTagLabel(peer().headTag)} ·{' '}
                        {might.getTagLabel(peer().bodyTag)} ·{' '}
                        {might.getTagLabel(peer().armsTag)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedOrbitPeer(null)}
                      class="text-white/70 font-bold px-2 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                )}
              </Show>

              {/* WHAT OTHERS SAY ABOUT YOU Glass Bar */}
              <div>
                <p class="text-[11px] font-bold uppercase tracking-widest text-white/80 mb-1.5">
                  O QUE OS OUTROS DIZEM DE TI
                </p>
                <div class="rounded-2xl bg-white/14 backdrop-blur-md border border-white/25 grid grid-cols-3 divide-x divide-white/20 py-3 px-2 text-center">
                  <div class="px-1">
                    <p class="text-[10px] font-semibold text-white/70">Cabeça</p>
                    <p class="text-sm font-bold text-white truncate">
                      {might.getTagLabel(activeAllMight()?.topTags?.head)}
                    </p>
                  </div>
                  <div class="px-1">
                    <p class="text-[10px] font-semibold text-white/70">Corpo</p>
                    <p class="text-sm font-bold text-white truncate">
                      {might.getTagLabel(activeAllMight()?.topTags?.body)}
                    </p>
                  </div>
                  <div class="px-1">
                    <p class="text-[10px] font-semibold text-white/70">Braços</p>
                    <p class="text-sm font-bold text-white truncate">
                      {might.getTagLabel(activeAllMight()?.topTags?.arms)}
                    </p>
                  </div>
                </div>
              </div>

              {/* AI All-MighT Tagline */}
              <Show when={activeAllMight()?.tagline}>
                <div class="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-3.5 space-y-1">
                  <p class="text-sm font-bold italic text-white">
                    «{activeAllMight()?.tagline}»
                  </p>
                  <p class="text-xs text-white/85 leading-relaxed">
                    {activeAllMight()?.description}
                  </p>
                </div>
              </Show>

              {/* Circle Filter Chips */}
              <div class="space-y-2">
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCircle('all')}
                    class={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                      selectedCircle() === 'all'
                        ? 'bg-white text-[#3E0C42] shadow'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    Todos ({acceptedCount()})
                  </button>
                  <For each={[...ALL_CIRCLES]}>
                    {(circle) => (
                      <button
                        type="button"
                        onClick={() => setSelectedCircle(circle)}
                        class={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                          selectedCircle() === circle
                            ? 'bg-white text-[#3E0C42] shadow'
                            : 'bg-white/15 text-white hover:bg-white/25'
                        }`}
                      >
                        {circle}
                      </button>
                    )}
                  </For>
                </div>

                {/* Weighted Tag Cloud (Peso = contagem / total na dimensão) */}
                <Show
                  when={!circleLoading()}
                  fallback={
                    <div class="rounded-2xl bg-white/10 p-4 text-center text-xs text-white/75">
                      A calcular pesos neste círculo...
                    </div>
                  }
                >
                  <Show
                    when={(activeAllMight()?.tagCloud?.length ?? 0) > 0}
                    fallback={
                      <div class="rounded-2xl bg-white/14 border border-white/25 p-4 text-center space-y-2.5">
                        <p class="text-xs font-medium text-white/90">
                          Ainda não tens MighTs aceites em{' '}
                          <strong>{selectedCircle()}</strong>.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            might.openAskWithCircle(
                              selectedCircle() === 'all'
                                ? undefined
                                : (selectedCircle() as Circle)
                            )
                          }
                          class="px-4 py-2 rounded-xl bg-[#144B86] text-white text-xs font-bold cursor-pointer"
                        >
                          Pedir MighT em {selectedCircle()}
                        </button>
                      </div>
                    }
                  >
                    <div class="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-3.5 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-white/75">
                          Nuvem ponderada ({selectedCircle() === 'all' ? 'Todos' : selectedCircle()})
                        </span>
                        <span class="text-[10px] text-white/65">
                          Peso = contagem ÷ dimensão
                        </span>
                      </div>
                      <div class="flex flex-wrap gap-1.5">
                        <For each={(activeAllMight()?.tagCloud ?? []).slice(0, 12)}>
                          {(item) => {
                            const accent =
                              DIMENSION_META[item.dimension as Dimension]?.accentHex ??
                              '#FFFFFF';
                            return (
                              <span
                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/16 border border-white/20 text-xs font-semibold text-white"
                              >
                                <span
                                  class="h-2 w-2 rounded-full shrink-0"
                                  style={{ 'background-color': accent }}
                                />
                                <span>{item.labelPt}</span>
                                <span class="text-[10px] font-bold text-white/80 tabular-nums">
                                  {item.pct}%
                                </span>
                              </span>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>
                </Show>
              </div>
            </Show>

            {/* INLINE CONSENT INBOX (Pending MighTs — explicit Aceitar / Recusar) */}
            <Show when={pendingMights().length > 0}>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <p class="text-[11px] font-extrabold uppercase tracking-widest text-[#C6EE00]">
                    Caixa de Entrada · Consentimento ({pendingMights().length})
                  </p>
                  <span class="text-[10px] text-white/75">
                    Só entra no perfil se aceitares
                  </span>
                </div>

                <For each={pendingMights()}>
                  {(m) => (
                    <div class="rounded-2xl bg-white/18 backdrop-blur-md border border-white/30 p-3.5 space-y-2.5 shadow-md">
                      <div class="flex items-center justify-between gap-2">
                        <div>
                          <p class="text-sm font-bold text-white">{m.senderName}</p>
                          <span class="inline-block px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wide text-white">
                            {m.circle}
                          </span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyId() === m.id}
                            onClick={() => handleDecline(m.id)}
                            class="px-3 py-1.5 rounded-xl bg-black/25 hover:bg-black/40 text-white/85 text-xs font-bold cursor-pointer"
                          >
                            Recusar
                          </button>
                          <button
                            type="button"
                            disabled={busyId() === m.id}
                            onClick={() => handleAccept(m.id)}
                            class="px-3.5 py-1.5 rounded-xl bg-[#3D9061] hover:bg-[#337a52] text-white text-xs font-bold shadow cursor-pointer"
                          >
                            {busyId() === m.id ? '...' : 'Aceitar'}
                          </button>
                        </div>
                      </div>

                      <div class="flex flex-wrap gap-1.5 text-xs">
                        <span class="px-2.5 py-1 rounded-lg bg-white/15 font-semibold">
                          {might.getTagLabel(m.headTag)}
                        </span>
                        <span class="px-2.5 py-1 rounded-lg bg-white/15 font-semibold">
                          {might.getTagLabel(m.bodyTag)}
                        </span>
                        <span class="px-2.5 py-1 rounded-lg bg-white/15 font-semibold">
                          {might.getTagLabel(m.armsTag)}
                        </span>
                      </div>

                      <Show when={m.note}>
                        <p class="text-xs italic text-white/85">«{m.note}»</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            {/* YOUR MIGHT NETWORK (MIGHTIFICARAM-TE + À TUA ESPERA — Parity with 18 Profile — Purple) */}
            <Show when={profile()?.allMightUnlocked}>
              <div class="space-y-3 pt-1">
                <div>
                  <h2 class="text-lg font-extrabold text-white">A tua rede MighT</h2>
                  <p class="text-xs text-white/75">
                    Apenas pessoas que te mightificaram ou pediram que as mightifiques.
                  </p>
                </div>

                {/* MIGHTIFIED YOU */}
                <Show when={(activeAllMight()?.recentPeers.length ?? 0) > 0}>
                  <div class="space-y-2">
                    <p class="text-[11px] font-bold uppercase tracking-widest text-white/75">
                      MIGHTIFICARAM-TE · {activeAllMight()?.recentPeers.length}
                    </p>
                    <For
                      each={
                        showAllPeersList()
                          ? activeAllMight()?.recentPeers
                          : activeAllMight()?.recentPeers.slice(0, 2)
                      }
                    >
                      {(peer, idx) => (
                        <div class="rounded-2xl bg-white/14 backdrop-blur-md border border-white/20 px-3.5 py-3 flex items-center gap-3">
                          <img
                            src={
                              peer.photoUrl ||
                              FALLBACK_PEER_PHOTOS[idx() % FALLBACK_PEER_PHOTOS.length]
                            }
                            alt={peer.name}
                            class="h-11 w-11 rounded-full object-cover border border-white/40 shrink-0"
                          />
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-white truncate">
                              {peer.name}
                            </p>
                            <p class="text-[11px] text-white/80 truncate">
                              {might.getTagLabel(peer.headTag)} ·{' '}
                              {might.getTagLabel(peer.bodyTag)} ·{' '}
                              {might.getTagLabel(peer.armsTag)}
                            </p>
                            <p class="text-[11px] text-[#E6F7FB] font-semibold">
                              Mightificou-te · {peer.circle}
                            </p>
                          </div>
                        </div>
                      )}
                    </For>
                    <Show when={(activeAllMight()?.recentPeers.length ?? 0) > 2}>
                      <button
                        type="button"
                        onClick={() => setShowAllPeersList(!showAllPeersList())}
                        class="text-xs font-bold text-white hover:underline cursor-pointer"
                      >
                        {showAllPeersList()
                          ? 'Ver menos'
                          : `Ver todos (${activeAllMight()?.recentPeers.length})`}
                      </button>
                    </Show>
                  </div>
                </Show>

                {/* WAITING FOR YOU */}
                <Show when={(activeAllMight()?.waitingForYou.length ?? 0) > 0}>
                  <div class="space-y-2">
                    <p class="text-[11px] font-bold uppercase tracking-widest text-white/75">
                      À TUA ESPERA · {activeAllMight()?.waitingForYou.length}
                    </p>
                    <For each={activeAllMight()?.waitingForYou}>
                      {(peer, idx) => (
                        <div class="rounded-2xl bg-white/14 backdrop-blur-md border border-white/20 px-3.5 py-3 flex items-center gap-3">
                          <img
                            src={
                              peer.photoUrl ||
                              FALLBACK_PEER_PHOTOS[(idx() + 3) % FALLBACK_PEER_PHOTOS.length]
                            }
                            alt={peer.name}
                            class="h-11 w-11 rounded-full object-cover border border-white/40 shrink-0"
                          />
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-bold text-white truncate">
                              {peer.name}
                            </p>
                            <p class="text-[11px] text-[#E6F7FB] font-semibold">
                              Pediu-te um MighT · {peer.circle}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              might.openSendTo({
                                id: peer.id,
                                name: peer.name,
                                photoUrl: peer.photoUrl,
                                avatarUrl: peer.avatarUrl ?? undefined,
                              })
                            }
                            class="px-3.5 py-2 rounded-xl bg-[#144B86] hover:bg-[#195ca3] text-white text-xs font-bold shadow cursor-pointer shrink-0"
                          >
                            Retribuir
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                {/* Next Step CTAs */}
                <div class="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => might.navigate('/card')}
                    class="py-3.5 rounded-2xl bg-white text-[#3E0C42] font-extrabold text-xs uppercase tracking-wider shadow cursor-pointer"
                  >
                    O meu MighT Card
                  </button>
                  <button
                    type="button"
                    onClick={() => might.navigate('/descobrir')}
                    class="py-3.5 rounded-2xl bg-[#144B86] text-white font-extrabold text-xs uppercase tracking-wider shadow cursor-pointer"
                  >
                    Descobrir Pares
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
}
