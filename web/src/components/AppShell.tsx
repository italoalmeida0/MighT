import { For, Show, createEffect, createMemo, on, type ParentComponent } from 'solid-js';
import { useMight } from '../lib/store';

interface NavTab {
  id: string;
  label: string;
  path: string;
  match: (route: string) => boolean;
}

const cleanRoute = (r: string) => r.split('?')[0] ?? r;

const NAV_TABS: NavTab[] = [
  {
    id: 'home',
    label: 'MighT',
    path: '/home',
    match: (r) => {
      const c = cleanRoute(r);
      return c === '/home' || c === '/card' || c === '/sobre';
    },
  },
  {
    id: 'send',
    label: 'Enviar/Pedir',
    path: '/enviar',
    match: (r) => {
      const c = cleanRoute(r);
      return c === '/enviar' || c === '/pedir';
    },
  },
  {
    id: 'stats',
    label: 'Stats',
    path: '/stats',
    match: (r) => cleanRoute(r) === '/stats',
  },
  {
    id: 'discover',
    label: 'Descobrir',
    path: '/descobrir',
    match: (r) => {
      const c = cleanRoute(r);
      return c === '/descobrir' || c === '/mapa';
    },
  },
  {
    id: 'roles',
    label: 'Funções',
    path: '/funcoes',
    match: (r) => cleanRoute(r) === '/funcoes',
  },
];

function TabIcon(props: { id: string; active: boolean }) {
  const stroke = () => (props.active ? 'currentColor' : 'currentColor');
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke()}
      stroke-width={props.active ? '2.2' : '1.9'}
      stroke-linecap="round"
      stroke-linejoin="round"
      class="h-5 w-5"
    >
      <Show when={props.id === 'home'}>
        <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
        <path d="M5 19h14" />
      </Show>
      <Show when={props.id === 'send'}>
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </Show>
      <Show when={props.id === 'stats'}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-6" />
        <path d="M22 20V8" />
      </Show>
      <Show when={props.id === 'discover'}>
        <circle cx="12" cy="12" r="9" />
        <polygon points="15.5 8.5 13.6 13.6 8.5 15.5 10.4 10.4 15.5 8.5" />
      </Show>
      <Show when={props.id === 'roles'}>
        <rect x="3" y="7" width="18" height="13" rx="2.5" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M3 13h18" />
      </Show>
    </svg>
  );
}

