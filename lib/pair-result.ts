/**
 * PairSession 结果数据构建工具
 *
 * 抽取自 /api/pair/result 路由，供 /api/pair/unlock 复用，
 * 保证两个路由返回的 ResultData 结构完全一致。
 */
import { prisma } from '@/lib/prisma';
import { chatCompletion } from '@/lib/llm';
import {
  MULTI_DIM_ANALYSIS_SYSTEM_PROMPT,
  buildMultiDimAnalysisPrompt,
} from '@/lib/prompts';
import { parseJsonFromLlm } from '@/lib/task-service';
import { getCoupleTypesByGenderCombo } from '@/shared/couple-types-all';
import type {
  GenderCombo,
  DimensionScores,
  Rarity,
  MultiDimAnalysis,
} from '@/shared/types';
import type { PairSession, CoupleType } from '@prisma/client';

/** PairSession 含 coupleType 关联的 Prisma 类型 */
type PairSessionWithCoupleType = PairSession & {
  coupleType: CoupleType | null;
  initiatorUser: { nickname: string | null; avatarUrl: string | null } | null;
  responderUser: { nickname: string | null; avatarUrl: string | null } | null;
};

/** 统一的类型展示字段（来自 Prisma CoupleType 或 shared CoupleTypeInfo 都能映射） */
interface ResolvedType {
  code: string;
  name: string;
  emoji: string;
  rarity: string;
  oneLiner: string;
  description: string;
  hiddenRisks: string;
  growthAdvice: string;
  shareCopy: string;
  radarProfile: unknown;
  estimatedRatio?: number;
}

export interface MatchedType {
  code: string;
  name: string;
  emoji: string;
  rarity: Rarity;
  oneLiner: string;
  description?: string;
  hiddenRisks?: string;
  growthAdvice?: string;
  shareCopy?: string;
  radarProfile?: Record<string, number>;
  /** 类型估计占比（hetero 为 0-1 小数，同性为 0-100 整数），用于 boast 变体替换 N% */
  estimatedRatio?: number;
}

export interface AlternativeType {
  code: string;
  name: string;
  emoji: string;
  oneLiner: string;
}

export interface ResultData {
  pairSessionId: string;
  isInitiator: boolean;
  unlocked: boolean;
  paid: boolean;
  compatibility: number;
  matched: MatchedType;
  alternatives?: AlternativeType[];
  summary?: string;
  dimensionsA?: Record<string, number>;
  dimensionsB?: Record<string, number>;
  /** 性别组合 'male-male' / 'male-female' / 'female-female' 等，可在未解锁时返回（不泄露答案） */
  genderCombo?: string;
  /** A（自己）的昵称，unlocked 后返回 */
  myNickname?: string;
  /** A（自己）的头像 URL，unlocked 后返回 */
  myAvatar?: string;
  /** B（对方）的昵称，unlocked 后返回 */
  partnerNickname?: string;
  /** B（对方）的头像 URL，unlocked 后返回 */
  partnerAvatar?: string;
  /** V3 多维度分析（深度解锁后 LLM 生成并缓存） */
  multiDimAnalysis?: MultiDimAnalysis;
}

/**
 * 解析 PairSession.alternatives（Json），返回 code 数组
 * 兼容两种格式：["CODE_A", ...] 和 [{ code: "CODE_A", ... }, ...]
 */
function parseAlternativeCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && 'code' in item) {
        return (item as { code: string }).code;
      }
      return null;
    })
    .filter((c): c is string => !!c);
}

/**
 * 从 PairSession 解析出展示用类型
 *
 * Phase 3 起优先级：
 * 1. pair.coupleType（matchedTypeId 关联，Prisma 自动 include）
 * 2. pair.matchedTypeCode（Phase 3 submit 路由写入的 code，查 CoupleType 表）
 * 3. 兜底：按 genderCombo 取首个 common 类型（仅用于 Phase 1/2 遗留旧数据）
 */
