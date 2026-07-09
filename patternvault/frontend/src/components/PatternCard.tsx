import type { PatternCard as PatternCardType } from "../types";

interface Props {
  card: PatternCardType;
  onQuiz?: (card: PatternCardType) => void;
  showProblemLink?: boolean;
}

function recencyColor(nextReviewDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(nextReviewDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "border-red-500/60 bg-red-500/5";
  if (diffDays <= 2) return "border-amber-500/60 bg-amber-500/5";
  return "border-emerald-500/60 bg-emerald-500/5";
}

export default function PatternCard({ card, onQuiz, showProblemLink = true }: Props) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm transition ${recencyColor(card.next_review_date)}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-100">{card.pattern_name}</h3>
        {card.llm_generated && (
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
            LLM
          </span>
        )}
      </div>
      {showProblemLink && card.problem_title && (
        <p className="mt-0.5 text-xs text-slate-400">from {card.problem_title}</p>
      )}
      <div className="mt-3 space-y-2 text-sm text-slate-300">
        <p>
          <span className="font-medium text-slate-400">Trigger: </span>
          {card.recognition_trigger}
        </p>
        <p>
          <span className="font-medium text-slate-400">Insight: </span>
          {card.core_insight}
        </p>
        <p>
          <span className="font-medium text-slate-400">Edge cases: </span>
          {card.common_edge_cases}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>Next review: {card.next_review_date}</span>
        {onQuiz && (
          <button
            onClick={() => onQuiz(card)}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Quiz Mode
          </button>
        )}
      </div>
    </div>
  );
}
