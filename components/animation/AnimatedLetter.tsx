'use client';

/**
 * AnimatedLetter - 滚动联动字符透明度（V3 · Prisma About 段）
 *
 * - 每个字符独立包裹
 * - useScroll target offset ['start 0.8', 'end 0.2']
 * - charProgress = index / totalChars
 * - opacity 0.2 → 1，range [charProgress - 0.1, charProgress + 0.05]
 * - 创建逐字揭示效果
 */
import { useRef } from 'react';
import { motion, useScroll, useTransform, MotionValue } from 'framer-motion';

interface AnimatedLetterProps {
  char: string;
  index: number;
  totalChars: number;
  scrollYProgress: MotionValue<number>;
}

export default function AnimatedLetter({
  char,
  index,
  totalChars,
  scrollYProgress,
}: AnimatedLetterProps) {
  const charProgress = index / totalChars;
  const opacity = useTransform(
    scrollYProgress,
    [charProgress - 0.1, charProgress + 0.05],
    [0.2, 1],
  );

  if (char === ' ') {
    return <span style={{ display: 'inline-block', width: '0.25em' }} />;
  }

  return (
    <motion.span style={{ opacity, display: 'inline-block' }}>
      {char}
    </motion.span>
  );
}