async function resolveMatchedType(
  pair: PairSessionWithCoupleType,
): Promise<ResolvedType | null> {
  // 1. matchedTypeId 关联查询（Prisma include）
  if (pair.coupleType) {
    const ct = pair.coupleType;
    return {
      code: ct.code,
      name: ct.name,
      emoji: ct.emoji,
      rarity: ct.rarity,
      oneLiner: ct.oneLiner,
      description: ct.description,
      hiddenRisks: ct.hiddenRisks,
      growthAdvice: ct.growthAdvice,
      shareCopy: ct.shareCopy,
      radarProfile: ct.radarProfile,
      estimatedRatio: ct.estimatedRatio,
    };
  }

  // 2. matchedTypeCode 查 CoupleType（Phase 3 submit 路由写入）
  if (pair.matchedTypeCode) {
    const ct = await prisma.coupleType.findUnique({
      where: { code: pair.matchedTypeCode },
    });
    if (ct) {
      return {
        code: ct.code,
        name: ct.name,
        emoji: ct.emoji,
        rarity: ct.rarity,
        oneLiner: ct.oneLiner,
        description: ct.description,
        hiddenRisks: ct.hiddenRisks,
        growthAdvice: ct.growthAdvice,
        shareCopy: ct.shareCopy,
        radarProfile: ct.radarProfile,
        estimatedRatio: ct.estimatedRatio,
      };
    }
  }

  // 3. 兜底：按 genderCombo 取首个 common 类型（Phase 1/2 旧数据）
  const genderCombo = pair.genderCombo as GenderCombo;
  const types = getCoupleTypesByGenderCombo(genderCombo);
  const fallback = types.find((t) => t.rarity === 'common') ?? types[0];
  if (!fallback) return null;
  return {
    code: fallback.code,
    name: fallback.name,
    emoji: fallback.emoji,
    rarity: fallback.rarity,
    oneLiner: fallback.oneLiner,
    description: fallback.description,
    hiddenRisks: fallback.hiddenRisks,
    growthAdvice: fallback.growthAdvice,
    shareCopy: fallback.shareCopy,
    radarProfile: fallback.radarProfile,
    estimatedRatio: fallback.estimatedRatio,
  };
}

/**
 * 解析备选类型列表
 * - 优先从 PairSession.alternatives 解析 code，再查 CoupleType 表
 * - 为空且付费时，按 genderCombo 取下 2 个 common 类型作为占位
 */
async function resolveAlternatives(
  pair: PairSessionWithCoupleType,
  resolvedCode: string,
  paid: boolean,
): Promise<AlternativeType[]> {
  const altCodes = parseAlternativeCodes(pair.alternatives);
  if (altCodes.length > 0) {
    const altTypes = await prisma.coupleType.findMany({
      where: { code: { in: altCodes } },
      select: { code: true, name: true, emoji: true, oneLiner: true },
    });
    return altCodes
      .map((code) => altTypes.find((t) => t.code === code))
      .filter((t): t is NonNullable<typeof t> => !!t)
      .map((t) => ({
        code: t.code,
        name: t.name,
        emoji: t.emoji,
        oneLiner: t.oneLiner,
      }));
  }

  if (!paid) return [];

  // Phase 1 未设置 alternatives：付费后用 genderCombo 取下 2 个 common 类型作为占位
  const genderCombo = pair.genderCombo as GenderCombo;
  const types = getCoupleTypesByGenderCombo(genderCombo);
  return types
    .filter((t) => t.rarity === 'common' && t.code !== resolvedCode)
    .slice(0, 2)
    .map((t) => ({
      code: t.code,
      name: t.name,
      emoji: t.emoji,
      oneLiner: t.oneLiner,
    }));
}

/**
 * 从 PairSession 构建 ResultData
 *
 * @param pair PairSession（需 include coupleType）
 * @param userId 当前用户 ID
 * @returns ResultData 或抛错（类型库数据异常时）
 */
