import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/import", label: "Import Problem" },
  { to: "/review", label: "Review Queue" },
  { to: "/stats", label: "Stats" },
];

const THEME_STORAGE_KEY = "patternvault_theme";

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle: () => setIsDark((d) => !d) };
}

export default function NavBar() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useDarkMode();

  return (
    <nav className="sticky top-0 z-20 flex items-center gap-1 border-b border-slate-800 bg-vault-bg/95 px-4 py-3 backdrop-blur">
      <span className="mr-4 flex items-center gap-2 font-bold text-slate-100">
        <span className="text-lg">🗂️</span> PatternVault
      </span>
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === "/"}
          className={({ isActive }) =>
            `rounded-md px-3 py-1.5 text-sm font-medium transition ${
              isActive ? "bg-vault-accent text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggle}
          title="Toggle dark mode"
          className="rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          {isDark ? "☀️" : "🌙"}
        </button>
        {user && (
          <>
            <span className="text-sm text-slate-400">{user.username}</span>
            <button
              onClick={logout}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              Log out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
