import {
  ALL_CIRCLES,
  DIMENSION_META,
  UNLOCK_THRESHOLD,
  type AllMightSummary,
  type BiggestDifference,
  type Circle,
  type Dimension,
  type DiscoverProfile,
  type FigureSelection,
  type JohariStats,
  type MightRecord,
  type OrbitPeer,
  type RolePeerRef,
  type RoleRecommendation,
  type RolesResponse,
  type TagItem,
  type TagWeight,
} from '../shared/types';
import { buildDeterministicNarrative } from './ai';
import { resolveTagSlug, type RoleRow, type SyntheticProfileRow } from './db';

const ALL_DIMENSIONS: readonly Dimension[] = ['personality', 'power', 'character'];

export function buildTagMap(tags: TagItem[]): Map<string, TagItem> {
  const map = new Map<string, TagItem>();
  for (const t of tags) {
    map.set(t.slug, t);
  }
  return map;
}

function getTagFromMight(m: MightRecord, dim: Dimension): string {
  if (dim === 'personality') return m.headTag;
  if (dim === 'power') return m.bodyTag;
  return m.armsTag;
}

/**
 * Peso = contagem ÷ total na dimensão (safe 0 when total == 0).
 */
export function computeDimensionWeights(
  mights: MightRecord[],
  tags: TagItem[],
  circleFilter?: Circle | 'all',
): Record<Dimension, TagWeight[]> {
  const tagMap = buildTagMap(tags);
  const accepted = mights.filter((m) => m.status === 'accepted');
  const scoped =
    circleFilter && circleFilter !== 'all'
      ? accepted.filter((m) => m.circle === circleFilter)
      : accepted;

  const result: Record<Dimension, TagWeight[]> = {
    personality: [],
    power: [],
    character: [],
  };

  for (const dim of ALL_DIMENSIONS) {
    const counts = new Map<string, number>();
    let total = 0;

    for (const m of scoped) {
      const rawSlug = getTagFromMight(m, dim);
      const slug = tagMap.has(rawSlug) ? rawSlug : resolveTagSlug(tags, rawSlug) ?? rawSlug;
      if (!slug) continue;
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
      total += 1;
    }

    if (total === 0) {
      result[dim] = [];
      continue;
    }

    const list: TagWeight[] = [];
    for (const [slug, count] of counts.entries()) {
      const tag = tagMap.get(slug);
      const weight = total > 0 ? count / total : 0;
      list.push({
        slug,
        labelPt: tag?.labelPt ?? slug,
        dimension: dim,
        bodyPart: DIMENSION_META[dim].bodyPart,
        count,
        weight,
        pct: Math.round(weight * 100),
      });
    }

    list.sort((a, b) => b.count - a.count || a.labelPt.localeCompare(b.labelPt, 'pt'));
    result[dim] = list;
  }

  return result;
}

export function buildSelfWeights(
  selfTags: FigureSelection | null,
  tags: TagItem[],
): Record<Dimension, TagWeight[]> {
  const tagMap = buildTagMap(tags);
  const result: Record<Dimension, TagWeight[]> = {
    personality: [],
    power: [],
    character: [],
  };
  if (!selfTags) return result;

  const mapping: Array<[Dimension, string]> = [
    ['personality', selfTags.head],
    ['power', selfTags.body],
    ['character', selfTags.arms],
  ];

  for (const [dim, rawSlug] of mapping) {
    const slug = tagMap.has(rawSlug) ? rawSlug : resolveTagSlug(tags, rawSlug);
    if (!slug) continue;
    const tag = tagMap.get(slug);
    result[dim] = [
      {
        slug,
        labelPt: tag?.labelPt ?? slug,
        dimension: dim,
        bodyPart: DIMENSION_META[dim].bodyPart,
        count: 1,
        weight: 1,
        pct: 100,
      },
    ];
  }

  return result;
}

