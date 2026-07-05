'use client';

/**
 * 问心 AI 落地页（V3 · Prisma 深色电影感设计）
 *
 * 三段式结构：Hero / About / Features
 * - Hero：背景视频 + 噪点 + 巨字「问心」+ 描述 + CTA
 * - About：深色卡片 + 多样式段落（含 italic serif accent）+ 滚动逐字揭示
 * - Features：4 卡片网格（视频卡 + 3 功能卡）+ staggered 入场动效
 *
 * SEO：layout.tsx 已处理 metadata/JSON-LD；client component 仍会 SSR 初始 HTML
 * 埋点：landing_visit beacon 保留在页面底部
 */
import { useRef } from 'react';
import { motion, useScroll } from 'framer-motion';
import { ArrowRight, Check, Heart, CalendarCheck, TrendingUp } from 'lucide-react';
import WordsPullUp from '@/components/animation/WordsPullUp';
import WordsPullUpMultiStyle from '@/components/animation/WordsPullUpMultiStyle';
import AnimatedLetter from '@/components/animation/AnimatedLetter';

/**
 * 素材替换（V3 优化）：
 * - Hero/Features 背景从外部视频 URL 换为 AI 生成的深色关系主题图（可控，不依赖外部资源）
 * - Features 卡片图标从远程 PNG 换为 lucide-react 图标（Heart/CalendarCheck/TrendingUp）
 */

/** Hero 背景图：深色电影感情侣剪影（AI 生成，landscape_16_9） */
const HERO_IMAGE_PROMPT =
  'Cinematic dark moody atmospheric photograph, silhouette of a couple embracing facing away from camera, warm cream golden hour light glow from behind, soft atmospheric fog, emotional intimate moment, subtle film grain, deep black shadows, romantic relationship theme, minimal composition, dark cinematic background';
