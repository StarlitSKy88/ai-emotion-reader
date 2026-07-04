import OpenAI from "openai";
import { buildFullPrompt, buildSummaryPrompt, UserInput } from "./prompts";

/**
 * 统一 LLM 客户端
 *
 * 自动适配：
 * - OpenAI 兼容协议（DeepSeek / Kimi / GLM / Qwen / MiniMax 按量付费 Key）
 * - Anthropic 兼容协议（MiniMax Token Plan 订阅 Key）
 *
 * 根据 LLM_BASE_URL 自动判断：
 * - 如果包含 "/anthropic" → Anthropic 协议
 * - 否则 → OpenAI 协议
 *
 * 切换模型只需修改 .env.local:
 *   LLM_API_KEY=...
 *   LLM_BASE_URL=https://...
 *   LLM_MODEL=...
 */

// ===== 配置 =====
const config = {
  apiKey:
    process.env.LLM_API_KEY ||
    process.env.MINIMAX_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    "",
  baseURL: process.env.LLM_BASE_URL || "https://api.minimaxi.com/v1",
  model: process.env.LLM_MODEL || "MiniMax-M3",
};

// 自动检测协议类型
const useAnthropicProtocol = config.baseURL.includes("/anthropic");
const providerName = process.env.LLM_PROVIDER || (useAnthropicProtocol ? "minimax-anthropic" : "minimax-openai");

if (!config.apiKey) {
  console.warn("[警告] LLM_API_KEY 未配置");
}

console.log(`[问心 AI] Provider: ${providerName}`);
console.log(`[问心 AI] Model: ${config.model}`);
console.log(`[问心 AI] Base URL: ${config.baseURL}`);
console.log(`[问心 AI] Protocol: ${useAnthropicProtocol ? "Anthropic" : "OpenAI"}`);

// ===== OpenAI 兼容客户端 =====
const openaiClient = new OpenAI({
  apiKey: config.apiKey,
  baseURL: config.baseURL,
});

// ===== 系统提示词 =====
const SYSTEM_PROMPT = `你是「问心 AI」，一位温暖、专业、共情的 AI 情感咨询师。

你的特点：
1. 用温暖的语言让用户感到"被看见"
2. 不评判、不说教、不绝对化
3. 用心理学视角提供深度洞察
4. 给出可执行的建议
5. 让用户感到被理解和陪伴

你的边界：
- 不算命、不占卜、不预测未来
- 不做医疗诊断
- 不替代专业心理咨询
- 遇到严重心理危机，引导用户寻求专业帮助`;

const SUMMARY_SYSTEM_PROMPT = `你是「问心 AI」，一位温暖、共情的 AI 情感咨询师。生成 250-350 字的情感摘要。`;

