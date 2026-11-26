import { For, Show, createEffect, createMemo, createSignal } from 'solid-js';
import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  ExternalLink,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Inbox,
  Lock,
  QrCode,
  Search,
  Send,
  Share2,
  Sparkles,
} from 'lucide-solid';
import {
  ALL_CIRCLES,
  DIMENSION_META,
  type BodyPart,
  type Circle,
  type Dimension,
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

export function SendAskScreen(props: { mode: 'send' | 'ask' }) {
  const {
    bootstrap,
    navigate,
    setActiveMode,
    preselectedPeer,
    setPreselectedPeer,
    preselectedCircle,
    setPreselectedCircle,
    getTag,
    getTagLabel,
    sendMight,
    showToast,
  } = useMight();

  const [tab, setTab] = createSignal<'send' | 'ask'>(props.mode);
  const [recipientName, setRecipientName] = createSignal('');
  const [recipientId, setRecipientId] = createSignal<string | undefined>(undefined);
  const [circle, setCircle] = createSignal<Circle>('Colegas');
  const [headTag, setHeadTag] = createSignal('');
  const [bodyTag, setBodyTag] = createSignal('');
  const [armsTag, setArmsTag] = createSignal('');
  const [activePart, setActivePart] = createSignal<BodyPart>('head');
  const [showAllTags, setShowAllTags] = createSignal(false);
  const [tagSearch, setTagSearch] = createSignal('');
  const [note, setNote] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [sendSuccess, setSendSuccess] = createSignal<{
    recipient: string;
    unlockedPedeNow: boolean;
  } | null>(null);
  const [copiedLink, setCopiedLink] = createSignal(false);

  // Sync route mode prop when user switches between #/enviar and #/pedir
  createEffect(() => {
    setTab(props.mode);
  });

  // Consume preselectedPeer (from Descobrir or À tua espera)
  createEffect(() => {
    const peer = preselectedPeer();
    if (peer) {
      setRecipientName(peer.name);
      setRecipientId(peer.id);
      setTab('send');
      setSendSuccess(null);
      setPreselectedPeer(null);
    }
  });

  // Consume preselectedCircle
  createEffect(() => {
    const c = preselectedCircle();
    if (c) {
      setCircle(c);
      setPreselectedCircle(null);
    }
  });

  const profile = () => bootstrap()?.profile;
  const tags = () => bootstrap()?.tags ?? [];
  const waitingPeers = () => bootstrap()?.allMight.waitingForYou ?? [];
  const quickPeers = () => bootstrap()?.quickPeers ?? [];
  const pedeUnlocked = () => Boolean(profile()?.pedeUnlocked || (profile()?.sentCount ?? 0) >= 1);

  const mergedPeerChips = createMemo(() => {
    const seen = new Set<string>();
    const list: {
      id: string;
      name: string;
      subtitle: string;
      avatarUrl: string;
      isWaiting: boolean;
      circle?: Circle;
    }[] = [];

    for (const wp of waitingPeers()) {
      const key = wp.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: wp.id,
        name: wp.name,
        subtitle: `À espera · ${wp.circle}`,
        avatarUrl: wp.photoUrl || wp.avatarUrl || '/assets/figures/heroes/avatar-01.png',
        isWaiting: true,
        circle: wp.circle,
      });
    }

    for (const qp of quickPeers()) {
      const key = qp.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: qp.id,
        name: qp.name,
        subtitle: qp.role,
        avatarUrl: qp.photoUrl || qp.avatarUrl || '/assets/figures/heroes/avatar-02.png',
        isWaiting: false,
      });
    }

    return list.slice(0, 12);
  });

  const activeDimension = createMemo<Dimension>(() => PART_TO_DIM[activePart()]);

  const visibleTagsForPart = createMemo<TagItem[]>(() => {
    const dim = activeDimension();
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

  const selectedSlugForPart = (part: BodyPart) => {
    if (part === 'head') return headTag();
    if (part === 'body') return bodyTag();
    return armsTag();
  };

  const handleSelectTag = (part: BodyPart, slug: string) => {
    if (part === 'head') setHeadTag(slug);
    else if (part === 'body') setBodyTag(slug);
    else setArmsTag(slug);

    // Smoothly advance to the next unselected part for < 2 min speed
    if (part === 'head' && !bodyTag()) setActivePart('body');
    else if (part === 'body' && !armsTag()) setActivePart('arms');
  };

  const activeTagItem = createMemo(() => {
    const slug = selectedSlugForPart(activePart());
    return slug ? getTag(slug) : undefined;
  });

  const canSubmitSend = createMemo(
    () =>
      recipientName().trim().length >= 2 &&
      Boolean(headTag()) &&
      Boolean(bodyTag()) &&
      Boolean(armsTag()) &&
      !submitting()
  );

  const handleSendSubmit = async (e: Event) => {
    e.preventDefault();
    if (!canSubmitSend()) return;

    const wasPedeUnlocked = pedeUnlocked();
    const targetName = recipientName().trim();
    setSubmitting(true);
    try {
      const updated = await sendMight({
        recipientName: targetName,
        recipientId: recipientId(),
        circle: circle(),
        head: headTag(),
        body: bodyTag(),
        arms: armsTag(),
        note: note().trim() || undefined,
      });
      const unlockedNow = !wasPedeUnlocked && Boolean(updated.profile.pedeUnlocked);
      setSendSuccess({
        recipient: targetName,
        unlockedPedeNow: unlockedNow,
      });
      showToast(
        unlockedNow
          ? `MighT enviado para ${targetName}! PEDE MIGHT desbloqueado!`
          : `MighT enviado para ${targetName}!`,
        'success'
      );
      setRecipientName('');
      setRecipientId(undefined);
      setHeadTag('');
      setBodyTag('');
      setArmsTag('');
      setActivePart('head');
      setNote('');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível enviar o MighT.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inviteFullUrl = createMemo(() => {
    const code = profile()?.inviteCode;
    if (!code) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/#/convite/${code}`;
    }
    return bootstrap()?.inviteUrl || `#/convite/${code}`;
  });

  const qrImageSrc = createMemo(() => {
    const url = inviteFullUrl();
    return url ? api.getQrUrl(url) : '';
  });

  const handleCopyLink = async () => {
    const url = inviteFullUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      showToast('Link de convite copiado!', 'success');
      window.setTimeout(() => setCopiedLink(false), 2400);
    } catch {
      showToast('Copia o link manualmente abaixo.', 'info');
    }
  };

  const handleShareLink = async () => {
    const url = inviteFullUrl();
    if (!url) return;
    const name = profile()?.firstName || 'mim';
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Reconhece ${name} no MighT`,
          text: `Escolhe 3 palavras para o MighT de ${name} (sem criar conta, demora 30 segundos):`,
          url,
        });
        return;
      } catch {
        // fallback to clipboard if share cancelled or unsupported
      }
    }
    await handleCopyLink();
  };

  const resetForAnother = () => {
    setSendSuccess(null);
  };

  return (
    <div class="bg-might-blue min-h-full flex flex-col text-white">
      {/* Top Header */}
      <header class="px-4 pt-4 pb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/home')}
          class="h-10 w-10 rounded-full glass-pill flex items-center justify-center text-[#0F1838] cursor-pointer"
          aria-label="Voltar ao perfil"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>

        <div class="text-center">
          <h1 class="text-sm font-extrabold tracking-[0.14em] uppercase text-[#0F1838]">
            MighT Social
          </h1>
          <p class="text-[11px] font-medium text-[#0F1838]/75">
            {tab() === 'send'
              ? 'Passo 2A · Reconhece alguém'
              : 'Passo 2B · Convida quem te conhece'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveMode('all');
            navigate('/home');
          }}
          class="relative h-10 w-10 rounded-full glass-pill flex items-center justify-center text-[#0F1838] cursor-pointer"
          aria-label="Ver Caixa de Entrada"
          title="Caixa de Entrada"
        >
          <Inbox class="h-4 w-4" />
          <Show when={(profile()?.pendingCount ?? 0) > 0}>
            <span class="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-[#753065] text-white text-[10px] font-bold flex items-center justify-center shadow">
              {profile()?.pendingCount}
            </span>
          </Show>
        </button>
      </header>

      {/* Segmented Switcher: MANDA MIGHT vs PEDE MIGHT */}
      <div class="px-4 pt-2 pb-3">
        <div class="p-1 rounded-2xl bg-[#0F1838]/15 backdrop-blur-md border border-white/30 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setTab('send');
              navigate('/enviar');
            }}
            class={`py-2.5 px-3 rounded-xl text-xs font-extrabold tracking-wide transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab() === 'send'
                ? 'bg-[#753065] text-white shadow-md'
                : 'text-[#0F1838]/80 hover:bg-white/25'
            }`}
          >
            <Send class="h-3.5 w-3.5" />
            <span>MANDA MIGHT</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('ask');
              navigate('/pedir');
            }}
            class={`py-2.5 px-3 rounded-xl text-xs font-extrabold tracking-wide transition-all flex flex-col items-center justify-center cursor-pointer ${
              tab() === 'ask'
                ? 'bg-[#144B86] text-white shadow-md'
                : 'text-[#0F1838]/80 hover:bg-white/25'
            }`}
          >
            <span class="flex items-center gap-1.5">
              <Show when={!pedeUnlocked()} fallback={<Share2 class="h-3.5 w-3.5 text-[#C6EE00]" />}>
                <Lock class="h-3.5 w-3.5" />
              </Show>
              <span>PEDE MIGHT</span>
            </span>
            <Show when={!pedeUnlocked()}>
              <span class="text-[9px] font-semibold opacity-80 leading-tight mt-0.5">
                Só depois de enviares
              </span>
            </Show>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div class="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
        <Show
          when={tab() === 'send'}
          fallback={
            /* ======================= PEDE MIGHT TAB (Passo 2B) ======================= */
            <Show
              when={pedeUnlocked()}
              fallback={
                /* Locked Give-to-Get State */
                <div class="glass-card-strong rounded-3xl p-6 text-center space-y-4 mt-2">
                  <div class="mx-auto h-16 w-16 rounded-2xl bg-[#753065]/25 border border-white/40 flex items-center justify-center text-[#753065]">
                    <Lock class="h-8 w-8 text-white" />
                  </div>
                  <div class="space-y-2">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/25 text-[#0F1838] text-[11px] font-bold uppercase tracking-wider">
                      Give-to-Get · Só depois de enviares
                    </span>
                    <h2 class="text-xl font-extrabold text-white leading-snug">
                      PEDE MIGHT bloqueado
                    </h2>
                    <p class="text-sm text-white/90 leading-relaxed">
                      Para receberes, começa por reconhecer alguém. Envia o teu 1.º MighT para desbloqueares o teu link de convite.
                    </p>
                  </div>

                  <div class="rounded-2xl bg-[#0F1838]/25 border border-white/20 p-3.5 text-left space-y-2 text-xs text-white/90">
                    <div class="flex items-center gap-2">
                      <span class="h-5 w-5 rounded-full bg-[#753065] text-white font-bold flex items-center justify-center text-[11px]">
                        1
                      </span>
                      <span>Escolhe 1 pessoa e o vosso círculo social</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="h-5 w-5 rounded-full bg-[#144B86] text-white font-bold flex items-center justify-center text-[11px]">
                        2
                      </span>
                      <span>Reconhece-a em 3 palavras (Cabeça · Corpo · Braços)</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="h-5 w-5 rounded-full bg-[#3D9061] text-white font-bold flex items-center justify-center text-[11px]">
                        3
                      </span>
                      <span>O teu QR Code e link sem conta ficam logo activos!</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTab('send');
                      navigate('/enviar');
                    }}
                    class="w-full py-3.5 px-5 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                  >
                    <Send class="h-4 w-4" />
                    <span>Enviar o meu 1.º MighT</span>
                  </button>
                </div>
              }
            >
              {/* Unlocked PEDE MIGHT State */}
              <div class="space-y-4">
                {/* Live Status Pill */}
                <div class="glass-card rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C6EE00] opacity-75" />
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#C6EE00]" />
                    </span>
                    <span class="text-xs font-semibold text-white">
                      À escuta de MighTs em tempo real ·{' '}
                      <strong>
                        {profile()?.acceptedCount ?? 0}/3 aceites
                      </strong>
                    </span>
                  </div>
                  <Show when={(profile()?.pendingCount ?? 0) > 0}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('all');
                        navigate('/home');
                      }}
                      class="px-2.5 py-1 rounded-full bg-[#753065] text-white text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      {profile()?.pendingCount} pendente{(profile()?.pendingCount ?? 0) > 1 ? 's' : ''}
                    </button>
                  </Show>
                </div>

                {/* QR Code Card */}
                <div class="glass-card-strong rounded-3xl p-5 text-center space-y-4">
                  <div class="space-y-1">
                    <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/25 text-[#0F1838] text-[11px] font-bold">
                      <QrCode class="h-3.5 w-3.5" />
                      <span>Sem criar conta · 30 segundos · só primeiro nome</span>
                    </div>
                    <h2 class="text-lg font-extrabold text-white pt-1">
                      Mostra o QR ou envia o teu link
                    </h2>
                    <p class="text-xs text-white/85">
                      Quem responder escolhe 3 palavras sobre ti — e tu decides se aceitas no teu All MighT.
                    </p>
                  </div>

                  {/* Scannable QR Container */}
                  <div class="mx-auto w-48 h-48 rounded-2xl bg-white p-3 shadow-xl flex items-center justify-center">
                    <Show
                      when={qrImageSrc()}
                      fallback={<div class="text-xs text-[#1C1E28]/60">A gerar QR…</div>}
                    >
                      <img
                        src={qrImageSrc()}
                        alt={`QR Code de convite de ${profile()?.firstName ?? 'MighT'}`}
                        class="w-full h-full object-contain"
                      />
                    </Show>
                  </div>

                  {/* Link Box */}
                  <div class="rounded-2xl bg-[#0F1838]/35 border border-white/25 px-3.5 py-2.5 flex items-center justify-between gap-2 text-left">
                    <span class="text-xs font-mono text-white/95 truncate">
                      {inviteFullUrl() || `#/convite/${profile()?.inviteCode}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      class="shrink-0 px-3 py-1.5 rounded-xl bg-white text-[#1C1E28] text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-white/90 transition-colors"
                    >
                      <Show when={copiedLink()} fallback={<Copy class="h-3.5 w-3.5" />}>
                        <Check class="h-3.5 w-3.5 text-[#3D9061]" />
                      </Show>
                      <span>{copiedLink() ? 'Copiado!' : 'Copiar link'}</span>
                    </button>
                  </div>

                  {/* Share & Quick Actions */}
                  <div class="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={handleShareLink}
                      class="py-3 px-4 rounded-2xl bg-[#753065] hover:bg-[#8B3A78] text-white font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 class="h-4 w-4" />
                      <span>Partilhar convite</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/convite/${profile()?.inviteCode}`)}
                      class="py-3 px-4 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/35 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink class="h-4 w-4" />
                      <span>Testar link</span>
                    </button>
                  </div>
                </div>

                {/* Zero dead-end footer actions */}
                <div class="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode('all');
                      navigate('/home');
                    }}
                    class="glass-card rounded-2xl p-3.5 text-left hover:bg-white/25 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center justify-between text-white">
                      <span class="text-xs font-extrabold uppercase tracking-wide">
                        Caixa de Entrada
                      </span>
                      <Inbox class="h-4 w-4 text-[#C6EE00]" />
                    </div>
                    <p class="text-[11px] text-white/80 mt-1">
                      Aceitar ou recusar MighTs recebidos
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('send')}
                    class="glass-card rounded-2xl p-3.5 text-left hover:bg-white/25 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center justify-between text-white">
                      <span class="text-xs font-extrabold uppercase tracking-wide">
                        Enviar mais
                      </span>
                      <Send class="h-4 w-4 text-[#1FB5D3]" />
                    </div>
                    <p class="text-[11px] text-white/80 mt-1">
                      Já enviaste {profile()?.sentCount ?? 0} MighT{(profile()?.sentCount ?? 0) === 1 ? '' : 's'}
                    </p>
                  </button>
                </div>
              </div>
            </Show>
          }
        >
          {/* ======================= MANDA MIGHT TAB (Passo 2A) ======================= */}
          <Show when={sendSuccess()}>
            {(info) => (
              <div class="glass-card-strong rounded-3xl p-5 space-y-3 border-2 border-[#C6EE00]/60">
                <div class="flex items-start gap-3">
                  <div class="h-10 w-10 rounded-2xl bg-[#3D9061] text-white flex items-center justify-center shrink-0 shadow">
                    <CheckCircle2 class="h-5 w-5" />
                  </div>
                  <div class="space-y-1">
                    <h2 class="text-base font-extrabold text-white">
                      MighT enviado para {info().recipient}!
                    </h2>
                    <Show
                      when={info().unlockedPedeNow}
                      fallback={
                        <p class="text-xs text-white/85">
                          O reconhecimento faz a rede crescer. Podes enviar outro ou pedir MighTs para ti.
                        </p>
                      }
                    >
                      <p class="text-xs font-bold text-[#C6EE00] flex items-center gap-1">
                        <Sparkles class="h-3.5 w-3.5" />
                        <span>PEDE MIGHT desbloqueado! Já podes partilhar o teu QR Code.</span>
                      </p>
                    </Show>
                  </div>
                </div>

                <div class="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSendSuccess(null);
                      setTab('ask');
                      navigate('/pedir');
                    }}
                    class="flex-1 py-2.5 px-3 rounded-xl bg-[#144B86] hover:bg-[#195CA5] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <QrCode class="h-3.5 w-3.5" />
                    <span>Ir para PEDE MIGHT</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetForAnother}
                    class="py-2.5 px-3 rounded-xl bg-white/25 hover:bg-white/35 text-white text-xs font-bold cursor-pointer"
                  >
                    Enviar outro
                  </button>
                </div>
              </div>
            )}
          </Show>

          <form onSubmit={handleSendSubmit} class="space-y-4">
            {/* Step 1: Pick Person */}
            <section class="glass-card-strong rounded-3xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
                  1 · Escolhe uma pessoa
                </span>
                <span class="text-[11px] font-semibold text-[#0F1838]/75">
                  Só primeiro nome ou colega
                </span>
              </div>

              <input
                type="text"
                value={recipientName()}
                onInput={(e) => {
                  setRecipientName(e.currentTarget.value);
                  setRecipientId(undefined);
                }}
                placeholder="Escreve o primeiro nome (ex.: Sofia, Duarte…)"
                class="w-full px-3.5 py-2.5 rounded-2xl bg-white/90 text-[#1C1E28] placeholder-[#1C1E28]/45 text-sm font-semibold border border-white focus:outline-none focus:ring-2 focus:ring-[#753065]"
              />

              {/* Quick Horizontal Peer Chips */}
              <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <For each={mergedPeerChips()}>
                  {(peer) => {
                    const isSelected = () =>
                      recipientName().trim().toLowerCase() === peer.name.toLowerCase();
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientName(peer.name);
                          setRecipientId(peer.id);
                          if (peer.circle) setCircle(peer.circle);
                        }}
                        class={`shrink-0 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                          isSelected()
                            ? 'bg-white text-[#1C1E28] border-white shadow-md font-bold'
                            : 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                        }`}
                      >
                        <img
                          src={peer.avatarUrl}
                          alt={peer.name}
                          class="h-6 w-6 rounded-full object-cover bg-white/40"
                        />
                        <div class="text-left leading-tight">
                          <div class="text-xs font-bold whitespace-nowrap">{peer.name}</div>
                          <Show when={peer.isWaiting}>
                            <div
                              class={`text-[9px] font-bold ${
                                isSelected() ? 'text-[#753065]' : 'text-[#C6EE00]'
                              }`}
                            >
                              {peer.subtitle}
                            </div>
                          </Show>
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>
            </section>

            {/* Step 2: Pick Circle */}
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
                            ? 'bg-white text-[#753065] border-white shadow-md scale-[1.02]'
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

            {/* Step 3: Pick 3 Tags with Live 3D MightFigure */}
            <section class="glass-card-strong rounded-3xl p-4 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <div class="space-y-1 flex-1 min-w-0">
                  <span class="block text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#0F1838]">
                    3 · Escolhe 3 palavras
                  </span>
                  <p class="text-xs text-white/90 leading-snug">
                    1 Cabeça, 1 Corpo e 1 Braços — a figura 3D ganha vida em tempo real.
                  </p>
                  <Show when={activeTagItem()}>
                    {(tag) => (
                      <div class="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#0F1838]/35 text-[11px] text-white">
                        <span class="font-bold">{tag().labelPt}:</span>
                        <span class="italic text-white/85">«{tag().taglinePt}»</span>
                      </div>
                    )}
                  </Show>
                </div>

                <div class="w-20 h-24 shrink-0 rounded-2xl bg-white/20 border border-white/35 p-1 flex items-center justify-center">
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
                    alt="Pré-visualização do MighT a enviar"
                  />
                </div>
              </div>

              {/* 3 Dimension Slot Tabs */}
              <div class="grid grid-cols-3 gap-1.5">
                <For each={PARTS_ORDER}>
                  {(part) => {
                    const dim = PART_TO_DIM[part];
                    const meta = DIMENSION_META[dim];
                    const chosenSlug = () => selectedSlugForPart(part);
                    const isActive = () => activePart() === part;
                    return (
                      <button
                        type="button"
                        onClick={() => setActivePart(part)}
                        class={`rounded-2xl p-2 text-left border transition-all cursor-pointer ${
                          isActive()
                            ? 'bg-[#144B86] text-white border-white shadow-md'
                            : chosenSlug()
                              ? 'bg-white/25 text-white border-white/40'
                              : 'bg-white/10 text-white/80 border-white/20'
                        }`}
                      >
                        <div class="text-[10px] font-bold uppercase tracking-wider opacity-85">
                          {meta.partLabelPt}
                        </div>
                        <div class="text-xs font-extrabold truncate mt-0.5">
                          {chosenSlug() ? getTagLabel(chosenSlug()) : meta.labelPt}
                        </div>
                      </button>
                    );
                  }}
                </For>
              </div>

              {/* Search + Show all 61 toggle */}
              <div class="flex items-center justify-between gap-2">
                <div class="relative flex-1">
                  <Search class="h-3.5 w-3.5 text-white/70 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tagSearch()}
                    onInput={(e) => setTagSearch(e.currentTarget.value)}
                    placeholder={`Filtrar ${DIMENSION_META[activeDimension()].labelPt.toLowerCase()}…`}
                    class="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/18 border border-white/25 text-xs text-white placeholder-white/65 focus:outline-none focus:bg-white/25"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllTags((v) => !v)}
                  class="px-2.5 py-1.5 rounded-xl bg-white/18 hover:bg-white/30 border border-white/25 text-[11px] font-bold text-white cursor-pointer shrink-0"
                >
                  {showAllTags() ? 'Top 10' : 'Ver todas (61)'}
                </button>
              </div>

              {/* Tag Grid */}
              <div class="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-0.5">
                <For each={visibleTagsForPart()}>
                  {(tag) => {
                    const isPicked = () => selectedSlugForPart(activePart()) === tag.slug;
                    return (
                      <button
                        type="button"
                        onClick={() => handleSelectTag(activePart(), tag.slug)}
                        class={`px-3 py-2 rounded-xl text-xs font-bold text-left transition-all cursor-pointer flex items-center justify-between gap-1 ${
                          isPicked()
                            ? 'glass-pill-active'
                            : 'glass-pill text-white'
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
            </section>

            {/* Step 4: Optional Note + Primary CTA */}
            <section class="glass-card rounded-3xl p-4 space-y-3">
              <div class="flex items-center justify-between">
                <label
                  for="might-send-note"
                  class="text-[11px] font-extrabold tracking-[0.12em] uppercase text-white/90"
                >
                  4 · Nota curta (opcional)
                </label>
                <span class="text-[11px] text-white/70">{note().length}/140</span>
              </div>
              <textarea
                id="might-send-note"
                rows={2}
                maxLength={140}
                value={note()}
                onInput={(e) => setNote(e.currentTarget.value)}
                placeholder="Ex.: Obrigado por transformares ideias soltas em planos concretos."
                class="w-full px-3.5 py-2.5 rounded-2xl bg-white/90 text-[#1C1E28] placeholder-[#1C1E28]/45 text-xs font-medium border border-white focus:outline-none focus:ring-2 focus:ring-[#753065] resize-none"
              />

              <button
                type="submit"
                disabled={!canSubmitSend()}
                class={`w-full py-3.5 px-5 rounded-2xl font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                  canSubmitSend()
                    ? 'bg-[#753065] hover:bg-[#8B3A78] text-white cursor-pointer active:scale-[0.98]'
                    : 'bg-white/25 text-white/60 cursor-not-allowed'
                }`}
              >
                <Send class="h-4 w-4" />
                <span>
                  {submitting()
                    ? 'A enviar MighT…'
                    : recipientName().trim()
                      ? `Enviar MighT para ${recipientName().trim()}`
                      : 'Enviar MighT'}
                </span>
              </button>
            </section>
          </form>
        </Show>
      </div>
    </div>
  );
}
