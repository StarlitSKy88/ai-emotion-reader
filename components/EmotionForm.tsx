"use client";

import { useState } from "react";

interface EmotionFormProps {
  onSubmit: (data: UserFormData) => void;
  loading: boolean;
}

export interface UserFormData {
  name: string;
  gender: string;
  age: string;
  status: string;
  focusAreas: string[];
  question: string;
}

const GENDERS = [
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "other", label: "其他" },
];

const STATUSES = [
  { value: "single", label: "单身" },
  { value: "dating", label: "恋爱中" },
  { value: "married", label: "已婚" },
  { value: "divorced", label: "离异" },
  { value: "complicated", label: "状态复杂" },
];

const FOCUS_OPTIONS = [
  { value: "self", label: "🌱 自我认知" },
  { value: "emotion", label: "💕 情感关系" },
  { value: "career", label: "💼 职业发展" },
  { value: "future", label: "🔮 未来方向" },
  { value: "psychology", label: "🧠 心理模式" },
];

export default function EmotionForm({ onSubmit, loading }: EmotionFormProps) {
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    gender: "female",
    age: "",
    status: "single",
    focusAreas: [],
    question: "",
  });

  const toggleFocus = (value: string) => {
    setFormData((prev) => {
      const exists = prev.focusAreas.includes(value);
      return {
        ...prev,
        focusAreas: exists
          ? prev.focusAreas.filter((v) => v !== value)
          : [...prev.focusAreas, value],
      };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim()) {
      alert("请告诉我你的困惑");
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
      {/* 称呼 */}
      <div>
        <label className="block text-sm font-medium text-night-200 mb-2">
          我该怎么称呼你？（可选）
        </label>
        <input
          type="text"
          className="input-field"
          placeholder="比如：小琳、阿杰、或者你想被称呼的名字"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          maxLength={20}
        />
      </div>

      {/* 性别 */}
      <div>
        <label className="block text-sm font-medium text-night-200 mb-2">
          你的性别
        </label>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              className={`pill ${
                formData.gender === g.value ? "pill-active" : "pill-default"
              }`}
              onClick={() => setFormData({ ...formData, gender: g.value })}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* 年龄 */}
      <div>
        <label className="block text-sm font-medium text-night-200 mb-2">
          你的年龄
        </label>
        <input
          type="number"
          className="input-field"
          placeholder="比如：28"
          value={formData.age}
          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
          min="14"
          max="100"
        />
      </div>

      {/* 情感状态 */}
      <div>
        <label className="block text-sm font-medium text-night-200 mb-2">
          当前情感状态
        </label>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`pill ${
                formData.status === s.value ? "pill-active" : "pill-default"
              }`}
              onClick={() => setFormData({ ...formData, status: s.value })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 关注重点 */}
      <div>
        <label className="block text-sm font-medium text-night-200 mb-2">
          你最想了解什么？（可多选）
        </label>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`pill ${
                formData.focusAreas.includes(f.value)
                  ? "pill-active"
                  : "pill-default"
              }`}
              onClick={() => toggleFocus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 核心困惑 */}
      <div>
        <label className="block text-sm font-medium text-night-200 mb-2">
          此刻最困扰你的是什么？{" "}
          <span className="text-mystic-400">*</span>
        </label>
        <textarea
          required
          className="input-field min-h-[140px] resize-y"
          placeholder="比如：我工作 5 年了，最近总觉得自己在原地踏步。看着同龄人都在往前走，我不知道自己真正想要什么……"
          value={formData.question}
          onChange={(e) =>
            setFormData({ ...formData, question: e.target.value })
          }
          maxLength={1000}
        />
        <div className="text-xs text-night-400 mt-1 text-right">
          {formData.question.length} / 1000
        </div>
      </div>

      {/* 提交按钮 */}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            AI 正在为你解读……
          </span>
        ) : (
          "🌙 开始我的专属解读"
        )}
      </button>

      <p className="text-xs text-night-400 text-center">
        ⏱ 约 30 秒生成 | 基于 AI 算法 + 心理学模型
      </p>
    </form>
  );
}