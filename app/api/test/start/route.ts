/**
 * 获取题库（开始测试）
 * GET /api/test/start?gender=male|female
 *
 * 返回该性别的题库（29 道选择题，不含开放题），以及用户最近的未完成 TestSession（断点续答）。
 * 返回结构：{ success: true, data: { gender, bankVersion, questions, openQuestion: null, resume } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import { MALE_TEST_BANK } from '@/shared/test-bank-male';
import { FEMALE_TEST_BANK } from '@/shared/test-bank-female';
import type { ApiResponse, Gender, Question, Answers } from '@/shared/types';

interface StartData {
  gender: Gender;
  bankVersion: string;
  /** 29 道选择题（保留 rationale 字段，前端不展示） */
  questions: Question[];
  /** 开放题在 submit 时按 couple 抽取，此处为 null */
  openQuestion: null;
  /** 最近的未完成 TestSession（断点续答），无则为 null */
  resume: {
    testSessionId: string;
    answers: Answers;
    /** 续答游标 = 已答题数（下一题索引） */
    cursor: number;
  } | null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserIdFromAuthHeader(
      request.headers.get('Authorization'),
    );
    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未登录' },
        { status: 401 },
      );
    }

    const genderParam = request.nextUrl.searchParams.get('gender');
    if (genderParam !== 'male' && genderParam !== 'female') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'gender 参数无效，仅支持 male / female' },
        { status: 400 },
      );
    }
    const gender: Gender = genderParam;

    const testBank = gender === 'male' ? MALE_TEST_BANK : FEMALE_TEST_BANK;

    // 查询最近的未完成 TestSession（断点续答）
    const unfinished = await prisma.testSession.findFirst({
      where: { userId, completedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, answers: true },
    });

    const answers = (unfinished?.answers ?? {}) as Answers;
    const data: StartData = {
      gender,
      bankVersion: testBank.version,
      questions: testBank.questions,
      openQuestion: null,
      resume: unfinished
        ? {
            testSessionId: unfinished.id,
            answers,
            cursor: Object.keys(answers).length,
          }
        : null,
    };

    return NextResponse.json<ApiResponse<StartData>>({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取题库失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
