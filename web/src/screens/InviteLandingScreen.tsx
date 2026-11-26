import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-solid';
import {
  ALL_CIRCLES,
  DIMENSION_META,
  type BodyPart,
  type Circle,
  type Dimension,
  type InviteInfoResponse,
  type TagItem,
} from '../../../shared/types';
import { MightFigure } from '../components/MightFigure';
import * as api from '../lib/api';
import { useMight } from '../lib/store';

const PART_TO_DIM: Record<BodyPart, Dimension> = {
  head: 'personality',
  body: 'power',
  arms: 'character',
};

const PARTS_ORDER: BodyPart[] = ['head', 'body', 'arms'];

function CircleIcon(props: { circle: Circle; class?: string }) {
  const cls = props.class ?? 'h-4 w-4';
  switch (props.circle) {
    case 'Família':
      return <Home class={cls} />;
    case 'Amigos':
      return <Heart class={cls} />;
    case 'Colegas':
      return <Briefcase class={cls} />;
    case 'Escola':
      return <GraduationCap class={cls} />;
    case 'Comunidade':
      return <Globe class={cls} />;
    case 'Clientes':
      return <Building2 class={cls} />;
  }
}

export function InviteLandingScreen(props: { code: string }) {
  const { navigate, showToast, refresh } = useMight();

  const [inviteInfo, setInviteInfo] = createSignal<InviteInfoResponse | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);

  const [senderName, setSenderName] = createSignal('');
  const [circle, setCircle] = createSignal<Circle>('Colegas');
  const [headTag, setHeadTag] = createSignal('');
  const [bodyTag, setBodyTag] = createSignal('');
  const [armsTag, setArmsTag] = createSignal('');
  const [activePart, setActivePart] = createSignal<BodyPart>('head');
  const [showAllTags, setShowAllTags] = createSignal(false);
  const [tagSearch, setTagSearch] = createSignal('');
  const [note, setNote] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);

  createEffect(() => {
    const code = props.code;
    setLoading(true);
    setLoadError(null);
    setSubmitted(false);
    void (async () => {
      try {
        const data = await api.fetchInviteInfo(code);
        setInviteInfo(data);
      } catch (err) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Este convite não foi encontrado ou expirou.'
        );
      } finally {
        setLoading(false);
      }
    })();
  });

  const tags = () => inviteInfo()?.tags ?? [];
  const requesterName = () => inviteInfo()?.requesterFirstName ?? 'este contacto';

  const getLocalTag = (slug: string) => tags().find((t) => t.slug === slug);
  const getLocalLabel = (slug: string) => getLocalTag(slug)?.labelPt ?? slug;

  const activeDim = createMemo<Dimension>(() => PART_TO_DIM[activePart()]);

  const filteredTags = createMemo<TagItem[]>(() => {
    const dim = activeDim();
    const q = tagSearch().trim().toLowerCase();
    return tags().filter((t) => {
      if (t.dimension !== dim) return false;
      if (!showAllTags() && !q && !t.isQuickPick) return false;
      if (q) {
        return (
          t.labelPt.toLowerCase().includes(q) ||
          t.taglinePt.toLowerCase().includes(q)
        );
      }
      return true;
    });
  });

  const selectedForPart = (part: BodyPart) => {
    if (part === 'head') return headTag();
    if (part === 'body') return bodyTag();
    return armsTag();
  };

  const pickTag = (part: BodyPart, slug: string) => {
    if (part === 'head') setHeadTag(slug);
    else if (part === 'body') setBodyTag(slug);
    else setArmsTag(slug);

    if (part === 'head' && !bodyTag()) setActivePart('body');
    else if (part === 'body' && !armsTag()) setActivePart('arms');
  };

  const canSubmit = createMemo(
    () =>
      senderName().trim().length >= 2 &&
      Boolean(headTag()) &&
      Boolean(bodyTag()) &&
      Boolean(armsTag()) &&
      !submitting()
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      await api.submitInviteMight(props.code, {
        senderName: senderName().trim(),
        circle: circle(),
        head: headTag(),
        body: bodyTag(),
        arms: armsTag(),
        note: note().trim() || undefined,
      });
      setSubmitted(true);
      showToast(`MighT enviado para ${requesterName()}!`, 'success');
      void refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível enviar o teu MighT.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSenderName('');
    setHeadTag('');
    setBodyTag('');
    setArmsTag('');
    setActivePart('head');
    setNote('');
    setSubmitted(false);
  };

  return (
    <div class="bg-might-blue min-h-full flex flex-col text-white">
      {/* Brand Bar */}
      <header class="px-4 pt-4 pb-2 flex items-center justify-between">
        <img
          src="/assets/brand/logo-white.svg"
          alt="MighT"
          class="h-6 w-auto drop-shadow"
        />
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/25 text-[#0F1838] text-[11px] font-bold">
          <ShieldCheck class="h-3.5 w-3.5" />
          <span>Sem criar conta · 30s</span>
        </span>
      </header>

      <div class="flex-1 overflow-y-auto px-4 pb-8">
        <Show
          when={!loading()}
          fallback={
            <div class="glass-card-strong rounded-3xl p-8 mt-6 text-center space-y-3">
              <div class="mx-auto w-24 h-28">
                <MightFigure mode="silhouette" loadingGradient class="w-full h-full" />
              </div>
              <p class="text-sm font-bold text-white">A preparar o convite MighT…</p>
            </div>
          }
        >
          <Show
            when={!loadError() && inviteInfo()}
            fallback={
              <div class="glass-card-strong rounded-3xl p-6 mt-6 text-center space-y-4">
                <h1 class="text-xl font-extrabold text-white">Convite indisponível</h1>
                <p class="text-sm text-white/85">
                  {loadError() || 'Este link de convite já não está activo.'}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  class="w-full py-3.5 px-5 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-bold text-sm cursor-pointer"
                >
                  Criar também o meu MighT
                </button>
              </div>
            }
          >
            <Show
              when={!submitted()}
              fallback={
                /* Celebratory Confirmation Screen */
                <div class="glass-card-strong rounded-3xl p-6 mt-3 text-center space-y-5">
                  <div class="mx-auto h-14 w-14 rounded-2xl bg-[#3D9061] text-white flex items-center justify-center shadow-lg">
                    <CheckCircle2 class="h-8 w-8" />
                  </div>

                  <div class="space-y-1.5">
                    <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#DBF2E5] text-[#3D9061] text-[11px] font-extrabold uppercase tracking-wider">
                      Enviado em tempo real
                    </span>
                    <h1 class="text-2xl font-extrabold text-white">
                      MighT enviado para {requesterName()}!
                    </h1>
                    <p class="text-xs text-white/90">
                      Obrigado, {senderName()}. O teu reconhecimento vai aparecer agora na caixa de entrada de {requesterName()}.
                    </p>
                  </div>

                  <div class="mx-auto w-32 h-40">
                    <MightFigure
                      mode="modular"
                      selection={{ head: headTag(), body: bodyTag(), arms: armsTag() }}
                      tags={tags()}
                      animateFloat
                      class="w-full h-full"
                    />
                  </div>

                  <div class="flex flex-wrap justify-center gap-2">
                    <span class="px-3 py-1 rounded-full bg-white text-[#1C1E28] text-xs font-bold">
                      {getLocalLabel(headTag())}
                    </span>
                    <span class="px-3 py-1 rounded-full bg-white text-[#1C1E28] text-xs font-bold">
                      {getLocalLabel(bodyTag())}
                    </span>
                    <span class="px-3 py-1 rounded-full bg-white text-[#1C1E28] text-xs font-bold">
                      {getLocalLabel(armsTag())}
                    </span>
                    <span class="px-3 py-1 rounded-full bg-white/25 text-white text-xs font-semibold">
                      Círculo: {circle()}
                    </span>
                  </div>

                  <div class="space-y-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => navigate('/criar')}
                      class="w-full py-3.5 px-5 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles class="h-4 w-4" />
                      <span>Criar também o meu MighT</span>
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      class="w-full py-2.5 px-4 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs cursor-pointer"
                    >
                      Enviar outro reconhecimento
                    </button>
                  </div>
                </div>
              }
            >
              {/* Main Accountless Recognition Form */}
              <form onSubmit={handleSubmit} class="space-y-4 pt-2">
                {/* Hero Prompt + Live 3D Figure */}
                <div class="glass-card-strong rounded-3xl p-4 flex items-center gap-4">
                  <div class="flex-1 space-y-1.5">
                    <span class="inline-block px-2.5 py-0.5 rounded-full bg-[#753065] text-white text-[10px] font-extrabold uppercase tracking-wider">
                      Convite MighT
                    </span>
                    <h1 class="text-xl font-extrabold text-white leading-tight">
                      Reconhece {requesterName()} em 3 palavras
                    </h1>
                    <p class="text-xs text-white/85 leading-relaxed">
                      Escolhe o que mais vês em {requesterName()} — personalidade, talento e carácter.
                    </p>
                  </div>
                  <div class="w-24 h-28 shrink-0">
                    <MightFigure
                      mode="modular"
                      selection={{
                        head: headTag() || 'sensitive',
                        body: bodyTag() || 'strategizer',
                        arms: armsTag() || 'freedom',
                      }}
                      tags={tags()}
                      selectedParts={{
                        head: Boolean(headTag()),
                        body: Boolean(bodyTag()),
                        arms: Boolean(armsTag()),
                      }}
                      activePart={activePart()}
                      class="w-full h-full"
                    />
                  </div>
                </div>

                {/* First Name Input */}
                <section class="glass-card-strong rounded-3xl p-4 space-y-2">
                  <label
                    for="invite-sender-name"
                    class="block text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#0F1838]"
                  >
                    1 · O teu primeiro nome
                  </label>
                  <input
                    id="invite-sender-name"
                    type="text"
                    required
                    value={senderName()}
                    onInput={(e) => setSenderName(e.currentTarget.value)}
                    placeholder="Ex.: Mariana"
                    class="w-full px-3.5 py-2.5 rounded-2xl bg-white/95 text-[#1C1E28] placeholder-[#1C1E28]/45 text-sm font-semibold border border-white focus:outline-none focus:ring-2 focus:ring-[#753065]"
                  />
                  <p class="text-[11px] text-white/80">
                    Privacidade: pedimos apenas o teu primeiro nome, sem registo nem password.
                  </p>
                </section>

                {/* Circle Picker */}
                <section class="glass-card-strong rounded-3xl p-4 space-y-2.5">
                  <span class="block text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
                    2 · Qual é o vosso círculo?
                  </span>
                  <div class="grid grid-cols-3 gap-2">
                    <For each={ALL_CIRCLES}>
                      {(c) => {
                        const active = () => circle() === c;
                        return (
                          <button
                            type="button"
                            onClick={() => setCircle(c)}
                            class={`py-2.5 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                              active()
                                ? 'bg-white text-[#753065] border-white shadow-md'
                                : 'bg-white/18 text-white border-white/30 hover:bg-white/28'
                            }`}
                          >
                            <CircleIcon circle={c} class="h-4 w-4" />
                            <span>{c}</span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </section>

                {/* 3-Word Picker */}
                <section class="glass-card-strong rounded-3xl p-4 space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
                      3 · Escolhe as 3 palavras
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllTags((v) => !v)}
                      class="text-[11px] font-bold text-white underline underline-offset-2 cursor-pointer"
                    >
                      {showAllTags() ? 'Ver top 10' : 'Ver todas as 61'}
                    </button>
                  </div>

                  {/* 3 Part Switcher */}
                  <div class="grid grid-cols-3 gap-1.5">
                    <For each={PARTS_ORDER}>
                      {(part) => {
                        const dim = PART_TO_DIM[part];
                        const meta = DIMENSION_META[dim];
                        const picked = () => selectedForPart(part);
                        const isActive = () => activePart() === part;
                        return (
                          <button
                            type="button"
                            onClick={() => setActivePart(part)}
                            class={`rounded-2xl p-2 text-left border transition-all cursor-pointer ${
                              isActive()
                                ? 'bg-[#144B86] text-white border-white shadow'
                                : picked()
                                  ? 'bg-white/25 text-white border-white/40'
                                  : 'bg-white/10 text-white/80 border-white/20'
                            }`}
                          >
                            <div class="text-[10px] font-bold uppercase opacity-85">
                              {meta.partLabelPt}
                            </div>
                            <div class="text-xs font-extrabold truncate mt-0.5">
                              {picked() ? getLocalLabel(picked()) : meta.labelPt}
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>

                  {/* Quick Filter */}
                  <div class="relative">
                    <Search class="h-3.5 w-3.5 text-white/70 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={tagSearch()}
                      onInput={(e) => setTagSearch(e.currentTarget.value)}
                      placeholder={`Procurar em ${DIMENSION_META[activeDim()].labelPt.toLowerCase()}…`}
                      class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/18 border border-white/25 text-xs text-white placeholder-white/65 focus:outline-none"
                    />
                  </div>

                  {/* Pills */}
                  <div class="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
                    <For each={filteredTags()}>
                      {(tag) => {
                        const isPicked = () => selectedForPart(activePart()) === tag.slug;
                        return (
                          <button
                            type="button"
                            onClick={() => pickTag(activePart(), tag.slug)}
                            class={`px-3 py-2 rounded-xl text-xs font-bold text-left flex items-center justify-between gap-1 cursor-pointer ${
                              isPicked() ? 'glass-pill-active' : 'glass-pill text-white'
                            }`}
                          >
                            <span class="truncate">{tag.labelPt}</span>
                            <Show when={isPicked()}>
                              <Check class="h-3.5 w-3.5 shrink-0 text-[#753065]" />
                            </Show>
                          </button>
                        );
                      }}
                    </For>
                  </div>

                  <Show when={getLocalTag(selectedForPart(activePart()))}>
                    {(t) => (
                      <p class="text-xs text-white/90 bg-[#0F1838]/30 rounded-xl px-3 py-2">
                        <strong>{t().labelPt}:</strong> «{t().taglinePt}»
                      </p>
                    )}
                  </Show>
                </section>

                {/* Optional Note + Submit */}
                <section class="glass-card rounded-3xl p-4 space-y-3">
                  <textarea
                    rows={2}
                    maxLength={140}
                    value={note()}
                    onInput={(e) => setNote(e.currentTarget.value)}
                    placeholder={`Nota opcional para ${requesterName()}…`}
                    class="w-full px-3.5 py-2.5 rounded-2xl bg-white/90 text-[#1C1E28] placeholder-[#1C1E28]/45 text-xs font-medium border border-white focus:outline-none resize-none"
                  />

                  <button
                    type="submit"
                    disabled={!canSubmit()}
                    class={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                      canSubmit()
                        ? 'bg-[#753065] hover:bg-[#8B3A78] text-white cursor-pointer active:scale-[0.98]'
                        : 'bg-white/25 text-white/60 cursor-not-allowed'
                    }`}
                  >
                    <Send class="h-4 w-4" />
                    <span>
                      {submitting()
                        ? 'A enviar…'
                        : `Enviar MighT para ${requesterName()}`}
                    </span>
                  </button>
                </section>
              </form>
            </Show>
          </Show>
        </Show>
      </div>
    </div>
  );
}
