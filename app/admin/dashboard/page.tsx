'use client';

/**
 * Admin 数据看板（Phase 6.7/6.8）
 *
 * 客户端组件：访问页面本身需要 token。
 * - 首次访问显示 token 输入框
 * - 用户输入 ADMIN_TOKEN 后存入 localStorage（key: admin_token）
 * - 后续数据请求从 localStorage 读 token，加到 Authorization: Bearer ${token} 头
 * - 401 响应时清空 localStorage 并重新要求输入
 * - 「退出登录」按钮清空 localStorage 并回到输入界面
 *
 * V2 优化（W-4）：原 dashboard 在服务端组件中用绝对 URL fetch 自身 API（服务端自调用），
 * 已在 14 维度审查（B-S-1）改为客户端组件 + 相对路径 fetch（fetch('/api/admin/...')），
 * 此处仅为复核确认：当前文件首行 'use client'，且所有 fetch 均使用相对路径，
 * 无 server-only API 调用，服务端自调用 fetch 问题已解决。
 *
 * V3：深色电影感（black + cream #DEDBC8），与全局设计语言对齐。
 */
import { useCallback, useEffect, useState, type FormEvent } from 'react';
// V2 优化（S-1）：原 funnel/retention 接口类型在本组件重复定义，
// 改为统一引用 shared/admin-types.ts，与 API 路由共用一份类型
import type { FunnelStep, RetentionPoint } from '@/shared/admin-types';

const STORAGE_KEY = 'admin_token';

type ViewState = 'loading' | 'gate' | 'dashboard';

