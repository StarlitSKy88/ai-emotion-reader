/**
 * 404 页面（V2 修复）
 *
 * 原为 Next.js 默认英文 404，与「问心 AI」品牌调性割裂，无返回首页链接。
 * 改为复用落地页纸面风格，提供中文友好提示 + 返回首页 CTA。
 */
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className='min-h-screen bg-black flex items-center justify-center px-6'>
      <div className='max-w-md w-full text-center'>
        <div className='font-serif italic text-6xl text-primary mb-6'>
          404
        </div>
        <h1 className='font-serif italic text-2xl mb-3' style={{ color: '#E1E0CC' }}>
          这一页，似乎走丢了
        </h1>
        <p className='text-sm text-gray-400 mb-8 leading-relaxed'>
          可能是链接已失效，或地址输错了。<br />
          不如回到首页，重新看见你们的关系。
        </p>
        <Link
          href='/'
          className='btn-editor'
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