export function flattenTagCloud(weightsByDim: Record<Dimension, TagWeight[]>): TagWeight[] {
  const all = [
    ...weightsByDim.personality,
    ...weightsByDim.power,
    ...weightsByDim.character,
  ];
  return all.sort((a, b) => b.pct - a.pct || b.count - a.count || a.labelPt.localeCompare(b.labelPt, 'pt'));
}

export function computeAllMightSummary(
  acceptedMights: MightRecord[],
  pendingMights: MightRecord[],
  sentMights: MightRecord[],
  tags: TagItem[],
  circleFilter: Circle | 'all' = 'all',
  firstName?: string,
): AllMightSummary {
  const tagMap = buildTagMap(tags);
  const unlocked = acceptedMights.length >= UNLOCK_THRESHOLD;
  const weightsByDimension = computeDimensionWeights(acceptedMights, tags, circleFilter);
  const tagCloud = flattenTagCloud(weightsByDimension);

  const circlesSet = new Set<Circle>();
  for (const m of acceptedMights) {
    circlesSet.add(m.circle);
  }
  const circlesRepresented = ALL_CIRCLES.filter((c) => circlesSet.has(c));

  const headSlug = weightsByDimension.personality[0]?.slug ?? '';
  const bodySlug = weightsByDimension.power[0]?.slug ?? '';
  const armsSlug = weightsByDimension.character[0]?.slug ?? '';
  const topTags: FigureSelection | null =
    headSlug && bodySlug && armsSlug ? { head: headSlug, body: bodySlug, arms: armsSlug } : null;

  const sentNames = new Set(sentMights.map((s) => s.recipientName.trim().toLowerCase()));
  const recentPeers: OrbitPeer[] = acceptedMights
    .slice(0, 8)
    .map((m, idx) => {
      const cyclePhoto = `/assets/peers/peer-${(idx % 6) + 1}.jpg`;
      const isHumanPortrait = Boolean(m.senderAvatarUrl && m.senderAvatarUrl.includes('/assets/peers/'));
      const photoUrl = idx < 6 ? cyclePhoto : isHumanPortrait ? m.senderAvatarUrl! : cyclePhoto;
      return {
        id: m.id,
        name: m.senderName,
        circle: m.circle,
        photoUrl,
        avatarUrl: photoUrl,
        headTag: tagMap.get(m.headTag)?.labelPt ?? m.headTag,
        bodyTag: tagMap.get(m.bodyTag)?.labelPt ?? m.bodyTag,
        armsTag: tagMap.get(m.armsTag)?.labelPt ?? m.armsTag,
        reciprocated: sentNames.has(m.senderName.trim().toLowerCase()),
      };
    });

  const waitingForYou: OrbitPeer[] = pendingMights.map((m, idx) => {
    const cyclePhoto = `/assets/peers/peer-${(idx % 6) + 1}.jpg`;
    const isHumanPortrait = Boolean(m.senderAvatarUrl && m.senderAvatarUrl.includes('/assets/peers/'));
    const photoUrl = isHumanPortrait ? m.senderAvatarUrl! : cyclePhoto;
    return {
      id: m.id,
      name: m.senderName,
      circle: m.circle,
      photoUrl,
      avatarUrl: photoUrl,
      headTag: tagMap.get(m.headTag)?.labelPt ?? m.headTag,
      bodyTag: tagMap.get(m.bodyTag)?.labelPt ?? m.bodyTag,
      armsTag: tagMap.get(m.armsTag)?.labelPt ?? m.armsTag,
      reciprocated: false,
    };
  });

  let description =
    'Quando aceitares 3 MighTs de pessoas que te conhecem, revelamos a soma da tua identidade aos olhos dos outros.';
  let tagline = 'Desbloqueia o teu All MighT ao aceitar 3 reconhecimentos.';

  if (topTags && tagMap.has(topTags.head) && tagMap.has(topTags.body) && tagMap.has(topTags.arms)) {
    const narrative = buildDeterministicNarrative(
      tagMap.get(topTags.head)!,
      tagMap.get(topTags.body)!,
      tagMap.get(topTags.arms)!,
      'all',
      firstName,
    );
    description = narrative.description;
    tagline = narrative.tagline;
  }

  return {
    unlocked,
    acceptedCount: acceptedMights.length,
    threshold: UNLOCK_THRESHOLD,
    activeCircle: circleFilter,
    circlesRepresented,
    topTags,
    weightsByDimension,
    tagCloud,
    recentPeers,
    waitingForYou,
    description,
    tagline,
  };
}

