import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  exportMarkdownUrl,
  getWeeklyDigest,
  listPatternCards,
  listProblems,
  listTopics,
} from "../api/client";
import PatternCard from "../components/PatternCard";
import type { PatternCard as PatternCardType, Problem, ProblemSource, ProblemStatus, Topic } from "../types";

const CATEGORY_LABELS: Record<string, string> = {
  DP: "Dynamic Programming",
  GRAPH: "Graph",
  LINEAR_DS: "Linear Data Structures",
  OTHER: "Other",
};

const STATUS_OPTIONS: ProblemStatus[] = ["SOLVED", "PARTIAL", "FAILED", "UNTRIED"];
const SOURCE_OPTIONS: ProblemSource[] = ["CODEFORCES", "CODECHEF", "LEETCODE", "OA", "OTHER"];

export default function Dashboard() {
  const [cards, setCards] = useState<PatternCardType[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [loadingProblems, setLoadingProblems] = useState(true);

  // Filters — mirror the backend's ?status= / ?source= / ?topic= / ?search= params
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    listPatternCards().then(setCards);
    listTopics().then(setTopics);
  }, []);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (sourceFilter) params.source = sourceFilter;
    if (topicFilter) params.topic = topicFilter;
    if (search) params.search = search;

    setLoadingProblems(true);
    const handle = setTimeout(() => {
      listProblems(params)
        .then(setProblems)
        .finally(() => setLoadingProblems(false));
    }, 300); // debounce search-as-you-type
    return () => clearTimeout(handle);
  }, [statusFilter, sourceFilter, topicFilter, search]);

  const grouped: Record<string, PatternCardType[]> = {};
  for (const card of cards) {
    const problem = problems.find((p) => p.id === card.problem);
    const categories = problem?.topics?.map((t) => t.parent_category) ?? ["OTHER"];
    const category = categories[0] || "OTHER";
    grouped[category] = grouped[category] || [];
    grouped[category].push(card);
  }

  async function handleDigest() {
    setDigestLoading(true);
    try {
      const data = await getWeeklyDigest();
      setDigest(data.digest);
    } finally {
      setDigestLoading(false);
    }
  }

  function clearFilters() {
    setStatusFilter("");
    setSourceFilter("");
    setTopicFilter("");
    setSearch("");
  }

  const hasActiveFilters = !!(statusFilter || sourceFilter || topicFilter || search);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={handleDigest}
            disabled={digestLoading}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {digestLoading ? "Generating…" : "📊 Weekly Digest"}
          </button>
          <a
            href={exportMarkdownUrl}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700"
          >
            ⬇ Export Markdown
          </a>
          <Link
            to="/import"
            className="rounded-md bg-vault-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            + Import Problem
          </Link>
        </div>
      </div>

      {digest && (
        <div className="mb-6 whitespace-pre-wrap rounded-xl bg-indigo-500/10 p-4 text-sm text-indigo-200">
          {digest}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryCards]) => (
            <div key={category}>
              <h2 className="mb-2 text-sm font-semibold text-slate-400">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="space-y-2">
                {categoryCards.map((c) => (
                  <PatternCard key={c.id} card={c} />
                ))}
              </div>
            </div>
          ))}
          {cards.length === 0 && (
            <p className="text-sm text-slate-500">
              No pattern cards yet — solve a problem and generate one from the workspace.
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400">Problems</h2>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-indigo-400 hover:underline">
                Clear filters
              </button>
            )}
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="col-span-2 rounded-md bg-slate-800 px-2 py-1.5 text-xs outline-none sm:col-span-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md bg-slate-800 px-2 py-1.5 text-xs outline-none"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-md bg-slate-800 px-2 py-1.5 text-xs outline-none"
            >
              <option value="">All sources</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="rounded-md bg-slate-800 px-2 py-1.5 text-xs outline-none"
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-xl bg-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={p.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-3 py-2">
                      <Link to={`/problems/${p.id}`} className="text-indigo-300 hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          p.status === "SOLVED"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : p.status === "FAILED"
                            ? "bg-red-500/20 text-red-300"
                            : p.status === "PARTIAL"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-slate-600/40 text-slate-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {p.time_taken_minutes ? `${p.time_taken_minutes}m` : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{p.test_run_count ?? 0}</td>
                  </tr>
                ))}
                {!loadingProblems && problems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-500">
                      No problems match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
