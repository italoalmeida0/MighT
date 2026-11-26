import { Show, createMemo, createSignal } from 'solid-js';
import type { Circle, FigureSelection } from '../../../shared/types';
import { MightFigure } from '../components/MightFigure';
import {
  exportMightCardPng,
  type CardFormat,
  type CardTheme,
} from '../lib/cardExport';
import { useMight } from '../lib/store';

export function CardScreen() {
  const might = useMight();
  const boot = () => might.bootstrap();
  const profile = () => boot()?.profile;
  const allMight = () => boot()?.allMight;

  const isUnlocked = () => Boolean(profile()?.allMightUnlocked);
  const [format, setFormat] = createSignal<CardFormat>('portrait');
  const [theme, setTheme] = createSignal<CardTheme>(
    isUnlocked() ? 'all' : 'self'
  );
  const [exporting, setExporting] = createSignal(false);

  const activeSelection = createMemo<FigureSelection>(() => {
    if (
      (theme() === 'all' || (theme() === 'collectible' && isUnlocked())) &&
      allMight()?.topTags
    ) {
      return allMight()!.topTags!;
    }
    return (
      profile()?.selfTags ?? {
        head: 'sensivel',
        body: 'estratega',
        arms: 'liberdade',
      }
    );
  });

  const activeTagline = createMemo(() => {
    if (theme() === 'all' && allMight()?.tagline) return allMight()!.tagline;
    if (theme() === 'collectible' && isUnlocked() && allMight()?.tagline) {
      return allMight()!.tagline;
    }
    return (
      profile()?.tagline ||
      'Lê a sala, pensa três passos à frente e sabe quando sair do guião.'
    );
  });

  const activeCircles = createMemo<Circle[]>(() => {
    const c = allMight()?.circlesRepresented ?? [];
    return c.length > 0 ? c : ['Colegas', 'Amigos', 'Família'];
  });

  const figureMode = createMemo(() => {
    if (theme() === 'all') return isUnlocked() ? 'purple-hero' : 'modular';
    if (theme() === 'collectible') return isUnlocked() ? 'blue-hero' : 'modular';
    return 'modular';
  });

  const handleDownload = async () => {
    setExporting(true);
    try {
      await exportMightCardPng({
        format: format(),
        theme: theme(),
        figureStyle: figureMode(),
        firstName: profile()?.firstName || 'Tiago',
        selection: activeSelection(),
        tags: boot()?.tags ?? [],
        tagline: activeTagline(),
        circles: activeCircles(),
        score: profile()?.score ?? 180,
        acceptedCount: profile()?.acceptedCount ?? 0,
        isAllMight: theme() === 'all' || (theme() === 'collectible' && isUnlocked()),
      });
      might.showToast('MighT Card descarregado em PNG (2x HD)!', 'success');
    } catch (err) {
      might.showToast(
        err instanceof Error ? err.message : 'Erro ao exportar PNG.',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    const shareText = `O meu MighT (${might.getTagLabel(
      activeSelection().head
    )} · ${might.getTagLabel(activeSelection().body)} · ${might.getTagLabel(
      activeSelection().arms
    )}): «${activeTagline()}»`;
    const url = boot()?.inviteUrl || window.location.origin;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `MighT Card — ${profile()?.firstName}`,
          text: shareText,
          url,
        });
        return;
      } catch {
        // user cancelled or unsupported -> fall back to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      might.showToast('Resumo e link de convite copiados!', 'success');
    }
  };

  const cardBgGradient = () => {
    if (theme() === 'all' || (theme() === 'collectible' && isUnlocked())) {
      return 'bg-gradient-to-b from-[#7A3492] to-[#27072E]';
    }
    return 'bg-gradient-to-b from-[#2360C7] to-[#0A295C]';
  };

  const headTag = () => might.getTag(activeSelection().head);
  const bodyTag = () => might.getTag(activeSelection().body);
  const armsTag = () => might.getTag(activeSelection().arms);

  return (
    <div class="px-5 pt-2 pb-8 space-y-4">
      {/* Header matching 08 My card — Blue.jpg */}
      <div class="flex items-center justify-between">
        <button
          type="button"
          onClick={() => might.navigate('/home')}
          class="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-[#1C1E28] font-bold cursor-pointer"
          aria-label="Voltar"
        >
          ‹
        </button>
        <h1 class="text-base font-extrabold tracking-wider uppercase text-[#1C1E28]">
          O MEU CARTÃO
        </h1>
        <div class="w-8">
          <MightFigure mode="silhouette" activePart="head" class="w-7 opacity-60" />
        </div>
      </div>

      <p class="text-xs text-[#1C1E28]/80 text-center font-medium">
        Descarrega o PNG em alta resolução ou partilha o teu MighT com a tua rede.
      </p>

      {/* Lock Banner if < 3 accepted */}
      <Show when={!isUnlocked()}>
        <div class="rounded-2xl bg-[#753065]/90 border border-white/25 p-3.5 text-white flex items-center justify-between gap-2 shadow">
          <div class="text-xs">
            <p class="font-bold">🔒 Pré-visualização Self MighT</p>
            <p class="text-white/80">
              Faltam {Math.max(0, 3 - (profile()?.acceptedCount ?? 0))} MighTs aceites para o
              All MighT Card.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              might.setActiveMode('all');
              might.navigate('/home');
            }}
            class="px-3 py-1.5 rounded-xl bg-white text-[#753065] text-xs font-extrabold shrink-0 cursor-pointer"
          >
            Desbloquear
          </button>
        </div>
      </Show>

      {/* Format & Theme Switchers */}
      <div class="space-y-2">
        <div class="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/15 backdrop-blur-md border border-white/20">
          <button
            type="button"
            onClick={() => setFormat('portrait')}
            class={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              format() === 'portrait'
                ? 'bg-white text-[#1C1E28] shadow'
                : 'text-white/85 hover:text-white'
            }`}
          >
            Retrato (9:16)
          </button>
          <button
            type="button"
            onClick={() => setFormat('linkedin')}
            class={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              format() === 'linkedin'
                ? 'bg-white text-[#1C1E28] shadow'
                : 'text-white/85 hover:text-white'
            }`}
          >
            LinkedIn (16:9)
          </button>
        </div>

        <div class="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-black/15 backdrop-blur-md border border-white/20">
          <button
            type="button"
            onClick={() => setTheme('self')}
            class={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
              theme() === 'self' ? 'bg-[#2360C7] text-white shadow' : 'text-white/80'
            }`}
          >
            Self Azul
          </button>
          <button
            type="button"
            onClick={() => setTheme('all')}
            class={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
              theme() === 'all' ? 'bg-[#753065] text-white shadow' : 'text-white/80'
            }`}
          >
            All Roxo
          </button>
          <button
            type="button"
            onClick={() => setTheme('collectible')}
            class={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
              theme() === 'collectible'
                ? 'bg-gradient-to-r from-[#E8EEF7] to-[#B0BDD4] text-[#1C1E28] shadow'
                : 'text-white/80'
            }`}
          >
            Metálico ★
          </button>
        </div>
      </div>

      {/* LIVE COLLECTIBLE CARD PREVIEW (08 My card — Blue + Cartões MighT parity) */}
      <Show
        when={format() === 'portrait'}
        fallback={
          /* Landscape LinkedIn 16:9 Preview */
          <div
            class={`rounded-2xl overflow-hidden shadow-2xl relative p-4 text-white ${cardBgGradient()} ${
              theme() === 'collectible'
                ? 'ring-4 ring-[#DDE5F2]/85'
                : 'border border-white/25'
            }`}
          >
            <div class="flex items-center gap-3.5">
              <div class="w-24 shrink-0 rounded-2xl bg-white/10 border border-white/20 p-2 flex flex-col items-center">
                <MightFigure
                  mode={figureMode()}
                  selection={activeSelection()}
                  tags={boot()?.tags ?? []}
                  class="w-18"
                />
                <span class="mt-1 text-[9px] font-bold text-white/90">
                  ★ {profile()?.score ?? 180}
                </span>
              </div>

              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[9px] font-extrabold uppercase tracking-widest text-[#C6EE00] truncate">
                    {isUnlocked() ? 'TU, PELOS OLHOS DOS OUTROS' : 'O TEU POTENCIAL'}
                  </span>
                  <img
                    src="/assets/brand/logo-white.svg"
                    alt="MighT"
                    class="h-3.5 w-auto opacity-90 shrink-0"
                  />
                </div>
                <p class="text-lg font-extrabold leading-tight truncate">
                  {profile()?.firstName || 'Tiago'}
                </p>
                <p class="text-[11px] italic text-white/95 line-clamp-2 leading-snug">
                  «{activeTagline()}»
                </p>
                <div class="flex flex-wrap gap-1.5 pt-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/15 border-t-2 border-[#1FB5D3] text-[10px] font-bold whitespace-nowrap">
                    {headTag()?.labelPt}
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/15 border-t-2 border-[#E94B7B] text-[10px] font-bold whitespace-nowrap">
                    {bodyTag()?.labelPt}
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-lg bg-white/15 border-t-2 border-[#C6EE00] text-[10px] font-bold whitespace-nowrap">
                    {armsTag()?.labelPt}
                  </span>
                </div>
              </div>
            </div>
          </div>
        }
      >
        {/* Portrait Collectible MighT Card */}
        <div
          class={`mx-auto w-full max-w-[324px] rounded-2xl p-5 text-white shadow-[0_24px_48px_rgba(0,0,0,0.35)] relative overflow-hidden ${cardBgGradient()} ${
            theme() === 'collectible'
              ? 'ring-[6px] ring-[#E5ECF6] shadow-[0_24px_50px_rgba(0,0,0,0.45)]'
              : 'border border-white/20'
          }`}
        >
          {/* Card Top Row */}
          <div class="flex items-center justify-between mb-1">
            <img
              src="/assets/brand/logo-white.svg"
              alt="MighT"
              class="h-4 w-auto opacity-90"
            />
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold text-[#FFE58F]">
                ★ {profile()?.score ?? 180}
              </span>
              <MightFigure
                mode="silhouette"
                activePart="head"
                class="w-5 opacity-60"
              />
            </div>
          </div>

          {/* Card Center 3D Figure */}
          <div class="flex justify-center py-2">
            <MightFigure
              mode={figureMode()}
              selection={activeSelection()}
              tags={boot()?.tags ?? []}
              class="w-44"
              alt="Cartão MighT 3D"
            />
          </div>

          {/* Name */}
          <h2 class="text-2xl font-extrabold text-center tracking-tight">
            {profile()?.firstName || 'Tiago Forjaz'}
          </h2>

          {/* Divider + 3 Icon-Prefixed Traits */}
          <div class="border-y border-white/25 my-3 py-2.5 grid grid-cols-3 gap-1 text-center text-[11px] font-semibold">
            <span class="truncate">● {headTag()?.labelPt ?? '—'}</span>
            <span class="truncate">▮ {bodyTag()?.labelPt ?? '—'}</span>
            <span class="truncate">∥ {armsTag()?.labelPt ?? '—'}</span>
          </div>

          {/* #1 Badge + Synthesized Tagline */}
          <div class="flex items-center justify-between gap-3">
            <span class="h-8 w-8 rounded-full bg-white/20 text-xs font-extrabold flex items-center justify-center shrink-0">
              #1
            </span>
            <p class="text-[11px] italic text-white/92 text-right leading-snug">
              «{activeTagline()}»
            </p>
          </div>
        </div>
      </Show>

      {/* 3 Glass Trait Definition Cards (Parity with 08 My card — Blue.jpg) */}
      <div class="space-y-2.5">
        <div class="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-3.5">
          <p class="text-xs font-extrabold uppercase tracking-wider text-white">
            PERSONALIDADE{' '}
            <span class="font-semibold text-white/80 ml-1 normal-case">
              {headTag()?.labelPt}
            </span>
          </p>
          <p class="text-xs text-white/85 mt-1 leading-relaxed">
            «{headTag()?.taglinePt}»
          </p>
        </div>

        <div class="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-3.5">
          <p class="text-xs font-extrabold uppercase tracking-wider text-white">
            PODER{' '}
            <span class="font-semibold text-white/80 ml-1 normal-case">
              {bodyTag()?.labelPt}
            </span>
          </p>
          <p class="text-xs text-white/85 mt-1 leading-relaxed">
            «{bodyTag()?.taglinePt}»
          </p>
        </div>

        <div class="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-3.5">
          <p class="text-xs font-extrabold uppercase tracking-wider text-white">
            CARÁCTER{' '}
            <span class="font-semibold text-white/80 ml-1 normal-case">
              {armsTag()?.labelPt}
            </span>
          </p>
          <p class="text-xs text-white/85 mt-1 leading-relaxed">
            «{armsTag()?.taglinePt}»
          </p>
        </div>
      </div>

      {/* Primary Download PNG & Share Buttons */}
      <div class="grid grid-cols-2 gap-3 pt-1">
        <button
          type="button"
          disabled={exporting()}
          onClick={handleDownload}
          class="py-3.5 px-4 rounded-2xl bg-[#753065] hover:bg-[#5E2451] text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <span>⬇</span>
          <span>{exporting() ? 'A exportar...' : 'Descarregar PNG'}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          class="py-3.5 px-4 rounded-2xl bg-white/85 hover:bg-white text-[#1C1E28] font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <span>🔗</span>
          <span>Partilhar</span>
        </button>
      </div>

      {/* Zero Dead Ends Next Action */}
      <button
        type="button"
        onClick={() => might.navigate('/descobrir')}
        class="w-full py-3 rounded-2xl bg-white/12 hover:bg-white/20 border border-white/25 text-white text-xs font-bold tracking-wide transition cursor-pointer"
      >
        Descobrir pessoas semelhantes a ti →
      </button>
    </div>
  );
}
