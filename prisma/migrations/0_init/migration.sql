-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "status" TEXT,
    "openid" TEXT,
    "unionid" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "nickname" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "subscription" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT,
    "expiresAt" TIMESTAMP(3),
    "code" TEXT,

    CONSTRAINT "authentications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "insights" JSONB NOT NULL DEFAULT '[]',
    "emotion" TEXT,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "emotion" TEXT,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 7,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkIns" JSONB NOT NULL DEFAULT '[]',
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "aiFeedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "emotion" TEXT NOT NULL,
    "note" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "openQuestionId" TEXT,
    "openAnswer" TEXT,
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "gender" TEXT NOT NULL,
    "bankVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "test_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pair_sessions" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "initiatorUserId" TEXT,
    "responderUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "genderCombo" TEXT NOT NULL,
    "dimensionsA" JSONB NOT NULL DEFAULT '{}',
    "dimensionsB" JSONB NOT NULL DEFAULT '{}',
    "compatibility" INTEGER,
    "matchedTypeId" TEXT,
    "matchedTypeCode" TEXT,
    "alternatives" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockMethod" TEXT,
    "resultSharedToInitiator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "pair_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couple_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "rarity" TEXT NOT NULL DEFAULT 'common',
    "genderCombo" TEXT NOT NULL DEFAULT 'male-female',
    "estimatedRatio" DOUBLE PRECISION NOT NULL,
    "oneLiner" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hiddenRisks" TEXT NOT NULL,
    "growthAdvice" TEXT NOT NULL,
    "shareCopy" TEXT NOT NULL,
    "radarProfile" JSONB NOT NULL,
    "attachmentCombo" TEXT NOT NULL,
    "conflictPattern" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "marketingAngle" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couple_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couples" (
    "id" TEXT NOT NULL,
    "pairSessionId" TEXT NOT NULL,
    "partnerAId" TEXT,
    "partnerBId" TEXT,
    "coupleTypeId" TEXT,
    "relationshipStart" TIMESTAMP(3),
    "stage" TEXT NOT NULL DEFAULT 'dating',
    "status" TEXT NOT NULL DEFAULT 'active',
    "profile" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "couples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "sourceDimension" TEXT NOT NULL,
    "targetDimension" TEXT,
    "estimatedMin" INTEGER NOT NULL DEFAULT 3,
    "statusA" TEXT NOT NULL DEFAULT 'pending',
    "statusB" TEXT NOT NULL DEFAULT 'pending',
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_responses" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "content" TEXT NOT NULL,
    "emotionTag" TEXT,
    "perspective" TEXT,
    "mediaUrls" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_events" (
    "id" TEXT NOT NULL,
    "pairSessionId" TEXT NOT NULL,
    "sharerUserId" TEXT,
    "utmSource" TEXT NOT NULL DEFAULT 'unknown',
    "utmMedium" TEXT NOT NULL DEFAULT 'unknown',
    "utmCampaign" TEXT NOT NULL DEFAULT 'default',
    "variant" TEXT NOT NULL DEFAULT 'mystery',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "scene" TEXT NOT NULL DEFAULT 'daily_task',
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "props" JSONB,
    "source" TEXT NOT NULL DEFAULT 'miniapp',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "authentications_provider_providerAccountId_key" ON "authentications"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_lastMessageAt_idx" ON "sessions"("lastMessageAt");

-- CreateIndex
CREATE INDEX "messages_sessionId_timestamp_idx" ON "messages"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "messages_userId_idx" ON "messages"("userId");

-- CreateIndex
CREATE INDEX "actions_userId_idx" ON "actions"("userId");

-- CreateIndex
CREATE INDEX "actions_status_idx" ON "actions"("status");

-- CreateIndex
CREATE INDEX "actions_sessionId_idx" ON "actions"("sessionId");

-- CreateIndex
CREATE INDEX "mood_entries_userId_date_idx" ON "mood_entries"("userId", "date");

-- CreateIndex
CREATE INDEX "test_sessions_userId_idx" ON "test_sessions"("userId");

-- CreateIndex
CREATE INDEX "test_sessions_gender_idx" ON "test_sessions"("gender");

-- CreateIndex
CREATE UNIQUE INDEX "pair_sessions_initiatorId_key" ON "pair_sessions"("initiatorId");

