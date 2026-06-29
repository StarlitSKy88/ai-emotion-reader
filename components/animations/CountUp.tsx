"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

/**
 * CountUp - 数字递增动画
 * 来自 ReactBits.dev
 * https://reactbits.dev/text-animations/count-up
 */

interface CountUpProps {
  to: number;
  from?: number;
  direction?: "up" | "down";
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export default function CountUp({
  to,
  from = 0,
  direction = "up",
  delay = 0,
  duration = 2,
  className = "",
  startWhen = true,
  separator = "",
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px" });
  const [displayValue, setDisplayValue] = useState(direction === "down" ? to : from);

  useEffect(() => {
    if (!inView || !startWhen) return;

    onStart?.();

    const controls = animate(displayValue, direction === "down" ? from : to, {
      duration,
      delay,
      ease: "easeOut",
      onUpdate: (value) => {
        setDisplayValue(value);
      },
      onComplete: () => {
        onEnd?.();
      },
    });

    return () => controls.stop();
  }, [inView, startWhen]);

  const formatted = Intl.NumberFormat("en-US", {
    useGrouping: !!separator,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(displayValue);

  return (
    <span ref={ref} className={className}>
      {separator ? formatted.replace(/,/g, separator) : formatted}
    </span>
  );
}