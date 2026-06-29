"use client";

import { useState } from "react";

interface EmotionFormProps {
  onSubmit: (data: UserFormData) => void;
  loading: boolean;
}

export interface UserFormData {
  // 基础信息
  name: string;
  gender: string;
  age: string;
  status: string;
  // 当前困扰
  currentQuestion: string;        // 此刻最困扰的事
  // 深度问题（新增）
  childhoodTag: string;            // 童年氛围
  relationshipPattern: string;     // 关系模式
  selfDescription: string;         // 自我描述
  // 关注重点（多选）
  focusAreas: string[];
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
  { value: "self", label: "自我认知" },
  { value: "emotion", label: "情感关系" },
  { value: "career", label: "职业发展" },
  { value: "future", label: "未来方向" },
  { value: "psychology", label: "心理模式" },
];

const CHILDHOOD_TAGS = [
  { value: "warm", label: "温暖、被爱" },
  { value: "strict", label: "严格、高期待" },
  { value: "neglect", label: "缺少陪伴" },
  { value: "conflict", label: "经常争吵" },
  { value: "chaotic", label: "不稳定" },
  { value: "lonely", label: "孤独、被忽视" },
  { value: "normal", label: "普通、平常" },
];

const RELATIONSHIP_PATTERNS = [
  { value: "anxious", label: "焦虑型（害怕被抛弃）" },
  { value: "avoidant", label: "回避型（害怕亲密）" },
  { value: "secure", label: "安全型（信任他人）" },
  { value: "disorganized", label: "混乱型（渴望又害怕）" },
  { value: "explorer", label: "探索型（享受新鲜）" },
  { value: "none", label: "目前不涉及" },
];

export default function EmotionForm({ onSubmit, loading }: EmotionFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<UserFormData>({
    name: "",
    gender: "female",
    age: "",
    status: "single",
    currentQuestion: "",
    childhoodTag: "normal",
    relationshipPattern: "secure",
    selfDescription: "",
    focusAreas: [],
  });

  const toggleFocus = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      focusAreas: prev.focusAreas.includes(value)
        ? prev.focusAreas.filter((v) => v !== value)
        : [...prev.focusAreas, value],
    }));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        alert("请告诉我怎么称呼你");
        return;
      }
      if (!formData.age.trim()) {
        alert("请填写年龄");
        return;
      }
    }
    if (step === 2) {
      if (!formData.currentQuestion.trim() || formData.currentQuestion.length < 10) {
        alert("请至少写 10 个字描述你的困惑");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(Math.max(1, step - 1));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.selfDescription.trim()) {
      alert("请用几句话描述一下自己");
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 进度条 */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-ink" : "bg-ink-100"
            }`}
          />
        ))}
      </div>

      {/* Step 1: 基础信息 */}
      {step === 1 && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-2">
            第一部分 / 关于你
          </div>
          <h3 className="font-serif text-2xl text-ink mb-6">先认识一下你</h3>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              我该怎么称呼你？
            </label>
            <input
              type="text"
              className="input-editor"
              placeholder="小琳、阿杰、或者你想被称呼的名字"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-3">
                性别
              </label>
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`pill-editor ${
                      formData.gender === g.value ? "pill-editor-active" : ""
                    }`}
                    onClick={() =>
                      setFormData({ ...formData, gender: g.value })
                    }
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-3">
                年龄
              </label>
              <input
                type="number"
                className="input-editor"
                placeholder="28"
                value={formData.age}
                onChange={(e) =>
                  setFormData({ ...formData, age: e.target.value })
                }
                min="14"
                max="100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              当前情感状态
            </label>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`pill-editor ${
                    formData.status === s.value ? "pill-editor-active" : ""
                  }`}
                  onClick={() =>
                    setFormData({ ...formData, status: s.value })
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleNext}
            className="btn-editor w-full justify-center mt-4"
          >
            继续 →
          </button>
        </div>
      )}

      {/* Step 2: 当前困扰 */}
      {step === 2 && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-2">
            第二部分 / 此刻
          </div>
          <h3 className="font-serif text-2xl text-ink mb-6">此刻发生了什么？</h3>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              用你自己的话，描述此刻最困扰你的事
              <span className="text-accent">*</span>
            </label>
            <textarea
              className="input-editor input-editor-textarea"
              placeholder="比如：我工作 5 年了，最近总觉得自己在原地踏步。看着同龄人都在往前走，我不知道自己真正想要什么……"
              value={formData.currentQuestion}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  currentQuestion: e.target.value,
                })
              }
              maxLength={2000}
              autoFocus
            />
            <div className="text-xs text-ink-muted mt-2 text-right">
              {formData.currentQuestion.length} / 2000
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              你最想了解什么？（可多选）
            </label>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`pill-editor ${
                    formData.focusAreas.includes(f.value)
                      ? "pill-editor-active"
                      : ""
                  }`}
                  onClick={() => toggleFocus(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleBack}
              className="btn-editor-secondary flex-1 justify-center"
            >
              ← 上一步
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="btn-editor flex-1 justify-center"
            >
              继续 →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: 深度问题 */}
      {step === 3 && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-xs font-mono text-ink-light uppercase tracking-wider mb-2">
            第三部分 / 深度了解
          </div>
          <h3 className="font-serif text-2xl text-ink mb-2">让我们更懂你</h3>
          <p className="text-sm text-ink-light mb-6">
            这些问题帮助 AI 更准确地理解你的内心
          </p>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              童年的家庭氛围是怎样的？
            </label>
            <div className="flex flex-wrap gap-2">
              {CHILDHOOD_TAGS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`pill-editor ${
                    formData.childhoodTag === c.value
                      ? "pill-editor-active"
                      : ""
                  }`}
                  onClick={() =>
                    setFormData({ ...formData, childhoodTag: c.value })
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              在亲密关系中，你通常是？
            </label>
            <div className="flex flex-wrap gap-2">
              {RELATIONSHIP_PATTERNS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`pill-editor ${
                    formData.relationshipPattern === r.value
                      ? "pill-editor-active"
                      : ""
                  }`}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      relationshipPattern: r.value,
                    })
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-3">
              用 3-5 句话描述你自己
              <span className="text-accent">*</span>
            </label>
            <textarea
              className="input-editor input-editor-textarea"
              placeholder="比如：我是一个看起来外向但内心敏感的人。工作认真但不擅长拒绝别人。最近总觉得自己活在别人的期待里……"
              value={formData.selfDescription}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  selfDescription: e.target.value,
                })
              }
              maxLength={500}
              autoFocus
            />
            <div className="text-xs text-ink-muted mt-2 text-right">
              {formData.selfDescription.length} / 500
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={handleBack}
              className="btn-editor-secondary flex-1 justify-center"
            >
              ← 上一步
            </button>
            <button type="submit" className="btn-editor flex-1 justify-center" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  AI 解读中
                </span>
              ) : (
                "开始我的专属解读 →"
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}