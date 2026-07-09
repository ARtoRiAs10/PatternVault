import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, email || undefined);
      }
      navigate("/");
    } catch (err: any) {
      const data = err?.response?.data;
      const msg =
        data?.non_field_errors?.[0] ??
        data?.username?.[0] ??
        data?.password?.[0] ??
        data?.detail ??
        "Something went wrong. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-vault-bg px-4">
      <div className="w-full max-w-sm rounded-xl bg-slate-800 p-6 shadow-lg">
        <h1 className="mb-1 text-center text-xl font-bold">🗂️ PatternVault</h1>
        <p className="mb-6 text-center text-sm text-slate-400">
          {mode === "login" ? "Log in to your vault" : "Create your account"}
        </p>

        <div className="mb-4 flex rounded-md bg-slate-900 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 font-medium ${
              mode === "login" ? "bg-vault-accent text-white" : "text-slate-400"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md py-1.5 font-medium ${
              mode === "register" ? "bg-vault-accent text-white" : "text-slate-400"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
              autoComplete="username"
            />
          </div>
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
                autoComplete="email"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm outline-none"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {error && <div className="rounded-md bg-red-500/10 p-2 text-xs text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-vault-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        {mode === "login" && (
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo account: <span className="font-mono">demo</span> /{" "}
            <span className="font-mono">demopass123</span> (after running{" "}
            <span className="font-mono">seed_demo_data</span>)
          </p>
        )}
      </div>
    </div>
  );
}
