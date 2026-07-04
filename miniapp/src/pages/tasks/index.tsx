/**
 * 任务页（tab）· Phase 4
 * - 显示今日任务卡片（调 /api/task/today）
 * - 点击跳转 /pages/task/detail?taskId=xxx
 * - 未配对时引导去测试
 */
import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { http } from '@/lib/request';
import { isLoggedIn } from '@/lib/auth';
import { trackPageView, trackTaskView } from '@/lib/track';
import type { DailyTaskInfo, TaskDifficulty } from '@shared/types';
import './index.scss';

export default function TasksPage() {
  const [task, setTask] = useState<DailyTaskInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    trackPageView('pages/tasks/index');
    loadTask();
  });

  const loadTask = async () => {
    if (!isLoggedIn()) {
      setTask(null);
      setLoading(false);
      return;
    }
    try {
      const res = await http.get<DailyTaskInfo>('/api/task/today');
      setTask(res);
    } catch {
      setTask(null);
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
            先完成情侣匹配测试，解锁结果后，每日会基于你们的关系类型推送一个 3 分钟微行动
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

  return (
    <View className='tasks'>
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
              我：{task.myStatus === 'done' ? '✓' : task.myStatus === 'skipped' ? '—' : '○'}
            </Text>
            <Text className={task.partnerStatus === 'done' ? 'done' : task.partnerStatus === 'skipped' ? 'skipped' : 'pending'}>
              TA：{task.partnerStatus === 'done' ? '✓' : task.partnerStatus === 'skipped' ? '—' : '○'}
            </Text>
          </View>
          <Text className='task-link text-primary'>查看详情 →</Text>
        </View>

        {/* AI 总结横幅（双方完成后显示） */}
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