function dimPrepPhrase(dim: Dimension): string {
  if (dim === 'personality') return 'a tua personalidade';
  if (dim === 'power') return 'o teu poder';
  return 'o teu carácter';
}

export function computeJohariStats(
  selfTags: FigureSelection | null,
  acceptedMights: MightRecord[],
  tags: TagItem[],
): JohariStats {
  const tagMap = buildTagMap(tags);
  const unlocked = acceptedMights.length >= UNLOCK_THRESHOLD;
  const byDimension = computeDimensionWeights(acceptedMights, tags);

  const selfEntries: Array<{ dim: Dimension; slug: string }> = selfTags
    ? [
        { dim: 'personality', slug: resolveTagSlug(tags, selfTags.head) ?? selfTags.head },
        { dim: 'power', slug: resolveTagSlug(tags, selfTags.body) ?? selfTags.body },
        { dim: 'character', slug: resolveTagSlug(tags, selfTags.arms) ?? selfTags.arms },
      ]
    : [];

  const selfSlugSet = new Set(selfEntries.map((e) => e.slug));
  const confirmed: TagWeight[] = [];
  const hidden: TagWeight[] = [];
  const superpowers: TagWeight[] = [];

  for (const dim of ALL_DIMENSIONS) {
    const list = byDimension[dim];
    const selfForDim = selfEntries.find((e) => e.dim === dim)?.slug;

    for (const tw of list) {
      if (selfSlugSet.has(tw.slug)) {
        confirmed.push(tw);
      } else {
        superpowers.push(tw);
      }
    }

    if (selfForDim && !list.some((tw) => tw.slug === selfForDim)) {
      const t = tagMap.get(selfForDim);
      hidden.push({
        slug: selfForDim,
        labelPt: t?.labelPt ?? selfForDim,
        dimension: dim,
        bodyPart: DIMENSION_META[dim].bodyPart,
        count: 0,
        weight: 0,
        pct: 0,
      });
    }
  }

  confirmed.sort((a, b) => b.pct - a.pct || b.count - a.count);
  superpowers.sort((a, b) => b.pct - a.pct || b.count - a.count);

  const selfCount = selfEntries.length || 3;
  const alignmentPct = selfEntries.length > 0 ? Math.round((confirmed.length / selfEntries.length) * 100) : 0;

  let topHeadlineInsight = 'Recebe e aceita 3 MighTs para descobrir como os outros te veem.';
  if (superpowers.length > 0) {
    const top = superpowers[0];
    topHeadlineInsight = `${top.pct}% escolheram ${top.labelPt} para ${dimPrepPhrase(top.dimension)}.`;
  } else if (confirmed.length > 0) {
    const top = confirmed[0];
    topHeadlineInsight = `${top.pct}% confirmaram ${top.labelPt} para ${dimPrepPhrase(top.dimension)}.`;
  }

  let mirrorInsight = 'Compara a tua perceção própria com o olhar de quem te conhece.';
  if (hidden.length > 0) {
    mirrorInsight = `Escolheste ${hidden[0].labelPt}, mas os outros ainda não o destacaram — talento oculto ou oportunidade para mostrar mais.`;
  } else if (superpowers.length > 0) {
    mirrorInsight = `Os teus pares veem ${superpowers[0].labelPt} com força em ti (${superpowers[0].pct}%), mesmo sem o teres escolhido no Self MighT.`;
  } else if (confirmed.length === 3) {
    mirrorInsight = 'Sincronia total: as tuas 3 escolhas coincidem com o olhar dos teus círculos.';
  }

  return {
    unlocked,
    totalReceived: acceptedMights.length,
    alignmentPct,
    confirmedCount: confirmed.length,
    selfCount,
    topHeadlineInsight,
    mirrorInsight,
    confirmed,
    superpowers,
    hidden,
    byDimension,
  };
}

