import { Show, createEffect, createMemo, createUniqueId, on } from 'solid-js';
import type { FigureSelection, TagItem } from '../../../shared/types';
import { resolvePartIndex } from '../lib/store';

export const MODULAR_VIEWBOX = '0 0 120 146';

export const MODULAR_COORDS = {
  body: {
    clip: { x: 26.26, y: 76.72, w: 67.48, h: 61.87 },
    draw: { x: 14.89, y: 58.88, w: 90.21, h: 90.21 },
  },
  leftArm: {
    clip: { x: 0.5, y: 71.0, w: 28.0, h: 52.5 },
    draw: { x: -18.3, y: 62.22, w: 96.71, h: 72.53 },
  },
  rightArm: {
    clip: { x: 91.5, y: 71.0, w: 28.0, h: 52.5 },
    draw: { x: 41.59, y: 62.22, w: 96.71, h: 72.53 },
  },
  head: {
    clip: { x: 4.2, y: 5.0, w: 111.6, h: 87.29 },
    draw: { x: -8.0, y: 2.38, w: 138.17, h: 92.9 },
  },
} as const;

export type MightFigureMode =
  | 'modular'
  | 'blue-hero'
  | 'purple-hero'
  | 'avatar'
  | 'silhouette'
  | 'surf';

export interface MightFigureProps {
  mode?: MightFigureMode;
  headIndex?: 0 | 1 | 2;
  bodyIndex?: 0 | 1 | 2;
  armsIndex?: 0 | 1 | 2;
  selection?: FigureSelection | null;
  tags?: TagItem[];
  avatarUrl?: string;
  activePart?: 'head' | 'body' | 'arms' | null;
  selectedParts?: { head?: boolean; body?: boolean; arms?: boolean };
  loadingGradient?: boolean;
  animateFloat?: boolean;
  class?: string;
  alt?: string;
}

const HEAD_PATH =
  'M60 7.5C40.5 7.5 29.8 18.8 27.6 28.4C17.2 31.1 10.5 40.3 10.5 51.8C10.5 63.3 17.5 72.4 28.1 75.0C34.2 84.4 45.4 89.2 60 89.2C74.6 89.2 85.8 84.4 91.9 75.0C102.5 72.4 109.5 63.3 109.5 51.8C109.5 40.3 102.8 31.1 92.4 28.4C90.2 18.8 79.5 7.5 60 7.5Z';

const BODY_PATH =
  'M30.5 84.2C38.6 90.4 48.8 93.4 60 93.4C71.2 93.4 81.4 90.4 89.5 84.2L91.2 126.5C91.5 133.2 86.2 138.6 79.4 138.6H76.2C71.2 138.6 68.1 135.4 67.2 130.6C66.6 127.1 63.7 125.0 60 125.0C56.3 125.0 53.4 127.1 52.8 130.6C51.9 135.4 48.8 138.6 43.8 138.6H40.6C33.8 138.6 28.5 133.2 28.8 126.5L30.5 84.2Z';

const LEFT_ARM_PATH =
  'M24.2 80.2C21.0 78.9 17.4 81.5 15.8 87.2L9.2 111.5C7.6 117.4 10.7 122.4 15.9 122.4C21.0 122.4 24.4 118.2 24.9 112.0L26.8 86.4C27.1 82.8 25.9 80.9 24.2 80.2Z';

const RIGHT_ARM_PATH =
  'M95.8 80.2C99.0 78.9 102.6 81.5 104.2 87.2L110.8 111.5C112.4 117.4 109.3 122.4 104.1 122.4C99.0 122.4 95.6 118.2 95.1 112.0L93.2 86.4C92.9 82.8 94.1 80.9 95.8 80.2Z';

