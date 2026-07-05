/**
 * 任务详情页 · Phase 4.4.2 + 4.4.5
 * - 显示任务完整详情 + 双方回应
 * - 我未完成 → 「开始写感受」按钮跳 task/chat
 * - 双方都完成 → 显示默契度总结横幅（调 /api/task/[taskId]/summary）
 */
import { useState } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { http } from '@/lib/request';
import type {
  DailyTaskInfo,
  TaskSummaryResult,
} from '@shared/types';
import './detail.scss';

export default function TaskDetailPage() {
  const router = useRouter();
  const [task, setTask] = useState<DailyTaskInfo | null>(null);
  const [summary, setSummary] = useState<TaskSummaryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useDidShow(() => {
    loadDetail();
  });

  const loadDetail = async () => {
    const { taskId } = router.params;
    if (!taskId) {
      Taro.showToast({ title: '参数缺失', icon: 'none' });
      setLoading(false);
      return;
    }
    try {
      const res = await http.get<DailyTaskInfo>(`/api/task/${taskId}`);
      setTask(res);
      // 双方都完成且有 response → 加载 summary
      if (
        res.myResponded &&
        res.partnerResponded &&
        (res.myStatus === 'done' || res.myStatus === 'skipped') &&
        (res.partnerStatus === 'done' || res.partnerStatus === 'skipped')
      ) {
        loadSummary(taskId);
      }
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (taskId: string) => {
    setLoadingSummary(true);
    try {
      const res = await http.get<TaskSummaryResult>(
        `/api/task/${taskId}/summary`
      );
      setSummary(res);
    } catch {
      // 总结生成失败不阻塞页面
    } finally {
      setLoadingSummary(false);
    }
  };

  /** 跳对话页写感受 */
  const goChat = () => {
    if (!task) return;
    Taro.navigateTo({
      url: `/pages/task/chat?taskId=${task.id}`,
    });
  };

  if (loading) {
    return (
      <View className='task-detail loading'>
        <Text className='text-muted'>加载中...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View className='task-detail loading'>
        <Text className='text-muted'>无数据</Text>
      </View>
    );
  }

  const iAmDone = task.myStatus === 'done' || task.myStatus === 'skipped';
  const partnerDone =
    task.partnerStatus === 'done' || task.partnerStatus === 'skipped';
  const bothDone = iAmDone && partnerDone;

  return (
    <View className='task-detail'>
      {/* 任务卡 */}
      <View className='card task-card'>
        <View className='task-meta'>
          <Text className='task-dim'>{dimensionLabel(task.sourceDimension)}</Text>
          {task.targetDimension && task.targetDimension !== task.sourceDimension && (
            <Text className='task-dim'>→ {dimensionLabel(task.targetDimension)}</Text>
          )}
          <Text className='task-time'>· 约 {task.estimatedMin} 分钟</Text>
        </View>
        <Text className='task-title'>{task.title}</Text>
        <Text className='task-desc'>{task.description}</Text>
      </View>

      {/* 我的回应 */}
      <View className='card response-card'>
        <Text className='section-title'>我的回应</Text>
        {task.myResponse ? (
          <View className='response-content'>
            {task.myResponse.emotionTag && (
              <View className='emotion-tag'>
                <Text className='tag-label'>情绪</Text>
                <Text className='tag-text'>{task.myResponse.emotionTag}</Text>
              </View>
            )}
            <Text className='response-text'>{task.myResponse.content || '（跳过，未写感受）'}</Text>
            {task.myResponse.perspective && (
              <View className='perspective-box'>
                <Text className='perspective-label'>AI 看见</Text>
                <Text className='perspective-text'>{task.myResponse.perspective}</Text>
              </View>
            )}
            {task.myResponse.mediaUrls.length > 0 && (
              <View className='media-grid'>
                {task.myResponse.mediaUrls.map((url, i) => (
                  <Image
                    key={i}
                    className='media-img'
                    src={url}
                    mode='aspectFill'
                    onClick={() => previewImage(url, task.myResponse!.mediaUrls)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className='response-empty'>
            <Text className='text-muted'>还没写感受</Text>
            <Button className='btn-primary' onClick={goChat}>
              开始写感受
            </Button>
          </View>
        )}
      </View>

      {/* 对方回应 */}
      <View className='card response-card'>
        <Text className='section-title'>TA 的回应</Text>
        {task.partnerResponse ? (
          <View className='response-content'>
            {task.partnerResponse.emotionTag && (
              <View className='emotion-tag'>
                <Text className='tag-label'>情绪</Text>
                <Text className='tag-text'>{task.partnerResponse.emotionTag}</Text>
              </View>
            )}
            <Text className='response-text'>{task.partnerResponse.content || '（跳过，未写感受）'}</Text>
            {task.partnerResponse.perspective && (
              <View className='perspective-box'>
                <Text className='perspective-label'>AI 看见</Text>
                <Text className='perspective-text'>{task.partnerResponse.perspective}</Text>
              </View>
            )}
            {task.partnerResponse.mediaUrls.length > 0 && (
              <View className='media-grid'>
                {task.partnerResponse.mediaUrls.map((url, i) => (
                  <Image
                    key={i}
                    className='media-img'
                    src={url}
                    mode='aspectFill'
                    onClick={() => previewImage(url, task.partnerResponse!.mediaUrls)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className='response-empty'>
            <Text className='text-muted'>
              {partnerDone ? 'TA 跳过了今日任务' : 'TA 还没写，等 TA 一起来'}
            </Text>
          </View>
        )}
      </View>

      {/* 默契度总结横幅(双方完成后显示) */}
      {bothDone && (
        <View className='card summary-banner'>
          <Text className='summary-title'>今日默契度</Text>
          {loadingSummary ? (
            <Text className='text-muted'>正在生成默契度总结...</Text>
          ) : summary ? (
            <View className='summary-content'>
              <Text className='compat-score'>{summary.compatibility}</Text>
              <Text className='compat-unit'>/ 100</Text>
              <Text className='summary-text'>{summary.summary}</Text>
              {summary.resonancePoints && summary.resonancePoints.length > 0 && (
                <View className='points-box'>
                  <Text className='points-label'>共鸣点</Text>
                  {summary.resonancePoints.map((p, i) => (
                    <Text key={i} className='points-item'>· {p}</Text>
                  ))}
                </View>
              )}
              {summary.complementaryPoints && summary.complementaryPoints.length > 0 && (
                <View className='points-box'>
                  <Text className='points-label'>互补点</Text>
                  {summary.complementaryPoints.map((p, i) => (
                    <Text key={i} className='points-item'>· {p}</Text>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text className='text-muted'>总结加载失败，稍后再试</Text>
          )}
        </View>
      )}
    </View>
  );
}

/** 预览图片 */
function previewImage(current: string, urls: string[]) {
  Taro.previewImage({ current, urls });
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