/**
 * Semelhança = % de peso sobreposto (histogram intersection).
 */
export function computeSimilarity(
  userWeights: Record<Dimension, TagWeight[]>,
  otherWeights: Record<Dimension, TagWeight[]>,
  otherName: string,
  tags: TagItem[],
  dimensionFilter: Dimension | 'all' = 'all',
): {
  similarityPct: number;
  commonTags: TagWeight[];
  biggestDifference: BiggestDifference;
} {
  const tagMap = buildTagMap(tags);
  const dims: readonly Dimension[] =
    dimensionFilter === 'all' ? ALL_DIMENSIONS : [dimensionFilter];

  let dimSimSum = 0;
  const commonTags: TagWeight[] = [];

  let maxDiffVal = -1;
  let maxDiffDim: Dimension = dims[0];
  let maxDiffSlug = '';
  let maxDiffUserW = 0;
  let maxDiffOtherW = 0;

  for (const dim of dims) {
    const mapA = new Map<string, TagWeight>();
    const mapB = new Map<string, TagWeight>();
    for (const tw of userWeights[dim]) mapA.set(tw.slug, tw);
    for (const tw of otherWeights[dim]) mapB.set(tw.slug, tw);

    const allSlugs = new Set([...mapA.keys(), ...mapB.keys()]);
    let dimSim = 0;

    for (const slug of allSlugs) {
      const wA = mapA.get(slug)?.weight ?? 0;
      const wB = mapB.get(slug)?.weight ?? 0;
      const overlap = Math.min(wA, wB);
      dimSim += overlap;

      if (overlap > 0) {
        const ref = mapB.get(slug) ?? mapA.get(slug)!;
        commonTags.push({
          ...ref,
          weight: overlap,
          pct: Math.round(overlap * 100),
        });
      }

      const diff = Math.abs(wA - wB);
      if (diff > maxDiffVal) {
        maxDiffVal = diff;
        maxDiffDim = dim;
        maxDiffSlug = slug;
        maxDiffUserW = wA;
        maxDiffOtherW = wB;
      }
    }

    dimSimSum += dimSim;
  }

  const avgSim = dims.length > 0 ? dimSimSum / dims.length : 0;
  const similarityPct = Math.round(avgSim * 100);

  commonTags.sort((a, b) => b.weight - a.weight || a.labelPt.localeCompare(b.labelPt, 'pt'));

  const userTop = userWeights[maxDiffDim][0]?.labelPt ?? null;
  const otherTop = otherWeights[maxDiffDim][0]?.labelPt ?? null;
  const diffLabel = tagMap.get(maxDiffSlug)?.labelPt ?? maxDiffSlug;
  const dimLabelPt = DIMENSION_META[maxDiffDim].labelPt;

  let summaryPt = `Perfis próximos em ${dimLabelPt.toLowerCase()}.`;
  if (maxDiffVal > 0 && diffLabel) {
    if (maxDiffUserW > maxDiffOtherW) {
      summaryPt = `Em ${dimLabelPt}, destacas-te mais em ${diffLabel} (${Math.round(maxDiffUserW * 100)}%) face a ${otherTop ?? otherName}.`;
    } else {
      summaryPt = `Em ${dimLabelPt}, ${otherName} destaca-se em ${diffLabel} (${Math.round(maxDiffOtherW * 100)}%) vs. ${userTop ?? 'o teu perfil'}.`;
    }
  }

  return {
    similarityPct,
    commonTags: commonTags.slice(0, 6),
    biggestDifference: {
      dimension: maxDiffDim,
      labelPt: dimLabelPt,
      userTopTag: userTop,
      otherTopTag: otherTop,
      summaryPt,
    },
  };
}

