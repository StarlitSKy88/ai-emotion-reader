/**
 * 朋友圈分享图片 Canvas 组件（Phase 3.3.3）
 *
 * 用微信小程序 Canvas API 绘制 600x900 的朋友圈分享图：
 * - 顶部：双方圆形头像 + 中间心形连接
 * - 中间：类型 emoji + 类型名 + 一句话标签
 * - 下方：简化版雷达图（6 维度，单方或双方叠加）+ 默契度数字
 * - 底部：品牌信息引导
 *
 * 与 RadarChart（SVG + base64）不同，本组件用原生 Canvas API 绘制，
 * 因为 Canvas 内无法渲染 SVG，且本组件需导出为图片供保存相册 / 朋友圈分享。
 *
 * 注意：
 * - 网络头像必须先 Taro.getImageInfo 转本地临时路径才能 drawImage
 * - 头像圆形裁剪用 ctx.clip()
 * - 不在组件内调用任何后端 API，utm 上报由父组件处理
 */
import { forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { View, Canvas, Button, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export interface ShareCanvasHandle {
  /** 触发绘制并返回临时图片路径 */
  generateImage: () => Promise<string>;
}

export interface ShareCanvasProps {
  /** Canvas 标识，多实例时需唯一，默认 'share-canvas' */
  canvasId?: string;
  /** 双方头像 URL（网络图片，组件内会 getImageInfo 转本地） */
  myAvatar?: string;
  partnerAvatar?: string;
  myNickname?: string;
  partnerNickname?: string;
  /** 类型信息 */
  typeEmoji: string;
  typeName: string;
  typeOneLiner: string;
  /** 默契度 0-100 */
  compatibility: number;
  /** 雷达图分数（可选，不传则不画雷达图） */
  radarScoresA?: Record<string, number>;
  radarScoresB?: Record<string, number>;
  /** 是否同性组合（同性不在画布上暴露类型名，只显示 emoji + 一句话） */
  isSameSex?: boolean;
  /** 朋友圈文案（4 种变体之一） */
  momentsCopy: string;
  /** 可见性控制：true 显示，false 隐藏（用于父组件按需触发） */
  visible: boolean;
  /** 关闭回调（点击关闭按钮或遮罩触发） */
  onClose?: () => void;
}

const CANVAS_WIDTH = 600; // 设计稿宽
// W-SH-1：原 900 + 160 给底部小程序码（120）+ 引导文字（20）+ 上下边距（20）
const CANVAS_HEIGHT = 1060; // 设计稿高
const COLOR_A = '#E8657E';
const COLOR_B = '#4A90E2';
const DIMENSIONS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'] as const;
const DIM_LABELS: Record<string, string> = {
  D1: '依恋',
  D2: '沟通',
  D3: '修复',
  D4: '意义',
  D5: '信任',
  D6: '亲密',
};

/**
 * 绘制多行文本（最多 maxLines 行，每行 maxCharsPerLine 字符，超出截断加省略号）
 *
 * 修复 B-1：原实现 break 在 current += ch 之前触发，导致第 N*maxCharsPerLine 字符丢失，
 * 且 maxLines-1 提前 break 使第二行永不绘制。改为先累积字符再判断截断，
 * 达到 maxLines 行后停止累积，剩余文本用省略号收尾。
 */
const drawMultiLineText = (
  ctx: Taro.CanvasContext,
  text: string,
  x: number,
  y: number,
  maxLines: number,
  maxCharsPerLine: number,
  lineHeight: number,
) => {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    // 已累积满 maxLines 行，丢弃剩余字符
    if (lines.length >= maxLines) break;
    current += ch;
    if (current.length >= maxCharsPerLine) {
      lines.push(current);
      current = '';
    }
  }
  // 最后不足一行的余量入栈（未达 maxLines 时）
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  // 还有剩余文本未绘制 → 最后一行末尾加省略号
  if (lines.join('').length < text.length && lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxCharsPerLine - 1) + '…';
  }
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * lineHeight);
  });
};