-- CreateIndex
CREATE INDEX "pair_sessions_initiatorUserId_idx" ON "pair_sessions"("initiatorUserId");

-- CreateIndex
CREATE INDEX "pair_sessions_responderUserId_idx" ON "pair_sessions"("responderUserId");

-- CreateIndex
CREATE INDEX "pair_sessions_status_createdAt_idx" ON "pair_sessions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "pair_sessions_genderCombo_idx" ON "pair_sessions"("genderCombo");

-- CreateIndex
CREATE INDEX "pair_sessions_matchedTypeId_idx" ON "pair_sessions"("matchedTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "couple_types_code_key" ON "couple_types"("code");

-- CreateIndex
CREATE INDEX "couple_types_genderCombo_idx" ON "couple_types"("genderCombo");

-- CreateIndex
CREATE INDEX "couple_types_isPublic_idx" ON "couple_types"("isPublic");

-- CreateIndex
CREATE INDEX "couple_types_rarity_idx" ON "couple_types"("rarity");

-- CreateIndex
CREATE UNIQUE INDEX "couples_pairSessionId_key" ON "couples"("pairSessionId");

-- CreateIndex
CREATE INDEX "couples_partnerAId_idx" ON "couples"("partnerAId");

-- CreateIndex
CREATE INDEX "couples_partnerBId_idx" ON "couples"("partnerBId");

-- CreateIndex
CREATE INDEX "couples_coupleTypeId_idx" ON "couples"("coupleTypeId");

-- CreateIndex
CREATE INDEX "couples_status_idx" ON "couples"("status");

-- CreateIndex
CREATE INDEX "daily_tasks_date_idx" ON "daily_tasks"("date");

-- CreateIndex
CREATE INDEX "daily_tasks_coupleId_idx" ON "daily_tasks"("coupleId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_tasks_coupleId_date_key" ON "daily_tasks"("coupleId", "date");

-- CreateIndex
CREATE INDEX "task_responses_taskId_idx" ON "task_responses"("taskId");

-- CreateIndex
CREATE INDEX "task_responses_userId_createdAt_idx" ON "task_responses"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "task_responses_taskId_userId_key" ON "task_responses"("taskId", "userId");

-- CreateIndex
CREATE INDEX "share_events_pairSessionId_createdAt_idx" ON "share_events"("pairSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "share_events_utmSource_idx" ON "share_events"("utmSource");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_scene_idx" ON "push_subscriptions"("userId", "scene");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_userId_templateId_scene_key" ON "push_subscriptions"("userId", "templateId", "scene");

-- CreateIndex
CREATE INDEX "track_events_event_createdAt_idx" ON "track_events"("event", "createdAt");

-- CreateIndex
CREATE INDEX "track_events_userId_createdAt_idx" ON "track_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "track_events_source_createdAt_idx" ON "track_events"("source", "createdAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentications" ADD CONSTRAINT "authentications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_sessions" ADD CONSTRAINT "test_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_sessions" ADD CONSTRAINT "pair_sessions_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "test_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_sessions" ADD CONSTRAINT "pair_sessions_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "test_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_sessions" ADD CONSTRAINT "pair_sessions_initiatorUserId_fkey" FOREIGN KEY ("initiatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_sessions" ADD CONSTRAINT "pair_sessions_responderUserId_fkey" FOREIGN KEY ("responderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pair_sessions" ADD CONSTRAINT "pair_sessions_matchedTypeId_fkey" FOREIGN KEY ("matchedTypeId") REFERENCES "couple_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_pairSessionId_fkey" FOREIGN KEY ("pairSessionId") REFERENCES "pair_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_partnerAId_fkey" FOREIGN KEY ("partnerAId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_partnerBId_fkey" FOREIGN KEY ("partnerBId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "couples" ADD CONSTRAINT "couples_coupleTypeId_fkey" FOREIGN KEY ("coupleTypeId") REFERENCES "couple_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "couples"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_responses" ADD CONSTRAINT "task_responses_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "daily_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_responses" ADD CONSTRAINT "task_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_pairSessionId_fkey" FOREIGN KEY ("pairSessionId") REFERENCES "pair_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_events" ADD CONSTRAINT "share_events_sharerUserId_fkey" FOREIGN KEY ("sharerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_events" ADD CONSTRAINT "track_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