export function buildDiscoverProfiles(
  userWeights: Record<Dimension, TagWeight[]>,
  selfTags: FigureSelection | null,
  profiles: SyntheticProfileRow[],
  syntheticMights: MightRecord[],
  tags: TagItem[],
  dimensionFilter: Dimension | 'all' = 'all',
): DiscoverProfile[] {
  const hasUserWeights =
    userWeights.personality.length > 0 ||
    userWeights.power.length > 0 ||
    userWeights.character.length > 0;
  const effectiveUserWeights = hasUserWeights ? userWeights : buildSelfWeights(selfTags, tags);

  const mightsByRecipient = new Map<string, MightRecord[]>();
  for (const m of syntheticMights) {
    const arr = mightsByRecipient.get(m.recipientId) ?? [];
    arr.push(m);
    mightsByRecipient.set(m.recipientId, arr);
  }

  const list: DiscoverProfile[] = profiles.map((p) => {
    const peerMights = mightsByRecipient.get(p.id) ?? [];
    const peerWeights =
      peerMights.length > 0
        ? computeDimensionWeights(peerMights, tags)
        : buildSelfWeights(
            { head: p.self_head, body: p.self_body, arms: p.self_arms },
            tags,
          );

    const circlesSet = new Set<Circle>();
    for (const m of peerMights) circlesSet.add(m.circle);
    const circles = ALL_CIRCLES.filter((c) => circlesSet.has(c));

    const sim = computeSimilarity(
      effectiveUserWeights,
      peerWeights,
      p.name.split(' ')[0],
      tags,
      dimensionFilter,
    );

    return {
      id: p.id,
      name: p.name,
      role: p.role,
      company: p.company,
      groupName: p.group_name,
      careerLevel: p.career_level,
      bio: p.bio,
      avatarUrl: p.avatar_url,
      photoUrl: p.photo_url,
      selfTags: {
        head: p.self_head,
        body: p.self_body,
        arms: p.self_arms,
      },
      taglinePt: p.tagline_pt,
      score: p.score,
      circles,
      similarityPct: sim.similarityPct,
      commonTags: sim.commonTags,
      biggestDifference: sim.biggestDifference,
      weightsByDimension: peerWeights,
      topTags: flattenTagCloud(peerWeights).slice(0, 6),
    };
  });

  list.sort(
    (a, b) =>
      b.similarityPct - a.similarityPct ||
      b.commonTags.length - a.commonTags.length ||
      a.name.localeCompare(b.name, 'pt'),
  );

  return list;
}

