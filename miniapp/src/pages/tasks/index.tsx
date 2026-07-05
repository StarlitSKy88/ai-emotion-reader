/**
 * 任务页(tab)· V3 商业化
 *
 * 显示内容:
 * - 30 天挑战进度卡(顶部):completedDates / totalDays / streakAlive / lastBreakDate
 * - 今日任务卡(调 /api/task/today,返回 { task, progress })
 * - 点击跳转 /pages/task/detail?taskId=xxx
 * - 未配对时引导去测试
 *
 * 进度数据来源:
 * - 主流程:/api/task/today 返回的 progress 字段(已含完整 V3 进度)
 * - 兜底:若 today 接口未返回 progress,调 /api/task/progress?coupleId=xxx 补拉
 */
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { http } from '@/lib/request';
import { isLoggedIn } from '@/lib/auth';
import { trackPageView, trackTaskView } from '@/lib/track';
import type {
  DailyTaskInfo,
  TaskDifficulty,
  ChallengeProgress,
} from '@shared/types';
import './index.scss';

/** /api/task/today 返回结构 */
interface TodayResponse {
  task: DailyTaskInfo;
  progress: ChallengeProgress;
}

export default function TasksPage() {
  const [task, setTask] = useState<DailyTaskInfo | null>(null);
  const [progress, setProgress] = useState<ChallengeProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    trackPageView('pages/tasks/index');
    loadTask();
  });

  const loadTask = async () => {
    if (!isLoggedIn()) {
      setTask(null);
      setProgress(null);
      setLoading(false);
      return;
    }
    try {
      const res = await http.get<TodayResponse>('/api/task/today');
      setTask(res?.task ?? null);
      setProgress(res?.progress ?? null);

      // 兜底:若 today 没返回 progress,且 task 有 coupleId,补拉 progress 接口
      if (!res?.progress && res?.task?.coupleId) {
        try {
          const prog = await http.get<ChallengeProgress>(
            `/api/task/progress?coupleId=${res.task.coupleId}`,
          );
          setProgress(prog);
        } catch {
          // 静默:progress 拉取失败不阻塞任务展示
        }
      }
    } catch {
      setTask(null);
      setProgress(null);
    } finally {
      setLoading(false);
    }
  };

  /** 跳任务详情 */
  const goDetail = () => {
    if (!task) return;
    trackTaskView(task.id, task.sourceDimension);
    Taro.navigateTo({ url: `/pages/task/detail?taskId=${task.id}` });
  };

  /** 跳测试页 */
  const goToTest = () => {
    Taro.navigateTo({ url: '/pages/test/index' });
  };

  if (loading) {
    return (
      <View className='tasks loading'>
        <Text className='text-muted'>加载中...</Text>
      </View>
    );
  }

  /* 未配对 / 未生成任务场景 */
  if (!task) {
    return (
      <View className='tasks empty'>
        <View className='card'>
          <Text className='card-title'>还没有每日任务</Text>
          <Text className='card-desc text-muted'>
            先完成情侣匹配测试,解锁结果后,每日会基于你们的关系类型推送一个 3 分钟微行动
          </Text>
          <Button className='btn-primary' onClick={goToTest}>
            去做测试
          </Button>
        </View>
      </View>
    );
  }

  const bothDone =
    (task.myStatus === 'done' || task.myStatus === 'skipped') &&
    (task.partnerStatus === 'done' || task.partnerStatus === 'skipped');

  // 进度数据(有则展示,无则不渲染进度卡)
  const showProgress = !!progress;
  const completedDates = progress?.completedDates ?? 0;
  const totalDays = progress?.totalDays ?? 30;
  const streakAlive = progress?.streakAlive ?? false;
  const progressPct = totalDays > 0 ? Math.min(100, (completedDates / totalDays) * 100) : 0;

  return (
    <View className='tasks'>
      {/* 30 天挑战进度卡 */}
      {showProgress && (
        <View className='card progress-card'>
          <View className='progress-header'>
            <Text className='progress-title'>30 天挑战</Text>
            <Text className='progress-count'>
              {completedDates} / {totalDays}
            </Text>
          </View>
          <View className='progress-bar'>
            <View
              className='progress-fill'
              style={{ width: `${progressPct}%` }}
            />
          </View>
          <View className='progress-status'>
            {streakAlive ? (
              <Text className='streak-alive'>连续进行中</Text>
            ) : (
              <Text className='streak-broken'>已中断,从断点继续</Text>
            )}
            {progress?.todayCompleted && (
              <Text className='today-done'>· 今日已完成</Text>
            )}
          </View>
        </View>
      )}

      {/* 顶部摘要 */}
      <View className='card summary-card'>
        <View className='summary-row'>
          <View className='summary-item'>
            <Text className='summary-num'>{task.date.slice(5)}</Text>
            <Text className='summary-label'>今日</Text>
          </View>
          <View className='summary-divider' />
          <View className='summary-item'>
            <Text className='summary-num'>
              {bothDone ? '✓' : `${task.estimatedMin}'`}
            </Text>
            <Text className='summary-label'>
              {bothDone ? '双方完成' : '预计分钟'}
            </Text>
          </View>
        </View>
      </View>

      {/* 今日任务 */}
      <View className='card today-card' onClick={goDetail}>
        <View className='task-meta'>
          <Text className='task-cat'>{difficultyLabel(task.difficulty)}</Text>
          <Text className='task-dim'>· {dimensionLabel(task.sourceDimension)}</Text>
        </View>
        <Text className='task-title'>{task.title}</Text>
        <Text className='task-desc'>{task.description}</Text>
        <View className='task-footer'>
          <View className='done-status'>
            <Text className={task.myStatus === 'done' ? 'done' : task.myStatus === 'skipped' ? 'skipped' : 'pending'}>
              我:{task.myStatus === 'done' ? '✓' : task.myStatus === 'skipped' ? '—' : '○'}
            </Text>
            <Text className={task.partnerStatus === 'done' ? 'done' : task.partnerStatus === 'skipped' ? 'skipped' : 'pending'}>
              TA:{task.partnerStatus === 'done' ? '✓' : task.partnerStatus === 'skipped' ? '—' : '○'}
            </Text>
          </View>
          <Text className='task-link text-primary'>查看详情 →</Text>
        </View>

        {/* AI 总结横幅(双方完成后显示) */}
        {bothDone && task.aiSummary && (
          <View className='insight-banner'>
            <Text className='insight-title'>今日默契度已生成</Text>
            <Text className='insight-text'>点详情查看共鸣点与互补点 →</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function difficultyLabel(d: TaskDifficulty): string {
  const map: Record<TaskDifficulty, string> = {
    easy: '轻松',
    medium: '中等',
    hard: '挑战',
  };
  return map[d] || d;
}

function dimensionLabel(dim: string): string {
  const map: Record<string, string> = {
    D1: '依恋',
    D2: '沟通',
    D3: '冲突修复',
    D4: '共同意义',
    D5: '信任承诺',
    D6: '亲密激情',
  };
  return map[dim] || dim;
}
