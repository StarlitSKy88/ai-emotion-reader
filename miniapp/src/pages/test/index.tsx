/**
 * 测试页
 * - 首次进入选择性别（决定题库）
 * - 30 道选择题 + 1 道开放题
 * - 答题进度本地缓存（断点续答）
 * - 提交到 /api/test/submit
 *   - A 模式（无 inviterTestSessionId）：跳 invite 页（带 testSessionId）
 *   - B 模式（有 inviterTestSessionId）：跳 result 页（带 pairSessionId）
 */
import { useState, useMemo } from 'react';
import { View, Text, Textarea, Button, Progress } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { MALE_TEST_BANK } from '@shared/test-bank-male';
import { FEMALE_TEST_BANK } from '@shared/test-bank-female';
import { OPEN_QUESTIONS } from '@shared/open-questions';
import { getGenderCombo } from '@shared/gender-combo';
import { getPronounStyle, replacePronounInBank } from '@shared/pronoun';
import type { Gender, Question, OptionLabel, Answers } from '@shared/types';
import { http } from '@/lib/request';
import './index.scss';

const STORAGE_KEY = 'test_progress_v2';

interface TestProgress {
  gender: Gender;
  /** 选择题答案 { "M-Q1": "A", ... } */
  answers: Answers;
  /** 开放题 ID */
  openQuestionId: string;
  /** 开放题答案 */
  openAnswer: string;
  /** 当前题号（0-based） */
  cursor: number;
  /** 邀请者的 TestSessionId（B 模式才有，用于后端创建 PairSession） */
  inviterTestSessionId?: string;
  /** 邀请者性别（B 模式才有，从 URL 带入；用于同性场景代词替换为 TA） */
  inviterGender?: Gender;
}

/** 满足配对题库约束：男女各 30 题，第 30 题统一为开放题 */
const OPEN_QUESTION = OPEN_QUESTIONS[0]; // 后端会按 couple 复用规则覆写

/** 后端提交响应 */
interface SubmitResponse {
  testSessionId: string;
  /** B 模式下后端创建 PairSession 后返回；A 模式无此字段 */
  pairSessionId?: string;
  /** B-U-2/B-E-1 修复：危机检测结果，high 级别前端跳资源页（不调 LLM） */
  crisisLevel?: 'high' | 'middle' | 'low';
}