export function computeRoleRecommendations(
  userWeights: Record<Dimension, TagWeight[]>,
  selfTags: FigureSelection | null,
  discoverProfiles: DiscoverProfile[],
  roles: RoleRow[],
  tags: TagItem[],
): RolesResponse {
  const tagMap = buildTagMap(tags);
  const hasAccepted =
    userWeights.personality.length > 0 ||
    userWeights.power.length > 0 ||
    userWeights.character.length > 0;

  const effectiveWeights = hasAccepted ? userWeights : buildSelfWeights(selfTags, tags);

  const userWeightBySlug = new Map<string, number>();
  for (const dim of ALL_DIMENSIONS) {
    for (const tw of effectiveWeights[dim]) {
      userWeightBySlug.set(tw.slug, tw.weight);
    }
  }

  const disclaimerPt =
    'Apenas hipóteses baseadas nas tuas tags e em perfis semelhantes — não é um teste psicométrico.';

  const recs: RoleRecommendation[] = roles.map((role) => {
    const normalizedRoleWeights = new Map<string, number>();
    let totalRoleWeight = 0;

    for (const [rawKey, val] of Object.entries(role.tag_weights)) {
      const slug = tagMap.has(rawKey) ? rawKey : resolveTagSlug(tags, rawKey) ?? rawKey;
      const w = Number(val) || 0;
      if (w > 0) {
        normalizedRoleWeights.set(slug, w);
        totalRoleWeight += w;
      }
    }

    // Score overlap against user tag weights
    let rawOverlap = 0;
    const matchedEntries: Array<{ slug: string; labelPt: string; score: number }> = [];

    for (const [slug, rw] of normalizedRoleWeights.entries()) {
      const uw = userWeightBySlug.get(slug) ?? 0;
      if (uw > 0) {
        const contribution = rw * (0.45 + uw * 0.55);
        rawOverlap += contribution;
        matchedEntries.push({
          slug,
          labelPt: tagMap.get(slug)?.labelPt ?? slug,
          score: uw * rw,
        });
      }
    }

    matchedEntries.sort((a, b) => b.score - a.score);
    const matchedTags = matchedEntries.slice(0, 4).map((e) => e.labelPt);

    // Find top similar peers holding this role (or matching track/keywords)
    const roleLower = role.title_pt.toLowerCase();
    const trackKeywords = role.track_pt
      .toLowerCase()
      .split(/[\s&]+/)
      .filter((w) => w.length > 3);

    const matchingPeers: RolePeerRef[] = discoverProfiles
      .filter((p) => {
        const pr = p.role.toLowerCase();
        if (pr === roleLower || pr.includes(roleLower) || roleLower.includes(pr)) return true;
        return trackKeywords.some((kw) => pr.includes(kw));
      })
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        company: p.company,
        avatarUrl: p.avatarUrl,
        photoUrl: p.photoUrl,
        similarityPct: p.similarityPct,
      }));

    // Base score from tag-function matrix + peer affinity boost
    const maxPossible = Math.max(0.5, totalRoleWeight * 0.55);
    const tagNorm = Math.min(1, rawOverlap / maxPossible);
    const avgPeerSim =
      matchingPeers.length > 0
        ? matchingPeers.reduce((s, p) => s + p.similarityPct, 0) / matchingPeers.length / 100
        : 0;
    const peerBoost = matchingPeers.length > 0 ? 0.08 + avgPeerSim * 0.14 : 0;

    const rawPct = Math.round((tagNorm * 0.78 + peerBoost) * 100);
    const matchPct = Math.max(24, Math.min(97, rawPct));

    // Crisp 1-line explainable PT-PT hypothesis
    const t1 = matchedTags[0];
    const t2 = matchedTags[1];
    let hypothesisPt: string;
    if (t1 && t2 && matchingPeers.length > 0) {
      hypothesisPt = `Junta os teus traços ${t1} e ${t2} ao percurso de ${matchingPeers.length} ${matchingPeers.length === 1 ? 'pessoa semelhante' : 'pessoas semelhantes'} na rede.`;
    } else if (t1 && t2) {
      hypothesisPt = `Alinha com o teu peso em ${t1} e ${t2} — ${role.hypothesis_template_pt || role.summary_pt}`;
    } else if (t1) {
      hypothesisPt = `Parte da tua força em ${t1} e abre espaço para crescer em ${role.track_pt}.`;
    } else if (role.hypothesis_template_pt) {
      hypothesisPt = role.hypothesis_template_pt;
    } else {
      hypothesisPt = `Explora ${role.title_pt} como hipótese de crescimento na área de ${role.track_pt}.`;
    }

    return {
      slug: role.slug,
      titlePt: role.title_pt,
      trackPt: role.track_pt,
      level: role.level,
      matchPct,
      matchedTags,
      similarPeers: matchingPeers,
      sampleCompanies: role.sample_companies,
      hypothesisPt,
      summaryPt: role.summary_pt,
      disclaimerPt,
    };
  });

  recs.sort((a, b) => b.matchPct - a.matchPct || a.titlePt.localeCompare(b.titlePt, 'pt'));

  const pickBest = (lvl: 'now' | 'next' | 'stretch') =>
    recs.find((r) => r.level === lvl) ?? null;

  return {
    unlocked: hasAccepted,
    trajectory: {
      now: pickBest('now'),
      next: pickBest('next'),
      stretch: pickBest('stretch'),
    },
    roles: recs,
    disclaimerPt,
  };
}
