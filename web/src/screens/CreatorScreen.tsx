import { For, Show, createMemo, createSignal } from 'solid-js';
import type { BodyPart, TagItem } from '../../../shared/types';
import { MightFigure } from '../components/MightFigure';
import { useMight } from '../lib/store';

interface StepMeta {
  step: 1 | 2 | 3;
  part: BodyPart;
  dimension: 'personality' | 'power' | 'character';
  eyebrow: string;
  title: string;
  prompt: string;
  ctaLabel: string;
}

const STEPS: StepMeta[] = [
  {
    step: 1,
    part: 'head',
    dimension: 'personality',
    eyebrow: 'CABEÇA · PERSONALIDADE',
    title: 'Personalidade',
    prompt: 'Qual é a melhor palavra para descrever a tua personalidade?',
    ctaLabel: 'Guardar e continuar',
  },
  {
    step: 2,
    part: 'body',
    dimension: 'power',
    eyebrow: 'CORPO · PODER (TALENTO)',
    title: 'Poder',
    prompt: 'Qual é o teu talento natural — aquilo que fazes melhor?',
    ctaLabel: 'Guardar e continuar',
  },
  {
    step: 3,
    part: 'arms',
    dimension: 'character',
    eyebrow: 'BRAÇOS · CARÁCTER (VALOR)',
    title: 'Carácter',
    prompt: 'Qual é o valor ou traço ético que mais te define?',
    ctaLabel: 'Ver o meu MighT',
  },
];

