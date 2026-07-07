/**
 * 30 天情侣挑战模拟展示页（纯前端 demo）
 *
 * 让用户无需等待 30 天，即可直观看到一次完整的 30 天挑战体验。
 * - 示例情侣类型：烟火余生型（OLD_COUPLE）
 * - 30 个不重复任务（6 维度 × (4 fallback + 1 补充) 跨维度交错）
 * - 第 7、18 天模拟一方跳过，展示断点续接
 * - 顶部：30 天总览统计卡
 * - 中间：30 天任务时间轴（纵向列表）
 * - 底部：断点续接说明 + 典型日期详情
 *
 * 数据由内嵌 simulate() 生成，不调用任何 API，与 scripts/simulate-30days.ts 同源同逻辑。
 */
import { useMemo } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

// ==================== 类型（页面内自洽，避免跨端依赖） ====================

type Dimension = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';
type Difficulty = 'easy' | 'medium' | 'hard';
type Status = 'done' | 'skipped' | 'pending';

interface SimTask {
  title: string;
  desc: string;
  dim: Dimension;
  difficulty: Difficulty;
  estimatedMin: number;
}

interface SimDay {
  day: number;
  date: string;
  dateShort: string;
  task: SimTask;
  statusA: Status;
  statusB: Status;
  harmony?: number;
  aiSummary?: string;
  resonance?: string;
  complement?: string;
  streakAlive: boolean;
  currentStreak: number;
  isBreakpoint: boolean;
  skipReason?: string;
}

// ==================== 维度元信息 ====================

const DIM_LABEL: Record<Dimension, string> = {
  D1: '依恋',
  D2: '沟通',
  D3: '冲突修复',
  D4: '共同意义',
  D5: '信任承诺',
  D6: '亲密激情',
};

const DIFF_LABEL: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '挑战',
};

// ==================== 30 个不重复任务（与脚本同源） ====================
// 6 维度 × (4 fallback + 1 补充) = 30，跨维度交错排列

