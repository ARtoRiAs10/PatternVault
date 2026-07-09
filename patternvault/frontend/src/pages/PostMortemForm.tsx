import { useState } from "react";
import { createPostMortem } from "../api/client";

interface Props {
  problemId: number;
  lastTestRunDiff?: { actual: string; expected: string };
  onSaved: () => void;
}

export default function PostMortemForm({ problemId, lastTestRunDiff, onSaved }: Props) {
  const [bugFound, setBugFound] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [lessonLearned, setLessonLearned] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await createPostMortem(problemId, {
        bug_found: bugFound,
        root_cause: rootCause,
        lesson_learned: lessonLearned,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl bg-slate-800 p-4">
      {lastTestRunDiff && lastTestRunDiff.expected && (
        <div className="mb-2 rounded-md bg-slate-950 p-2 text-xs">
          <p className="text-slate-500">actual vs expected</p>
          <p className="text-red-300">- {lastTestRunDiff.expected}</p>
          <p className="text-emerald-300">+ {lastTestRunDiff.actual}</p>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-slate-400">Bug found</label>
        <textarea
          value={bugFound}
          onChange={(e) => setBugFound(e.target.value)}
          rows={2}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Root cause</label>
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          rows={2}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">Lesson learned</label>
        <textarea
          value={lessonLearned}
          onChange={(e) => setLessonLearned(e.target.value)}
          rows={2}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Post-Mortem"}
      </button>
      <p className="text-[11px] text-slate-500">
        Saving will ask the LLM to merge this insight into the linked pattern card's edge cases.
      </p>
    </div>
  );
}