// ===== OpenAI 协议流式（自动跳过 reasoning_content / think 标签）=====
async function streamOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number = 0.85,
): Promise<AsyncIterable<string>> {
  // B-PQ-1 修复：叙事场景 temperature=0.85（情绪摘要/分析），避免 vendor 默认 1.0 输出飘忽
  console.log(`[OpenAI] POST ${config.baseURL}/chat/completions, max_tokens=${maxTokens}, temperature=${temperature}`);

  const openaiStream = await openaiClient.chat.completions.create({
    model: config.model,
    max_tokens: maxTokens,
    temperature,
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  // 用于跨 chunk 累积的 buffer，处理跨 chunk 的 <think>...</think> 标签（MiniMax 风格）
  let buffer = "";
  let inThinkBlock = false;

  async function* generate() {
    let chunkCount = 0;
    let totalContent = "";
    let totalReasoning = 0;

    for await (const chunk of openaiStream as any) {
      chunkCount++;

      // DeepSeek 风格: content 和 reasoning_content 分开，直接忽略 reasoning
      const reasoning = chunk.choices?.[0]?.delta?.reasoning_content;
      if (reasoning) {
        totalReasoning += reasoning.length;
        continue;
      }

      // 取 content（MiniMax 用 <think>...</think> 内嵌，DeepSeek 用 content 字段分离）
      const delta = chunk.choices?.[0]?.delta?.content || "";
      if (!delta) continue;

      buffer += delta;
      totalContent += delta;

      // 处理 buffer：过滤 <think>...</think> 标签（MiniMax 风格兼容）
      let output = "";
      let cursor = 0;

      while (cursor < buffer.length) {
        if (inThinkBlock) {
          const endIdx = buffer.indexOf("</think>", cursor);
          if (endIdx === -1) break;
          inThinkBlock = false;
          cursor = endIdx + "</think>".length;
        } else {
          const startIdx = buffer.indexOf("<think>", cursor);
          if (startIdx === -1) {
            output += buffer.slice(cursor);
            cursor = buffer.length;
          } else {
            output += buffer.slice(cursor, startIdx);
            inThinkBlock = true;
            cursor = startIdx + "<think>".length;
          }
        }
      }

      buffer = buffer.slice(cursor);

      if (output) yield output;
    }

    console.log(
      `[OpenAI] 流结束, ${chunkCount} chunks, 最终内容 ${totalContent.length} 字, 跳过思考 ${totalReasoning} 字`,
    );
  }

  return generate();
}

// ===== Anthropic 协议流式 =====
async function streamAnthropic(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number = 0.85,
): Promise<AsyncIterable<string>> {
  // B-PQ-1 修复：叙事场景 temperature=0.85，与 streamOpenAI 对齐
  const url = `${config.baseURL.replace(/\/$/, "")}/v1/messages`;
  console.log(`[Anthropic] POST ${url}, max_tokens=${maxTokens}, temperature=${temperature}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax/Anthropic API 错误 [${response.status}]: ${errorText}`);
  }

  if (!response.body) throw new Error("空响应");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  async function* generate() {
    let chunkCount = 0;
    let totalContent = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`[Anthropic] 流结束, ${chunkCount} chunks, 内容长度 ${totalContent.length}`);
        break;
      }
      chunkCount++;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
            const text = json.delta.text || "";
            if (text) {
              totalContent += text;
              yield text;
            }
          }
          if (json.type === "error") {
            throw new Error(`Anthropic 流式错误: ${json.error?.message || JSON.stringify(json)}`);
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Anthropic")) throw e;
          continue;
        }
      }
    }
  }

  return generate();
}

// ===== API 函数 =====
export async function streamFullAnalysis(
  input: UserInput,
): Promise<AsyncIterable<string>> {
  const prompt = buildFullPrompt(input);
  return useAnthropicProtocol
    ? streamAnthropic(SYSTEM_PROMPT, prompt, 4096)
    : streamOpenAI(SYSTEM_PROMPT, prompt, 4096);
}

export async function streamSummary(
  input: UserInput,
): Promise<AsyncIterable<string>> {
  const prompt = buildSummaryPrompt(input);
  return useAnthropicProtocol
    ? streamAnthropic(SUMMARY_SYSTEM_PROMPT, prompt, 1024)
    : streamOpenAI(SUMMARY_SYSTEM_PROMPT, prompt, 1024);
}

/**
 * 非流式聊天补全（用于开放题分析等需要完整 JSON 响应的场景）
 *
 * 自动适配 OpenAI / Anthropic 协议，返回完整的文本内容。
 */
export async function chatCompletion(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number = 0.6,
): Promise<string> {
  // B-PQ-1 修复：JSON 结构化场景 temperature=0.6（开放题分析），降低输出随机性确保结构稳定
  if (useAnthropicProtocol) {
    const url = `${config.baseURL.replace(/\/$/, "")}/v1/messages`;
    console.log(`[Anthropic] POST ${url} (non-stream), max_tokens=${maxTokens}, temperature=${temperature}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax/Anthropic API 错误 [${response.status}]: ${errorText}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      ?.map((block) => (block.type === "text" ? block.text || "" : ""))
      .join("") || "";
    return text;
  }

  // OpenAI 协议非流式
  console.log(`[OpenAI] POST ${config.baseURL}/chat/completions (non-stream), max_tokens=${maxTokens}, temperature=${temperature}`);
  const completion = await openaiClient.chat.completions.create({
    model: config.model,
    max_tokens: maxTokens,
    temperature,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return completion.choices?.[0]?.message?.content || "";
}

export const currentLLMConfig = {
  provider: providerName,
  model: config.model,
  baseURL: config.baseURL,
  protocol: useAnthropicProtocol ? "Anthropic" : "OpenAI",
};