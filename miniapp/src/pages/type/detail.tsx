/**
 * 类型详情页
 * 路由：/pages/type/detail?code=OLD_COUPLE
 *
 * 数据来源：直接 import @shared/couple-types-all.ts 的 getCoupleTypeByCode
 * - 支持查询所有 65 种类型（含同性专属），但只能通过 code 访问
 * - 同性专属类型不会出现在百科页列表中（隐私保护 3.4.1/3.4.2）
 *
 * 分享：
 * - 同性专属类型（isPublic=false）不显示 type name 在分享标题（隐私保护 3.4.4）
 */
import { View, Text, Button } from '@tarojs/components';
import Taro, { useRouter, useShareAppMessage } from '@tarojs/taro';
import { getCoupleTypeByCode } from '@shared/couple-types-all';
import RadarChart from '@/components/RadarChart';
import './detail.scss';

export default function TypeDetailPage() {
  const router = useRouter();
  const code = router.params.code || '';
  const typeInfo = getCoupleTypeByCode(code);

  useShareAppMessage(() => {
    if (!typeInfo) {
      return {
        title: '情侣类型百科 · 问心 AI',
        path: '/pages/type/encyclopedia',
      };
    }
    // 同性专属类型不在分享标题中暴露 type name（隐私保护 3.4.4）
    const title = typeInfo.isPublic
      ? `情侣类型：${typeInfo.emoji} ${typeInfo.name}`
      : '我们做完情侣测试了，来看看你们的关系类型';
    return {
      title,
      path: `/pages/type/detail?code=${code}`,
      imageUrl: '/assets/share/type-share.png',
    };
  });

  if (!typeInfo) {
    return (
      <View className='type-detail loading'>
        <Text className='text-muted'>未找到该类型</Text>
        <Button
          className='btn-ghost mt'
          onClick={() => Taro.navigateTo({ url: '/pages/type/encyclopedia' })}
        >
          查看类型百科
        </Button>
      </View>
    );
  }

  const isRare = typeInfo.rarity === 'rare';
  const isSameSex =
    typeInfo.genderCombo === 'male-male' ||
    typeInfo.genderCombo === 'female-female';
  // 同性专属类型（isPublic=false）限制内容显示（隐私保护 3.4.4）
  const isRestricted = !typeInfo.isPublic;
  // 占比百分比：estimatedRatio 在 hetero 中是 0~1 的小数，在同性中是 0~100 的整数
  const ratioPercent = isSameSex
    ? Math.round(typeInfo.estimatedRatio)
    : Math.round(typeInfo.estimatedRatio * 100);

  return (
    <View className='type-detail'>
      {/* 顶部类型卡 */}
      <View className={`card type-card ${isRare ? 'rare' : ''}`}>
        <Text className='type-emoji'>{typeInfo.emoji}</Text>
        <Text className='type-name'>{typeInfo.name}</Text>
        <View className='type-badges'>
          <Text className='type-rarity'>
            {isRare ? '稀有类型' : '常见类型'}
          </Text>
          {isSameSex && <Text className='type-exclusive'>专属类型</Text>}
        </View>
        <Text className='type-oneliner'>{typeInfo.oneLiner}</Text>
        {!isRestricted && (
          <Text className='type-ratio text-muted'>
            约 {ratioPercent}% 的情侣是这种类型
          </Text>
        )}
      </View>

      {/* 同性专属类型限制提示 */}
      {isRestricted && (
        <View className='card restricted-card'>
          <Text className='restricted-title'>这是同性专属类型</Text>
          <Text className='restricted-desc text-muted'>
            完整解读需做完测试解锁
          </Text>
        </View>
      )}

      {/* 关系描述 */}
      {!isRestricted && (
        <View className='card'>
          <Text className='section-title'>关系描述</Text>
          <Text className='section-text'>{typeInfo.description}</Text>
        </View>
      )}

      {/* 隐藏风险 */}
      {!isRestricted && (
        <View className='card'>
          <Text className='section-title'>隐藏风险</Text>
          <Text className='section-text'>{typeInfo.hiddenRisks}</Text>
        </View>
      )}

      {/* 成长建议 */}
      {!isRestricted && (
        <View className='card'>
          <Text className='section-title'>成长建议</Text>
          <Text className='section-text'>{typeInfo.growthAdvice}</Text>
        </View>
      )}

      {/* 典型雷达图 */}
      {!isRestricted && (
        <View className='card radar-card'>
          <Text className='section-title'>典型维度雷达图</Text>
          <RadarChart scoresA={typeInfo.radarProfile} />
          <Text className='radar-tip text-muted'>
            这是该类型的典型维度画像，你的实际分数可能略有不同
          </Text>
        </View>
      )}

      {/* 分享文案 */}
      {!isRestricted && (
        <View className='card'>
          <Text className='section-title'>分享文案</Text>
          <Text className='section-text share-copy'>{typeInfo.shareCopy}</Text>
          <Button
            className='btn-ghost mt'
            onClick={() => {
              Taro.setClipboardData({ data: typeInfo.shareCopy });
            }}
          >
            复制文案
          </Button>
        </View>
      )}

      {/* 去测试 CTA */}
      <View className='card cta-card'>
        <Text className='card-title'>想知道你们是哪种类型？</Text>
        <Text className='card-desc text-muted'>
          3 分钟情侣匹配测试 · 65 种类型结果
        </Text>
        <Button
          className='btn-primary'
          onClick={() => Taro.navigateTo({ url: '/pages/test/index' })}
        >
          去做测试
        </Button>
        <Button
          className='btn-ghost mt'
          onClick={() => Taro.navigateTo({ url: '/pages/type/encyclopedia' })}
        >
          查看全部类型
        </Button>
      </View>
    </View>
  );
}
