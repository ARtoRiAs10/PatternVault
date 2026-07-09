import { diffLines } from "diff";

interface Props {
  original: string;
  updated: string;
}

export default function DiffView({ original, updated }: Props) {
  const parts = diffLines(original || "", updated || "");

  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed">
      {parts.map((part, idx) => (
        <div
          key={idx}
          className={
            part.added
              ? "bg-emerald-900/40 text-emerald-300"
              : part.removed
              ? "bg-red-900/40 text-red-300"
              : "text-slate-400"
          }
        >
          {part.value
            .split("\n")
            .filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ""))
            .map((line, i) => (
              <div key={i}>
                <span className="select-none opacity-50">
                  {part.added ? "+ " : part.removed ? "- " : "  "}
                </span>
                {line}
              </div>
            ))}
        </div>
      ))}
    </pre>
  );
}
