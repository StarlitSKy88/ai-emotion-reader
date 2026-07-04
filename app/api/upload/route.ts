/**
 * 通用图片上传（Phase 4.4.4 task/chat 页依赖）
 * POST /api/upload
 *
 * multipart/form-data，字段名：file
 *
 * 存储策略：
 * - 开发环境（NODE_ENV !== 'production'）：写入 public/uploads/，返回本地 URL
 * - 生产环境：通过 UPLOAD_BASE_URL + 对象存储（OSS/COS/S3）切换
 *   未配置时降级到本地 public/uploads/（适合 EdgeOne Pages 等带持久化存储的平台）
 *
 * 限制：
 * - 仅允许 image/jpeg、image/png、image/webp、image/gif
 * - 单文件 ≤ 5MB
 *
 * 返回：{ success: true, data: { url, size, mimeType } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getUserIdFromAuthHeader } from '@/lib/wechat-auth';
import type { ApiResponse } from '@/shared/types';

/** 允许的 MIME 类型 */
const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
/** 最大文件大小 5MB */
const MAX_SIZE = 5 * 1024 * 1024;
/** MIME → 扩展名映射 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

interface UploadResult {
  url: string;
  size: number;
  mimeType: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 校验登录态
    const userId = getUserIdFromAuthHeader(
      request.headers.get('Authorization'),
    );
    if (!userId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未登录' },
        { status: 401 },
      );
    }

    // 2. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '缺少 file 字段' },
        { status: 400 },
      );
    }

    // 3. 校验 MIME 类型
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `不支持的图片类型：${file.type}` },
        { status: 400 },
      );
    }

    // 4. 校验大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: `文件超过 5MB（当前 ${Math.round(file.size / 1024 / 1024)}MB）` },
        { status: 400 },
      );
    }

    // 5. 生成文件名：{userId}_{timestamp}_{random}.{ext}
    const ext = MIME_TO_EXT[file.type] || 'jpg';
    const random = Math.random().toString(36).slice(2, 8);
    const filename = `${userId}_${Date.now()}_${random}.${ext}`;

    // 6. 写入 public/uploads/
    // Next.js public/ 目录下文件可直接通过 /filename 访问
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    const filePath = join(uploadsDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // 7. 构造可访问 URL
    // 优先用 UPLOAD_BASE_URL（生产环境对象存储 CDN 域名），否则用同源 /uploads/
    const baseUrl = process.env.UPLOAD_BASE_URL || '';
    const url = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/${filename}`
      : `/uploads/${filename}`;

    return NextResponse.json<ApiResponse<UploadResult>>({
      success: true,
      data: {
        url,
        size: file.size,
        mimeType: file.type,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json<ApiResponse>(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