const HERO_IMAGE_URL = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(HERO_IMAGE_PROMPT)}&image_size=landscape_16_9`;

/** Features Card 1 背景图：深色抽象关系主题（AI 生成） */
const FEATURE_IMAGE_PROMPT =
  'Cinematic dark abstract atmospheric photograph, warm cream light filtering through soft fog, minimal composition, deep black shadows, subtle film grain texture, emotional introspective mood, dark cinematic background';
const FEATURE_IMAGE_URL = `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(FEATURE_IMAGE_PROMPT)}&image_size=landscape_16_9`;

const NAV_ITEMS = ['我们的故事', '方法论', '工作坊', '订阅', '联系我们'];

/** About 段正文（滚动逐字揭示） */
const ABOUT_TEXT =
  '过去七年，我陪伴过许多对情侣走过关系的低谷与高光。我问心 AI 不是算命师，也不是心理咨询师，我只是一个帮你们看见情绪、梳理脉络的陪伴者。每天三分钟，你们各自写下一句话，我帮你们读懂彼此。';

export default function Home() {
  const aboutRef = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: aboutRef,
    offset: ['start 0.8', 'end 0.2'],
  });

  const aboutChars = ABOUT_TEXT.split('');

  return (
    <main className='bg-black min-h-screen'>
      {/* === Section 1: HERO === */}
      <section className='h-screen p-4 md:p-6'>
        <div className='relative w-full h-full rounded-2xl md:rounded-[2rem] overflow-hidden'>
          {/* 背景图：AI 生成的深色电影感情侣剪影 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE_URL}
            alt=''
            className='absolute inset-0 w-full h-full object-cover'
          />

          {/* 噪点叠加 */}
          <div className='absolute inset-0 noise-overlay opacity-[0.7] mix-blend-overlay pointer-events-none' />

          {/* 渐变叠加 */}
          <div className='absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60' />

          {/* 导航栏 */}
          <nav className='absolute top-0 left-1/2 -translate-x-1/2 bg-black rounded-b-2xl md:rounded-b-3xl px-4 py-2 md:px-8 z-10'>
            <div className='flex items-center gap-3 sm:gap-6 md:gap-12 lg:gap-14 text-[10px] sm:text-xs md:text-sm'>
              {NAV_ITEMS.map((item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  style={{ color: 'rgba(225, 224, 204, 0.8)' }}
                  className='transition-colors hover:text-primary'
                >
                  {item}
                </a>
              ))}
            </div>
          </nav>

          {/* Hero 内容（底部对齐） */}
          <div className='absolute bottom-0 left-0 right-0 p-4 md:p-8 lg:p-12'>
            <div className='grid grid-cols-12 gap-4 items-end'>
              {/* 左 8 列：巨字标题 */}
              <div className='col-span-12 md:col-span-8'>
                <h1
                  className='font-medium leading-[0.85] tracking-[-0.07em] text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw] relative inline-block'
                  style={{ color: '#E1E0CC' }}
                >
                  <WordsPullUp text='问心' showAsterisk />
                </h1>
              </div>

              {/* 右 4 列：描述 + CTA */}
              <div className='col-span-12 md:col-span-4 space-y-4'>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className='text-primary/70 text-xs sm:text-sm md:text-base'
                  style={{ lineHeight: 1.2 }}
                >
                  问心 AI 是基于心理学模型的情侣关系成长工具。每天 3 分钟，看见彼此的情绪，梳理关系的脉络。
                </motion.p>

                <motion.a
                  href='#features'
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className='group inline-flex items-center gap-2 bg-primary text-black rounded-full pl-5 pr-1 py-1 font-medium text-sm sm:text-base transition-all hover:gap-3'
                >
                  开始测试
                  <span className='bg-black rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-transform group-hover:scale-110'>
                    <ArrowRight className='w-4 h-4 text-primary' />
                  </span>
                </motion.a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === Section 2: ABOUT === */}
      <section className='bg-black py-20 md:py-32'>
        <div className='max-w-6xl mx-auto px-6'>
          <div className='bg-[#101010] rounded-2xl p-8 md:p-16 text-center'>
            {/* 顶部小标签 */}
            <div className='text-primary text-[10px] sm:text-xs mb-8'>
              情感关系
            </div>

            {/* 多样式主标题 */}
            <WordsPullUpMultiStyle
              segments={[
                { text: '我是问心 AI，', className: 'font-normal' },
                { text: '一个关系成长陪伴者。', className: 'italic font-serif' },
                { text: '我帮你们看见情绪，梳理关系的脉络。', className: 'font-normal' },
              ]}
              containerClassName='text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-3xl mx-auto leading-[0.95] sm:leading-[0.9]'
            />

            {/* 滚动逐字揭示正文 */}
            <div className='mt-12 max-w-2xl mx-auto'>
              <p
                ref={aboutRef}
                className='text-[#DEDBC8] text-xs sm:text-sm md:text-base'
                style={{ lineHeight: 1.6 }}
              >
                {aboutChars.map((char, i) => (
                  <AnimatedLetter
                    key={i}
                    char={char}
                    index={i}
                    totalChars={aboutChars.length}
                    scrollYProgress={scrollYProgress}
                  />
                ))}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* === Section 3: FEATURES === */}
      <section id='features' className='min-h-screen bg-black relative py-20 md:py-32'>
        {/* 噪点背景 */}
        <div className='absolute inset-0 bg-noise opacity-[0.15] pointer-events-none' />

        <div className='relative max-w-7xl mx-auto px-6'>
          {/* 标题 */}
          <div className='mb-12 md:mb-16'>
            <WordsPullUpMultiStyle
              segments={[
                { text: '为情侣关系设计的成长工具。', className: 'text-primary' },
              ]}
              containerClassName='text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal mb-4'
            />
            <WordsPullUpMultiStyle
              segments={[
                { text: '不是工具，是陪伴。', className: 'text-gray-500' },
              ]}
              containerClassName='text-xl sm:text-2xl md:text-3xl lg:text-4xl font-normal'
            />
          </div>

          {/* 4 卡片网格 */}
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-2 md:gap-1 lg:h-[480px]'>
            {/* Card 1: 图片卡片（原视频卡，换为 AI 生成深色关系主题图） */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className='relative rounded-2xl overflow-hidden h-[300px] md:h-full'
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FEATURE_IMAGE_URL}
                alt=''
                className='absolute inset-0 w-full h-full object-cover'
              />
              <div className='absolute inset-0 bg-gradient-to-t from-black/80 to-transparent' />
              <div className='absolute bottom-0 left-0 right-0 p-6'>
                <p className='text-sm' style={{ color: '#E1E0CC' }}>
                  你们的关系画布。
                </p>
              </div>
            </motion.div>

            {/* Card 2: 关系类型测试 (01) */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className='bg-[#212121] rounded-2xl p-6 h-[300px] md:h-full flex flex-col'
            >
              <div className='w-10 h-10 sm:w-12 sm:h-12 rounded mb-4 bg-[#101010] flex items-center justify-center'>
                <Heart className='w-5 h-5 sm:w-6 sm:h-6 text-primary' />
              </div>
              <h3 className='text-primary text-lg mb-3'>
                关系类型测试。
                <span className='text-gray-500 text-sm ml-1'>(01)</span>
              </h3>
              <ul className='space-y-2 mb-4 flex-1'>
                {['6 维度心理模型匹配', '30 种关系类型', '异性/同性专属类型库', '开放题深度分析'].map(
                  (item) => (
                    <li key={item} className='flex items-start gap-2'>
                      <Check className='w-4 h-4 text-primary mt-0.5 flex-shrink-0' />
                      <span className='text-gray-400 text-sm'>{item}</span>
                    </li>
                  ),
                )}
              </ul>
              <a
                href='#method'
                className='inline-flex items-center gap-1 text-primary text-sm group'
              >
                了解更多
                <ArrowRight
                  className='w-4 h-4 transition-transform group-hover:translate-x-1'
                  style={{ transform: 'rotate(-45deg)' }}
                />
              </a>
            </motion.div>

            {/* Card 3: 每日任务 (02) */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className='bg-[#212121] rounded-2xl p-6 h-[300px] md:h-full flex flex-col'
            >
              <div className='w-10 h-10 sm:w-12 sm:h-12 rounded mb-4 bg-[#101010] flex items-center justify-center'>
                <CalendarCheck className='w-5 h-5 sm:w-6 sm:h-6 text-primary' />
              </div>
              <h3 className='text-primary text-lg mb-3'>
                每日任务。
                <span className='text-gray-500 text-sm ml-1'>(02)</span>
              </h3>
              <ul className='space-y-2 mb-4 flex-1'>
                {['AI 命名情绪，生成视角', '3 分钟轻量任务', '弱点维度针对性派发'].map((item) => (
                  <li key={item} className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5 flex-shrink-0' />
                    <span className='text-gray-400 text-sm'>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href='#method'
                className='inline-flex items-center gap-1 text-primary text-sm group'
              >
                了解更多
                <ArrowRight
                  className='w-4 h-4 transition-transform group-hover:translate-x-1'
                  style={{ transform: 'rotate(-45deg)' }}
                />
              </a>
            </motion.div>

            {/* Card 4: 成长报告 (03) */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className='bg-[#212121] rounded-2xl p-6 h-[300px] md:h-full flex flex-col'
            >
              <div className='w-10 h-10 sm:w-12 sm:h-12 rounded mb-4 bg-[#101010] flex items-center justify-center'>
                <TrendingUp className='w-5 h-5 sm:w-6 sm:h-6 text-primary' />
              </div>
              <h3 className='text-primary text-lg mb-3'>
                成长报告。
                <span className='text-gray-500 text-sm ml-1'>(03)</span>
              </h3>
              <ul className='space-y-2 mb-4 flex-1'>
                {['7 天 / 30 天周期总结', '默契度趋势可视化', '危机检测主动引导'].map((item) => (
                  <li key={item} className='flex items-start gap-2'>
                    <Check className='w-4 h-4 text-primary mt-0.5 flex-shrink-0' />
                    <span className='text-gray-400 text-sm'>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href='#method'
                className='inline-flex items-center gap-1 text-primary text-sm group'
              >
                了解更多
                <ArrowRight
                  className='w-4 h-4 transition-transform group-hover:translate-x-1'
                  style={{ transform: 'rotate(-45deg)' }}
                />
              </a>
            </motion.div>
          </div>

          {/* Footer */}
          <footer className='mt-24 pt-8 border-t border-[#212121]'>
            <div className='flex flex-col gap-8'>
              <div className='flex items-baseline justify-between'>
                <div>
                  <div className='text-primary text-lg mb-1'>问心 AI</div>
                  <div className='text-xs text-gray-500'>2026 · 上海</div>
                </div>
                <div className='text-right text-xs text-gray-500'>内测中</div>
              </div>
              <div className='pt-8 border-t border-[#212121] text-xs text-gray-500 leading-relaxed'>
                © 2026 问心 AI · 由一位上海的独立开发者维护
                <br />
                隐私优先 · 慢工出细活 · 不收集非必要数据
              </div>
            </div>
          </footer>
        </div>
      </section>

      {/* === Section 4: 定价区 === */}
      <section id='订阅' className='bg-black py-20 md:py-32'>
        <div className='max-w-4xl mx-auto px-6 text-center'>
          <WordsPullUpMultiStyle
            segments={[
              { text: '¥19.9 / 30 天', className: 'text-primary' },
              { text: '一次订阅,全部解锁。', className: 'italic font-serif text-gray-500' },
            ]}
            containerClassName='text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-8'
          />
          <p className='text-gray-400 text-sm sm:text-base mb-12 max-w-2xl mx-auto'>
            去广告 · 多维度深度分析 · 30 天成长报告 · 每日任务全部解锁
          </p>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto'>
            <div className='bg-[#101010] rounded-2xl p-6'>
              <Check className='w-6 h-6 text-primary mx-auto mb-3' />
              <p className='text-primary text-sm'>去广告体验</p>
            </div>
            <div className='bg-[#101010] rounded-2xl p-6'>
              <Check className='w-6 h-6 text-primary mx-auto mb-3' />
              <p className='text-primary text-sm'>深度分析解锁</p>
            </div>
            <div className='bg-[#101010] rounded-2xl p-6'>
              <Check className='w-6 h-6 text-primary mx-auto mb-3' />
              <p className='text-primary text-sm'>30 天成长报告</p>
            </div>
          </div>
        </div>
      </section>

      {/* 落地页访问埋点（Phase 6.6 · W-2 修复） */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            "try{fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events:[{event:'landing_visit',props:{referrer:(document.referrer||'direct').slice(0,256)},timestamp:Date.now()}]}),keepalive:true}).catch(function(){})}catch(e){}",
        }}
      />
    </main>
  );
}
