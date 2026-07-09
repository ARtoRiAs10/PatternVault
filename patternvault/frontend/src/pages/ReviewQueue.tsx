import { useEffect, useState } from "react";
import { getReviewQueue, quizPatternCard, submitReview } from "../api/client";
import type { PatternCard as PatternCardType } from "../types";

export default function ReviewQueue() {
  const [queue, setQueue] = useState<PatternCardType[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  const [quiz, setQuiz] = useState<{ quiz_statement: string; difficulty_hint?: string } | null>(null);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  async function loadQueue() {
    setLoading(true);
    const data = await getReviewQueue();
    setQueue(data);
    setIndex(0);
    setRevealed(false);
    setQuiz(null);
    setLoading(false);
  }

  useEffect(() => {
    loadQueue();
  }, []);

  const current = queue[index];

  async function handleRate(rating: number) {
    if (!current) return;
    await submitReview(current.id, rating);
    const next = index + 1;
    if (next < queue.length) {
      setIndex(next);
      setRevealed(false);
      setQuiz(null);
      setQuizRevealed(false);
      setQuizAnswer("");
    } else {
      await loadQueue();
    }
  }

  async function handleStartQuiz() {
    if (!current) return;
    setQuizLoading(true);
    try {
      const data = await quizPatternCard(current.id);
      setQuiz(data);
      setQuizRevealed(false);
      setQuizAnswer("");
    } finally {
      setQuizLoading(false);
    }
  }

  if (loading) return <div className="text-slate-400">Loading review queue…</div>;

  if (!current) {
    return (
      <div className="rounded-xl bg-slate-800 p-8 text-center">
        <p className="text-lg font-semibold">🎉 All caught up!</p>
        <p className="mt-1 text-sm text-slate-400">No pattern cards are due for review right now.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between text-sm text-slate-400">
        <span>
          Card {index + 1} of {queue.length}
        </span>
        {current.overdue_days != null && current.overdue_days > 0 && (
          <span className="text-red-400">{current.overdue_days}d overdue</span>
        )}
      </div>

      <div className="rounded-xl bg-slate-800 p-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">Recognition trigger</p>
        <p className="mt-2 text-base">{current.recognition_trigger}</p>

        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mt-6 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Reveal Insight
          </button>
        ) : (
          <>
            <div className="mt-4 space-y-2 rounded-lg bg-slate-900 p-3 text-sm">
              <p>
                <span className="text-slate-400">Pattern: </span>
                {current.pattern_name}
              </p>
              <p>
                <span className="text-slate-400">Insight: </span>
                {current.core_insight}
              </p>
              <p>
                <span className="text-slate-400">Edge cases: </span>
                {current.common_edge_cases}
              </p>
            </div>

            {!quiz && (
              <button
                onClick={handleStartQuiz}
                disabled={quizLoading}
                className="mt-3 w-full rounded-md bg-purple-600/20 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-600/30 disabled:opacity-50"
              >
                {quizLoading ? "Generating quiz…" : "🧠 Quiz Mode: try a fresh isomorphic problem"}
              </button>
            )}

            {quiz && (
              <div className="mt-3 space-y-2 rounded-lg bg-slate-900 p-3 text-sm">
                <p className="whitespace-pre-wrap">{quiz.quiz_statement}</p>
                <textarea
                  value={quizAnswer}
                  onChange={(e) => setQuizAnswer(e.target.value)}
                  placeholder="Sketch your approach here…"
                  rows={4}
                  className="w-full rounded-md bg-slate-950 px-3 py-2 text-sm outline-none"
                />
                {!quizRevealed ? (
                  <button
                    onClick={() => setQuizRevealed(true)}
                    className="rounded-md bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
                  >
                    Reveal Original Pattern
                  </button>
                ) : (
                  <p className="text-xs text-emerald-300">
                    Original pattern: {current.pattern_name} — self-grade your answer above.
                  </p>
                )}
              </div>
            )}

            <p className="mt-5 mb-2 text-xs uppercase tracking-wide text-slate-500">
              How well did you recall this?
            </p>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  onClick={() => handleRate(r)}
                  className={`rounded-md py-2 text-sm font-semibold ${
                    r <= 2
                      ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                      : r === 3
                      ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
