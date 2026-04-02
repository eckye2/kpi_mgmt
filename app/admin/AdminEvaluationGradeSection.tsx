"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  STAFF_DIST_GRADES,
  defaultPercentagesRecord,
  sumPercentages,
} from "@/lib/evaluation-staff-distribution";

type EvalTargetRole = "HQ_HEAD" | "CENTER_HEAD" | "STAFF";

type RuleRow = {
  dept: string;
  targetRole: EvalTargetRole;
  grades: string[];
};

type ApiPayload = {
  year: number;
  departments: string[];
  counts: Record<string, Record<EvalTargetRole, number>>;
  rules: RuleRow[];
};

type StaffDistRow = {
  dept: string;
  percentages: Record<string, number>;
  staffCount: number;
  sumPct: number;
};

type StaffDistApi = { year: number; rows: StaffDistRow[] };

const TARGET_META: { role: EvalTargetRole; title: string }[] = [
  { role: "HQ_HEAD", title: "본부장 평정 — 허용 등급" },
  { role: "CENTER_HEAD", title: "센터장 평정 — 허용 등급" },
  { role: "STAFF", title: "직원(정규직) 평정 — 허용 등급" },
];

const GRADE_COLS = ["A", "B", "C", "D", "S", "E"] as const;

function buildLocalState(payload: ApiPayload): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of payload.rules) {
    m.set(`${r.dept}|${r.targetRole}`, new Set(r.grades));
  }
  return m;
}

function buildStaffPctState(
  departments: string[],
  rows: StaffDistRow[]
): Record<string, Record<string, number>> {
  const byDept = new Map(rows.map((r) => [r.dept, r.percentages]));
  const out: Record<string, Record<string, number>> = {};
  const def = defaultPercentagesRecord();
  for (const d of departments) {
    out[d] = { ...def, ...(byDept.get(d) ?? {}) };
  }
  return out;
}

