"use client";

import { useCallback, useEffect, useState } from "react";

export default function AdminAuditSection() {
  const [auditLines, setAuditLines] = useState<string[]>([]);
  const [auditBusy, setAuditBusy] = useState(false);

  const loadAudit = useCallback(async () => {
    setAuditBusy(true);
    try {
      const res = await fetch("/api/admin/audit?take=150", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAuditLines([
          typeof data.error === "string" ? data.error : "감사 로그 조회 실패",
        ]);
        return;
      }
      const logs = Array.isArray(data.logs) ? data.logs : [];
      setAuditLines(
        logs.map(
          (l: {
            createdAt: string;
            action: string;
            actor?: { name: string; email?: string };
            targetType?: string;
            targetId?: string;
            detail?: string | null;
          }) => {
            const detail = l.detail ? `  ${l.detail.slice(0, 120)}${l.detail.length > 120 ? "…" : ""}` : "";
            return `${new Date(l.createdAt).toLocaleString("ko-KR")}  ${l.action}  ${l.actor?.name ?? "?"} (${l.actor?.email ?? ""})  ${l.targetType ?? ""}#${l.targetId ?? ""}${detail}`;
          }
        )
      );
    } catch {
      setAuditLines(["네트워크 오류"]);
    } finally {
      setAuditBusy(false);
    }
  }, []);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  return (
    <div className="space-y-8">
      <section
        id="section-admin-audit"
        className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">관리자 감사 로그</h2>
          <button
            type="button"
            onClick={() => loadAudit()}
            disabled={auditBusy}
            className="border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] hover:bg-[var(--secondary)] disabled:opacity-50"
          >
            {auditBusy ? "불러오는 중…" : "새로고침"}
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          사용자·비밀번호·Import, 평가 등급 규칙, 직원 배분율, 조직 사전 저장 등
          관리자 API에서 기록된 이벤트입니다.
        </p>
        {auditLines.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">기록이 없습니다.</p>
        ) : (
          <ul className="max-h-[28rem] space-y-1 overflow-auto rounded border border-[var(--border)] bg-[var(--background)] p-3 font-mono text-[11px]">
            {auditLines.map((line, i) => (
              <li key={i} className="border-b border-[var(--border)]/40 py-1.5 last:border-0">
                {line}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-medium mb-3">운영 메모</h2>
        <ul className="space-y-2 text-xs text-[var(--muted-foreground)] list-disc pl-5">
          <li>
            조직 코드(본부·센터·역할·등급단) 변경 시, 기존 사용자 행의 본부/센터
            표기와 불일치가 없는지 사용자 탭에서 점검하세요.
          </li>
          <li>
            평가 등급·배분율 변경은 해당 연도 설정 저장 시 감사 로그에 남습니다.
          </li>
        </ul>
      </section>
    </div>
  );
}