export function CreatorScreen() {
  const might = useMight();
  const existing = might.bootstrap()?.profile.selfTags;

  const [stepIdx, setStepIdx] = createSignal<0 | 1 | 2>(0);
  const [firstName, setFirstName] = createSignal(
    might.bootstrap()?.profile.firstName &&
      might.bootstrap()?.profile.firstName !== 'Visitante'
      ? might.bootstrap()!.profile.firstName
      : ''
  );
  const [headSlug, setHeadSlug] = createSignal<string>(existing?.head ?? '');
  const [bodySlug, setBodySlug] = createSignal<string>(existing?.body ?? '');
  const [armsSlug, setArmsSlug] = createSignal<string>(existing?.arms ?? '');
  const [showAll, setShowAll] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [generating, setGenerating] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const currentStep = () => STEPS[stepIdx()];

  const currentSelectionSlug = () => {
    const part = currentStep().part;
    if (part === 'head') return headSlug();
    if (part === 'body') return bodySlug();
    return armsSlug();
  };

  const setCurrentSelectionSlug = (slug: string) => {
    const part = currentStep().part;
    if (part === 'head') setHeadSlug(slug);
    else if (part === 'body') setBodySlug(slug);
    else setArmsSlug(slug);
  };

  const dimensionTags = createMemo<TagItem[]>(() => {
    const all = might.bootstrap()?.tags ?? [];
    const dim = currentStep().dimension;
    return all.filter((t) => t.dimension === dim);
  });

  const visibleTags = createMemo<TagItem[]>(() => {
    const all = dimensionTags();
    const q = search().trim().toLowerCase();
    if (q) {
      return all.filter(
        (t) =>
          t.labelPt.toLowerCase().includes(q) ||
          t.taglinePt.toLowerCase().includes(q) ||
          t.labelEn.toLowerCase().includes(q)
      );
    }
    if (showAll()) return all;
    return all.filter((t) => t.isQuickPick).slice(0, 10);
  });

  const selectedTagObj = createMemo<TagItem | undefined>(() => {
    const slug = currentSelectionSlug();
    return slug ? might.getTag(slug) : undefined;
  });

  const handleNext = async () => {
    if (!currentSelectionSlug()) {
      might.showToast('Escolhe 1 palavra para esta parte do teu MighT.', 'warning');
      return;
    }
    if (stepIdx() < 2) {
      setShowAll(false);
      setSearch('');
      setStepIdx((stepIdx() + 1) as 0 | 1 | 2);
      return;
    }

    // Final step: show LOADING MighT dark reveal and call POST /api/me/self-might
    setSubmitError(null);
    setGenerating(true);
    const minRevealDelay = new Promise((res) => window.setTimeout(res, 1150));

    try {
      await Promise.all([
        might.saveSelfMight({
          firstName: firstName().trim() || undefined,
          head: headSlug(),
          body: bodySlug(),
          arms: armsSlug(),
        }),
        minRevealDelay,
      ]);
      might.setActiveMode('self');
      might.navigate('/home');
    } catch (err) {
      setGenerating(false);
      setSubmitError(
        err instanceof Error ? err.message : 'Não foi possível gerar o teu MighT.'
      );
    }
  };

  const handleBack = () => {
    setShowAll(false);
    setSearch('');
    if (stepIdx() > 0) {
      setStepIdx((stepIdx() - 1) as 0 | 1 | 2);
    } else {
      might.navigate('/');
    }
  };

  return (
    <Show
      when={!generating()}
      fallback={
        /* LOADING MighT parity screen (#1C1E28 dark canvas) */
        <div class="fixed inset-0 z-50 bg-[#1C1E28] text-white flex flex-col items-center justify-between px-8 py-14 text-center animate-[fadeIn_200ms_ease-out]">
          <div class="mt-8 space-y-2">
            <p class="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C6EE00]">
              MighT Studio
            </p>
            <h1 class="text-3xl font-extrabold leading-tight">
              A gerar o teu
              <br />
              MighT
            </h1>
          </div>

          <div class="relative flex items-center justify-center my-6">
            <div class="absolute h-56 w-56 rounded-full bg-gradient-to-tr from-[#753065]/40 via-[#358EC0]/30 to-[#C87BCE]/40 blur-2xl animate-pulse" />
            <MightFigure
              mode="silhouette"
              loadingGradient
              animateFloat
              class="w-48 relative z-10"
              alt="A gerar a tua figura MighT"
            />
          </div>

          <div class="space-y-2 mb-6">
            <p class="text-sm font-medium text-white/75">
              {might.getTagLabel(headSlug())} · {might.getTagLabel(bodySlug())} ·{' '}
              {might.getTagLabel(armsSlug())}
            </p>
            <p class="text-xs text-white/50 tracking-wide">Por favor aguarda...</p>
          </div>
        </div>
      }
    >
      <div class="min-h-full flex flex-col px-5 pt-2 pb-6 text-[#1C1E28]">
        {/* Top Navigation + Progress */}
        <div class="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handleBack}
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/35 hover:bg-white/55 text-xs font-bold text-[#1C1E28] transition cursor-pointer"
          >
            <span>←</span>
            <span>Voltar</span>
          </button>

          <div class="flex items-center gap-1.5">
            <For each={[0, 1, 2]}>
              {(i) => (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      i === 0 ||
                      (i === 1 && headSlug()) ||
                      (i === 2 && headSlug() && bodySlug())
                    ) {
                      setStepIdx(i as 0 | 1 | 2);
                    }
                  }}
                  class={`h-2 rounded-full transition-all cursor-pointer ${
                    stepIdx() === i
                      ? 'w-7 bg-[#144B86]'
                      : 'w-2 bg-white/60'
                  }`}
                  aria-label={`Passo ${i + 1} de 3`}
                />
              )}
            </For>
            <span class="ml-1.5 text-xs font-bold text-[#144B86]">
              {currentStep().step} de 3
            </span>
          </div>
        </div>

        {/* Optional First Name Pill (if still blank or Visitante) */}
        <Show when={!firstName().trim()}>
          <div class="mb-3 rounded-2xl bg-white/40 border border-white/60 px-3.5 py-2 flex items-center gap-2">
            <span class="text-[11px] font-bold uppercase tracking-wide text-[#144B86] shrink-0">
              Nome:
            </span>
            <input
              type="text"
              maxLength={24}
              value={firstName()}
              onInput={(e) => setFirstName(e.currentTarget.value)}
              placeholder="O teu primeiro nome (opcional)"
              class="w-full bg-transparent text-sm font-semibold text-[#1C1E28] placeholder-[#1C1E28]/50 outline-none"
            />
          </div>
        </Show>

        {/* Header + Top-Right Live 3D Preview (Parity with Choose head/body/arms + Video) */}
        <div class="flex items-start justify-between gap-3 mb-4">
          <div class="flex-1 pt-1">
            <p class="text-[11px] font-extrabold uppercase tracking-widest text-[#144B86]">
              {currentStep().eyebrow}
            </p>
            <h1 class="text-2xl font-extrabold text-[#1C1E28] leading-tight mt-0.5">
              {currentStep().title}
            </h1>
            <p class="text-[13px] text-[#1C1E28]/80 leading-snug mt-1.5">
              {currentStep().prompt}
            </p>
          </div>

          <div class="shrink-0 flex flex-col items-center">
            <div class="w-28 h-34 flex items-center justify-center rounded-3xl bg-white/25 border border-white/45 p-1.5 shadow-sm">
              <MightFigure
                mode="modular"
                selection={{
                  head: headSlug(),
                  body: bodySlug(),
                  arms: armsSlug(),
                }}
                tags={might.bootstrap()?.tags ?? []}
                selectedParts={{
                  head: Boolean(headSlug()),
                  body: Boolean(bodySlug()),
                  arms: Boolean(armsSlug()),
                }}
                activePart={currentStep().part}
                class="w-24"
                alt="Pré-visualização 3D em tempo real"
              />
            </div>
          </div>
        </div>

        {/* Selected Tag PT-PT Micro-Tagline Pill */}
        <Show
          when={selectedTagObj()}
          fallback={
            <div class="mb-3 rounded-2xl bg-white/30 border border-white/40 px-3.5 py-2.5 text-xs text-[#1C1E28]/70 font-medium text-center">
              Toca numa palavra para ver a tua figura 3D mudar ao vivo
            </div>
          }
        >
          {(tag) => (
            <div class="mb-3 rounded-2xl bg-white/75 border border-white px-4 py-2.5 shadow-sm flex items-center justify-between gap-2 animate-[fadeIn_180ms_ease-out]">
              <div>
                <span class="text-xs font-extrabold uppercase tracking-wider text-[#753065]">
                  {tag().labelPt}
                </span>
                <p class="text-xs font-semibold text-[#1C1E28] italic mt-0.5">
                  «{tag().taglinePt}»
                </p>
              </div>
              <span class="text-xs font-bold text-[#144B86] shrink-0">✓</span>
            </div>
          )}
        </Show>

        {/* Search bar when expanded */}
        <Show when={showAll()}>
          <div class="mb-3">
            <input
              type="search"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              placeholder={`Pesquisar nas ${dimensionTags().length} palavras...`}
              class="w-full rounded-2xl bg-white/70 border border-white px-3.5 py-2.5 text-sm font-medium text-[#1C1E28] placeholder-[#1C1E28]/50 outline-none focus:bg-white transition"
            />
          </div>
        </Show>

        {/* 2x5 Pill Grid (Parity with Choose head/body/arms.jpg) */}
        <div class="grid grid-cols-2 gap-2.5 flex-1 content-start">
          <For each={visibleTags()}>
            {(tag) => {
              const selected = () => currentSelectionSlug() === tag.slug;
              return (
                <button
                  type="button"
                  onClick={() => setCurrentSelectionSlug(tag.slug)}
                  class={`min-h-[48px] px-3 py-2.5 rounded-2xl text-xs font-bold uppercase tracking-wide transition-all cursor-pointer border ${
                    selected()
                      ? 'bg-white text-[#1C1E28] border-white shadow-[0_6px_18px_rgba(20,75,134,0.22)] scale-[1.02]'
                      : 'bg-white/35 hover:bg-white/55 text-[#1C1E28] border-white/40'
                  }`}
                >
                  {tag.labelPt}
                </button>
              );
            }}
          </For>
        </div>

        {/* Toggle "Ver todas as 61 palavras" */}
        <div class="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setShowAll(!showAll());
              setSearch('');
            }}
            class="text-xs font-bold text-[#144B86] hover:text-[#753065] underline underline-offset-4 py-1 cursor-pointer"
          >
            {showAll()
              ? 'Mostrar só as 10 principais'
              : `Ver todas as 61 palavras (${dimensionTags().length} nesta dimensão)`}
          </button>
        </div>

        {/* Error notice */}
        <Show when={submitError()}>
          <div class="mt-2 rounded-xl bg-[#753065] text-white px-3 py-2 text-xs font-medium text-center">
            {submitError()}
          </div>
        </Show>

        {/* Primary Purple CTA */}
        <div class="mt-4">
          <button
            type="button"
            disabled={!currentSelectionSlug()}
            onClick={handleNext}
            class={`w-full py-4 rounded-[20px] font-bold text-base shadow-lg transition cursor-pointer ${
              currentSelectionSlug()
                ? 'bg-[#753065] hover:bg-[#5E2451] text-white active:scale-[0.99]'
                : 'bg-[#753065]/40 text-white/70 cursor-not-allowed'
            }`}
          >
            {currentStep().ctaLabel}
          </button>
        </div>
      </div>
    </Show>
  );
}
