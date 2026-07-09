import { useEffect, useRef, useState } from "react";

interface TimerProps {
  running: boolean;
  onTick?: (seconds: number) => void;
  resetKey?: string | number;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function Timer({ running, onTick, resetKey }: TimerProps) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          onTick?.(next);
          return next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5 font-mono text-sm text-emerald-400">
      <span className={`h-2 w-2 rounded-full ${running ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
      {formatDuration(seconds)}
    </div>
  );
}

export { formatDuration };
