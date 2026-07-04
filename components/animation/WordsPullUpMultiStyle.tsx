'use client';

/**
 * WordsPullUpMultiStyle - 多样式段落逐词上拉（V3 · Prisma 设计规范）
 *
 * - 接收 { text, className }[] 段落数组
 * - 所有段落拆词，保留每词的 className
 * - 同 pull-up 动效（y:20 → 0，staggered 0.08s）
 * - 外层 inline-flex flex-wrap justify-center
 */
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface TextSegment {
  text: string;
  className?: string;
}

interface WordsPullUpMultiStyleProps {
  segments: TextSegment[];
  containerClassName?: string;
}

export default function WordsPullUpMultiStyle({
  segments,
  containerClassName = '',
}: WordsPullUpMultiStyleProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  // 拍平所有单词，保留每词所属段落的 className
  const allWords: Array<{ word: string; className?: string }> = [];
  for (const seg of segments) {
    const words = seg.text.split(' ');
    for (const w of words) {
      allWords.push({ word: w, className: seg.className });
    }
  }

  return (
    <span
      ref={ref}
      className={`inline-flex flex-wrap justify-center ${containerClassName}`}
    >
      {allWords.map((item, i) => (
        <motion.span
          key={`${item.word}-${i}`}
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{
            duration: 0.6,
            delay: i * 0.08,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={`inline-block ${item.className ?? ''}`}
          style={{ marginRight: '0.25em' }}
        >
          {item.word}
        </motion.span>
      ))}
    </span>
  );
}
