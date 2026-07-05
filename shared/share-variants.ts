/**
 * 4 种分享卡片变体文案模板
 * 按 rarity + compatibility 自动选择最合适的变体
 *
 * - boast（炫耀）：稀有类型 + 高默契度 → 强调稀缺与得意
 * - selfmock（自嘲）：低默契度 → 用幽默化解尴尬
 * - helpseek（求助）：中等默契度（40-60）→ 真诚求建议（改善空间最大）
 * - mystery（神秘）：默认 → 用悬念引发好奇
 *
 * 修复 W-2：原逻辑依赖 stage 字段触发 helpseek，但 ResultData 不含 stage，
 * 导致 helpseek 变体永不触发（死代码）。改为按 compatibility 区间选择，
 * 语义合理：中等默契度情侣改善空间最大，求助动机最强。
 *
 * 修复 W-3：boast 占比计算区分同性/异性（hetero 是 0-1 小数，同性是 0-100 整数）。
 */

export type ShareVariant = 'boast' | 'selfmock' | 'helpseek' | 'mystery';

export interface ShareVariantContext {
  rarity: 'common' | 'rare';
  compatibility: number; // 0-100
  stage?: string; // stable / honeymoon / adjustment / crisis / rebirth（保留字段，不再参与决策）
  typeName?: string;
  isSameSex?: boolean; // 同性组合不暴露类型名
  /** 类型估计占比（hetero 为 0-1 小数，同性为 0-100 整数），用于 boast 变体替换 N% */
  estimatedRatio?: number;
}

export interface ShareVariantResult {
  variant: ShareVariant;
  title: string; // 微信分享标题（<=35 字）
  momentsCopy: string; // 朋友圈文案
}

const TEMPLATES: Record<ShareVariant, (ctx: ShareVariantContext) => ShareVariantResult> = {
  boast: (ctx) => {
    // W-WC-3：移除「全国仅 N%」具体百分比措辞（违反广告法），改为不出现具体数值的相对稀有表述
    return {
      variant: 'boast',
      title: ctx.typeName && !ctx.isSameSex
        ? `我们居然是稀有类型「${ctx.typeName}」，在类型库中相对稀有`
        : `我们居然测出了稀有情侣类型，在类型库中相对稀有`,
      momentsCopy: `测了下我们的情侣类型，居然是稀有款 ${ctx.typeName && !ctx.isSameSex ? '「' + ctx.typeName + '」' : ''}。据说这种类型在类型库中相对稀有，快测测你们是什么`,
    };
  },
  selfmock: (ctx) => ({
    variant: 'selfmock',
    title: ctx.typeName && !ctx.isSameSex
      ? `我们的关系类型是「${ctx.typeName}」，但还是有救的`
      : '我们的情侣类型有点真实，但还是有救的',
    momentsCopy: `测了下我们的情侣类型，${ctx.typeName && !ctx.isSameSex ? '是「' + ctx.typeName + '」' : '结果有点真实'}。不过据说这种类型反而最值得修复，来测测你们会不会比我们好`,
  }),
  helpseek: (ctx) => ({
    variant: 'helpseek',
    title: ctx.typeName && !ctx.isSameSex
      ? `我们卡在「${ctx.typeName}」了，求建议`
      : '我们做完情侣测试卡住了，求建议',
    momentsCopy: `我们做完情侣测试，${ctx.typeName && !ctx.isSameSex ? '类型是「' + ctx.typeName + '」' : '结果有点扎心'}。默契度不上不下，有没有过来人给点建议`,
  }),
  mystery: (ctx) => ({
    variant: 'mystery',
    title: '我们做了情侣测试，结果竟然是…',
    momentsCopy: `刚和 TA 做完情侣测试，${ctx.typeName && !ctx.isSameSex ? '类型居然是「' + ctx.typeName + '」' : '结果出乎意料'}。想知道你们是哪种情侣？来测测`,
  }),
};

/**
 * 根据 rarity + compatibility 自动选模板
 *
 * 选择优先级：
 * 1. rare + compatibility >= 70 → boast（炫耀稀缺）
 * 2. compatibility < 40 → selfmock（低默契度用自嘲化解）
 * 3. 40 <= compatibility < 60 → helpseek（中等默契度改善空间最大，求助合理）
 * 4. 其他 → mystery
 */
export function pickShareVariant(ctx: ShareVariantContext): ShareVariantResult {
  let variant: ShareVariant;
  if (ctx.rarity === 'rare' && ctx.compatibility >= 70) {
    variant = 'boast';
  } else if (ctx.compatibility < 40) {
    variant = 'selfmock';
  } else if (ctx.compatibility < 60) {
    variant = 'helpseek';
  } else {
    variant = 'mystery';
  }
  return TEMPLATES[variant](ctx);
}

/** 变体中文标签（用于 UI 展示） */
export const VARIANT_LABELS: Record<ShareVariant, string> = {
  boast: '炫耀款',
  selfmock: '自嘲款',
  helpseek: '求助款',
  mystery: '神秘款',
};
