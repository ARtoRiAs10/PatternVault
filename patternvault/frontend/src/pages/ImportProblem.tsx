import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProblem, fetchCodeChefProblem, fetchCodeforcesProblem } from "../api/client";
import type { ProblemSource } from "../types";

type SourceOption = "CODEFORCES" | "CODECHEF" | "MANUAL";

export default function ImportProblem() {
  const navigate = useNavigate();
  const [source, setSource] = useState<SourceOption>("CODEFORCES");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CF fields
  const [contestId, setContestId] = useState("");
  const [problemIndex, setProblemIndex] = useState("");

  // CodeChef fields
  const [problemCode, setProblemCode] = useState("");

  // Manual / shared form fields (pre-filled after CF/CodeChef fetch)
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [statement, setStatement] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [manualSource, setManualSource] = useState<ProblemSource>("LEETCODE");
  const [prefilled, setPrefilled] = useState(false);

  async function handleFetchMetadata() {
    setError(null);
    setLoading(true);
    try {
      if (source === "CODEFORCES") {
        const data = await fetchCodeforcesProblem(contestId, problemIndex);
        setTitle(data.title);
        setUrl(data.url);
        setDifficulty(data.difficulty_rating?.toString() ?? "");
        setStatement(`Tags: ${(data.tags || []).join(", ")}\n\nFull statement: see linked Codeforces page.`);
      } else if (source === "CODECHEF") {
        const data = await fetchCodeChefProblem(problemCode);
        setTitle(data.title);
        setUrl(data.url);
        setDifficulty(data.difficulty_rating?.toString() ?? "");
        setStatement(`Tags: ${(data.tags || []).join(", ")}\n\nFull statement: see linked CodeChef page.`);
      }
      setPrefilled(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Could not fetch problem metadata.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const problem = await createProblem({
        title,
        url,
        statement,
        difficulty_rating: difficulty ? parseInt(difficulty, 10) : null,
        source: source === "MANUAL" ? manualSource : source,
        status: "UNTRIED",
      });
      navigate(`/problems/${problem.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Could not save problem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Import Problem</h1>

      <div className="mb-4 flex gap-2">
        {(["CODEFORCES", "CODECHEF", "MANUAL"] as SourceOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => {
              setSource(opt);
              setPrefilled(false);
              setError(null);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              source === opt ? "bg-vault-accent text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {opt === "CODEFORCES" ? "Codeforces" : opt === "CODECHEF" ? "CodeChef" : "Manual paste (LeetCode/Other)"}
          </button>
        ))}
      </div>

      {source === "CODEFORCES" && !prefilled && (
        <div className="mb-4 flex gap-2 rounded-lg bg-slate-800 p-3">
          <input
            placeholder="Contest ID (e.g. 20)"
            value={contestId}
            onChange={(e) => setContestId(e.target.value)}
            className="w-1/2 rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
          />
          <input
            placeholder="Problem Index (e.g. C)"
            value={problemIndex}
            onChange={(e) => setProblemIndex(e.target.value)}
            className="w-1/2 rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={handleFetchMetadata}
            disabled={loading || !contestId || !problemIndex}
            className="whitespace-nowrap rounded-md bg-vault-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Fetch
          </button>
        </div>
      )}

      {source === "CODECHEF" && !prefilled && (
        <div className="mb-4 flex gap-2 rounded-lg bg-slate-800 p-3">
          <input
            placeholder="Problem Code (e.g. AGGRCOW)"
            value={problemCode}
            onChange={(e) => setProblemCode(e.target.value)}
            className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={handleFetchMetadata}
            disabled={loading || !problemCode}
            className="whitespace-nowrap rounded-md bg-vault-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Fetch
          </button>
        </div>
      )}

      {source === "MANUAL" && (
        <div className="mb-4 rounded-lg bg-slate-800 p-3">
          <label className="mb-1 block text-xs text-slate-400">Source</label>
          <select
            value={manualSource}
            onChange={(e) => setManualSource(e.target.value as ProblemSource)}
            className="mb-2 w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
          >
            <option value="LEETCODE">LeetCode</option>
            <option value="OA">OA</option>
            <option value="OTHER">Other</option>
          </select>
          <p className="text-xs text-slate-500">
            Per LeetCode's Terms of Service, PatternVault never scrapes or calls unofficial
            LeetCode APIs. Paste the statement yourself from a page you're authorized to view.
          </p>
        </div>
      )}

      {error && <div className="mb-4 rounded-md bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}

      {(prefilled || source === "MANUAL") && (
        <div className="space-y-3 rounded-lg bg-slate-800 p-4">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Difficulty rating</label>
            <input
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Statement</label>
            <textarea
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              rows={8}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={loading || !title}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Save & Open Workspace
          </button>
        </div>
      )}
    </div>
  );
}
