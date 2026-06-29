"use client";

import { useEffect, useRef, useState } from "react";

/**
 * BlurText - 文字从模糊到清晰的渐显动画
 * 来自 ReactBits.dev
 * https://reactbits.dev/text-animations/blur-text
 */

type BlurTextProps = {
  text?: string;
  delay?: number;
  className?: string;
  animateBy?: "words" | "characters";
  direction?: "top" | "bottom";
  threshold?: number;
  rootMargin?: string;
  animationFrom?: Record<string, string | number>;
  animationTo?: Record<string, string | number>;
  easing?: (t: number) => number;
  onAnimationComplete?: () => void;
  stepDuration?: number;
};

const buildKeyframes = (
  from: Record<string, string | number>,
  to: Record<string, string | number>
): Record<string, Record<string, string | number>> => {
  const keyframes: Record<string, Record<string, string | number>> = {};
  for (const prop in from) {
    keyframes[prop] = { from, to };
  }
  return keyframes;
};

const BlurText: React.FC<BlurTextProps> = ({
  text = "",
  delay = 200,
  className = "",
  animateBy = "words",
  direction = "top",
  threshold = 0.1,
  rootMargin = "0px",
  animationFrom,
  animationTo,
  easing = (t) => t,
  onAnimationComplete,
  stepDuration = 0.35,
}) => {
  const elements = animateBy === "words" ? text.split(" ") : text.split("");
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold, rootMargin }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const defaultFrom: Record<string, string | number> =
    direction === "top"
      ? { filter: "blur(10px)", opacity: 0, y: -50 }
      : { filter: "blur(10px)", opacity: 0, y: 50 };

  const defaultTo: Record<string, string | number> = {
    filter: "blur(0px)",
    opacity: 1,
    y: 0,
  };

  const fromSnapshot = animationFrom ?? defaultFrom;
  const toSnapshot = animationTo ?? defaultTo;

  const stepCount = elements.length;
  const totalDuration = stepDuration * stepCount;
  const easingFn = typeof easing === "function" ? easing : (t: number) => t;

  return (
    <p
      ref={ref}
      className={className}
      style={{ display: "flex", flexWrap: "wrap" }}
    >
      {elements.map((segment, index) => {
        const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshot);
        const spanStyle: React.CSSProperties = {
          display: "inline-block",
          opacity: inView ? undefined : 0,
          filter: inView ? undefined : "blur(10px)",
          willChange: "transform, filter, opacity",
        };

        if (inView) {
          spanStyle.animation = `blur-text-${index} ${totalDuration}s ${easingFn(0)} ${delay}ms forwards`;
        }

        return (
          <span key={index} style={spanStyle}>
            {segment === " " ? " " : segment}
            {animateBy === "words" && index < elements.length - 1 ? " " : ""}
          </span>
        );
      })}

      <style>
        {elements
          .map((_, index) => {
            const animateKeyframes = buildKeyframes(fromSnapshot, toSnapshot);
            return `@keyframes blur-text-${index} {\n${Object.entries(animateKeyframes)
              .map(
                ([prop, keyframes]) =>
                  `  ${prop} {\n    ${Object.entries(keyframes)
                    .map(([key, value]) => `      ${key}: ${value};`)
                    .join("\n")}\n  }`
              )
              .join("\n")}\n}`;
          })
          .join("\n")}
      </style>
    </p>
  );
};

export default BlurText;