function bounceElement(el: SVGElement | undefined) {
  if (!el || typeof el.animate !== 'function') return;
  el.animate(
    [
      { transform: 'scale(0.88)', opacity: 0.78 },
      { transform: 'scale(1.06)', opacity: 1 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    {
      duration: 380,
      easing: 'cubic-bezier(0.22, 1.35, 0.36, 1)',
    }
  );
}

export function MightFigure(props: MightFigureProps) {
  const uid = createUniqueId();
  let headGroupRef: SVGGElement | undefined;
  let bodyGroupRef: SVGGElement | undefined;
  let armsGroupRef: SVGGElement | undefined;

  const tagMap = createMemo<Record<string, TagItem>>(() => {
    const map: Record<string, TagItem> = {};
    for (const t of props.tags ?? []) {
      map[t.slug] = t;
    }
    return map;
  });

  const resolvedHead = createMemo<0 | 1 | 2>(() => {
    if (props.headIndex !== undefined) return props.headIndex;
    return resolvePartIndex(props.selection?.head, tagMap());
  });

  const resolvedBody = createMemo<0 | 1 | 2>(() => {
    if (props.bodyIndex !== undefined) return props.bodyIndex;
    return resolvePartIndex(props.selection?.body, tagMap());
  });

  const resolvedArms = createMemo<0 | 1 | 2>(() => {
    if (props.armsIndex !== undefined) return props.armsIndex;
    return resolvePartIndex(props.selection?.arms, tagMap());
  });

  const headSelected = () => props.selectedParts?.head ?? true;
  const bodySelected = () => props.selectedParts?.body ?? true;
  const armsSelected = () => props.selectedParts?.arms ?? true;

  // Trigger snappy spring pop on each individual body part when its variant or selection changes
  createEffect(
    on(
      () => [resolvedHead(), props.selection?.head, headSelected()],
      () => bounceElement(headGroupRef),
      { defer: true }
    )
  );
  createEffect(
    on(
      () => [resolvedBody(), props.selection?.body, bodySelected()],
      () => bounceElement(bodyGroupRef),
      { defer: true }
    )
  );
  createEffect(
    on(
      () => [resolvedArms(), props.selection?.arms, armsSelected()],
      () => bounceElement(armsGroupRef),
      { defer: true }
    )
  );

  const mode = () => props.mode ?? 'modular';

  const heroSrc = createMemo(() => {
    const m = mode();
    if (m === 'blue-hero') return '/assets/figures/heroes/blue-hero.png';
    if (m === 'purple-hero') return '/assets/figures/heroes/purple-hero.png';
    if (m === 'surf') return '/assets/figures/heroes/surf.png';
    if (m === 'avatar') return props.avatarUrl || '/assets/figures/heroes/avatar-01.png';
    return '';
  });

  const partFill = (part: 'head' | 'body' | 'arms') => {
    if (props.loadingGradient) return `url(#${uid}-loading-grad)`;
    if (props.activePart === part) return '#144B86';
    return 'rgba(255, 255, 255, 0.44)';
  };

  return (
    <div
      class={`relative inline-flex items-center justify-center select-none ${
        props.animateFloat ? 'animate-float-slow' : ''
      } ${props.class ?? ''}`}
      style={{ 'aspect-ratio': '120 / 146' }}
      aria-label={props.alt ?? 'Figura 3D MighT'}
    >
      <Show
        when={mode() === 'modular' || mode() === 'silhouette'}
        fallback={
          <img
            src={heroSrc()}
            alt={props.alt ?? 'Figura 3D MighT'}
            class="h-full w-full object-contain drop-shadow-[0_18px_32px_rgba(2,20,54,0.28)]"
            draggable={false}
          />
        }
      >
        <svg
          viewBox={MODULAR_VIEWBOX}
          class="h-full w-full overflow-visible drop-shadow-[0_16px_28px_rgba(2,20,54,0.24)]"
          role="img"
          aria-label={props.alt ?? 'Figura modular 3D MighT'}
        >
          <defs>
            <linearGradient id={`${uid}-loading-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#9A53A6" />
              <stop offset="45%" stop-color="#5870BA" />
              <stop offset="100%" stop-color="#69B3E7" />
            </linearGradient>

            <clipPath id={`${uid}-body-clip`}>
              <rect
                x={MODULAR_COORDS.body.clip.x}
                y={MODULAR_COORDS.body.clip.y}
                width={MODULAR_COORDS.body.clip.w}
                height={MODULAR_COORDS.body.clip.h}
                rx="4"
              />
            </clipPath>
            <clipPath id={`${uid}-left-arm-clip`}>
              <rect
                x={MODULAR_COORDS.leftArm.clip.x}
                y={MODULAR_COORDS.leftArm.clip.y}
                width={MODULAR_COORDS.leftArm.clip.w}
                height={MODULAR_COORDS.leftArm.clip.h}
                rx="4"
              />
            </clipPath>
            <clipPath id={`${uid}-right-arm-clip`}>
              <rect
                x={MODULAR_COORDS.rightArm.clip.x}
                y={MODULAR_COORDS.rightArm.clip.y}
                width={MODULAR_COORDS.rightArm.clip.w}
                height={MODULAR_COORDS.rightArm.clip.h}
                rx="4"
              />
            </clipPath>
            <clipPath id={`${uid}-head-clip`}>
              <rect
                x={MODULAR_COORDS.head.clip.x}
                y={MODULAR_COORDS.head.clip.y}
                width={MODULAR_COORDS.head.clip.w}
                height={MODULAR_COORDS.head.clip.h}
                rx="8"
              />
            </clipPath>
          </defs>

          {/* Z-Order 1: Body (Power / Talent) */}
          <g
            ref={bodyGroupRef}
            style={{ 'transform-origin': '60px 108px' }}
          >
            <Show
              when={mode() === 'modular' && bodySelected()}
              fallback={
                <path
                  d={BODY_PATH}
                  fill={partFill('body')}
                  class="transition-colors duration-300"
                />
              }
            >
              <g clip-path={`url(#${uid}-body-clip)`}>
                <image
                  href={`/assets/figures/parts/body-${resolvedBody()}.png`}
                  x={MODULAR_COORDS.body.draw.x}
                  y={MODULAR_COORDS.body.draw.y}
                  width={MODULAR_COORDS.body.draw.w}
                  height={MODULAR_COORDS.body.draw.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </Show>
          </g>

          {/* Z-Order 2 & 3: Arms (Character / Value) */}
          <g
            ref={armsGroupRef}
            style={{ 'transform-origin': '60px 98px' }}
          >
            <Show
              when={mode() === 'modular' && armsSelected()}
              fallback={
                <>
                  <path
                    d={LEFT_ARM_PATH}
                    fill={partFill('arms')}
                    class="transition-colors duration-300"
                  />
                  <path
                    d={RIGHT_ARM_PATH}
                    fill={partFill('arms')}
                    class="transition-colors duration-300"
                  />
                </>
              }
            >
              <g clip-path={`url(#${uid}-left-arm-clip)`}>
                <image
                  href={`/assets/figures/parts/arms-${resolvedArms()}.png`}
                  x={MODULAR_COORDS.leftArm.draw.x}
                  y={MODULAR_COORDS.leftArm.draw.y}
                  width={MODULAR_COORDS.leftArm.draw.w}
                  height={MODULAR_COORDS.leftArm.draw.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
              <g clip-path={`url(#${uid}-right-arm-clip)`}>
                <image
                  href={`/assets/figures/parts/arms-${resolvedArms()}.png`}
                  x={MODULAR_COORDS.rightArm.draw.x}
                  y={MODULAR_COORDS.rightArm.draw.y}
                  width={MODULAR_COORDS.rightArm.draw.w}
                  height={MODULAR_COORDS.rightArm.draw.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </Show>
          </g>

          {/* Z-Order 4: Head (Personality) */}
          <g
            ref={headGroupRef}
            style={{ 'transform-origin': '60px 48px' }}
          >
            <Show
              when={mode() === 'modular' && headSelected()}
              fallback={
                <path
                  d={HEAD_PATH}
                  fill={partFill('head')}
                  class="transition-colors duration-300"
                />
              }
            >
              <g clip-path={`url(#${uid}-head-clip)`}>
                <image
                  href={`/assets/figures/parts/head-${resolvedHead()}.png`}
                  x={MODULAR_COORDS.head.draw.x}
                  y={MODULAR_COORDS.head.draw.y}
                  width={MODULAR_COORDS.head.draw.w}
                  height={MODULAR_COORDS.head.draw.h}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            </Show>
          </g>
        </svg>
      </Show>
    </div>
  );
}