export default function AdminEvaluationGradeSection() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState<ApiPayload | null>(null);
  const [local, setLocal] = useState<Map<string, Set<string>>>(new Map());
  const [staffPctByDept, setStaffPctByDept] = useState<
    Record<string, Record<string, number>>
  >({});
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setError("");
    try {
      const [rulesRes, distRes] = await Promise.all([
        fetch(`/api/evaluation-grade-rules?year=${y}`, { credentials: "include" }),
        fetch(`/api/evaluation-staff-distribution?year=${y}`, {
          credentials: "include",
        }),
      ]);
      if (!rulesRes.ok) {
        setError(`등급 규칙 불러오기 실패 (${rulesRes.status})`);
        setPayload(null);
        return;
      }
      const data = (await rulesRes.json()) as ApiPayload;
      setPayload(data);
      setLocal(buildLocalState(data));

      if (distRes.ok) {
        const dist = (await distRes.json()) as StaffDistApi;
        setStaffPctByDept(buildStaffPctState(data.departments, dist.rows));
        const sc: Record<string, number> = {};
        for (const r of dist.rows) sc[r.dept] = r.staffCount;
        setStaffCounts(sc);
      } else {
        setStaffPctByDept(buildStaffPctState(data.departments, []));
        const sc: Record<string, number> = {};
        for (const d of data.departments) {
          sc[d] = data.counts[d]?.STAFF ?? 0;
        }
        setStaffCounts(sc);
      }
    } catch {
      setError("네트워크 오류");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(year);
  }, [year, load]);

  const toggleGrade = (dept: string, target: EvalTargetRole, g: string) => {
    const key = `${dept}|${target}`;
    setLocal((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(key) ?? []);
      if (set.has(g)) set.delete(g);
      else set.add(g);
      if (set.size === 0) {
        GRADE_COLS.forEach((x) => set.add(x));
      }
      next.set(key, set);
      return next;
    });
  };

  const setStaffPct = (dept: string, g: string, raw: string) => {
    const n = parseFloat(raw);
    const v = Number.isFinite(n) ? Math.max(0, Math.min(100, round2(n))) : 0;
    setStaffPctByDept((prev) => {
      const base = { ...defaultPercentagesRecord(), ...prev[dept] };
      base[g] = v;
      return { ...prev, [dept]: base };
    });
  };

  const rulesToSave = useMemo((): RuleRow[] => {
    if (!payload) return [];
    const out: RuleRow[] = [];
    for (const dept of payload.departments) {
      for (const { role } of TARGET_META) {
        const key = `${dept}|${role}`;
        const set = local.get(key);
        const grades = set
          ? Array.from(set).filter((x) =>
              (GRADE_COLS as readonly string[]).includes(x)
            )
          : [...GRADE_COLS];
        out.push({
          dept,
          targetRole: role,
          grades: grades.length ? grades : [...GRADE_COLS],
        });
      }
    }
    return out;
  }, [payload, local]);

  const staffRowsToSave = useMemo(() => {
    if (!payload) return [];
    return payload.departments.map((dept) => ({
      dept,
      percentages: {
        ...defaultPercentagesRecord(),
        ...staffPctByDept[dept],
      },
    }));
  }, [payload, staffPctByDept]);

  const staffDistInvalid = useMemo(() => {
    for (const row of staffRowsToSave) {
      if (sumPercentages(row.percentages) > 100.0001) {
        return `${row.dept}: 배분율 합계가 100%를 초과합니다.`;
      }
    }
    return "";
  }, [staffRowsToSave]);

  const handleSave = async () => {
    if (!payload) return;
    if (staffDistInvalid) {
      setError(staffDistInvalid);
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const resRules = await fetch("/api/admin/evaluation-grade-rules", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, rules: rulesToSave }),
      });
      const dataRules = await resRules.json().catch(() => ({}));
      if (!resRules.ok) {
        setError(
          typeof dataRules.error === "string"
            ? dataRules.error
            : "등급 허용 규칙 저장에 실패했습니다."
        );
        return;
      }

      const resDist = await fetch("/api/admin/evaluation-staff-distribution", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, rows: staffRowsToSave }),
      });
      const dataDist = await resDist.json().catch(() => ({}));
      if (!resDist.ok) {
        setError(
          typeof dataDist.error === "string"
            ? dataDist.error
            : "직원 배분율 저장에 실패했습니다."
        );
        return;
      }

      setMessage("등급 허용 규칙과 직원 배분율이 저장되었습니다.");
      await load(year);
    } catch {
      setError("저장 중 오류");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !payload) {
    return (
      <section
        id="section-admin-eval-grades"
        className="scroll-mt-24 mb-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h2 className="text-xl font-medium mb-2">평가 등급 허용 설정</h2>
        <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>
      </section>
    );
  }

  if (!payload) {
    return (
      <section
        id="section-admin-eval-grades"
        className="scroll-mt-24 mb-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h2 className="text-xl font-medium mb-2">평가 등급 허용 설정</h2>
        <p className="text-sm text-red-600">{error || "데이터 없음"}</p>
      </section>
    );
  }

  return (
    <section
      id="section-admin-eval-grades"
      className="scroll-mt-24 mb-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-medium">평가 등급 허용 설정</h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)] max-w-3xl">
            본부별로 본부장·센터장·직원 평가 시 선택 가능한 등급을 지정합니다. A~D는
            상대평가, S는 내부만족도, E는 역량평가에 쓰일 수 있습니다. 직원(정규직)은
            추가로 등급별 배분율(%)을 DB에 저장하며, 합계는 100%를 넘을 수 없습니다.
            기본값은 A 20% · B 50% · C 20% · D 10% · S/E 0% 입니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">연도</label>
          <select
            className="border border-[var(--border)] bg-white rounded-md px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[0, 1, 2, 3].map((d) => {
              const y = currentYear - d;
              return (
                <option key={y} value={y}>
                  {y}년
                </option>
              );
            })}
          </select>
          <button
            type="button"
            disabled={saving || !!staffDistInvalid}
            onClick={handleSave}
            className="border border-[var(--accent)] bg-[var(--accent)] text-white px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-md disabled:opacity-50"
          >
            {saving ? "저장 중…" : "설정 저장"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 whitespace-pre-wrap">{error}</p>
      )}
      {message && (
        <p className="mb-4 text-sm text-green-700 whitespace-pre-wrap">
          {message}
        </p>
      )}
      {staffDistInvalid && (
        <p className="mb-4 text-sm text-amber-700">{staffDistInvalid}</p>
      )}

      {TARGET_META.map(({ role, title }) => (
        <div key={role} className="mb-10">
          <h3 className="text-lg font-medium mb-3">{title}</h3>
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--background)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left font-medium">부서명</th>
                  <th className="px-3 py-2 text-center font-medium w-24">대상자</th>
                  {GRADE_COLS.map((g) => (
                    <th key={g} className="px-2 py-2 text-center font-mono w-14">
                      {g}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.departments.map((dept) => {
                  const key = `${dept}|${role}`;
                  const set = local.get(key) ?? new Set(GRADE_COLS);
                  const n = payload.counts[dept]?.[role] ?? 0;
                  return (
                    <tr
                      key={key}
                      className="border-b border-[var(--border)] hover:bg-[var(--secondary)]/40"
                    >
                      <td className="px-3 py-2 font-medium">{dept}</td>
                      <td className="px-3 py-2 text-center font-mono">{n}</td>
                      {GRADE_COLS.map((g) => (
                        <td key={g} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4"
                            checked={set.has(g)}
                            onChange={() => toggleGrade(dept, role, g)}
                            aria-label={`${dept} ${role} ${g}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mb-4">
        <h3 className="text-lg font-medium mb-2">
          직원(정규직) 평정 — 등급별 배분율 (%)
        </h3>
        <p className="text-xs text-[var(--muted-foreground)] mb-3 max-w-3xl">
          본부별 정규직 인원 대비 등급 부여 비율입니다. 모든 등급의 합은 100%를 초과할
          수 없습니다. 저장 시 DB에 반영되며 대시보드에서 권장 인원 상한(내림)으로
          안내합니다.
        </p>
        <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[var(--background)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-2 text-left font-medium">부서명</th>
                <th className="px-3 py-2 text-center font-medium w-20">직원수</th>
                {STAFF_DIST_GRADES.map((g) => (
                  <th key={g} className="px-1 py-2 text-center font-mono w-16">
                    {g}%
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-medium w-24">합계</th>
              </tr>
            </thead>
            <tbody>
              {payload.departments.map((dept) => {
                const pct = {
                  ...defaultPercentagesRecord(),
                  ...staffPctByDept[dept],
                };
                const sum = sumPercentages(pct);
                const n = staffCounts[dept] ?? payload.counts[dept]?.STAFF ?? 0;
                const over = sum > 100.0001;
                return (
                  <tr
                    key={`dist-${dept}`}
                    className="border-b border-[var(--border)] hover:bg-[var(--secondary)]/40"
                  >
                    <td className="px-3 py-2 font-medium">{dept}</td>
                    <td className="px-3 py-2 text-center font-mono">{n}</td>
                    {STAFF_DIST_GRADES.map((g) => (
                      <td key={g} className="px-1 py-1 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          className="w-full max-w-[4.5rem] border border-[var(--border)] rounded px-1 py-1 text-center text-xs font-mono"
                          value={pct[g] ?? 0}
                          onChange={(e) => setStaffPct(dept, g, e.target.value)}
                        />
                      </td>
                    ))}
                    <td
                      className={`px-3 py-2 text-center font-mono ${over ? "text-red-600 font-semibold" : ""}`}
                    >
                      {round2(sum)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] font-mono text-[var(--muted-foreground)]">
          권장 인원(내림) = 직원수 × 해당 등급 % (대시보드 최종점검·개인 탭·직원
          역량평가에서 본부별로 표시)
        </p>
      </div>
    </section>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