export default function TestPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** 进入页面时恢复缓存；首次进入读取 URL 中的 inviterTestSessionId / inviterGender */
  useDidShow(() => {
    const cached = Taro.getStorageSync(STORAGE_KEY);
    const inviterTestSessionId = router.params.inviterTestSessionId;
    // inviterGender 仅接受 male / female，其他值忽略（防 'other' 让 getGenderCombo 抛错）
    const rawInviterGender = router.params.inviterGender;
    const inviterGender: Gender | undefined =
      rawInviterGender === 'male' || rawInviterGender === 'female'
        ? rawInviterGender
        : undefined;
    if (cached) {
      // URL 中携带 inviterTestSessionId 时，覆写缓存里的（防止 B 复用 A 缓存）
      const merged: TestProgress = {
        ...cached,
        inviterTestSessionId: inviterTestSessionId || cached.inviterTestSessionId,
        inviterGender: inviterGender || cached.inviterGender,
      };
      setProgress(merged);
      Taro.setStorageSync(STORAGE_KEY, merged);
    } else if (inviterTestSessionId) {
      // B 模式但还没有缓存，先记下 inviterTestSessionId，等用户选性别后写入
      // 这里不预设 progress，仍走性别选择页；inviterTestSessionId 在 pickGender 时落入
    }
  });

  /** 选择性别，开始测试 */
  const pickGender = (g: Gender) => {
    const init: TestProgress = {
      gender: g,
      answers: {},
      openQuestionId: OPEN_QUESTION.id,
      openAnswer: '',
      cursor: 0,
      inviterTestSessionId: router.params.inviterTestSessionId || undefined,
      inviterGender:
        router.params.inviterGender === 'male' || router.params.inviterGender === 'female'
          ? (router.params.inviterGender as Gender)
          : undefined,
    };
    setProgress(init);
    Taro.setStorageSync(STORAGE_KEY, init);
  };

  /** 切换性别：清空进度，重新选择（带二次确认） */
  const switchGender = () => {
    Taro.showModal({
      title: '切换性别',
      content: '切换性别会清空当前答题进度，确定要重新选择吗？',
      confirmText: '重新选择',
      cancelText: '继续答题',
      success: (r) => {
        if (r.confirm) {
          Taro.removeStorageSync(STORAGE_KEY);
          setProgress(null);
        }
      },
    });
  };

  /** 当前题库（按 inviterGender 决定是否做同性代词替换；A 模式默认 mixed） */
  const bank = useMemo(() => {
    if (!progress) return null;
    const rawBank = progress.gender === 'male' ? MALE_TEST_BANK : FEMALE_TEST_BANK;
    // B 模式且携带 inviterGender：根据性别组合判定代词风格（同性→neutral→TA）
    if (progress.inviterGender) {
      try {
        const combo = getGenderCombo(progress.gender, progress.inviterGender);
        const style = getPronounStyle(combo);
        if (style === 'neutral') {
          return {
            ...rawBank,
            questions: replacePronounInBank(rawBank.questions, style),
          };
        }
      } catch {
        // getGenderCombo 在 'other' 时抛错，降级为原题库
      }
    }
    return rawBank;
  }, [progress]);

  /** 选择题题列表（29 道，第 30 题为开放题） */
  const scaleQuestions: Question[] = useMemo(() => {
    if (!bank) return [];
    return bank.questions.filter((q) => q.kind !== 'open');
  }, [bank]);

  /** 总题数 = 29 选择 + 1 开放 */
  const total = scaleQuestions.length + 1;

  /** 当前题目 */
  const currentQuestion: Question | null = useMemo(() => {
    if (!progress) return null;
    if (progress.cursor < scaleQuestions.length) {
      return scaleQuestions[progress.cursor];
    }
    return null; // 已进入开放题阶段
  }, [progress, scaleQuestions]);

  /** 选择某选项 */
  const pickOption = (qId: string, label: OptionLabel) => {
    if (!progress) return;
    const next: TestProgress = {
      ...progress,
      answers: { ...progress.answers, [qId]: label },
      // 自动推进到下一题
      cursor: progress.cursor + 1,
    };
    setProgress(next);
    Taro.setStorageSync(STORAGE_KEY, next);
  };

  /** 修改开放题答案 */
  const updateOpenAnswer = (text: string) => {
    if (!progress) return;
    const next: TestProgress = { ...progress, openAnswer: text };
    setProgress(next);
    // 开放题输入不频繁写 storage，避免性能问题
  };

  /** 上一题 */
  const goPrev = () => {
    if (!progress || progress.cursor === 0) return;
    const next: TestProgress = { ...progress, cursor: progress.cursor - 1 };
    setProgress(next);
    Taro.setStorageSync(STORAGE_KEY, next);
  };

  /** 提交测试 */
  const submit = async () => {
    if (!progress) return;
    if (Object.keys(progress.answers).length < scaleQuestions.length) {
      Taro.showToast({ title: '还有未作答的题目', icon: 'none' });
      return;
    }
    if (!progress.openAnswer.trim() || progress.openAnswer.trim().length < 10) {
      Taro.showToast({ title: '开放题至少 10 字', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await http.post<SubmitResponse>('/api/test/submit', {
        gender: progress.gender,
        bankVersion: bank?.version,
        answers: progress.answers,
        openQuestionId: progress.openQuestionId,
        openAnswer: progress.openAnswer.trim(),
        // B 模式才传，后端据此关联 A 的 TestSession 并创建 PairSession
        inviterTestSessionId: progress.inviterTestSessionId || undefined,
      });
      // 清缓存
      Taro.removeStorageSync(STORAGE_KEY);

      // B-U-2/B-E-1 修复：开放题命中高风险危机关键词，跳资源页（不调 LLM）
      if (res.crisisLevel === 'high') {
        Taro.redirectTo({ url: '/pages/crisis/index' });
        return;
      }

      if (progress.inviterTestSessionId && res.pairSessionId) {
        // B 模式：跳 result 页（带 pairSessionId），看到「分享给 A 解锁」引导
        Taro.redirectTo({
          url: `/pages/result/index?pairSessionId=${res.pairSessionId}`,
        });
      } else {
        // A 模式：跳 invite 页（带 testSessionId）
        Taro.redirectTo({
          url: `/pages/invite/index?testSessionId=${res.testSessionId}`,
        });
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  /** 性别选择页 */
  if (!progress) {
    return (
      <View className='test gender-pick'>
        <View className='card'>
          <Text className='card-title'>选择你的性别</Text>
          <Text className='card-desc text-muted'>
            题库分男/女版本，确保你和 TA 看到的是各自的视角
          </Text>
          <Button className='btn-primary' onClick={() => pickGender('male')}>
            我是男生
          </Button>
          <Button className='btn-ghost mt' onClick={() => pickGender('female')}>
            我是女生
          </Button>
        </View>
        <View className='card'>
          <Text className='card-desc text-muted'>
            65 种类型覆盖异性、男男、女女三种组合，结果只在双方都答完后生成
          </Text>
        </View>
      </View>
    );
  }

  const answeredCount = Object.keys(progress.answers).length;
  const percent = Math.round((answeredCount / total) * 100);

  return (
    <View className='test'>
      {/* 进度条 + 切换性别入口 */}
      <View className='progress-wrap'>
        <Progress percent={percent} strokeWidth={6} activeColor='#E8657E' />
        <Text className='progress-text'>
          {answeredCount} / {total}
        </Text>
        <Text className='switch-gender' onClick={switchGender}>
          切换性别
        </Text>
      </View>

      {/* 选择题阶段 */}
      {currentQuestion ? (
        <View className='card question-card'>
          <View className='q-meta'>
            <Text className='q-index'>
              Q{progress.cursor + 1}
            </Text>
            <Text className='q-dim'>
              {currentQuestion.dimension === 'funny'
                ? '趣味题'
                : currentQuestion.dimension}
            </Text>
          </View>
          <Text className='q-stem'>{currentQuestion.stem}</Text>
          <View className='options'>
            {currentQuestion.options.map((opt) => {
              const selected = progress.answers[currentQuestion.id] === opt.label;
              return (
                <View
                  key={opt.label}
                  className={`option ${selected ? 'selected' : ''}`}
                  onClick={() => pickOption(currentQuestion.id, opt.label)}
                >
                  <Text className='opt-label'>{opt.label}</Text>
                  <Text className='opt-text'>{opt.text}</Text>
                </View>
              );
            })}
          </View>
          {progress.cursor > 0 && (
            <Button className='btn-ghost mt' onClick={goPrev}>
              上一题
            </Button>
          )}
        </View>
      ) : (
        /* 开放题阶段 */
        <View className='card question-card'>
          <View className='q-meta'>
            <Text className='q-index'>Q{total}</Text>
            <Text className='q-dim'>开放题</Text>
          </View>
          <Text className='q-stem'>{OPEN_QUESTION.stem}</Text>
          <Textarea
            className='open-input'
            placeholder='在这里写下你的真实想法（至少 10 字）'
            maxlength={300}
            value={progress.openAnswer}
            onInput={(e) => updateOpenAnswer(e.detail.value)}
            autoHeight
          />
          <Text className='char-count text-muted'>
            {progress.openAnswer.length} / 300
          </Text>
          <View className='btn-row'>
            <Button className='btn-ghost' onClick={goPrev}>
              上一题
            </Button>
            <Button
              className='btn-primary'
              loading={submitting}
              onClick={submit}
            >
              {submitting ? '提交中' : '提交并邀请 TA'}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
