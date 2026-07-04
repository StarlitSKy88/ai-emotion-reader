'use client';

/**
 * WordsPullUp - 单词逐个上拉动效（V3 · Prisma 设计规范）
 *
 * - 按空格拆分文本，每个单词是独立 motion.span
 * - useInView 触发，y:20 → 0，staggered delay 0.08s
 * - 支持 showAsterisk：在最后一个字符 "a" 后加 superscript *
 */
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface WordsPullUpProps {
  text: string;
  className?: string;
  /** 在最后一个 "a" 字符后加 superscript * */
  showAsterisk?: boolean;
}

export default function WordsPullUp({
  text,
  className = '',
  showAsterisk = false,
}: WordsPullUpProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const words = text.split(' ');

  return (
    <span ref={ref} className={`inline-block ${className}`}>
      {words.map((word, i) => {
        const isLast = i === words.length - 1;
        return (
          <motion.span
            key={`${word}-${i}`}
            initial={{ y: 20, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{
              duration: 0.6,
              delay: i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
            className='inline-block'
            style={{ marginRight: '0.25em' }}
          >
            {word}
            {showAsterisk && isLast && word.endsWith('a') && (
              <span
                style={{
                  position: 'absolute',
                  top: '0.65em',
                  marginLeft: '-0.1em',
                  fontSize: '0.31em',
                }}
              >
                *
              </span>
            )}
          </motion.span>
        );
      })}
    </span>
  );
}