const TASKS: SimTask[] = [
  // ============ D1 依恋（5个）- 共同活动建立安全感 ============
  { title: '一起完成一次3分钟眼神对话', desc: '面对面坐下，不看手机不说话，只看对方的眼睛3分钟。结束后各说一句刚才的感受。这是最简单的"在一起"。', dim: 'D1', difficulty: 'easy', estimatedMin: 3 },
  { title: '一起听一首对你们有特殊意义的歌', desc: '找一首你们都喜欢的歌，戴上耳机或外放，一起完整听完。结束后各自写下一句听歌时想到的画面。', dim: 'D1', difficulty: 'easy', estimatedMin: 5 },
  { title: '一起给对方写一张"今天我注意到你"小纸条', desc: '花3分钟，各自写下一句今天注意到对方的细节（"你今天笑起来有点累"）。写完交换看，不解释，只接住。', dim: 'D1', difficulty: 'medium', estimatedMin: 5 },
  { title: '一起翻看手机里的合照', desc: '一起翻相册里的合照，各自挑出最喜欢的一张，告诉对方为什么喜欢这张。重点是"一起翻"，不是"选哪张"。', dim: 'D1', difficulty: 'medium', estimatedMin: 10 },
  { title: '一起完成15分钟同步呼吸练习', desc: '背靠背坐下，闭上眼，一起呼吸15分钟。感受对方的呼吸节奏，试着同步。结束后不说话，各自写一句感受。', dim: 'D1', difficulty: 'hard', estimatedMin: 15 },

  // ============ D2 沟通（5个）- 共同活动练习表达 ============
  { title: '一起玩"3真1假"游戏', desc: '各说4件关于自己的事（3件真的1件假的），对方猜哪件是假的。猜完后一起聊聊那些"真"的事。', dim: 'D2', difficulty: 'easy', estimatedMin: 5 },
  { title: '一起给对方讲今天最有意思的事', desc: '各自花3分钟，给对方讲今天自己遇到的最有意思的一件事。对方只能听，不能评论，不能打断，听完只说"谢谢你告诉我"。', dim: 'D2', difficulty: 'medium', estimatedMin: 6 },
  { title: '一起完成一次"无声晚餐"', desc: '一起吃一顿饭，全程不说话，只用眼神和手势交流。观察对方，感受对方，把注意力还给"在一起"本身。', dim: 'D2', difficulty: 'medium', estimatedMin: 15 },
  { title: '一起录制一段1分钟的"我们的播客"', desc: '打开手机录音，一起录一段1分钟的对话，主题是"今天我们各自的心情"。录完一起回放听一遍。', dim: 'D2', difficulty: 'medium', estimatedMin: 5 },
  { title: '一起完成一次"角色互换对话"', desc: '花10分钟，A扮演B，B扮演A，聊一件最近的小事。试着用对方的语气、对方的立场说话。结束后聊聊"原来你是这么想的"。', dim: 'D2', difficulty: 'hard', estimatedMin: 10 },

  // ============ D3 冲突修复（5个）- 共同活动修复关系 ============
  { title: '一起做一次"和好仪式"', desc: '为最近的一次小摩擦，双方各写一句"我做得不够好的地方"。写完一起把纸条撕掉，说一句"翻篇了"。', dim: 'D3', difficulty: 'easy', estimatedMin: 5 },
  { title: '一起完成"情绪温度计"', desc: '各自给今天的情绪打分（0-10分），写在纸上一起看。如果分差大，低分的一方说一句需要什么；如果分差小，互相击掌。', dim: 'D3', difficulty: 'easy', estimatedMin: 3 },
  { title: '一起做一件让对方开心的小事', desc: 'A给B倒杯水/泡杯茶，B给A捏肩1分钟。不需要说话，用行动说"我在乎你"。做完一起说一句"谢谢"。', dim: 'D3', difficulty: 'medium', estimatedMin: 5 },
  { title: '一起完成"拥抱和解"', desc: '为最近的一次小摩擦，给对方一个长拥抱（至少30秒），抱的时候说一句"我们和好了"。不解释，不翻旧账，只拥抱。', dim: 'D3', difficulty: 'medium', estimatedMin: 1 },
  { title: '一起写一张"我们的停战协议"', desc: '一起写下一句话："下次再有摩擦，我们先做____再说话"（比如先喝口水、先深呼吸3次）。双方共同签字，贴在冰箱上。', dim: 'D3', difficulty: 'hard', estimatedMin: 10 },

  // ============ D4 共同意义（5个）- 共同活动创造记忆 ============
  { title: '一起回忆你们第一次见面的场景', desc: '坐在一起，轮流讲你们第一次见面时记得的细节。讲完后各自写下一句话："当时没想到你会..."。一起看对方写的。', dim: 'D4', difficulty: 'easy', estimatedMin: 5 },
  { title: '一起画一张"我们的关系地图"', desc: '拿一张纸，一起标出你们去过的地方、想一起去的地方。各自用不同颜色的笔画，最后一起给地图起个名字。', dim: 'D4', difficulty: 'medium', estimatedMin: 15 },
  { title: '一起看一部电影', desc: '选一部你们都想看（或重温）的电影，一起完整看完。结束后各自写一句观后感，交换看。重点是"一起看完"，不快进不分心。', dim: 'D4', difficulty: 'medium', estimatedMin: 90 },
  { title: '一起做一顿饭', desc: '一起做一顿饭，哪怕只是煮一碗面。分工合作：一个切菜一个炒，或一个煮一个摆盘。做完一起吃，拍照留念。', dim: 'D4', difficulty: 'hard', estimatedMin: 30 },
  { title: '一起完成"关系时间胶囊"', desc: '各自写一封给一年后对方的信，封进信封，约定明年今日一起拆开。写的时候不放音乐不分心，只写给彼此的话。', dim: 'D4', difficulty: 'hard', estimatedMin: 20 },

  // ============ D5 信任承诺（5个）- 共同活动建立信任 ============
  { title: '一起完成一次"盲导信任走"', desc: '一人闭眼，另一人引导走一段路（5分钟）。引导方只用手势和简短语言，确保对方安全。走完交换角色。', dim: 'D5', difficulty: 'easy', estimatedMin: 5 },
  { title: '一起做一件对方一直想让你做的小事', desc: 'A陪B做一件B一直想让A做的事（看一集剧、吃一家店），B也陪A做一件A想做的事。一起完成，不分心。', dim: 'D5', difficulty: 'easy', estimatedMin: 10 },
  { title: '一起制定"本月承诺清单"', desc: '一起各写2件本月会为对方做的事（"周三晚上我洗碗"、"周末陪你逛街"）。写完一起念一遍，贴在冰箱上。', dim: 'D5', difficulty: 'medium', estimatedMin: 10 },
  { title: '一起完成"信任背靠背"', desc: '背靠背坐下，闭上眼，感受对方的呼吸3分钟。结束后各自说一句"刚才我想到了..."。不评价，只分享。', dim: 'D5', difficulty: 'medium', estimatedMin: 3 },
  { title: '一起做一件对方擅长而你不会的事', desc: '让擅长的一方教不擅长的一方做一件事（做饭、画画、运动）。一起完成，不评价对方学得怎么样，只说"谢谢你教我"。', dim: 'D5', difficulty: 'hard', estimatedMin: 20 },

  // ============ D6 亲密激情（5个）- 共同活动点燃浪漫 ============
  { title: '一起给对方一个20秒拥抱', desc: '今天主动给对方一个长拥抱（至少20秒），不发一言，只是抱。长拥抱会释放催产素，比短拥抱更拉近关系。', dim: 'D6', difficulty: 'easy', estimatedMin: 1 },
  { title: '一起跳一支舞', desc: '在客厅放一首你们喜欢的歌，一起跳一支舞。不会跳没关系，抱着晃就行。重点是"一起动起来"。', dim: 'D6', difficulty: 'easy', estimatedMin: 5 },
  { title: '一起完成"心动留言"', desc: '各自在对方手机备忘录留一句"今天我最心动你的瞬间"。留完一起看对方写的，再说一句"原来你是这么想的"。', dim: 'D6', difficulty: 'medium', estimatedMin: 5 },
  { title: '一起完成一次"无手机90分钟"深度共处', desc: '双方把手机调飞行模式放另一个房间。一起做一件需要专注共同完成的事（拼图、做饭、散步），结束后各自写下一句最享受的瞬间。', dim: 'D6', difficulty: 'hard', estimatedMin: 90 },
  { title: '一起看一次日落或日出', desc: '约一次一起看日落或日出，全程不说话只感受。结束后各自写一句话："刚才我想到的是..."。一起看对方写的。', dim: 'D6', difficulty: 'hard', estimatedMin: 30 },
];

