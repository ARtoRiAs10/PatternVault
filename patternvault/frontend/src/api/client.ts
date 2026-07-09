import axios from "axios";
import type {
  ExecuteResult,
  PatternCard,
  PostMortem,
  Problem,
  ReviewLog,
  TestRun,
  Topic,
} from "../types";

export const TOKEN_STORAGE_KEY = "patternvault_token";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach the auth token (if present) to every outgoing request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// On a 401 (expired/invalid token), clear it and bounce to /login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/**
 * DRF paginates list endpoints at PAGE_SIZE=25. Dashboard/review views want
 * the full collection, so this follows `next` links until exhausted rather
 * than silently truncating at page 1.
 */
async function fetchAllPages<T>(path: string, params?: Record<string, string>): Promise<T[]> {
  let url: string | null = path;
  let results: T[] = [];
  let isFirst = true;

  while (url) {
    const resp: { data: Paginated<T> } = await api.get<Paginated<T>>(url, {
      params: isFirst ? params : undefined,
    });
    results = results.concat(resp.data.results);
    url = resp.data.next;
    isFirst = false;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const registerUser = (username: string, password: string, email?: string) =>
  api.post<{ token: string; user: { id: number; username: string } }>("/auth/register/", {
    username,
    password,
    email,
  }).then((r) => r.data);

export const loginUser = (username: string, password: string) =>
  api.post<{ token: string }>("/auth/login/", { username, password }).then((r) => r.data);

export const fetchMe = () => api.get<{ id: number; username: string }>("/auth/me/").then((r) => r.data);

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------
export const listTopics = () => fetchAllPages<Topic>("/topics/");
export const createTopic = (data: Partial<Topic>) => api.post<Topic>("/topics/", data).then((r) => r.data);

// ---------------------------------------------------------------------------
// Problems
// ---------------------------------------------------------------------------
export const listProblems = (params?: Record<string, string>) => fetchAllPages<Problem>("/problems/", params);
export const getProblem = (id: number) => api.get<Problem>(`/problems/${id}/`).then((r) => r.data);
export const createProblem = (data: Partial<Problem> & { topic_ids?: number[] }) =>
  api.post<Problem>("/problems/", data).then((r) => r.data);
export const updateProblem = (id: number, data: Partial<Problem> & { topic_ids?: number[] }) =>
  api.patch<Problem>(`/problems/${id}/`, data).then((r) => r.data);
export const deleteProblem = (id: number) => api.delete(`/problems/${id}/`);

// ---------------------------------------------------------------------------
// Codeforces / CodeChef import
// ---------------------------------------------------------------------------
export const fetchCodeforcesProblem = (contestId: string, problemIndex: string) =>
  api.get(`/codeforces/problem/${contestId}/${problemIndex}/`).then((r) => r.data);
export const fetchCodeChefProblem = (problemCode: string) =>
  api.get(`/codechef/problem/${problemCode}/`).then((r) => r.data);

// ---------------------------------------------------------------------------
// Code execution (Judge0)
// ---------------------------------------------------------------------------
export const executeCode = (payload: {
  source_code: string;
  language: string;
  stdin?: string;
  expected_output?: string;
  problem?: number;
  timer_duration_seconds?: number;
  save_run?: boolean;
}) => api.post<ExecuteResult>("/execute/", payload).then((r) => r.data);

// ---------------------------------------------------------------------------
// Pattern cards / review queue / spaced repetition
// ---------------------------------------------------------------------------
export const listPatternCards = () => fetchAllPages<PatternCard>("/pattern-cards/");
export const getReviewQueue = () => api.get<PatternCard[]>("/review-queue/").then((r) => r.data);
export const generatePatternCard = (problemId: number) =>
  api.post<PatternCard>(`/problems/${problemId}/generate-pattern-card/`).then((r) => r.data);
export const submitReview = (patternCardId: number, selfRating: number) =>
  api
    .post<ReviewLog>("/review-logs/", { pattern_card: patternCardId, self_rating: selfRating })
    .then((r) => r.data);
export const quizPatternCard = (patternCardId: number) =>
  api.post(`/pattern-cards/${patternCardId}/quiz/`).then((r) => r.data);

// ---------------------------------------------------------------------------
// Post-mortems
// ---------------------------------------------------------------------------
export const createPostMortem = (
  problemId: number,
  data: Partial<PostMortem>
): Promise<{ postmortem: PostMortem; pattern_card: PatternCard | null }> =>
  api.post(`/problems/${problemId}/postmortem/`, data).then((r) => r.data);

// ---------------------------------------------------------------------------
// Test runs
// ---------------------------------------------------------------------------
export const listTestRuns = (problemId: number) =>
  fetchAllPages<TestRun>("/test-runs/", { problem: String(problemId) });

// ---------------------------------------------------------------------------
// Stretch: digest / export / stats
// ---------------------------------------------------------------------------
export const getWeeklyDigest = () => api.get("/weekly-digest/").then((r) => r.data);
export const getStatsOverview = () => api.get("/stats/overview/").then((r) => r.data);
export const exportMarkdownUrl = "/api/export/markdown/";

export default api;
