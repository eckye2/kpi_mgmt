"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminUsersSection from "./AdminUsersSection";
import AdminPermissionSection from "./AdminPermissionSection";
import AdminEvaluationGradeSection from "./AdminEvaluationGradeSection";
import AdminSystemConfigSection from "./AdminSystemConfigSection";
import AdminAuditSection from "./AdminAuditSection";
import AdminOrgDictionarySection from "./AdminOrgDictionarySection";

const loginUrl = `/login?next=${encodeURIComponent("/admin")}`;

function goDashboard() {
  window.location.assign("/dashboard");
}

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  dept: string;
  subDept: string;
  isSystemAdmin: boolean;
  mustChangePassword?: boolean;
};

function isAppAdminClient(u: User) {
  return (
    u.isSystemAdmin ||
    u.role === "PRESIDENT" ||
    u.role === "VICE_PRESIDENT"
  );
}

type AdminTab = "users" | "grades" | "audit";

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [tab, setTab] = useState<AdminTab>("users");

  useEffect(() => {
    let cancelled = false;
    let passwordRedirect = false;
    let exitingAfterForbidden = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push(loginUrl);
          return;
        }
        const data = await res.json();
        if (cancelled || !data.user) {
          router.push(loginUrl);
          return;
        }
        const u = data.user as User;
        if (u.mustChangePassword) {
          passwordRedirect = true;
          router.replace(
            `/account/change-password?next=${encodeURIComponent("/admin")}`
          );
          return;
        }
        if (!isAppAdminClient(u)) {
          exitingAfterForbidden = true;
          try {
            await fetch("/api/auth/logout", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            /* ignore */
          }
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("kpiUserEmail");
            window.localStorage.removeItem("kpiUserEmployeeNo");
            try {
              window.sessionStorage.clear();
            } catch {
              /* ignore */
            }
            window.location.assign("/login?admin_denied=1");
          }
          return;
        }
        setCurrentUser(u);
      } catch (e) {
        console.error("Error loading user:", e);
        router.push(loginUrl);
      } finally {
        if (!cancelled && !passwordRedirect && !exitingAfterForbidden)
          setSessionChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const tabBtn = (key: AdminTab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
        tab === key
          ? "border-[var(--accent)] text-[var(--foreground)]"
          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );

  const subNavLink = (href: string, label: string) => (
    <a
      href={href}
      className="text-xs text-[var(--muted-foreground)] underline-offset-4 hover:text-[var(--foreground)] hover:underline"
    >
      {label}
    </a>
  );

  return (
    <div className="min-h-screen bg-[var(--background)] p-8">
      {!sessionChecked ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center text-lg">로딩 중...</div>
        </div>
      ) : !currentUser ? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted-foreground)]">
          대시보드로 이동합니다…
        </div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">통합설정</h1>
              <p className="mt-1 text-sm font-mono text-[var(--muted-foreground)]">
                Unified settings
              </p>
            </div>
            <button
              onClick={goDashboard}
              className="border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors hover:bg-[var(--secondary)]"
            >
              대시보드로 돌아가기
            </button>
          </div>

          <nav className="mb-8 flex flex-wrap gap-8 border-b border-[var(--border)]">
            {tabBtn("users", "사용자")}
            {tabBtn("grades", "평가 등급 관리")}
            {tabBtn("audit", "감사관리")}
          </nav>

          {tab === "users" && (
            <div className="space-y-8">
              <nav className="flex flex-wrap gap-6 border-b border-[var(--border)]/60 pb-3">
                {subNavLink("#section-admin-users", "사용자")}
                {subNavLink(
                  "#section-admin-import",
                  "사용자 Import (CSV / Excel)"
                )}
                {subNavLink("#section-admin-permission", "권한 관리")}
              </nav>
              <AdminUsersSection currentUserId={currentUser.id} />
              <AdminPermissionSection />
            </div>
          )}

          {tab === "grades" && (
            <div className="space-y-10">
              <nav className="flex flex-wrap gap-6 border-b border-[var(--border)]/60 pb-3">
                {subNavLink("#section-admin-eval-grades", "평가 등급 허용 설정")}
                {subNavLink(
                  "#section-admin-system-config",
                  "점검 주기 · 기능 활성화"
                )}
              </nav>
              <AdminEvaluationGradeSection />
              <AdminSystemConfigSection />
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-10">
              <nav className="flex flex-wrap gap-6 border-b border-[var(--border)]/60 pb-3">
                {subNavLink("#section-admin-audit", "관리자 감사 로그")}
                {subNavLink("#section-admin-org-dictionary", "조직 코드 사전")}
              </nav>
              <AdminAuditSection />
              <AdminOrgDictionarySection />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