// ==================== AI 默契度模板 ====================

const AI_SUMMARY: Record<Dimension, string[]> = {
  D1: ['今天的坦诚让你们离彼此又近了一寸', '你们都敢把心里话摊在桌上，这很珍贵'],
  D2: ['好好说话，是你们最稳的默契', '对话里多了倾听，少了评判'],
  D3: ['裂缝被你们亲手补上了光', '都愿意先看见自己，再看见对方'],
  D4: ['你们的故事有了新的注脚', '在回忆里找到彼此，在期待里看见未来'],
  D5: ['小事里的承诺，被你们一件件兑现', '信任不是不说，是说了也不动摇'],
  D6: ['今天的拥抱比昨天多停留了几秒', '浪漫不靠新鲜感，靠愿意在一起'],
};

const RESONANCE: Record<Dimension, string[]> = {
  D1: ['两人都愿意袒露脆弱，安全感在细微处生根', '脆弱没有被接住，而是被稳稳托住'],
  D2: ['对话里多了倾听，少了评判', '你们都在努力把话说完整'],
  D3: ['都愿意先看见自己，再看见对方', '不争对错，只看彼此'],
  D4: ['在回忆里找到彼此，在期待里看见未来', '你们对这段关系的想象开始重叠'],
  D5: ['信任在小事里被反复确认', '承诺不再是空话，是动作'],
  D6: ['浪漫不靠新鲜感，靠愿意在一起', '心动被你们重新接住了一次'],
};

