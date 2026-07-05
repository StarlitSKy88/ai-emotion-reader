/**
 * 类型百科页
 * 路由：/pages/type/encyclopedia
 *
 * 数据来源：直接 import @shared/couple-types-hetero.ts 的 HETERO_COUPLE_TYPES
 * - hetero 文件本身不含同性专属类型，自然满足隐私保护 3.4.1/3.4.2
 * - 仅展示 isPublic=true 的 35 种类型（30 常见 + 5 稀有）
 * - 同性专属类型不在百科列表展示，但可通过 /pages/type/detail?code=XXX 访问
 *
 * 交互：
 * - 顶部搜索框：按 name/oneLiner 过滤
 * - 按稀有度分组：常见类型 / 稀有类型
 * - 点击卡片跳转 /pages/type/detail?code=XXX
 */
import { useMemo, useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useShareAppMessage } from '@tarojs/taro';
import { HETERO_COUPLE_TYPES } from '@shared/couple-types-hetero';
import type { CoupleTypeInfo } from '@shared/types';
import TypeVisual from '@/components/TypeVisual';
import './encyclopedia.scss';

export default function EncyclopediaPage() {
  const [keyword, setKeyword] = useState('');

  useShareAppMessage(() => ({
    title: '35 种情侣类型百科 · 问心 AI',
    path: '/pages/type/encyclopedia',
    imageUrl: '/assets/share/type-share.png',
  }));

  // 仅展示 isPublic=true 的类型（hetero 文件已全部是 isPublic=true，这里再加一层防御）
  const publicTypes = useMemo(
    () => HETERO_COUPLE_TYPES.filter((t) => t.isPublic),
    [],
  );

  // 按稀有度分组
  const commonTypes = useMemo(
    () => publicTypes.filter((t) => t.rarity === 'common'),
    [publicTypes],
  );
  const rareTypes = useMemo(
    () => publicTypes.filter((t) => t.rarity === 'rare'),
    [publicTypes],
  );

  // 关键词过滤
  const filterByKeyword = (list: CoupleTypeInfo[]): CoupleTypeInfo[] => {
    if (!keyword.trim()) return list;
    const kw = keyword.trim().toLowerCase();
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(kw) ||
        t.oneLiner.toLowerCase().includes(kw),
    );
  };

  const filteredCommon = filterByKeyword(commonTypes);
  const filteredRare = filterByKeyword(rareTypes);
  const hasResult = filteredCommon.length > 0 || filteredRare.length > 0;

  /** 点击类型卡跳转详情页 */
  const goDetail = (code: string) => {
    Taro.navigateTo({ url: `/pages/type/detail?code=${code}` });
  };

  /** 渲染单张类型卡 */
  const renderTypeCard = (t: CoupleTypeInfo) => (
    <View
      key={t.code}
      className={`type-card ${t.rarity === 'rare' ? 'rare' : ''}`}
      onClick={() => goDetail(t.code)}
    >
      <View className='card-header'>
        <View className='card-visual'>
          <TypeVisual code={t.code} radarProfile={t.radarProfile} rarity={t.rarity} size={120} />
        </View>
        <View className='card-meta'>
          <Text className='card-name'>{t.name}</Text>
          <Text className='card-oneliner'>{t.oneLiner}</Text>
        </View>
        {t.rarity === 'rare' && <Text className='rarity-badge'>稀有</Text>}
      </View>
    </View>
  );

  return (
    <View className='encyclopedia'>
      {/* 顶部说明 */}
      <View className='card intro-card'>
        <Text className='intro-title'>35 种情侣类型百科</Text>
        <Text className='intro-desc text-muted'>
          以下是 35 种公开情侣类型，更多专属类型请做完测试解锁
        </Text>
      </View>

      {/* 搜索框 */}
      <View className='search-wrap'>
        <Input
          className='search-input'
          type='text'
          placeholder='搜索类型名或一句话描述'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
        />
      </View>

      {/* 列表 */}
      {!hasResult && (
        <View className='card empty-card'>
          <Text className='text-muted'>没有找到匹配的类型</Text>
        </View>
      )}

      {filteredCommon.length > 0 && (
        <View className='group'>
          <Text className='group-title'>
            常见类型 · {filteredCommon.length} 种
          </Text>
          {filteredCommon.map(renderTypeCard)}
        </View>
      )}

      {filteredRare.length > 0 && (
        <View className='group'>
          <Text className='group-title'>
            稀有类型 · {filteredRare.length} 种
          </Text>
          {filteredRare.map(renderTypeCard)}
        </View>
      )}

      <View className='footer'>
        <Text className='text-muted'>问心 AI · 让爱被看见</Text>
      </View>
    </View>
  );
}