export default function AdminDashboardPage() {
  const [view, setView] = useState<ViewState>('loading');
  const [funnelSteps, setFunnelSteps] = useState<FunnelStep[] | null>(null);
  const [retentionData, setRetentionData] = useState<{
    cohortSize: number;
    curve: RetentionPoint[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');

  const loadData = useCallback(async (token: string) => {
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [funnelRes, retentionRes] = await Promise.all([
        fetch(`/api/admin/funnel?days=30`, { headers, cache: 'no-store' }),
        fetch(`/api/admin/retention?cohortDays=7&retentionDays=30`, {
          headers,
          cache: 'no-store',
        }),
      ]);

      // 401：token 失效，清空 localStorage 并回到输入界面
      if (funnelRes.status === 401 || retentionRes.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        setFunnelSteps(null);
        setRetentionData(null);
        setView('gate');
        setError('Token 已失效，请重新输入');
        return;
      }

      if (funnelRes.ok) {
        const json = (await funnelRes.json()) as {
          success: boolean;
          data?: { steps: FunnelStep[] };
        };
        setFunnelSteps(json.data?.steps || null);
      } else {
        setFunnelSteps(null);
      }

      if (retentionRes.ok) {
        const json = (await retentionRes.json()) as {
          success: boolean;
          data?: { cohortSize: number; curve: RetentionPoint[] };
        };
        setRetentionData(json.data || null);
      } else {
        setRetentionData(null);
      }
    } catch {
      setError('数据加载失败，请稍后重试');
    }
  }, []);

  // 首次挂载：检查 localStorage 是否已有 token（避免 SSR 读取 localStorage 报错）
  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (token) {
      setView('dashboard');
      void loadData(token);
    } else {
      setView('gate');
    }
  }, [loadData]);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;
    localStorage.setItem(STORAGE_KEY, token);
    setTokenInput('');
    setView('dashboard');
    void loadData(token);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setFunnelSteps(null);
    setRetentionData(null);
    setError(null);
    setView('gate');
  };

  // loading：避免 SSR/CSR hydration 不一致
  if (view === 'loading') {
    return null;
  }

  // token 输入界面
  if (view === 'gate') {
    return (
      <main className='bg-black min-h-screen flex items-center justify-center px-6 py-12'>
        <meta name='robots' content='noindex, nofollow' />
        <div className='w-full max-w-md bg-[#101010] rounded-2xl p-8'>
          <h1 className='text-primary text-2xl font-bold'>问心 AI 数据看板</h1>
          <p className='text-gray-400 text-sm mt-2'>
            请输入 Admin Token 以访问数据看板
          </p>
          <form onSubmit={handleLogin} className='mt-6'>
            <input
              type='password'
              className='input-editor'
              placeholder='ADMIN_TOKEN'
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              autoComplete='off'
              autoFocus
            />
            <button
              type='submit'
              className='btn-editor w-full justify-center'
              disabled={!tokenInput.trim()}
              style={{ marginTop: 16 }}
            >
              进入看板
            </button>
          </form>
          {error && (
            <p className='text-sm mt-4' style={{ color: '#f87171' }}>
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  // 已登录：数据看板
  return (
    <main className='bg-black min-h-screen'>
      <meta name='robots' content='noindex, nofollow' />
      <div className='max-w-4xl mx-auto px-6 py-10'>
        <div className='flex justify-between items-start gap-4'>
          <div>
            <h1 className='text-primary text-2xl font-bold'>问心 AI 数据看板</h1>
            <p className='text-gray-400 text-sm mt-1'>数据实时查询 · 最近 30 天</p>
          </div>
          <button
            type='button'
            className='btn-editor-secondary'
            onClick={handleLogout}
            style={{ padding: '8px 20px', fontSize: '0.875rem' }}
          >
            退出登录
          </button>
        </div>

        {error && (
          <p className='text-sm mt-4' style={{ color: '#f87171' }}>
            {error}
          </p>
        )}

        {/* 转化漏斗 */}
        <section className='mt-10 bg-[#101010] rounded-2xl p-6'>
          <h2 className='text-primary text-lg font-semibold'>转化漏斗</h2>
          {!funnelSteps ? (
            <p className='text-gray-500 mt-4'>暂无数据</p>
          ) : (
            <table className='w-full mt-4 text-sm' style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #212121', textAlign: 'left' }}>
                  <th className='text-gray-400 font-medium' style={{ padding: '10px 12px' }}>
                    步骤
                  </th>
                  <th
                    className='text-gray-400 font-medium'
                    style={{ padding: '10px 12px', textAlign: 'right' }}
                  >
                    人数
                  </th>
                  <th
                    className='text-gray-400 font-medium'
                    style={{ padding: '10px 12px', textAlign: 'right' }}
                  >
                    步转化率
                  </th>
                  <th
                    className='text-gray-400 font-medium'
                    style={{ padding: '10px 12px', textAlign: 'right' }}
                  >
                    整体转化率
                  </th>
                </tr>
              </thead>
              <tbody>
                {funnelSteps.map((step) => (
                  <tr key={step.step} style={{ borderBottom: '1px solid #212121' }}>
                    <td style={{ padding: '10px 12px', color: '#E1E0CC' }}>
                      {step.label}
                    </td>
                    <td
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: '#E1E0CC',
                      }}
                    >
                      {step.count.toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#86efac' }}>
                      {step.conversionRate}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#DEDBC8' }}>
                      {step.overallRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 留存曲线 */}
        <section className='mt-6 bg-[#101010] rounded-2xl p-6'>
          <h2 className='text-primary text-lg font-semibold'>留存曲线</h2>
          {!retentionData ? (
            <p className='text-gray-500 mt-4'>暂无数据</p>
          ) : (
            <>
              <p className='text-sm text-gray-400 mt-2'>
                Cohort: 最近 7 天新用户（共 {retentionData.cohortSize} 人）
              </p>
              <div className='flex flex-wrap gap-2 mt-4'>
                {retentionData.curve
                  .filter(
                    (_, i) =>
                      [0, 1, 3, 7, 14, 30].includes(i) ||
                      i === retentionData.curve.length - 1,
                  )
                  .map((point) => (
                    <div
                      key={point.day}
                      className='bg-[#212121] rounded-2xl text-center'
                      style={{ padding: '12px 16px', minWidth: 100 }}
                    >
                      <div className='text-xs text-gray-400'>Day {point.day}</div>
                      <div
                        className='text-2xl font-bold'
                        style={{ color: '#DEDBC8' }}
                      >
                        {point.retentionRate}%
                      </div>
                      <div className='text-xs text-gray-500'>{point.activeUsers} 人</div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </section>

        <footer
          className='mt-10 pt-5 text-xs text-gray-500'
          style={{ borderTop: '1px solid #212121' }}
        >
          数据来源：TrackEvent + raw SQL · 自动刷新需手动 F5
        </footer>
      </div>
    </main>
  );
}