const COMPLEMENT: Record<Dimension, string[]> = {
  D1: ['一方先开口，另一方总能稳稳接住', '一个怕说错，一个愿等'],
  D2: ['一个善于表达，一个善于接住', '一个习惯直说，一个习惯听完'],
  D3: ['一个先低头，一个愿给台阶', '一个易上头，一个能拉回'],
  D4: ['一个负责记，一个负责续', '一个想远方，一个顾脚下'],
  D5: ['一个稳得住，一个信得过', '一个敢承诺，一个敢相信'],
  D6: ['一个制造心动，一个接住心动', '一个主动靠近，一个温柔回应'],
};

// ==================== 可复现伪随机（保证数据稳定） ====================

let _seed = 20260706;
function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ==================== 日期工具 ====================

const START_DATE = new Date('2026-07-06T00:00:00+08:00');

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ==================== 模拟主逻辑 ====================

interface SimulationResult {
  days: SimDay[];
  stats: {
    completedDates: number;
    skippedDays: number;
    finalStreak: number;
    longestStreak: number;
    avgHarmony: number;
    totalDays: number;
    breakpoints: number[];
  };
}

function simulate(): SimulationResult {
  const days: SimDay[] = [];
  let streakAlive = false;
  let currentStreak = 0;
  let longestStreak = 0;
  const breakpoints: number[] = [];

  for (let i = 0; i < 30; i++) {
    const day = i + 1;
    const date = addDays(START_DATE, i);
    const task = TASKS[i];

    let statusA: Status = 'done';
    let statusB: Status = 'done';
    let isBreakpoint = false;
    let skipReason: string | undefined;

    // 断点 1：第 7 天 B 跳过
    if (day === 7) {
      statusB = 'skipped';
      isBreakpoint = true;
      skipReason = 'B 当天加班到深夜，未来得及完成';
      breakpoints.push(day);
    }
    // 断点 2：第 18 天 A 跳过
    else if (day === 18) {
      statusA = 'skipped';
      isBreakpoint = true;
      skipReason = 'A 出差途中手机没电，错过当天任务';
      breakpoints.push(day);
    }

    const bothDone = statusA === 'done' && statusB === 'done';
    let harmony: number | undefined;
    let aiSummary: string | undefined;
    let resonance: string | undefined;
    let complement: string | undefined;

    if (bothDone) {
      streakAlive = true;
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
      harmony = randInt(60, 95);
      const dim = task.dim;
      aiSummary = pick(AI_SUMMARY[dim]);
      resonance = pick(RESONANCE[dim]);
      complement = pick(COMPLEMENT[dim]);
    } else {
      streakAlive = false;
      currentStreak = 0;
    }

    days.push({
      day,
      date: fmtDate(date),
      dateShort: fmtShort(date),
      task,
      statusA,
      statusB,
      harmony,
      aiSummary,
      resonance,
      complement,
      streakAlive,
      currentStreak,
      isBreakpoint,
      skipReason,
    });
  }

  const completedDates = days.filter((d) => d.harmony !== undefined).length;
  const skippedDays = days.filter((d) => d.isBreakpoint).length;
  const scores = days
    .filter((d) => d.harmony !== undefined)
    .map((d) => d.harmony as number);
  const avgHarmony = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return {
    days,
    stats: {
      completedDates,
      skippedDays,
      finalStreak: currentStreak,
      longestStreak,
      avgHarmony,
      totalDays: 30,
      breakpoints,
    },
  };
}

// ==================== 页面组件 ====================

