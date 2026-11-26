import type { Circle, FigureSelection, TagItem } from '../../../shared/types';
import { MODULAR_COORDS } from '../components/MightFigure';
import { resolvePartIndex } from './store';

export type CardFormat = 'portrait' | 'linkedin';
export type CardTheme = 'self' | 'all' | 'collectible';

export interface CardExportOptions {
  format: CardFormat;
  theme: CardTheme;
  figureStyle?: 'modular' | 'blue-hero' | 'purple-hero' | 'surf';
  firstName: string;
  selection: FigureSelection;
  tags: TagItem[];
  tagline: string;
  circles: Circle[];
  score: number;
  acceptedCount: number;
  isAllMight: boolean;
}

function slugifyName(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'might'
  );
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(' ');
        let clipped = rest;
        while (clipped.length > 3 && ctx.measureText(`${clipped}…`).width > maxWidth) {
          clipped = clipped.slice(0, -1);
        }
        lines.push(clipped === rest ? rest : `${clipped.trimEnd()}…`);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function drawPartMiniIcon(
  ctx: CanvasRenderingContext2D,
  part: 'head' | 'body' | 'arms',
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(cx - size / 2, cy - size / 2);
  const s = size / 24;
  ctx.scale(s, s);
  if (part === 'head') {
    ctx.beginPath();
    ctx.ellipse(12, 12, 8.5, 6.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4.2, 12.2, 3, 0, Math.PI * 2);
    ctx.arc(19.8, 12.2, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (part === 'body') {
    drawRoundedRect(ctx, 6, 4, 12, 15, 3);
    ctx.fill();
    ctx.fillRect(7, 17, 4, 3);
    ctx.fillRect(13, 17, 4, 3);
  } else {
    drawRoundedRect(ctx, 4.5, 5, 4.2, 14, 2.1);
    ctx.fill();
    drawRoundedRect(ctx, 15.3, 5, 4.2, 14, 2.1);
    ctx.fill();
  }
  ctx.restore();
}

function drawMiniSilhouette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  color: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  // Head
  ctx.beginPath();
  ctx.ellipse(12, 8.5, 9.2, 6.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(3.4, 8.8, 2.8, 0, Math.PI * 2);
  ctx.arc(20.6, 8.8, 2.8, 0, Math.PI * 2);
  ctx.fill();
  // Torso
  drawRoundedRect(ctx, 6.5, 16, 11, 12, 2.6);
  ctx.fill();
  // Arms
  drawRoundedRect(ctx, 2.6, 16.5, 2.8, 10.2, 1.4);
  ctx.fill();
  drawRoundedRect(ctx, 18.6, 16.5, 2.8, 10.2, 1.4);
  ctx.fill();
  ctx.restore();
}

async function drawFigureOnCanvas(
  ctx: CanvasRenderingContext2D,
  opts: CardExportOptions,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const style = opts.figureStyle ?? (opts.isAllMight ? 'purple-hero' : 'modular');
  if (style === 'blue-hero' || style === 'purple-hero' || style === 'surf') {
    const src =
      style === 'blue-hero'
        ? '/assets/figures/heroes/blue-hero.png'
        : style === 'purple-hero'
        ? '/assets/figures/heroes/purple-hero.png'
        : '/assets/figures/heroes/surf.png';
    const img = await loadImage(src);
    if (img) {
      const iw = img.naturalWidth || dw;
      const ih = img.naturalHeight || dh;
      const scale = Math.min(dw / iw, dh / ih);
      const rw = iw * scale;
      const rh = ih * scale;
      const rx = dx + (dw - rw) / 2;
      const ry = dy + (dh - rh) / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(2, 16, 44, 0.35)';
      ctx.shadowBlur = 32;
      ctx.shadowOffsetY = 16;
      ctx.drawImage(img, rx, ry, rw, rh);
      ctx.restore();
      return;
    }
  }

  const tagMap: Record<string, TagItem> = {};
  for (const t of opts.tags) tagMap[t.slug] = t;

  const headIdx = resolvePartIndex(opts.selection.head, tagMap);
  const bodyIdx = resolvePartIndex(opts.selection.body, tagMap);
  const armsIdx = resolvePartIndex(opts.selection.arms, tagMap);

  const [bodyImg, armsImg, headImg] = await Promise.all([
    loadImage(`/assets/figures/parts/body-${bodyIdx}.png`),
    loadImage(`/assets/figures/parts/arms-${armsIdx}.png`),
    loadImage(`/assets/figures/parts/head-${headIdx}.png`),
  ]);

  const sx = dw / 120;
  const sy = dh / 146;

  const drawClipped = (
    img: HTMLImageElement | null,
    clip: { x: number; y: number; w: number; h: number },
    draw: { x: number; y: number; w: number; h: number }
  ) => {
    if (!img) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx + clip.x * sx, dy + clip.y * sy, clip.w * sx, clip.h * sy);
    ctx.clip();
    ctx.drawImage(
      img,
      dx + draw.x * sx,
      dy + draw.y * sy,
      draw.w * sx,
      draw.h * sy
    );
    ctx.restore();
  };

  ctx.save();
  ctx.shadowColor = 'rgba(2, 16, 44, 0.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  drawClipped(bodyImg, MODULAR_COORDS.body.clip, MODULAR_COORDS.body.draw);
  drawClipped(armsImg, MODULAR_COORDS.leftArm.clip, MODULAR_COORDS.leftArm.draw);
  drawClipped(armsImg, MODULAR_COORDS.rightArm.clip, MODULAR_COORDS.rightArm.draw);
  drawClipped(headImg, MODULAR_COORDS.head.clip, MODULAR_COORDS.head.draw);
  ctx.restore();
}

export async function exportMightCardPng(opts: CardExportOptions): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
      await Promise.all([
        document.fonts.load('700 64px "Mona Sans"'),
        document.fonts.load('500 32px "Mona Sans"'),
        document.fonts.load('italic 500 30px "Mona Sans"'),
      ]);
    } catch {
      // proceed with loaded fallback fonts
    }
  }

  const isPortrait = opts.format === 'portrait';
  const baseW = isPortrait ? 1080 : 1200;
  const baseH = isPortrait ? 1920 : 627;
  const dpr = 2; // High-DPI 2x export

  const canvas = document.createElement('canvas');
  canvas.width = baseW * dpr;
  canvas.height = baseH * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível inicializar o motor Canvas 2D.');
  }

  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const isPurple = opts.theme === 'all' || (opts.theme === 'collectible' && opts.isAllMight);
  const isCollectible = opts.theme === 'collectible';

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, isPortrait ? 0 : baseW, baseH);
  if (isPurple) {
    bgGrad.addColorStop(0, '#7A3492');
    bgGrad.addColorStop(1, '#27072E');
  } else {
    bgGrad.addColorStop(0, '#2360C7');
    bgGrad.addColorStop(1, '#0A295C');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, baseW, baseH);

  // Collectible metallic silver border
  if (isCollectible) {
    const borderGrad = ctx.createLinearGradient(0, 0, baseW, baseH);
    borderGrad.addColorStop(0, '#F5F7FA');
    borderGrad.addColorStop(0.5, '#9BA8BE');
    borderGrad.addColorStop(1, '#FFFFFF');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = isPortrait ? 28 : 16;
    drawRoundedRect(ctx, 14, 14, baseW - 28, baseH - 28, isPortrait ? 42 : 28);
    ctx.stroke();
  }

  const tagMap: Record<string, TagItem> = {};
  for (const t of opts.tags) tagMap[t.slug] = t;
  const headLabel = tagMap[opts.selection.head]?.labelPt ?? opts.selection.head;
  const bodyLabel = tagMap[opts.selection.body]?.labelPt ?? opts.selection.body;
  const armsLabel = tagMap[opts.selection.arms]?.labelPt ?? opts.selection.arms;

  const logoImg = await loadImage('/assets/brand/logo-white.svg');

  if (isPortrait) {
    // Top soft radial glow
    const halo = ctx.createRadialGradient(540, 560, 40, 540, 560, 440);
    halo.addColorStop(0, 'rgba(255,255,255,0.22)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 100, 1080, 900);

    // Header row
    if (logoImg) {
      ctx.drawImage(logoImg, 84, 84, 210, 63);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 54px "Mona Sans", sans-serif';
      ctx.fillText('MIGHT', 84, 136);
    }

    // Top-right badge or mini silhouette
    drawMiniSilhouette(ctx, 932, 86, 2.1, 'rgba(255,255,255,0.45)');

    // Pill sub-header
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    drawRoundedRect(ctx, 84, 182, isCollectible ? 430 : 390, 54, 27);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 22px "Mona Sans", sans-serif';
    ctx.textBaseline = 'middle';
    const modeLabel = opts.isAllMight
      ? `ALL MIGHT · ${opts.acceptedCount} ACEITES`
      : 'SELF MIGHT';
    ctx.fillText(modeLabel, 114, 209);
    ctx.restore();

    // Score top right if collectible
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    drawRoundedRect(ctx, 780, 182, 216, 54, 27);
    ctx.fill();
    ctx.fillStyle = '#FFE58F';
    ctx.font = '700 26px "Mona Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`★ ${opts.score}`, 888, 209);
    ctx.restore();

    // Hero 3D figure
    await drawFigureOnCanvas(ctx, opts, 240, 275, 600, 730);

    // Name
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 84px "Mona Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(opts.firstName || 'MighT', 540, 1085);
    ctx.restore();

    // Horizontal divider 1
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 1138);
    ctx.lineTo(996, 1138);
    ctx.stroke();

    // 3 icon-prefixed traits
    const cols = [
      { part: 'head' as const, label: headLabel, x: 235 },
      { part: 'body' as const, label: bodyLabel, x: 540 },
      { part: 'arms' as const, label: armsLabel, x: 845 },
    ];
    for (const c of cols) {
      ctx.save();
      ctx.font = '600 32px "Mona Sans", sans-serif';
      const textW = ctx.measureText(c.label).width;
      const iconW = 30;
      const gap = 12;
      const totalW = iconW + gap + textW;
      const startX = c.x - totalW / 2;
      drawPartMiniIcon(ctx, c.part, startX + iconW / 2, 1202, iconW, '#FFFFFF');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.label, startX + iconW + gap, 1204);
      ctx.restore();
    }

    // Horizontal divider 2
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 1268);
    ctx.lineTo(996, 1268);
    ctx.stroke();

    // #1 Badge + Tagline
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(146, 1388, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 36px "Mona Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('#1', 146, 1390);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'italic 500 36px "Mona Sans", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const lines = wrapLines(ctx, `«${opts.tagline}»`, 730, 3);
    lines.forEach((line, idx) => {
      ctx.fillText(line, 996, 1330 + idx * 50);
    });
    ctx.restore();

    // Circles row
    const activeCircles = opts.circles.length > 0 ? opts.circles : (['Colegas', 'Amigos', 'Família'] as Circle[]);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '700 22px "Mona Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      opts.isAllMight ? 'TU, PELOS OLHOS DOS OUTROS' : 'O MEU RETRATO EM TRÊS PALAVRAS',
      540,
      1578
    );

    ctx.font = '600 24px "Mona Sans", sans-serif';
    const pillHeights = 48;
    const pillWidths = activeCircles.slice(0, 4).map((c) => ctx.measureText(c).width + 44);
    const totalPillsW = pillWidths.reduce((a, b) => a + b, 0) + (pillWidths.length - 1) * 14;
    let curX = (1080 - totalPillsW) / 2;
    activeCircles.slice(0, 4).forEach((circle, idx) => {
      const pw = pillWidths[idx];
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      drawRoundedRect(ctx, curX, 1612, pw, pillHeights, 24);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(circle, curX + pw / 2, 1636);
      curX += pw + 14;
    });
    ctx.restore();

    // Footer
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(84, 1756);
    ctx.lineTo(996, 1756);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 24px "Mona Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('HACK TALENT DEBT.', 84, 1815);
    ctx.textAlign = 'right';
    ctx.fillText('Visualize Talent · MighT', 996, 1815);
    ctx.restore();
  } else {
    // LINKEDIN 1200 x 627
    // Left lime accent bar
    ctx.fillStyle = '#C6EE00';
    ctx.fillRect(0, 0, 12, 627);

    // Left glass card panel
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    drawRoundedRect(ctx, 48, 42, 404, 543, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    await drawFigureOnCanvas(ctx, opts, 90, 72, 320, 388);

    // Left panel footer pill
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    drawRoundedRect(ctx, 84, 496, 332, 48, 24);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 20px "Mona Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const countLabel = opts.isAllMight
      ? `${opts.acceptedCount} MighTs aceites · ★ ${opts.score}`
      : `Self MighT · ★ ${opts.score}`;
    ctx.fillText(countLabel, 250, 520);
    ctx.restore();

    // Right column
    ctx.save();
    ctx.fillStyle = '#C6EE00';
    ctx.font = '700 18px "Mona Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      opts.isAllMight ? 'TU, PELOS OLHOS DOS OUTROS' : 'O TEU POTENCIAL EM TRÊS PALAVRAS',
      492,
      78
    );
    ctx.restore();

    if (logoImg) {
      ctx.drawImage(logoImg, 996, 48, 152, 46);
    }

    // Name
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 56px "Mona Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(opts.firstName || 'MighT', 492, 154);
    ctx.restore();

    // Tagline
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'italic 500 26px "Mona Sans", sans-serif';
    const lines = wrapLines(ctx, `«${opts.tagline}»`, 650, 2);
    lines.forEach((line, idx) => {
      ctx.fillText(line, 492, 206 + idx * 36);
    });
    ctx.restore();

    // 3 compact trait boxes
    const traitCards = [
      { part: 'head' as const, dim: 'Personalidade', label: headLabel, color: '#1FB5D3' },
      { part: 'body' as const, dim: 'Poder', label: bodyLabel, color: '#E94B7B' },
      { part: 'arms' as const, dim: 'Carácter', label: armsLabel, color: '#C6EE00' },
    ];
    traitCards.forEach((card, idx) => {
      const cx = 492 + idx * 220;
      const cy = 304;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      drawRoundedRect(ctx, cx, cy, 204, 122, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Top accent bar
      ctx.fillStyle = card.color;
      drawRoundedRect(ctx, cx + 16, cy + 14, 48, 5, 2.5);
      ctx.fill();

      drawPartMiniIcon(ctx, card.part, cx + 174, cy + 28, 22, 'rgba(255,255,255,0.75)');

      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '600 15px "Mona Sans", sans-serif';
      ctx.fillText(card.dim.toUpperCase(), cx + 16, cy + 56);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 24px "Mona Sans", sans-serif';
      ctx.fillText(card.label, cx + 16, cy + 94);
      ctx.restore();
    });

    // Circles row
    const circles = opts.circles.length > 0 ? opts.circles : (['Colegas', 'Amigos', 'Família'] as Circle[]);
    let cx = 492;
    ctx.save();
    ctx.font = '600 18px "Mona Sans", sans-serif';
    for (const circle of circles.slice(0, 5)) {
      const pw = ctx.measureText(circle).width + 30;
      if (cx + pw > 1152) break;
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      drawRoundedRect(ctx, cx, 456, pw, 38, 19);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(circle, cx + 15, 475);
      cx += pw + 10;
    }
    ctx.restore();

    // Footer
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.68)';
    ctx.font = '500 18px "Mona Sans", sans-serif';
    ctx.fillText(
      'Hack talent debt. Visualiza o teu potencial e a tua carreira.',
      492,
      556
    );
    ctx.restore();
  }

  // Trigger download
  const fileName = `might-card-${slugifyName(opts.firstName)}-${isPortrait ? 'retrato' : 'linkedin'}.png`;

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      resolve();
    }, 'image/png');
  });
}