export async function buildResultData(
  pair: PairSessionWithCoupleType,
  userId: string,
): Promise<ResultData> {
  const isInitiator = pair.initiatorUserId === userId;
  const unlocked = pair.resultSharedToInitiator;
  // B-WC-1 修复：MVP 阶段深度内容免费开放，paid 一律返回 true（已分享后深度内容总是显示）
  // V2 接入虚拟支付后恢复 paid = pair.unlocked
  const paid = true;

  // 未分享：返回最小信息
  if (!unlocked) {
    return {
      pairSessionId: pair.id,
      isInitiator,
      unlocked: false,
      paid: false,
      compatibility: 0,
      matched: {
        code: '',
        name: '',
        emoji: '',
        rarity: 'common',
        oneLiner: '',
      },
      genderCombo: pair.genderCombo,
    };
  }

  // 已分享：组装基础结果
  const compatibility = pair.compatibility ?? 0;
  const resolved = await resolveMatchedType(pair);
  if (!resolved) {
    throw new Error('类型库数据异常');
  }

  // 组装 matched（深度字段根据 paid 决定）
  const matched: MatchedType = {
    code: resolved.code,
    name: resolved.name,
    emoji: resolved.emoji,
    rarity: resolved.rarity as Rarity,
    oneLiner: resolved.oneLiner,
    // radarProfile 始终返回（前端雷达图用类型典型特征做回退）
    radarProfile: resolved.radarProfile as Record<string, number>,
    estimatedRatio: resolved.estimatedRatio,
  };
  if (paid) {
    matched.description = resolved.description;
    matched.hiddenRisks = resolved.hiddenRisks;
    matched.growthAdvice = resolved.growthAdvice;
    matched.shareCopy = resolved.shareCopy;
  }

  // alternatives
  const alternatives = await resolveAlternatives(pair, resolved.code, paid);

  // summary：深度内容根据 paid 决定
  let summary: string | undefined;
  if (paid) {
    summary = pair.summary ?? undefined;
  }

  // dimensionsA / dimensionsB：付费后返回双方维度分数（用于雷达图对比）
  let dimensionsA: Record<string, number> | undefined;
  let dimensionsB: Record<string, number> | undefined;
  if (paid) {
    dimensionsA = (pair.dimensionsA as DimensionScores) ?? undefined;
    dimensionsB = (pair.dimensionsB as DimensionScores) ?? undefined;
  }

  // V3 深度解锁：判断 deepUnlockMethod 是否已设置（保留 unlocked = basic 解锁含义）
  const deepUnlocked = !!pair.deepUnlockMethod;

  // 多维度分析：深度解锁后从缓存读取，无缓存则调用 LLM 生成并落库
  let multiDimAnalysis: MultiDimAnalysis | undefined;
  if (deepUnlocked) {
    if (pair.multiDimAnalysis) {
      multiDimAnalysis = parseJsonFromLlm<MultiDimAnalysis>(pair.multiDimAnalysis) ?? undefined;
    } else {
      try {
        const prompt = buildMultiDimAnalysisPrompt({
          dimensionsA: (pair.dimensionsA as Record<string, number>) ?? {},
          dimensionsB: (pair.dimensionsB as Record<string, number>) ?? {},
          compatibility: pair.compatibility ?? 0,
          coupleTypeName: pair.coupleType?.name ?? '未知',
          coupleTypeOneLiner: pair.coupleType?.oneLiner ?? '',
          genderCombo: pair.genderCombo,
        });
        const raw = await chatCompletion(MULTI_DIM_ANALYSIS_SYSTEM_PROMPT, prompt, 800);
        const parsed = parseJsonFromLlm<MultiDimAnalysis>(raw);
        if (parsed?.overview) {
          // 缓存到数据库（避免重复调用 LLM）
          await prisma.pairSession.update({
            where: { id: pair.id },
            data: {
              multiDimAnalysis: raw,
              multiDimGeneratedAt: new Date(),
            },
          });
          multiDimAnalysis = parsed;
        }
      } catch {
        // LLM 失败不阻塞，返回默认提示（multiDimAnalysis 保持 undefined）
      }
    }
  }

  // 已分享时，根据 isInitiator 映射 my/partner（双方头像区域）
  const myUser = isInitiator ? pair.initiatorUser : pair.responderUser;
  const partnerUser = isInitiator ? pair.responderUser : pair.initiatorUser;

  return {
    pairSessionId: pair.id,
    isInitiator,
    unlocked: true,
    paid,
    compatibility,
    matched,
    alternatives: alternatives.length > 0 ? alternatives : undefined,
    summary,
    dimensionsA,
    dimensionsB,
    genderCombo: pair.genderCombo,
    myNickname: myUser?.nickname ?? undefined,
    myAvatar: myUser?.avatarUrl ?? undefined,
    partnerNickname: partnerUser?.nickname ?? undefined,
    partnerAvatar: partnerUser?.avatarUrl ?? undefined,
    multiDimAnalysis,
  };
}