const ShareCanvas = forwardRef<ShareCanvasHandle, ShareCanvasProps>(function ShareCanvas(
  props,
  ref,
) {
  const {
    canvasId = 'share-canvas',
    myAvatar,
    partnerAvatar,
    myNickname,
    partnerNickname,
    typeEmoji,
    typeName,
    typeOneLiner,
    compatibility,
    radarScoresA,
    radarScoresB,
    isSameSex,
    momentsCopy,
    visible,
    onClose,
  } = props;

  const [generating, setGenerating] = useState(false);

  /** 下载网络图片为本地临时路径 */
  const downloadImage = async (url: string): Promise<string> => {
    if (!url) return '';
    try {
      const info = await Taro.getImageInfo({ src: url });
      return info.path;
    } catch {
      // 头像下载失败返回空字符串，绘制时用占位灰色圆
      return '';
    }
  };

  /** 下载小程序码（W-SH-1）
   * 5s 超时避免阻塞 Canvas；失败时 console.warn 吞掉，返回空串不阻塞绘制。
   */
  const downloadQrCode = async (): Promise<string> => {
    const url = '/api/qrcode?scene=share_card&page=pages/index/index&width=430';
    try {
      const infoPromise = Taro.getImageInfo({ src: url });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('qrcode load timeout')), 5000),
      );
      const info = await Promise.race([infoPromise, timeoutPromise]);
      return info.path;
    } catch (err) {
      console.warn('[ShareCanvas] qrcode load failed:', err);
      return '';
    }
  };

  /** 绘制圆形头像 */
  const drawAvatar = (
    ctx: Taro.CanvasContext,
    path: string,
    cx: number,
    cy: number,
    r: number,
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.clip();
    if (path) {
      ctx.drawImage(path, cx - r, cy - r, r * 2, r * 2);
    } else {
      // 占位灰色圆
      ctx.setFillStyle('#CCCCCC');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
    // 头像边框
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.setStrokeStyle('#FFFFFF');
    ctx.setLineWidth(3);
    ctx.stroke();
  };

  /** 绘制简化雷达图（中心 cx, cy，半径 r） */
  const drawRadar = (ctx: Taro.CanvasContext, cx: number, cy: number, r: number) => {
    // 3 圈网格
    for (let ring = 1; ring <= 3; ring++) {
      const rr = (r * ring) / 3;
      ctx.beginPath();
      DIMENSIONS.forEach((_, i) => {
        const angle = ((-90 + i * 60) * Math.PI) / 180;
        const x = cx + rr * Math.cos(angle);
        const y = cy + rr * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.setStrokeStyle('#EAEAEA');
      ctx.setLineWidth(1);
      ctx.stroke();
    }

    // 6 条轴线
    DIMENSIONS.forEach((_, i) => {
      const angle = ((-90 + i * 60) * Math.PI) / 180;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.setStrokeStyle('#EAEAEA');
      ctx.setLineWidth(1);
      ctx.stroke();
    });

    // B 数据多边形（先画，置于 A 下方）
    if (radarScoresB) {
      ctx.beginPath();
      DIMENSIONS.forEach((dim, i) => {
        const s = Math.max(0, Math.min(100, radarScoresB[dim] ?? 0));
        const angle = ((-90 + i * 60) * Math.PI) / 180;
        const x = cx + ((s / 100) * r * Math.cos(angle));
        const y = cy + ((s / 100) * r * Math.sin(angle));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.setFillStyle('rgba(74, 144, 226, 0.15)');
      ctx.fill();
      ctx.setStrokeStyle(COLOR_B);
      ctx.setLineWidth(2);
      ctx.stroke();
    }

    // A 数据多边形
    if (radarScoresA) {
      ctx.beginPath();
      DIMENSIONS.forEach((dim, i) => {
        const s = Math.max(0, Math.min(100, radarScoresA[dim] ?? 0));
        const angle = ((-90 + i * 60) * Math.PI) / 180;
        const x = cx + ((s / 100) * r * Math.cos(angle));
        const y = cy + ((s / 100) * r * Math.sin(angle));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.setFillStyle('rgba(232, 101, 126, 0.2)');
      ctx.fill();
      ctx.setStrokeStyle(COLOR_A);
      ctx.setLineWidth(2);
      ctx.stroke();
    }

    // 维度标签
    ctx.setFillStyle('#999999');
    ctx.setFontSize(18);
    ctx.setTextAlign('center');
    ctx.setTextBaseline('middle');
    const labelR = r + 22;
    DIMENSIONS.forEach((dim, i) => {
      const angle = ((-90 + i * 60) * Math.PI) / 180;
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);
      ctx.fillText(DIM_LABELS[dim] || dim, x, y);
    });
  };

  const draw = useCallback(async (): Promise<string> => {
    setGenerating(true);
    try {
      // 1. 预下载头像
      const [myAvatarPath, partnerAvatarPath] = await Promise.all([
        downloadImage(myAvatar || ''),
        downloadImage(partnerAvatar || ''),
      ]);

      // 2. 获取 Canvas 上下文
      const ctx = Taro.createCanvasContext(canvasId);

      // 3. 背景：白色 + 顶部粉色装饰带
      ctx.setFillStyle('#FFFFFF');
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // 顶部装饰带
      ctx.setFillStyle('#FFE5EC');
      ctx.fillRect(0, 0, CANVAS_WIDTH, 200);

      const centerX = CANVAS_WIDTH / 2;

      // 4. 双方头像（顶部居中，左右各一个，中间心形）
      const avatarR = 60;
      const avatarY = 100;
      const avatarOffsetX = 90;
      drawAvatar(ctx, myAvatarPath, centerX - avatarOffsetX, avatarY, avatarR);
      drawAvatar(ctx, partnerAvatarPath, centerX + avatarOffsetX, avatarY, avatarR);
      // 中间心形
      ctx.setFillStyle(COLOR_A);
      ctx.setFontSize(36);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText('❤', centerX, avatarY);

      // 5. 昵称（头像下方）
      ctx.setFillStyle('#333333');
      ctx.setFontSize(24);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('alphabetic');
      ctx.fillText(myNickname || '我', centerX - avatarOffsetX, avatarY + avatarR + 36);
      ctx.fillText(partnerNickname || 'TA', centerX + avatarOffsetX, avatarY + avatarR + 36);

      // 6. 类型 emoji（大）
      // W-1：同性组合用通用 ❤ 替代类型 emoji，避免类型识别
      ctx.setFontSize(96);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('middle');
      ctx.fillText(isSameSex ? '❤' : typeEmoji, centerX, 320);

      // 7. 类型名（同性组合不显示，只显示一句话）
      ctx.setTextBaseline('alphabetic');
      if (!isSameSex) {
        ctx.setFillStyle('#333333');
        ctx.setFontSize(36);
        ctx.fillText(typeName, centerX, 380);
      }

      // 8. 一句话标签
      // W-1：同性组合用通用占位文案，避免 oneLiner 暴露类型特征
      ctx.setFillStyle('#666666');
      ctx.setFontSize(24);
      ctx.fillText(
        isSameSex ? '我们的关系类型有点特别' : typeOneLiner,
        centerX,
        isSameSex ? 380 : 420,
      );

      // 9. 默契度数字
      ctx.setFillStyle(COLOR_A);
      ctx.setFontSize(72);
      ctx.setTextAlign('left');
      ctx.fillText(`${compatibility}`, centerX - 60, 510);
      ctx.setFillStyle('#999999');
      ctx.setFontSize(24);
      ctx.fillText('/ 100', centerX + 60, 510);
      ctx.setFillStyle('#999999');
      ctx.setFontSize(20);
      ctx.setTextAlign('center');
      ctx.fillText('默契度', centerX, 540);

      // 10. 雷达图（如果有分数）
      // W-1：同性组合不绘制雷达图（雷达形状可识别类型特征），仅保留默契度数字
      if (!isSameSex && (radarScoresA || radarScoresB)) {
        drawRadar(ctx, centerX, 680, 100);
        // 图例
        ctx.setFontSize(18);
        ctx.setTextAlign('left');
        ctx.setTextBaseline('middle');
        ctx.setFillStyle(COLOR_A);
        ctx.fillRect(centerX - 80, 810, 16, 16);
        ctx.setFillStyle('#666666');
        ctx.fillText('我', centerX - 58, 818);
        ctx.setFillStyle(COLOR_B);
        ctx.fillRect(centerX + 20, 810, 16, 16);
        ctx.setFillStyle('#666666');
        ctx.fillText('TA', centerX + 42, 818);
      }

      // 11. 朋友圈文案（小字，雷达图下方或默契度下方）
      // W-9：多行绘制（最多 2 行，每行 18 字符），避免 24 字符截断丢失核心情绪
      if (momentsCopy) {
        ctx.setFillStyle('#888888');
        ctx.setFontSize(20);
        ctx.setTextAlign('center');
        ctx.setTextBaseline('alphabetic');
        drawMultiLineText(ctx, momentsCopy, centerX, 845, 2, 18, 28);
      }

      // 12. 底部品牌
      ctx.setFillStyle('#999999');
      ctx.setFontSize(20);
      ctx.setTextAlign('center');
      ctx.setTextBaseline('alphabetic');
      ctx.fillText('问心 AI · 测测你们是哪种情侣', centerX, 880);

      // 13. 小程序码 + 引导文字（W-SH-1）
      // 同性组合不绘制小程序码与引导文字：避免「测测你们的关系类型」+ 同性类型名间接暴露
      if (!isSameSex) {
        const qrPath = await downloadQrCode();
        if (qrPath) {
          // 小程序码 120x120，居中（品牌语下方 20px 起）
          ctx.drawImage(qrPath, centerX - 60, 900, 120, 120);
        }
        // 引导文字（14px，居中，灰色）
        ctx.setFillStyle('#999999');
        ctx.setFontSize(14);
        ctx.setTextAlign('center');
        ctx.setTextBaseline('alphabetic');
        ctx.fillText('微信扫码 · 测测你们的关系类型', centerX, 1040);
      }

      // 14. 渲染并导出
      return new Promise<string>((resolve, reject) => {
        ctx.draw(false, () => {
          setTimeout(() => {
            Taro.canvasToTempFilePath({
              canvasId,
              fileType: 'png',
              quality: 1,
              success: (res) => resolve(res.tempFilePath),
              fail: (err) => reject(new Error(err.errMsg || '导出失败')),
            });
          }, 200);
        });
      });
    } finally {
      setGenerating(false);
    }
  }, [
    canvasId,
    myAvatar,
    partnerAvatar,
    myNickname,
    partnerNickname,
    typeEmoji,
    typeName,
    typeOneLiner,
    compatibility,
    radarScoresA,
    radarScoresB,
    isSameSex,
    momentsCopy,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      generateImage: draw,
    }),
    [draw],
  );

  const handleSave = async () => {
    let tempPath: string;
    try {
      tempPath = await draw();
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '生成图片失败', icon: 'none' });
      return;
    }

    // 检查相册权限
    try {
      await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
    } catch {
      // 拒绝授权，引导设置
      const modalRes = await Taro.showModal({
        title: '提示',
        content: '需要相册权限才能保存图片，是否去设置？',
        confirmText: '去设置',
      });
      if (!modalRes.confirm) return;

      try {
        const settingRes = await Taro.openSetting();
        // W-10：用户在设置中开启权限后，继续保存；否则提示并退出
        if (!settingRes.authSetting['scope.writePhotosAlbum']) {
          Taro.showToast({ title: '未开启相册权限', icon: 'none' });
          return;
        }
      } catch {
        Taro.showToast({ title: '打开设置失败', icon: 'none' });
        return;
      }
    }

    // 保存到相册
    try {
      await Taro.saveImageToPhotosAlbum({ filePath: tempPath });
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (e) {
      Taro.showToast({ title: (e as Error).message || '保存失败', icon: 'none' });
    }
  };

  return (
    <View
      className={`share-canvas ${visible ? 'visible' : 'hidden'}`}
      onClick={() => {
        // 点击遮罩（冒泡到外层）关闭
        if (visible && onClose) onClose();
      }}
    >
      {visible && (
        <View
          className='share-canvas-content'
          catchMove
          onClick={(e) => e.stopPropagation()}
        >
          <View className='share-canvas-close' onClick={() => onClose?.()}>
            ×
          </View>
          <Canvas
            canvasId={canvasId}
            style={{ width: `${CANVAS_WIDTH}rpx`, height: `${CANVAS_HEIGHT}rpx` }}
            className='share-canvas-el'
          />
          <View className='share-canvas-actions'>
            <Button className='btn-primary' onClick={handleSave} loading={generating}>
              保存到相册
            </Button>
            <Text className='share-canvas-tip text-muted'>
              保存后可发朋友圈或发给好友
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

export default ShareCanvas;
