"use client";

import { useEffect, useState } from "react";

type SystemConfig = {
  checkCycle: "매월" | "분기" | "반기";
  midCheckEnabled: boolean;
  finalCheckEnabled: boolean;
  goalModificationApprovalRequired: boolean;
};

const defaultConfig: SystemConfig = {
  checkCycle: "매월",
  midCheckEnabled: true,
  finalCheckEnabled: true,
  goalModificationApprovalRequired: true,
};

export default function AdminSystemConfigSection() {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [original, setOriginal] = useState<SystemConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/system-config", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          setOriginal(data.config);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const hasChanges =
    config.checkCycle !== original.checkCycle ||
    config.midCheckEnabled !== original.midCheckEnabled ||
    config.finalCheckEnabled !== original.finalCheckEnabled ||
    config.goalModificationApprovalRequired !==
      original.goalModificationApprovalRequired;

  const save = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/system-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setOriginal(config);
        setMessage("저장되었습니다.");
      } else {
        const err = await res.json().catch(() => ({}));
        setError(
          typeof err.error === "string" ? err.error : "저장에 실패했습니다."
        );
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="section-admin-system-config" className="scroll-mt-24 space-y-8">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-medium mb-6">점검 주기 설정</h2>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium min-w-[120px]">점검 주기</label>
            <select
              className="border border-[var(--border)] bg-white rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] w-[200px]"
              value={config.checkCycle}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  checkCycle: e.target.value as SystemConfig["checkCycle"],
                }))
              }
            >
              <option value="매월">매월</option>
              <option value="분기">분기</option>
              <option value="반기">반기</option>
            </select>
            <span className="text-xs text-[var(--muted)]">
              실적 입력 및 점검 주기를 설정합니다
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-xl font-medium mb-6">기능 활성화</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 border border-[var(--border)] rounded-lg">
            <input
              type="checkbox"
              id="midCheckEnabled"
              checked={config.midCheckEnabled}
              onChange={(e) =>
                setConfig((c) => ({ ...c, midCheckEnabled: e.target.checked }))
              }
              className="w-5 h-5"
            />
            <div className="flex-1">
              <label
                htmlFor="midCheckEnabled"
                className="text-sm font-medium cursor-pointer"
              >
                중간점검 활성화
              </label>
              <p className="text-xs text-[var(--muted)] mt-1">
                활성화 시 사용자가 중간점검에서 실적을 입력할 수 있습니다
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border border-[var(--border)] rounded-lg">
            <input
              type="checkbox"
              id="finalCheckEnabled"
              checked={config.finalCheckEnabled}
              onChange={(e) =>
                setConfig((c) => ({ ...c, finalCheckEnabled: e.target.checked }))
              }
              className="w-5 h-5"
            />
            <div className="flex-1">
              <label
                htmlFor="finalCheckEnabled"
                className="text-sm font-medium cursor-pointer"
              >
                최종점검 활성화
              </label>
              <p className="text-xs text-[var(--muted)] mt-1">
                활성화 시 사용자가 최종점검에서 실적을 입력할 수 있습니다
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 border border-[var(--border)] rounded-lg">
            <input
              type="checkbox"
              id="goalModificationApproval"
              checked={config.goalModificationApprovalRequired}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  goalModificationApprovalRequired: e.target.checked,
                }))
              }
              className="w-5 h-5"
            />
            <div className="flex-1">
              <label
                htmlFor="goalModificationApproval"
                className="text-sm font-medium cursor-pointer"
              >
                목표 수정 승인 필수
              </label>
              <p className="text-xs text-[var(--muted)] mt-1">
                활성화 시 목표 수정 시 상급자의 승인이 필요합니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || !hasChanges}
          className={`border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors ${
            saving || !hasChanges
              ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
              : "bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90"
          }`}
        >
          {saving ? "저장 중…" : !hasChanges ? "변경 없음" : "점검·기능 설정 저장"}
        </button>
      </div>
    </div>
  );
}
