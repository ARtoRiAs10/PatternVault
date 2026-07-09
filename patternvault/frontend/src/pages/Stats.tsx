import { useEffect, useState } from "react";
import { getStatsOverview } from "../api/client";

interface PerTopicStat {
  name: string;
  parent_category: string;
  solved_count: number;
  avg_time: number | null;
}

interface SolvedPerWeek {
  week: string;
  count: number;
}

interface StatsData {
  per_topic: PerTopicStat[];
  solved_per_week: SolvedPerWeek[];
  review_days_count: number;
}

export default function Stats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatsOverview()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Loading stats…</div>;
  if (!data) return <div className="text-slate-400">No stats available.</div>;

  const maxSolvedPerTopic = Math.max(1, ...data.per_topic.map((t) => t.solved_count));
  const maxWeekly = Math.max(1, ...data.solved_per_week.map((w) => w.count));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Stats</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">Review streak</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{data.review_days_count} days</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">Topics tracked</p>
          <p className="mt-1 text-2xl font-bold">{data.per_topic.length}</p>
        </div>
        <div className="rounded-xl bg-slate-800 p-4">
          <p className="text-xs text-slate-400">Total solved</p>
          <p className="mt-1 text-2xl font-bold">
            {data.per_topic.reduce((sum, t) => sum + t.solved_count, 0)}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Solved per topic</h2>
        <div className="space-y-2">
          {data.per_topic.map((t) => (
            <div key={t.name} className="flex items-center gap-3">
              <span className="w-40 truncate text-xs text-slate-300">{t.name}</span>
              <div className="h-2 flex-1 rounded-full bg-slate-700">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${(t.solved_count / maxSolvedPerTopic) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-slate-400">{t.solved_count}</span>
              {t.avg_time != null && (
                <span className="w-16 text-right text-[11px] text-slate-500">
                  avg {Math.round(t.avg_time)}m
                </span>
              )}
            </div>
          ))}
          {data.per_topic.length === 0 && (
            <p className="text-sm text-slate-500">No topics yet — solve a few problems first.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-400">Problems solved per week</h2>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {data.solved_per_week.map((w) => (
            <div key={w.week} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-emerald-500"
                style={{ height: `${(w.count / maxWeekly) * 90 + 4}px` }}
                title={`${w.count} solved`}
              />
              <span className="text-[10px] text-slate-500">{w.week.slice(5, 10)}</span>
            </div>
          ))}
          {data.solved_per_week.length === 0 && (
            <p className="text-sm text-slate-500">No solved problems yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
