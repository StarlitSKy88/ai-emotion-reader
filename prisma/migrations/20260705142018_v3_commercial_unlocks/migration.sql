-- V3 商业化改造:两层解锁 + 多维度分析 + 断点续接
-- 仅包含 V3 新增字段的 ALTER TABLE 语句,不涉及索引变更

-- AlterTable:PairSession 增加 basic/deep 解锁字段 + multiDimAnalysis 缓存
ALTER TABLE "pair_sessions" ADD COLUMN     "basicUnlockMethod" TEXT,
ADD COLUMN     "basicUnlockedAt" TIMESTAMP(3),
ADD COLUMN     "deepUnlockMethod" TEXT,
ADD COLUMN     "deepUnlockedAt" TIMESTAMP(3),
ADD COLUMN     "multiDimAnalysis" TEXT,
ADD COLUMN     "multiDimGeneratedAt" TIMESTAMP(3);

-- AlterTable:DailyTask 增加断点续接字段
ALTER TABLE "daily_tasks" ADD COLUMN     "streakAlive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastBreakDate" DATE,
ADD COLUMN     "completedDates" INTEGER NOT NULL DEFAULT 0;
