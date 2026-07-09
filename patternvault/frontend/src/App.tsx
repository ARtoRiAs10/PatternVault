import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import ImportProblem from "./pages/ImportProblem";
import Login from "./pages/Login";
import ReviewQueue from "./pages/ReviewQueue";
import Stats from "./pages/Stats";
import Workspace from "./pages/Workspace";

function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-vault-bg text-slate-100">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/import"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ImportProblem />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/review"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReviewQueue />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Stats />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/problems/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Workspace />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
