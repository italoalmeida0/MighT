import { Match, Show, Switch, createMemo } from 'solid-js';
import { AppShell } from './components/AppShell';
import { MightFigure } from './components/MightFigure';
import { MightProvider, useMight } from './lib/store';
import { AboutScreen } from './screens/AboutScreen';
import { CardScreen } from './screens/CardScreen';
import { CreatorScreen } from './screens/CreatorScreen';
import { DiscoverScreen } from './screens/DiscoverScreen';
import { HomeScreen } from './screens/HomeScreen';
import { InviteLandingScreen } from './screens/InviteLandingScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { RolesScreen } from './screens/RolesScreen';
import { SendAskScreen } from './screens/SendAskScreen';
import { StatsScreen } from './screens/StatsScreen';

function RouterView() {
  const might = useMight();
  const route = () => might.route();

  const inviteCode = createMemo(() => {
    const r = route();
    if (!r.startsWith('/convite/')) return null;
    return decodeURIComponent(r.slice('/convite/'.length).split('?')[0] ?? '');
  });

  // Allow public invite route to render even while main session bootstrap loads
  return (
    <Show
      when={!might.loading() || Boolean(inviteCode())}
      fallback={
        <div class="min-h-full flex flex-col items-center justify-center px-6 py-16 text-center space-y-4">
          <MightFigure mode="silhouette" loadingGradient animateFloat class="w-32" />
          <p class="text-sm font-semibold text-white/90">A carregar o teu MighT...</p>
        </div>
      }
    >
      <Show
        when={!might.error() || Boolean(might.bootstrap()) || Boolean(inviteCode())}
        fallback={
          <div class="min-h-full flex flex-col items-center justify-center px-6 py-16 text-center space-y-4">
            <MightFigure mode="silhouette" activePart="head" class="w-28" />
            <div class="space-y-1">
              <h1 class="text-lg font-bold text-[#1C1E28]">
                Ligação temporariamente indisponível
              </h1>
              <p class="text-xs text-white/85">{might.error()}</p>
            </div>
            <button
              type="button"
              onClick={() => might.refresh()}
              class="px-5 py-3 rounded-2xl bg-white text-[#1C1E28] font-bold text-sm shadow cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        }
      >
        <Switch
          fallback={
            might.bootstrap()?.profile.selfTags ? <HomeScreen /> : <OnboardingScreen />
          }
        >
          <Match when={inviteCode()}>
            {(code) => <InviteLandingScreen code={code()} />}
          </Match>
          <Match when={route() === '/' || route() === '/onboarding'}>
            <OnboardingScreen />
          </Match>
          <Match when={route() === '/criar'}>
            <CreatorScreen />
          </Match>
          <Match when={route() === '/home'}>
            <HomeScreen />
          </Match>
          <Match when={route() === '/enviar'}>
            <SendAskScreen mode="send" />
          </Match>
          <Match when={route() === '/pedir'}>
            <SendAskScreen mode="ask" />
          </Match>
          <Match when={route() === '/stats'}>
            <StatsScreen />
          </Match>
          <Match when={route() === '/card'}>
            <CardScreen />
          </Match>
          <Match when={route() === '/descobrir' || route() === '/mapa'}>
            <DiscoverScreen />
          </Match>
          <Match when={route() === '/funcoes'}>
            <RolesScreen />
          </Match>
          <Match when={route() === '/sobre'}>
            <AboutScreen />
          </Match>
        </Switch>
      </Show>
    </Show>
  );
}

export function App() {
  return (
    <MightProvider>
      <AppShell>
        <RouterView />
      </AppShell>
    </MightProvider>
  );
}