export const AppShell: ParentComponent = (props) => {
  const might = useMight();
  let scrollRef: HTMLElement | undefined;

  createEffect(
    on(
      () => [might.route(), might.activeMode()],
      () => {
        if (scrollRef) scrollRef.scrollTop = 0;
      }
    )
  );

  const isInvite = createMemo(() => might.route().startsWith('/convite/'));
  const isOnboardingOrCreator = createMemo(() => {
    const r = might.route();
    return r === '/' || r === '/onboarding' || r === '/criar';
  });

  const showBottomNav = createMemo(() => {
    if (isInvite() || isOnboardingOrCreator()) return false;
    return Boolean(might.bootstrap()?.profile.selfTags);
  });

  const pendingCount = createMemo(() => might.bootstrap()?.profile.pendingCount ?? 0);
  const acceptedCount = createMemo(() => might.bootstrap()?.profile.acceptedCount ?? 0);

  const shellBackground = createMemo(() => {
    const r = might.route();
    if (r === '/criar' || r === '/sobre' || isInvite()) {
      return 'bg-[#A9C6DE] text-[#1C1E28]';
    }
    if (r === '/home' && might.activeMode() === 'all') {
      return 'bg-gradient-to-b from-[#C87BCE] to-[#3E0C42] text-white';
    }
    return 'bg-gradient-to-b from-[#D1EAFF] via-[#5A91C0] to-[#023460] text-white';
  });

  const canExpand = createMemo(() => {
    const r = might.route();
    return r === '/descobrir' || r === '/mapa';
  });

  return (
    <div class="phone-stage w-full bg-[#091229] text-white relative overflow-hidden">
      {/* Ambient Stage Glow on Desktop */}
      <div
        aria-hidden="true"
        class="pointer-events-none fixed inset-0 hidden sm:block opacity-75"
        style={{
          background:
            might.activeMode() === 'all' && might.route() === '/home'
              ? 'radial-gradient(circle at 50% 25%, rgba(200, 123, 206, 0.28), transparent 55%), radial-gradient(circle at 80% 80%, rgba(117, 48, 101, 0.26), transparent 50%)'
              : 'radial-gradient(circle at 50% 20%, rgba(53, 142, 192, 0.30), transparent 55%), radial-gradient(circle at 20% 85%, rgba(20, 75, 134, 0.32), transparent 50%)',
        }}
      />

      {/* Toast Notifications */}
      <div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[min(372px,calc(100vw-24px))] pointer-events-none">
        <For each={might.toasts()}>
          {(toast) => (
            <button
              type="button"
              onClick={() => {
                might.dismissToast(toast.id);
                if (toast.message.toLowerCase().includes('novo might')) {
                  might.setActiveMode('all');
                  might.navigate('/home');
                }
              }}
              class={`pointer-events-auto w-full text-left px-4 py-3 rounded-2xl backdrop-blur-xl border shadow-xl flex items-center gap-3 transition-all ${
                toast.tone === 'success'
                  ? 'bg-[#144B86]/90 border-white/30 text-white'
                  : toast.tone === 'error'
                  ? 'bg-[#753065]/95 border-white/30 text-white'
                  : 'bg-[#1C1E28]/90 border-white/25 text-white'
              }`}
            >
              <span class="h-2.5 w-2.5 rounded-full bg-[#C6EE00] shrink-0 animate-pulse" />
              <span class="text-xs font-medium leading-snug flex-1">{toast.message}</span>
              <span class="text-[11px] opacity-70 font-semibold">×</span>
            </button>
          )}
        </For>
      </div>

      {/* Main Mobile-First Phone Chassis */}
      <div
        class={`phone-shell transition-all duration-300 ${shellBackground()} ${
          might.expandedShell() && canExpand() ? 'phone-expanded' : ''
        }`}
      >
        {/* Top Utility Strip (Modo Demo + Expandir ecrã) */}
        <Show when={!isInvite()}>
          <div class="relative z-30 flex items-center justify-between px-4 pt-3 pb-1.5 shrink-0">
            <button
              type="button"
              onClick={() => might.navigate(might.bootstrap()?.profile.selfTags ? '/home' : '/')}
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1838]/75 hover:bg-[#0F1838]/90 text-white backdrop-blur-md border border-white/20 text-[11px] font-bold tracking-wide shadow-sm transition cursor-pointer"
              title="Ir para o início"
            >
              <span class="inline-block h-2 w-2 rounded-full bg-[#C6EE00]" />
              <span>MighT</span>
            </button>

            <div class="flex items-center gap-1.5">
              <Show when={canExpand()}>
                <button
                  type="button"
                  onClick={() => might.setExpandedShell(!might.expandedShell())}
                  class="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0F1838]/75 hover:bg-[#0F1838]/90 text-white backdrop-blur-md border border-white/20 text-[11px] font-bold shadow-sm transition cursor-pointer"
                >
                  {might.expandedShell() ? 'Ecrã móvel' : 'Expandir ecrã'}
                </button>
              </Show>

              <button
                type="button"
                onClick={() => might.setDemoDrawerOpen(true)}
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1838]/75 hover:bg-[#0F1838]/90 text-white backdrop-blur-md border border-white/20 text-[11px] font-bold shadow-sm transition cursor-pointer"
                aria-label="Abrir Modo Demo"
              >
                <span
                  class={`h-1.5 w-1.5 rounded-full ${
                    might.sseConnected() ? 'bg-[#3D9061]' : 'bg-[#E88F3D]'
                  }`}
                />
                <span>Modo Demo</span>
              </button>
            </div>
          </div>
        </Show>

        {/* Scrollable Content Viewport */}
        <main
          ref={scrollRef}
          class={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar relative ${
            showBottomNav() ? 'pb-24' : 'pb-6'
          }`}
        >
          {props.children}
        </main>

        {/* Floating Glass Bottom Navigation Bar */}
        <Show when={showBottomNav()}>
          <nav
            aria-label="Navegação principal"
            class="absolute bottom-3 left-3 right-3 z-30 rounded-[24px] bg-[#1C1E28]/75 backdrop-blur-xl border border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.35)] px-1.5 py-1.5 flex items-center justify-around"
          >
            <For each={NAV_TABS}>
              {(tab) => {
                const active = () => tab.match(might.route());
                const hasBadge = () =>
                  (tab.id === 'home' || tab.id === 'stats') && pendingCount() > 0;
                return (
                  <button
                    type="button"
                    onClick={() => might.navigate(tab.path)}
                    class={`relative flex flex-col items-center justify-center gap-0.5 min-w-[58px] min-h-[46px] px-2 py-1 rounded-[18px] transition-all cursor-pointer ${
                      active()
                        ? 'bg-white text-[#1C1E28] shadow-sm scale-[1.02]'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <div class="relative">
                      <TabIcon id={tab.id} active={active()} />
                      <Show when={hasBadge()}>
                        <span class="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E94B7B] text-white text-[10px] font-bold flex items-center justify-center shadow">
                          {pendingCount()}
                        </span>
                      </Show>
                      <Show when={tab.id === 'stats' && acceptedCount() < 3 && !hasBadge()}>
                        <span
                          class="absolute -top-1 -right-1.5 text-[9px] leading-none"
                          title="Desbloqueia aos 3 MighTs aceites"
                        >
                          🔒
                        </span>
                      </Show>
                    </div>
                    <span class="text-[10px] font-semibold leading-none tracking-tight">
                      {tab.label}
                    </span>
                  </button>
                );
              }}
            </For>
          </nav>
        </Show>

        {/* Modo Demo Bottom Sheet */}
        <Show when={might.demoDrawerOpen()}>
          <div
            class="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) might.setDemoDrawerOpen(false);
            }}
          >
            <div class="w-full max-w-[420px] rounded-t-[28px] sm:rounded-[28px] bg-[#1C1E28] text-white border border-white/20 shadow-2xl p-5 space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-[11px] font-bold uppercase tracking-widest text-[#C6EE00]">
                    Controlo de Palco · Tempo Real
                  </p>
                  <h2 class="text-lg font-bold">Modo Demo MighT</h2>
                </div>
                <button
                  type="button"
                  onClick={() => might.setDemoDrawerOpen(false)}
                  class="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg font-bold cursor-pointer"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>

              <div class="rounded-2xl bg-white/8 border border-white/15 px-3.5 py-2.5 text-xs flex items-center justify-between">
                <span class="text-white/75">Estado atual</span>
                <span class="font-semibold">
                  {acceptedCount()}/3 aceites · {pendingCount()} pendentes ·{' '}
                  {might.sseConnected() ? 'SSE ativo' : 'Offline'}
                </span>
              </div>

              <div class="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    await might.demoSimulateReceive(1, false);
                    might.setDemoDrawerOpen(false);
                    might.showToast('+1 MighT da sala recebido na tua caixa de entrada!', 'success');
                  }}
                  class="w-full py-3 px-4 rounded-2xl bg-[#144B86] hover:bg-[#1a5da6] text-left font-semibold text-sm flex items-center justify-between transition cursor-pointer"
                >
                  <span>+1 MighT da sala (pendente)</span>
                  <span class="text-xs opacity-75">SSE</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await might.demoSimulateReceive(3, true);
                    might.setDemoDrawerOpen(false);
                    might.setActiveMode('all');
                    might.navigate('/home');
                  }}
                  class="w-full py-3 px-4 rounded-2xl bg-[#753065] hover:bg-[#8c3a79] text-left font-semibold text-sm flex items-center justify-between transition cursor-pointer"
                >
                  <span>+3 MighTs da sala (Desbloquear All MighT)</span>
                  <span class="text-xs opacity-80">✨ 3/3</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await might.demoLoadPreset('tiago');
                    might.setDemoDrawerOpen(false);
                  }}
                  class="w-full py-3 px-4 rounded-2xl bg-white/12 hover:bg-white/20 text-left font-semibold text-sm flex items-center justify-between transition cursor-pointer"
                >
                  <span>Carregar demo completo (Tiago)</span>
                  <span class="text-xs text-[#C6EE00]">8 aceites</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await might.demoLoadPreset('fresh');
                    might.setDemoDrawerOpen(false);
                  }}
                  class="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/12 border border-white/15 text-left font-semibold text-sm text-white/80 flex items-center justify-between transition cursor-pointer"
                >
                  <span>Recomeçar do zero</span>
                  <span class="text-xs opacity-65">Reset</span>
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
