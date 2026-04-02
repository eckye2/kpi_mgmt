"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSafeLoginNextPath } from "@/lib/safe-login-redirect";

const inputStyle =
  "w-full border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] font-mono focus:outline-none focus:border-[var(--accent)]";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [afterPath, setAfterPath] = useState("/dashboard");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : new URLSearchParams();
      const safeNext = getSafeLoginNextPath(params.get("next")) ?? "/dashboard";
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.replace(
            `/login?next=${encodeURIComponent("/account/change-password")}`
          );
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.user?.mustChangePassword) {
          router.replace(safeNext);
          return;
        }
        setAfterPath(safeNext);
      } catch {
        if (!cancelled) {
          router.replace(
            `/login?next=${encodeURIComponent("/account/change-password")}`
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center font-sans">
        <p className="text-sm font-mono text-[var(--muted-foreground)]">확인 중…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <div className="border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-6 py-5">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--muted-foreground)]">
              KPCQA KPI MANAGEMENT SYSTEM
            </p>
            <h1 className="mt-2 text-2xl font-light">비밀번호 변경</h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              보안 정책에 따라 새 비밀번호로 변경한 뒤 서비스를 이용할 수 있습니다. (8자 이상)
            </p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                현재 비밀번호
              </label>
              <input
                className={`mt-2 ${inputStyle}`}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                새 비밀번호
              </label>
              <input
                className={`mt-2 ${inputStyle}`}
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                새 비밀번호 확인
              </label>
              <input
                className={`mt-2 ${inputStyle}`}
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="mx-6 mb-6 border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
              {error}
            </div>
          )}

          <div className="border-t border-[var(--border)] px-6 py-5">
            <button
              type="button"
              disabled={loading}
              className="w-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              onClick={async () => {
                setError("");
                const cur = currentPassword.trim();
                const np = newPassword.trim();
                const cp = confirmPassword.trim();
                if (!cur || !np) {
                  setError("모든 필드를 입력하세요.");
                  return;
                }
                if (np !== cp) {
                  setError("새 비밀번호가 일치하지 않습니다.");
                  return;
                }
                setLoading(true);
                try {
                  const res = await fetch("/api/auth/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                      currentPassword: cur,
                      newPassword: np,
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(
                      typeof data.error === "string"
                        ? data.error
                        : "변경에 실패했습니다."
                    );
                    return;
                  }
                  if (typeof window !== "undefined") {
                    window.location.assign(afterPath);
                  }
                } catch {
                  setError("네트워크 오류가 발생했습니다.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "처리 중…" : "변경 후 계속"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
