/**
 * Prisma Seed · 将 65 种 CoupleType 写入数据库
 * 运行：npx tsx prisma/seed-couple-types.ts
 */
import { PrismaClient } from '@prisma/client';
import { ALL_COUPLE_TYPES } from '../shared/couple-types-all';

const prisma = new PrismaClient();

async function main() {
  console.log(`开始 seed ${ALL_COUPLE_TYPES.length} 种 CoupleType...`);

  // 使用 upsert 避免重复插入
  for (const type of ALL_COUPLE_TYPES) {
    await prisma.coupleType.upsert({
      where: { code: type.code },
      update: {
        name: type.name,
        emoji: type.emoji,
        rarity: type.rarity,
        genderCombo: type.genderCombo,
        estimatedRatio: type.estimatedRatio,
        oneLiner: type.oneLiner,
        description: type.description,
        hiddenRisks: type.hiddenRisks,
        growthAdvice: type.growthAdvice,
        shareCopy: type.shareCopy,
        radarProfile: type.radarProfile,
        attachmentCombo: type.attachmentCombo,
        conflictPattern: type.conflictPattern,
        stage: type.stage,
        marketingAngle: type.marketingAngle,
        isPublic: type.isPublic,
      },
      create: {
        code: type.code,
        name: type.name,
        emoji: type.emoji,
        rarity: type.rarity,
        genderCombo: type.genderCombo,
        estimatedRatio: type.estimatedRatio,
        oneLiner: type.oneLiner,
        description: type.description,
        hiddenRisks: type.hiddenRisks,
        growthAdvice: type.growthAdvice,
        shareCopy: type.shareCopy,
        radarProfile: type.radarProfile,
        attachmentCombo: type.attachmentCombo,
        conflictPattern: type.conflictPattern,
        stage: type.stage,
        marketingAngle: type.marketingAngle,
        isPublic: type.isPublic,
      },
    });
  }

  const total = await prisma.coupleType.count();
  console.log(`✅ Seed 完成，数据库共 ${total} 种 CoupleType`);

  // 按性别组合统计
  const heteroCount = await prisma.coupleType.count({
    where: { genderCombo: 'male-female' },
  });
  const mmCount = await prisma.coupleType.count({
    where: { genderCombo: 'male-male' },
  });
  const ffCount = await prisma.coupleType.count({
    where: { genderCombo: 'female-female' },
  });
  console.log(`  异性恋：${heteroCount} 种`);
  console.log(`  男男：${mmCount} 种`);
  console.log(`  女女：${ffCount} 种`);

  // 公共/隐藏统计
  const publicCount = await prisma.coupleType.count({
    where: { isPublic: true },
  });
  const hiddenCount = await prisma.coupleType.count({
    where: { isPublic: false },
  });
  console.log(`  公开：${publicCount} 种`);
  console.log(`  隐藏：${hiddenCount} 种`);
}

main()
  .catch((e) => {
    console.error('❌ Seed 失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