export default function SimulationPage() {
  const { days, stats } = useMemo(() => simulate(), []);
  const completionRate = Math.round((stats.completedDates / stats.totalDays) * 100);
  const progressWidth = `${completionRate}%`;

  // 断点详情
  const breakpointDays = stats.breakpoints.map((b) => days[b - 1]);
  // 典型日期详情
  const detailDays = [1, 7, 30].map((n) => days[n - 1]);

  return (
    <View className='sim'>
      {/* ===== 顶部：30 天总览统计卡 ===== */}
      <View className='stats-card'>
        <View className='stats-grid'>
          <View className='stats-item'>
            <Text className='stats-num'>
              {stats.completedDates}
              <Text className='unit'>/{stats.totalDays}天</Text>
            </Text>
            <Text className='stats-label'>完成天数</Text>
          </View>
          <View className='stats-divider' />
          <View className='stats-item'>
            <Text className='stats-num'>
              {stats.finalStreak}
              <Text className='unit'>天</Text>
            </Text>
            <Text className='stats-label'>当前连续</Text>
          </View>
          <View className='stats-divider' />
          <View className='stats-item'>
            <Text className='stats-num'>
              {stats.skippedDays}
              <Text className='unit'>天</Text>
            </Text>
            <Text className='stats-label'>跳过天数</Text>
          </View>
          <View className='stats-divider' />
          <View className='stats-item'>
            <Text className='stats-num'>
              {stats.avgHarmony}
              <Text className='unit'>分</Text>
            </Text>
            <Text className='stats-label'>平均默契度</Text>
          </View>
        </View>
        <View className='stats-progress'>
          <View className='progress-bar'>
            <View className='progress-fill' style={{ width: progressWidth }} />
          </View>
          <View className='progress-meta'>
            <Text>完成率 {completionRate}% · 最长连续 {stats.longestStreak} 天</Text>
            <Text className='breakpoints'>
              断点 {stats.breakpoints.map((b) => `第${b}天`).join('、')}
            </Text>
          </View>
        </View>
      </View>

      {/* ===== 情侣类型卡 ===== */}
      <View className='type-card'>
        <View className='type-head'>
          <Text className='type-name'>烟火余生型</Text>
          <Text className='type-code'>OLD_COUPLE</Text>
        </View>
        <Text className='type-line'>
          我们的浪漫不是烛光晚餐，是知道对方鞋子放哪只脚。
        </Text>
        <View className='type-meta'>
          <Text className='tag'>稳定期</Text>
          <Text className='tag'>安全×安全</Text>
          <Text className='tag'>冲突修复型</Text>
        </View>
      </View>

      {/* ===== 中间：30 天任务时间轴 ===== */}
      <Text className='section-title'>30 天任务时间轴</Text>
      <View className='timeline'>
        {days.map((d) => (
          <View
            key={d.day}
            className={`day-row${d.isBreakpoint ? ' breakpoint' : ''}`}
          >
            <View className='day-badge'>D{String(d.day).padStart(2, '0')}</View>
            <View className='day-main'>
              <Text className='day-title'>{d.task.title}</Text>
              <View className='day-sub'>
                <Text className='day-date'>{d.dateShort}</Text>
                <Text className='day-tag'>{d.task.dim}·{DIM_LABEL[d.task.dim]}</Text>
                <Text className={`day-tag diff-${d.task.difficulty}`}>
                  {DIFF_LABEL[d.task.difficulty]}
                </Text>
              </View>
            </View>
            <View className='day-right'>
              {d.harmony !== undefined ? (
                <Text className='day-harmony'>{d.harmony}</Text>
              ) : (
                <Text className='day-harmony skipped'>—</Text>
              )}
              <View className='day-status'>
                <Text className={`status-dot ${d.statusA}`}>
                  A·{d.statusA === 'done' ? '完成' : '跳过'}
                </Text>
                <Text className={`status-dot ${d.statusB}`}>
                  B·{d.statusB === 'done' ? '完成' : '跳过'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* ===== 底部：断点续接说明 ===== */}
      <Text className='section-title'>断点续接说明</Text>
      <View className='breakpoint-card'>
        <Text className='bp-intro'>
          30 天挑战采用「断点续接」机制：一方当天跳过 → 当日连续中断（streakAlive
          置为 false），但累计完成天数不重置；次日双方都完成 → 连接复活，从 1
          重新计连续。累计完成天数持续累加，断点不影响最终进度。
        </Text>
        {breakpointDays.map((d) => {
          const skipper = d.statusA === 'skipped' ? 'A' : 'B';
          const other = skipper === 'A' ? 'B' : 'A';
          const next = days[d.day];
          return (
            <View key={d.day} className='bp-item'>
              <View className='bp-head'>
                <Text className='bp-day'>第 {d.day} 天 · {d.dateShort}</Text>
                <Text className='bp-skipper'>{skipper} 跳过，{other} 完成</Text>
              </View>
              <Text className='bp-reason'>{d.skipReason}</Text>
              <Text className='bp-flow'>
                连续状态：<Text className='alive'>alive</Text> →{' '}
                <Text className='broken'>broken</Text>（当前连续归 0）
              </Text>
              {next && (
                <Text className='bp-flow'>
                  次日续接：第 {next.day} 天双方完成 →{' '}
                  <Text className='alive'>streakAlive 复活</Text>，连续重新计为{' '}
                  {next.currentStreak} 天
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* ===== 典型日期详情 ===== */}
      <Text className='section-title'>典型日期详情</Text>
      {detailDays.map((d) => (
        <View key={d.day} className='detail-card'>
          <View className='detail-head'>
            <Text className='detail-day'>第 {d.day} 天</Text>
            <Text className='detail-date'>{d.date}</Text>
          </View>
          <Text className='detail-task-title'>{d.task.title}</Text>
          <Text className='detail-task-desc'>{d.task.desc}</Text>
          <View className='detail-meta'>
            <Text>维度：{d.task.dim}·{DIM_LABEL[d.task.dim]}</Text>
            <Text>难度：{DIFF_LABEL[d.task.difficulty]}</Text>
            <Text>预计：{d.task.estimatedMin} 分钟</Text>
          </View>
          <View className='detail-status-row'>
            <Text>
              <Text className='label'>A 状态：</Text>
              <Text className={d.statusA === 'done' ? 'val-done' : 'val-skipped'}>
                {d.statusA === 'done' ? '✅ 完成' : '⏭ 跳过'}
              </Text>
            </Text>
            <Text>
              <Text className='label'>B 状态：</Text>
              <Text className={d.statusB === 'done' ? 'val-done' : 'val-skipped'}>
                {d.statusB === 'done' ? '✅ 完成' : '⏭ 跳过'}
              </Text>
            </Text>
          </View>

          {d.isBreakpoint ? (
            <View className='detail-break'>
              <Text className='reason'>⚠️ 断点日：{d.skipReason}</Text>
              <Text className='detail-streak'>
                streakAlive：<Text className='dead'>false</Text> · 当前连续：{d.currentStreak} 天
              </Text>
            </View>
          ) : (
            <View>
              <View className='detail-harmony'>
                <Text className='detail-harmony-num'>
                  <Text className='label'>默契度</Text>
                  {d.harmony} 分
                </Text>
              </View>
              <Text className='detail-ai'>
                <Text className='ico'>🤖</Text>AI 总结：{d.aiSummary}
              </Text>
              <Text className='detail-point'>
                <Text className='ico'>✨</Text>共鸣点：{d.resonance}
              </Text>
              <Text className='detail-point'>
                <Text className='ico'>🧩</Text>互补点：{d.complement}
              </Text>
              <Text className='detail-streak'>
                streakAlive：<Text className='alive'>true</Text> · 当前连续：{d.currentStreak} 天
              </Text>
            </View>
          )}
        </View>
      ))}

      <View className='sim-footer'>
        <Text>烟火余生型的 30 天，没有惊天动地的剧情，只有「稳稳在场」。</Text>
        <Text>浪漫不是烛光晚餐，是知道对方鞋子放哪只脚。</Text>
      </View>
    </View>
  );
}
