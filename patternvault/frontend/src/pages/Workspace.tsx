import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  executeCode,
  generatePatternCard,
  getProblem,
  updateProblem,
} from "../api/client";
import DiffView from "../components/DiffView";
import PatternCard from "../components/PatternCard";
import Timer from "../components/Timer";
import type { ExecuteResult, Language, Problem } from "../types";
import PostMortemForm from "./PostMortemForm";

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "cpp", label: "C++" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "javascript", label: "JavaScript" },
  { id: "go", label: "Go" },
];

const MONACO_LANG_MAP: Record<Language, string> = {
  cpp: "cpp",
  python: "python",
  java: "java",
  javascript: "javascript",
  go: "go",
  other: "plaintext",
};

export default function Workspace() {
  const { id } = useParams();
  const problemId = Number(id);

  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("cpp");
  const [stdin, setStdin] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [runResult, setRunResult] = useState<ExecuteResult | null>(null);
  const [running, setRunning] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);

  // Reimplementation mode
  const [reimplMode, setReimplMode] = useState(false);
  const [reimplCode, setReimplCode] = useState("");
  const [showDiff, setShowDiff] = useState(false);

  const [showPostMortem, setShowPostMortem] = useState(false);

  useEffect(() => {
    getProblem(problemId).then((p) => {
      setProblem(p);
      setLanguage(p.language);
      setCode(reimplMode ? "" : p.code_submitted || "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId]);

  async function handleRun(isSubmit: boolean) {
    setBusy(true);
    setRunResult(null);
    try {
      const activeCode = reimplMode ? reimplCode : code;
      const result = await executeCode({
        source_code: activeCode,
        language,
        stdin,
        expected_output: isSubmit ? expectedOutput : "",
        problem: problemId,
        timer_duration_seconds: timerSeconds,
        save_run: isSubmit,
      });
      setRunResult(result);
      if (isSubmit) {
        setRunning(false);
        if (!reimplMode) {
          await updateProblem(problemId, {
            code_submitted: activeCode,
            language,
            time_taken_minutes: Math.max(1, Math.round(timerSeconds / 60)),
            status: result.status === "Accepted" ? "SOLVED" : "PARTIAL",
          });
          const updated = await getProblem(problemId);
          setProblem(updated);
        } else {
          setShowDiff(true);
        }
      }
    } catch (err: any) {
      setRunResult({
        stdout: "",
        stderr: err?.response?.data?.detail ?? "Execution failed.",
        status: "RuntimeError",
        raw_status: "Error",
        execution_time_ms: null,
        memory_used: null,
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateCard() {
    setGeneratingCard(true);
    try {
      await generatePatternCard(problemId);
      const updated = await getProblem(problemId);
      setProblem(updated);
    } catch (err) {
      // surfaced via runResult-style banner would be nicer; keep simple
      console.error(err);
    } finally {
      setGeneratingCard(false);
    }
  }

  function startReimplementation() {
    setReimplMode(true);
    setReimplCode("");
    setRunning(true);
    setTimerSeconds(0);
    setShowDiff(false);
    setRunResult(null);
  }

  if (!problem) return <div className="text-slate-400">Loading…</div>;

  const canGenerateCard = problem.status !== "UNTRIED";
  const canPostMortem = problem.status === "FAILED" || problem.status === "PARTIAL";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Left panel: statement */}
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-800 p-4">
          <div className="flex items-start justify-between">
            <h1 className="text-lg font-bold">{problem.title}</h1>
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs">{problem.source}</span>
          </div>
          {problem.url && (
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-indigo-400 hover:underline"
            >
              Open original problem page ↗
            </a>
          )}
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{problem.statement}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {problem.topics.map((t) => (
              <span key={t.id} className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                {t.name}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span>Rating: {problem.difficulty_rating ?? "—"}</span>
            <span>Status: {problem.status}</span>
            {problem.time_taken_minutes && <span>Last time: {problem.time_taken_minutes}m</span>}
          </div>
        </div>

        {problem.is_core_algorithm && !reimplMode && (
          <button
            onClick={startReimplementation}
            className="w-full rounded-lg bg-purple-600/20 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-600/30"
          >
            🔁 From-scratch reimplementation mode
          </button>
        )}

        {canGenerateCard && (
          <button
            onClick={handleGenerateCard}
            disabled={generatingCard}
            className="w-full rounded-lg bg-indigo-600/20 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-50"
          >
            {generatingCard ? "Generating…" : "✨ Generate Pattern Card"}
          </button>
        )}

        {problem.pattern_cards && problem.pattern_cards.length > 0 && (
          <div className="space-y-2">
            {problem.pattern_cards.map((pc) => (
              <PatternCard key={pc.id} card={pc} showProblemLink={false} />
            ))}
          </div>
        )}

        {canPostMortem && (
          <button
            onClick={() => setShowPostMortem((s) => !s)}
            className="w-full rounded-lg bg-amber-600/20 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-600/30"
          >
            📝 {showPostMortem ? "Hide" : "Add"} Post-Mortem
          </button>
        )}
        {showPostMortem && (
          <PostMortemForm
            problemId={problemId}
            lastTestRunDiff={runResult ? { actual: runResult.stdout, expected: expectedOutput } : undefined}
            onSaved={async () => {
              setShowPostMortem(false);
              setProblem(await getProblem(problemId));
            }}
          />
        )}

        {showDiff && reimplMode && (
          <div className="rounded-xl bg-slate-800 p-4">
            <h3 className="mb-2 text-sm font-semibold">Diff vs. saved solution</h3>
            <DiffView original={problem.code_submitted} updated={reimplCode} />
          </div>
        )}
      </div>

      {/* Right panel: editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <Timer running={running} onTick={setTimerSeconds} resetKey={reimplMode ? "reimpl" : "main"} />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-700">
          <Editor
            height="420px"
            theme="vs-dark"
            language={MONACO_LANG_MAP[language]}
            value={reimplMode ? reimplCode : code}
            onChange={(v) => (reimplMode ? setReimplCode(v ?? "") : setCode(v ?? ""))}
            options={{ fontSize: 13, minimap: { enabled: false } }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">stdin</label>
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              rows={4}
              className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">expected output (optional)</label>
            <textarea
              value={expectedOutput}
              onChange={(e) => setExpectedOutput(e.target.value)}
              rows={4}
              className="w-full rounded-md bg-slate-800 px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleRun(false)}
            disabled={busy}
            className="flex-1 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
          >
            {busy ? "Running…" : "▶ Run"}
          </button>
          <button
            onClick={() => handleRun(true)}
            disabled={busy}
            className="flex-1 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "✅ Submit"}
          </button>
        </div>

        {runResult && (
          <div className="space-y-2 rounded-xl bg-slate-800 p-4">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  runResult.status === "Accepted"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {runResult.status}
              </span>
              {runResult.execution_time_ms != null && (
                <span className="text-xs text-slate-500">{runResult.execution_time_ms}ms</span>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400">stdout</p>
              <pre className="max-h-32 overflow-auto rounded bg-slate-950 p-2 text-xs">{runResult.stdout}</pre>
            </div>
            {runResult.stderr && (
              <div>
                <p className="text-xs text-slate-400">stderr</p>
                <pre className="max-h-32 overflow-auto rounded bg-slate-950 p-2 text-xs text-red-300">
                  {runResult.stderr}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
