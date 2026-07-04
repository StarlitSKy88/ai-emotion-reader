/**
 * Admin 看板共享类型定义（V2 优化 · S-1）
 *
 * 提取自：
 * - app/api/admin/funnel/route.ts（FunnelStep / FunnelData）
 * - app/api/admin/retention/route.ts（RetentionPoint / RetentionData）
 * - app/admin/dashboard/page.tsx（前端重复定义）
 *
 * 用途：API 路由和 admin dashboard 客户端组件共用同一份类型定义，
 *      避免接口字段不一致或重复维护。
 */

// ==================== 转化漏斗（Funnel） ====================

export interface FunnelStep {
  step: string;
  label: string;
  count: number;
  /** 相对上一步的转化率 */
  conversionRate: number;
  /** 相对第一步的整体转化率 */
  overallRate: number;
}

export interface FunnelData {
  days: number;
  startDate: string;
  endDate: string;
  steps: FunnelStep[];
}

// ==================== 留存曲线（Retention） ====================

export interface RetentionPoint {
  day: number;
  /** 活跃用户数 */
  activeUsers: number;
  /** 留存率（相对 cohort 总人数） */
  retentionRate: number;
}

export interface RetentionData {
  /** cohort 总人数 */
  cohortSize: number;
  /** cohort 起始日期（YYYY-MM-DD） */
  cohortStart: string;
  /** cohort 结束日期（YYYY-MM-DD） */
  cohortEnd: string;
  /** 留存曲线数据点 */
  curve: RetentionPoint[];
}
