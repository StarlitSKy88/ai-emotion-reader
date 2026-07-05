/**
 * 批量生成 65 种情侣类型 AI 配图
 *
 * 调用 trae text_to_image API，下载到 public/types/<code>.png
 * - 并发 5
 * - 失败重试 2 次
 * - 进度日志
 *
 * 运行：node scripts/generate-type-images.ts
 *
 * 鉴权说明：API 需要 TRAE IDE 会话鉴权。若在浏览器/IDE 内联上下文中运行，
 * cookie 会自动携带；独立 Node 脚本默认无鉴权，调用会返回
 * {"code":1001,"message":"Authentication failed"} 并 302 到 default.jpeg。
 * 本脚本通过 md5 比对识别 default.jpeg 兜底图，标记为失败。
 *
 * 如需在已鉴权环境运行，可设置环境变量 TRAE_AUTH_COOKIE（完整 Cookie 字符串），
 * 脚本会作为 Cookie 头透传。
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// 65 种情侣类型 code → AI 生图 prompt 映射
// 风格统一：深色电影感、低饱和度、warm cream (#E1E0CC) 主色调、抽象意象、无人脸、无文字
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_SUFFIX =
  'deep dark background, warm cream (#E1E0CC) and amber accent tones, low saturation, moody atmospheric lighting, soft film grain texture, no faces, no text, no people, minimal composition, elegant editorial aesthetic, 1:1 square composition';

type PromptEntry = { code: string; imagery: string };

const PROMPTS: PromptEntry[] = [
  // ==================== 异性恋 35 种 ====================
  // 30 common
  { code: 'OLD_COUPLE', imagery: 'residual sparks of fireworks fading into a dark night sky, two intertwined smoke trails slowly dissolving, warm afterglow embers settling' },
  { code: 'DOUBLE_HELIX', imagery: 'two glowing helical strands intertwining upward like a DNA spiral, warm amber luminous ribbon, graceful double helix' },
  { code: 'KITE_LINE', imagery: 'a single taut kite string stretching from dark earth up into deep sky, geometric tension, a small distant angular kite silhouette' },
  { code: 'CAT_LASER', imagery: 'a thin darting beam of amber light cutting through dark fog, an elusive glowing dot, swift playful motion trail' },
  { code: 'NEW_WINE', imagery: 'a glass of dark wine glowing amber in dim candlelight, swirling vapor rising, intoxicating hazy atmosphere, deep red liquid' },
  { code: 'TWIN_STAR', imagery: 'two distant stars orbiting in parallel across cold deep space, faint separate light trails, vast dark void between them' },
  { code: 'COMRADE_BACK_TO_BACK', imagery: 'two shield-like geometric slabs standing back to back, warm amber metallic sheen, battle-worn surfaces, defensive stance' },
  { code: 'LIGHTHOUSE_BOAT', imagery: 'a single focused beam of warm light from a dark tower sweeping across black water, guiding a small floating vessel silhouette' },
  { code: 'FERRY_BOAT', imagery: 'a small wooden boat lifted by gentle dark waves toward a warm glow, rescuing amber light reflected on water surface' },
  { code: 'TWIN_VINE', imagery: 'two parallel vines growing upward and gently intertwining, each with its own strong roots, vibrant amber leaves, mutual upward reach' },
  { code: 'MARS_EARTH', imagery: 'two glowing celestial bodies colliding in dark space, explosive amber sparks scattering, planetary impact, dramatic cosmic collision' },
  { code: 'OLD_WELL', imagery: 'a deep mossy stone well with still dark water reflecting a faint circle of light far below, ancient stones' },
  { code: 'MIGRATORY_BIRD', imagery: 'a solitary bird silhouette flying across a pale moonlit sky, a thin curving migration path trailing behind' },
  { code: 'HOURGLASS', imagery: 'an hourglass with streams of falling amber sand glowing faintly, dark void surrounding, geometric brass frame, time slipping' },
  { code: 'SIEGE_CASTLE', imagery: 'a dark stone fortress surrounded by swirling fog, walls and an outer faint amber light pressing in, besieged silence' },
  { code: 'BROKEN_MIRROR', imagery: 'shattered mirror fragments reassembling in midair, golden amber light glowing in the cracks, kintsugi-like repair' },
  { code: 'AGED_WINE', imagery: 'a dusty old wine bottle draped with cobwebs, amber liquid glowing faintly inside, faded dim storage cellar' },
  { code: 'TILTED_SCALE', imagery: 'an unbalanced brass balance scale tipping sharply to one side, a heavy weight on one pan and a feather on the other' },
  { code: 'CLOUD_DESKMATE', imagery: 'two soft cloud forms floating side by side on the surface of a dim sky, light and airy but never touching deeply' },
  { code: 'CHILDHOOD_ECHO', imagery: 'concentric ripples expanding outward from a single point in still dark water, echoing waves, repeating fading circles' },
  { code: 'LAVA_REBORN', imagery: 'molten lava flowing and solidifying into new black rock, glowing orange cracks of fire, rebirth from destruction' },
  { code: 'WINTER_SUN', imagery: 'a low warm sun barely above a dark horizon, faint golden rays cutting through cold blue mist, gentle thawing light' },
  { code: 'ICE_FIRE', imagery: 'crystalline blue ice and a flickering amber flame meeting edge to edge, rising steam, extreme temperature contrast' },
  { code: 'RESONANCE', imagery: 'two tuning forks vibrating in sync, overlapping concentric amber sound waves rippling outward, perfect harmony' },
  { code: 'DORMANT_VOLCANO', imagery: 'a calm cone-shaped mountain with faint glowing amber cracks running beneath the surface, thin wisps of smoke' },
  { code: 'TRAVEL_COMPANION', imagery: 'two vintage suitcases sitting together on a dim railway platform, soft amber platform light, side by side journey' },
  { code: 'NEST_FEATHER', imagery: 'a tightly woven dark nest cradling a single glowing amber feather, protective surrounding, soft inner warmth' },
  { code: 'PARTNER', imagery: 'two interlocking brass gears turning in a dark precision mechanism, amber metallic sheen, mechanical partnership' },
  { code: 'BENCH_PLAYER', imagery: 'a single empty wooden chair in a dim spotlight, dust particles drifting in the light beam, waiting in silence' },
  { code: 'SUMMER_CICADA', imagery: 'sound waves rendered as golden concentric ripples expanding in warm summer air, fleeting vibration, ephemeral resonance' },
  // 5 rare
  { code: 'R_TWIN_FLAME', imagery: 'two flames merging into one brilliant amber star, sacred geometry, twin fires uniting, radiant convergence' },
  { code: 'R_MOTH_FLAME', imagery: 'a small winged silhouette drawn toward a bright burning amber flame, fatal attraction, incandescent pull' },
  { code: 'R_STILL_WELL', imagery: 'a perfectly still dark pool of water with a mirror surface, absolute calm, undisturbed reflection, deep quiet' },
  { code: 'R_PHOENIX_REBIRTH', imagery: 'a burst of amber light rising from smoldering ashes, wings of fire forming, rebirth from ruin' },
  { code: 'R_TWO_TREES', imagery: 'two tall separate trees standing independently, their roots visibly intertwined deep underground, mutual nourishment' },

  // ==================== 男男 15 种 ====================
  { code: 'MM_MIRROR', imagery: 'two mirrors facing each other creating an infinite regression of amber reflections, parallel glass surfaces' },
  { code: 'MM_LIGHTHOUSE', imagery: 'a tall dark light tower with a sweeping beam cutting through fog over black water, distant small craft' },
  { code: 'MM_PARALLEL', imagery: 'two parallel light trails walking forward together across a dark terrain, equal stride, side by side path' },
  { code: 'MM_DUAL_NEST', imagery: 'two intertwined nests glowing with shared warmth, overlapping spherical forms, mutual care' },
  { code: 'MM_HUNTER_FOX', imagery: 'a darting amber streak and a pursuing beam of light threading through a dark forest, chase and evasion' },
  { code: 'MM_SHIELD_WARRIOR', imagery: 'two overlapping shields forming a unified barrier, amber metallic sheen, defensive solidarity' },
  { code: 'MM_LOCKED_ROOM', imagery: 'a closed dark wooden door with warm amber light seeping beneath it and through the keyhole, hidden interior' },
  { code: 'MM_GARDEN_WINDOW', imagery: 'an open window looking onto a dark garden where a single amber flower blooms, framed opening' },
  { code: 'MM_DUAL_TOWER', imagery: 'two slender dark towers standing tall in a landscape, each crowned with a steady warm light, mutual watch' },
  { code: 'MM_FIREWORKS_COOLING', imagery: 'fading smoke trails dissolving in a dark sky after fireworks, dim residual embers cooling' },
  { code: 'MM_TIDE_MOON', imagery: 'a distant pale moon pulling gentle tides across dark water, rhythmic swelling waves, lunar pull' },
  { code: 'MM_OLD_TREE_NEW_BUD', imagery: 'an ancient gnarled dark trunk with a single bright new amber-tinged shoot emerging, renewal on old wood' },
  { code: 'MM_OLD_WELL', imagery: 'a quiet circular stone well in deep darkness, a faint still water reflection far below, absolute stillness' },
  { code: 'MM_MIGRATORY_BIRD', imagery: 'a lone bird silhouette crossing distant pale moonlight, a thin migration trail behind it' },
  { code: 'MM_MARS_EARTH', imagery: 'two glowing orbs colliding in a dark void, amber sparks scattering, dramatic planetary impact' },

  // ==================== 女女 15 种 ====================
  { code: 'FF_VINE', imagery: 'fast-growing vines rapidly wrapping around each other and spiraling upward, intense intertwining, urgent growth' },
  { code: 'FF_DUAL_ANXIOUS', imagery: 'two vibrating tuning forks creating rippling interference patterns, overlapping amber wave fields, resonant tension' },
  { code: 'FF_TIDAL', imagery: 'two waves flowing toward and away from each other on a dark shore, alternating rhythm, ebb and flow' },
  { code: 'FF_TWIN_VINE', imagery: 'two graceful vines growing side by side and occasionally touching, amber blooms at the points of contact' },
  { code: 'FF_CAT', imagery: 'two soft cat-eye glows in darkness, separate but mutually aware, gentle amber luminescence, independent closeness' },
  { code: 'FF_COCOON', imagery: 'a glowing amber cocoon splitting open with light emerging from the crack, transformation in progress, rebirth' },
  { code: 'FF_UNDERCURRENT', imagery: 'a dark smooth ice surface with swirling amber currents visible deep beneath, hidden motion under stillness' },
  { code: 'FF_SHINE_TOGETHER', imagery: 'two bright stars shining side by side, each distinct and radiant, forming a shared constellation' },
  { code: 'FF_TWIN_TOWER', imagery: 'two quiet towers in a still dark landscape, each with a warm steady light, calm mutual vigil' },
  { code: 'FF_LIGHTHOUSE', imagery: 'a beam of warm light sweeping across dark water, guiding a small drifting craft, distant tower glow' },
  { code: 'FF_KITE_LINE', imagery: 'a taut thin thread connecting the ground to a drifting angular form in a dark sky, held tension' },
  { code: 'FF_FIREWORK_COOLING', imagery: 'dissolving smoke trails in a dark sky, fading amber sparks dispersing, quiet afterglow' },
  { code: 'FF_OLD_WELL', imagery: 'a deep quiet stone well with still water catching a faint circle of light, undisturbed surface' },
  { code: 'FF_PHOENIX', imagery: 'rising amber flames from a bed of ashes forming a wing-like shape, fiery rebirth, soaring light' },
  { code: 'FF_MIGRATORY_BIRD', imagery: 'a bird silhouette against a pale distant moon, a long curving journey path trailing behind' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image';
const IMAGE_SIZE = 'square';
const OUTPUT_DIR = join(process.cwd(), 'public', 'types');
const CONCURRENCY = 5;
const MAX_RETRIES = 2; // 失败重试次数（首次 + 2 次重试 = 最多 3 次尝试）
const REQUEST_TIMEOUT_MS = 60_000;

/** 鉴权失败时 API 302 重定向到的兜底图，md5 用于识别 */
const DEFAULT_IMAGE_MD5 = '19a0b822edb11957055e4588c2159058';

