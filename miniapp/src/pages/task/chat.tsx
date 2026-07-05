/**
 * 任务对话页 · Phase 4.4.3 + 4.4.4
 * - 写感受 + 拍照上传（最多 3 张）
 * - 提交到 /api/task/[taskId]/response
 * - 提交后返回 detail 页
 */
import { useState } from 'react';
import { View, Text, Textarea, Button, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { http } from '@/lib/request';
import { trackTaskComplete, trackTaskSkip, trackCrisisRedirect } from '@/lib/track';
import './chat.scss';

export default function TaskChatPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  /** 选择图片（相册或拍照） */
  const chooseImage = () => {
    if (mediaUrls.length >= 3) {
      Taro.showToast({ title: '最多 3 张图片', icon: 'none' });
      return;
    }
    Taro.chooseImage({
      count: 3 - mediaUrls.length,
      sourceType: ['album', 'camera'],
      success: async (res) => {
        // 逐张上传到后端
        const uploadUrls: string[] = [];
        for (const tempPath of res.tempFilePaths) {
          try {
            const url = await uploadImage(tempPath);
            uploadUrls.push(url);
          } catch {
            // 单张上传失败不阻塞，继续上传其他
          }
        }
        setMediaUrls((prev) => [...prev, ...uploadUrls].slice(0, 3));
      },
    });
  };

  /** 上传图片到后端 */
  const uploadImage = (tempPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const base = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') as string;
      const token = Taro.getStorageSync('token') || '';
      Taro.uploadFile({
        url: `${base}/api/upload`,
        filePath: tempPath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            const data = JSON.parse(res.data) as { success: boolean; data?: { url: string }; error?: string };
            if (data.success && data.data?.url) {
              resolve(data.data.url);
            } else {
              reject(new Error(data.error || '上传失败'));
            }
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        },
        fail: (err) => reject(new Error(err.errMsg || '上传失败')),
      });
    });
  };

  /** 删除已选图片 */
  const removeImage = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  /** 提交回应 */
  const submit = async (status: 'done' | 'skipped') => {
    const { taskId } = router.params;
    if (!taskId) {
      Taro.showToast({ title: '参数缺失', icon: 'none' });
      return;
    }
    if (status === 'done' && !content.trim()) {
      Taro.showToast({ title: '请写下你的感受', icon: 'none' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await http.post<{
        crisisLevel: 'low' | 'middle' | 'high';
      }>(`/api/task/${taskId}/response`, {
        content: content.trim(),
        mediaUrls,
        status,
      });

      // 提交埋点（status === 'done' 用 task_complete，否则 task_skip）
      if (status === 'done') {
        trackTaskComplete(taskId, mediaUrls.length > 0);
      } else {
        trackTaskSkip(taskId);
      }

      // 5.4.4 危机转介自动化：high 级别立即跳转资源页
      if (result.crisisLevel === 'high') {
        trackCrisisRedirect('high');
        Taro.showToast({ title: '已提交', icon: 'success', duration: 800 });
        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/crisis/index' });
        }, 800);
        return;
      }
      if (result.crisisLevel === 'middle') {
        trackCrisisRedirect('middle');
      }

      Taro.showToast({ title: '已提交', icon: 'success' });
      // 返回 detail 页（detail 页 useDidShow 会重新加载）
      setTimeout(() => Taro.navigateBack(), 800);
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '提交失败', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  /** 预览图片 */
  const previewImage = (current: string) => {
    Taro.previewImage({ current, urls: mediaUrls });
  };

  return (
    <View className='task-chat'>
      {/* 提示卡 */}
      <View className='card tip-card'>
        <Text className='tip-text'>
          写下你做完这个任务的真实感受。不需要修饰，不需要正确，只是看见自己。
        </Text>
      </View>

      {/* 感受输入 */}
      <View className='card input-card'>
        <Textarea
          className='content-input'
          placeholder='今天做这个任务时，你感受到了什么？发生了什么？'
          value={content}
          onInput={(e) => setContent(e.detail.value)}
          maxlength={500}
          autoHeight
        />
        <View className='char-count'>
          <Text className='text-muted'>{content.length}/500</Text>
        </View>
      </View>

      {/* 图片上传 */}
      <View className='card media-card'>
        <Text className='section-title'>配图（可选，最多 3 张）</Text>
        <View className='media-grid'>
          {mediaUrls.map((url, i) => (
            <View key={i} className='media-item'>
              <Image
                className='media-img'
                src={url}
                mode='aspectFill'
                onClick={() => previewImage(url)}
              />
              <View className='media-remove' onClick={() => removeImage(i)}>
                <Text className='remove-icon'>×</Text>
              </View>
            </View>
          ))}
          {mediaUrls.length < 3 && (
            <View className='media-add' onClick={chooseImage}>
              <Text className='add-icon'>+</Text>
              <Text className='add-text'>添加</Text>
            </View>
          )}
        </View>
      </View>

      {/* 提交按钮 */}
      <View className='actions'>
        <Button
          className='btn-primary'
          loading={submitting}
          disabled={submitting}
          onClick={() => submit('done')}
        >
          完成打卡
        </Button>
        <Button
          className='btn-ghost'
          disabled={submitting}
          onClick={() => submit('skipped')}
        >
          今天先跳过
        </Button>
      </View>
    </View>
  );
}
