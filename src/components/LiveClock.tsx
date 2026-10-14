import React, { useState, useEffect } from "react";
import { Clock, Calendar } from "lucide-react";

interface LiveClockProps {
  variant?: "dark" | "light" | "compact";
  showIcon?: boolean;
}

export const LiveClock: React.FC<LiveClockProps> = ({ variant = "dark", showIcon = true }) => {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const timeStr = now.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/80 shadow-xs">
        {showIcon && <Clock className="w-3.5 h-3.5 text-sky-400 animate-pulse" />}
        <span className="capitalize">{dateStr}</span>
        <span className="text-sky-400">|</span>
        <span className="text-emerald-400">{timeStr}</span>
      </div>
    );
  }

  if (variant === "light") {
    return (
      <div className="flex items-center gap-2 font-mono text-xs font-extrabold text-slate-800 bg-slate-100/90 px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-xs">
        {showIcon && <Clock className="w-4 h-4 text-sky-600 animate-pulse" />}
        <span className="capitalize">{dateStr}</span>
        <span className="text-slate-300">•</span>
        <span className="text-sky-700">{timeStr}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 font-mono text-xs font-bold text-slate-200 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner">
      {showIcon && <Clock className="w-3.5 h-3.5 text-sky-400 animate-pulse" />}
      <span className="capitalize text-slate-300">{dateStr}</span>
      <span className="text-slate-600">|</span>
      <span className="text-emerald-400 font-black">{timeStr}</span>
    </div>
  );
};
