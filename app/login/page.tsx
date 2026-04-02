"use client";

import { useEffect, useState } from "react";
import { getSafeLoginNextPath } from "@/lib/safe-login-redirect";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [afterLoginPath, setAfterLoginPath] = useState("/dashboard");
  const [forbiddenBanner, setForbiddenBanner] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin_denied") === "1") {
      setForbiddenBanner("권한이 없습니다.");
      params.delete("admin_denied");
      params.delete("next");
      const q = params.toString();
      window.history.replaceState(null, "", q ? `/login?${q}` : "/login");
    }
    const next = getSafeLoginNextPath(params.get("next"));
    if (next) setAfterLoginPath(next);
  }, []);
  const inputStyle =
    "w-full border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)]";

  const validate = () => {
    if (!email.trim()) return "이메일을 입력해주세요.";
    if (!password) return "비밀번호를 입력해주세요.";
    return "";
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <div className="border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--muted-foreground)]">
              KPCQA KPI MANAGEMENT SYSTEM
            </p>
            <h1 className="mt-2 text-2xl font-light">로그인</h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              회사 이메일과 비밀번호로 로그인하세요. 초기 비밀번호는 사번과 동일할 수 있으며,
              변경 후에는 <span className="text-[var(--foreground)]">새로 설정한 비밀번호</span>로
              로그인합니다.
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                이메일
              </label>
              <input
                className={`mt-2 ${inputStyle}`}
                placeholder="user001@kpcqa.or.kr"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                비밀번호
              </label>
              <input
                className={`mt-2 ${inputStyle}`}
                placeholder="비밀번호"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          {forbiddenBanner && (
            <div className="mx-6 mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {forbiddenBanner}
            </div>
          )}

          {error && (
            <div className="mx-6 mb-6 border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              {error}
            </div>
          )}

          <div className="border-t border-[var(--border)] px-6 py-5">
            <button
              disabled={loading}
              className="w-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              onClick={async () => {
                const nextError = validate();
                if (nextError) {
                  setError(nextError);
                  return;
                }
                setError("");
                setLoading(true);
                try {
                  const res = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      email: email.trim().toLowerCase(),
                      password: password.trim(),
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(
                      typeof data.error === "string"
                        ? data.error
                        : "로그인에 실패했습니다."
                    );
                    return;
                  }
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("kpiUserEmail");
                    window.localStorage.removeItem("kpiUserEmployeeNo");
                  }
                  const changePwUrl = `/account/change-password?next=${encodeURIComponent(afterLoginPath)}`;
                  if (typeof window !== "undefined") {
                    window.location.assign(
                      data.mustChangePassword ? changePwUrl : afterLoginPath
                    );
                  }
                } catch {
                  setError("네트워크 오류가 발생했습니다.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "처리 중…" : "로그인"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
