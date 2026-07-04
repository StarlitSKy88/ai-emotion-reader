/**
 * 危机资源页（Phase 5.4.3 / 5.4.4）
 * - 显示心理援助热线列表
 * - 点击热线号码直接拨打
 * - 紧急情况引导拨打 110/120
 *
 * 转介触发：任务回应检测到 high 级别危机时，前端自动跳转到此页
 *
 * 注：RESOURCES 与 lib/crisis-detector.ts 的 CRISIS_RESOURCES 为镜像副本
 * （miniapp 不引用 server-side lib）。修改热线时需同步两处。
 */
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

interface ResourceItem {
  name: string;
  phone: string;
  hours: string;
  desc: string;
}

const RESOURCES: ResourceItem[] = [
  {
    name: '全国心理援助热线',
    phone: '400-161-9995',
    hours: '24 小时',
    desc: '国家卫健委设立，免费、保密',
  },
  {
    name: '北京心理危机研究与干预中心',
    phone: '010-82951332',
    hours: '24 小时',
    desc: '国内首家专业心理危机干预机构',
  },
  {
    name: '希望 24 热线',
    phone: '400-161-9995',
    hours: '24 小时',
    desc: '全国性心理危机干预热线',
  },
  {
    name: '生命线',
    phone: '400-821-1215',
    hours: '每天 8:00-22:00',
    desc: '专注自杀预防的公益热线',
  },
];

export default function CrisisPage() {
  /** 拨打电话 */
  const callPhone = (phone: string, name: string) => {
    Taro.makePhoneCall({
      phoneNumber: phone,
      success: () => {},
      fail: () => {
        Taro.showToast({
          title: `请手动拨打 ${name}：${phone}`,
          icon: 'none',
          duration: 3000,
        });
      },
    });
  };

  /** 紧急情况：110 */
  const callEmergency = () => {
    Taro.makePhoneCall({
      phoneNumber: '110',
      fail: () => {
        Taro.showToast({
          title: '请立即拨打 110 或 120',
          icon: 'none',
          duration: 3000,
        });
      },
    });
  };

  return (
    <View className='crisis'>
      <View className='crisis-header'>
        <Text className='crisis-title'>你不必一个人承受</Text>
        <Text className='crisis-subtitle'>
          有些痛苦太重了，不该一个人扛。{'\n'}
          这些热线 24 小时有人接听，免费、保密。
        </Text>
      </View>

      {/* 紧急情况 */}
      <View className='crisis-emergency'>
        <Text className='emergency-title'>正在危机中？</Text>
        <Text className='emergency-desc'>
          如果你正在伤害自己，或即将伤害自己，请立即拨打紧急电话。
        </Text>
        <Text className='emergency-btn' onClick={callEmergency}>
          拨打 110 / 120
        </Text>
      </View>

      {/* 热线列表 */}
      {RESOURCES.map((r) => (
        <View className='crisis-card' key={r.name + r.phone}>
          <Text className='card-name'>{r.name}</Text>
          <Text className='card-hours'>{r.hours}</Text>
          <Text className='card-desc'>{r.desc}</Text>
          <Button
            className='card-call-btn'
            onClick={() => callPhone(r.phone, r.name)}
          >
            拨打 {r.phone}
          </Button>
        </View>
      ))}

      <View className='crisis-footer'>
        <Text className='footer-text'>
          · 这些热线由专业心理咨询师接听
        </Text>
        <Text className='footer-text'>
          · 通话内容完全保密，不会泄露给任何人
        </Text>
        <Text className='footer-text'>
          · 拨打热线不代表软弱，而是勇敢求助
        </Text>
      </View>
    </View>
  );
}