/** 可选：通过环境变量透传 TRAE 会话 Cookie（已鉴权环境运行时使用） */
const TRAE_AUTH_COOKIE = process.env.TRAE_AUTH_COOKIE ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function buildPromptUrl(imagery: string): string {
  const full = `Abstract cinematic illustration of ${imagery}, ${STYLE_SUFFIX}`;
  return `${API_BASE}?prompt=${encodeURIComponent(full)}&image_size=${IMAGE_SIZE}`;
}

function md5(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type FetchResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: string };

/**
 * 调用 text_to_image API 并下载图片。
 * 鉴权失败时 API 返回 302 + JSON {"code":1001,...}，Location 指向 default.jpeg。
 * 通过跟随重定向后比对 md5 识别兜底图。
 */
async function fetchImage(code: string, imagery: string, attempt: number): Promise<FetchResult> {
  const url = buildPromptUrl(imagery);
  const headers: Record<string, string> = {
    Accept: 'image/*,*/*;q=0.8',
  };
  if (TRAE_AUTH_COOKIE) headers.Cookie = TRAE_AUTH_COOKIE;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
    }

    const contentType = res.headers.get('content-type') ?? '';
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // 非图片响应（如直接返回 JSON 错误）
    if (!contentType.startsWith('image/')) {
      const text = buffer.toString('utf8').slice(0, 200);
      return { ok: false, reason: `non-image response (${contentType}): ${text}` };
    }

    // 识别兜底图（鉴权失败时 302 → default.jpeg）
    const hash = md5(buffer);
    if (hash === DEFAULT_IMAGE_MD5) {
      return {
        ok: false,
        reason: 'auth-failed: API returned default fallback image (code 1001 Authentication failed)',
      };
    }

    return { ok: true, buffer };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `fetch error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(code: string, imagery: string): Promise<FetchResult> {
  let lastReason = 'unknown';
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const result = await fetchImage(code, imagery, attempt);
    if (result.ok) return result;
    lastReason = result.reason;
    // 鉴权失败无需重试（重试也是同样结果），但为遵守「失败重试 2 次」的规范仍执行
    if (attempt <= MAX_RETRIES) {
      await sleep(800 * attempt);
    }
  }
  return { ok: false, reason: lastReason };
}

// ─────────────────────────────────────────────────────────────────────────────
// 并发调度
// ─────────────────────────────────────────────────────────────────────────────

async function runPool<T, R>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let completed = 0;
  const total = items.length;

  async function runOne(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      const item = items[idx];
      results[idx] = await worker(item, idx);
      completed++;
      if (completed % 5 === 0 || completed === total) {
        console.log(`  进度: ${completed}/${total} (${Math.round((completed / total) * 100)}%)`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(size, items.length) }, () => runOne());
  await Promise.all(workers);
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  情侣类型 AI 配图批量生成');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  类型总数: ${PROMPTS.length}`);
  console.log(`  输出目录: ${OUTPUT_DIR}`);
  console.log(`  并发数:   ${CONCURRENCY}`);
  console.log(`  重试次数: ${MAX_RETRIES}`);
  console.log(`  图片尺寸: ${IMAGE_SIZE}`);
  console.log(`  鉴权Cookie: ${TRAE_AUTH_COOKIE ? '已配置 (' + TRAE_AUTH_COOKIE.length + ' 字符)' : '未配置（独立脚本默认无鉴权）'}`);
  console.log('───────────────────────────────────────────────────────────');

  // 创建输出目录
  mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✓ 输出目录已就绪: ${OUTPUT_DIR}`);

  console.log('\n▶ 开始生成...\n');
  const startTs = Date.now();

  type Outcome = { code: string; ok: boolean; reason?: string; bytes?: number };
  const outcomes: Outcome[] = await runPool(
    PROMPTS,
    CONCURRENCY,
    async (entry, idx): Promise<Outcome> => {
      const result = await fetchWithRetry(entry.code, entry.imagery);
      if (result.ok) {
        const outPath = join(OUTPUT_DIR, `${entry.code}.png`);
        writeFileSync(outPath, result.buffer);
        console.log(`  [${String(idx + 1).padStart(2, '0')}/${PROMPTS.length}] ✓ ${entry.code} (${result.buffer.length} bytes)`);
        return { code: entry.code, ok: true, bytes: result.buffer.length };
      } else {
        console.log(`  [${String(idx + 1).padStart(2, '0')}/${PROMPTS.length}] ✗ ${entry.code} — ${result.reason}`);
        return { code: entry.code, ok: false, reason: result.reason };
      }
    },
  );

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
  const succeeded = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  生成结果汇总');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  总数: ${PROMPTS.length}`);
  console.log(`  成功: ${succeeded.length}`);
  console.log(`  失败: ${failed.length}`);
  console.log(`  耗时: ${elapsed}s`);
  console.log(`  输出目录: ${OUTPUT_DIR}`);

  if (succeeded.length > 0) {
    console.log('\n✓ 成功列表:');
    for (const o of succeeded) {
      console.log(`    ${o.code}.png  (${o.bytes} bytes)`);
    }
  }

  if (failed.length > 0) {
    console.log('\n✗ 失败列表:');
    for (const o of failed) {
      console.log(`    ${o.code} — ${o.reason}`);
    }
    // 失败原因归类
    const reasons = new Map<string, string[]>();
    for (const o of failed) {
      const key = o.reason ?? 'unknown';
      if (!reasons.has(key)) reasons.set(key, []);
      reasons.get(key)!.push(o.code);
    }
    console.log('\n  失败原因归类:');
    for (const [reason, codes] of reasons) {
      console.log(`    [${codes.length} 张] ${reason}`);
      console.log(`      codes: ${codes.join(', ')}`);
    }
  }

  console.log('\n───────────────────────────────────────────────────────────');
  if (failed.length > 0 && succeeded.length === 0) {
    console.log('  ⚠ 全部失败 — 通常因为 API 需 TRAE IDE 会话鉴权。');
    console.log('     解决方案：');
    console.log('     1) 在 TRAE IDE 内已登录的浏览器上下文中运行；');
    console.log('     2) 或设置环境变量 TRAE_AUTH_COOKIE 后重跑：');
    console.log('        TRAE_AUTH_COOKIE="你的cookie字符串" node scripts/generate-type-images.ts');
  }
  console.log('───────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('脚本异常退出:', err);
  process.exit(1);
});
