"use client";

import { useCallback, useEffect, useState } from "react";

type DeptRow = {
  code: string;
  labelKo: string;
  sortOrder: number;
  active: boolean;
};
type SubRow = {
  code: string;
  labelKo: string;
  deptCode: string;
  sortOrder: number;
  active: boolean;
};
type RoleRow = {
  code: string;
  labelKo: string;
  permissionKey: string;
  sortOrder: number;
  active: boolean;
  remark: string;
};
type GradeRow = {
  code: string;
  labelKo: string;
  mapsToGrade: string;
  sortOrder: number;
  active: boolean;
  remark: string;
};

const PERM_OPTIONS = [
  { value: "", label: "(없음)" },
  { value: "PRESIDENT", label: "원장" },
  { value: "VICE_PRESIDENT", label: "부원장" },
  { value: "HQ_HEAD", label: "본부장" },
  { value: "CENTER_HEAD", label: "센터장" },
  { value: "STAFF", label: "직원" },
];

const MAP_GRADE_OPTIONS = [
  { value: "", label: "(없음)" },
  { value: "LEVEL_1", label: "1단" },
  { value: "LEVEL_2", label: "2단" },
  { value: "LEVEL_3", label: "3단" },
  { value: "LEVEL_4", label: "4단" },
];

const inputClass =
  "w-full min-w-[80px] border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

type OrgSubTab = "dept" | "sub" | "role" | "grade";

export default function AdminOrgDictionarySection() {
  const [subTab, setSubTab] = useState<OrgSubTab>("dept");
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [subDepts, setSubDepts] = useState<SubRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/org-dictionary", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "불러오기 실패");
        return;
      }
      setDepts(
        (data.depts ?? []).map(
          (d: { code: string; labelKo: string; sortOrder: number; active: boolean }) => ({
            code: d.code,
            labelKo: d.labelKo,
            sortOrder: d.sortOrder ?? 0,
            active: d.active !== false,
          })
        )
      );
      setSubDepts(
        (data.subDepts ?? []).map(
          (s: {
            code: string;
            labelKo: string;
            deptCode: string;
            sortOrder: number;
            active: boolean;
          }) => ({
            code: s.code,
            labelKo: s.labelKo,
            deptCode: s.deptCode,
            sortOrder: s.sortOrder ?? 0,
            active: s.active !== false,
          })
        )
      );
      setRoles(
        (data.roles ?? []).map(
          (r: {
            code: string;
            labelKo: string;
            permissionKey: string | null;
            sortOrder: number;
            active: boolean;
            remark: string | null;
          }) => ({
            code: r.code,
            labelKo: r.labelKo,
            permissionKey: r.permissionKey ?? "",
            sortOrder: r.sortOrder ?? 0,
            active: r.active !== false,
            remark: r.remark ?? "",
          })
        )
      );
      setGrades(
        (data.grades ?? []).map(
          (g: {
            code: string;
            labelKo: string;
            mapsToGrade: string | null;
            sortOrder: number;
            active: boolean;
            remark: string | null;
          }) => ({
            code: g.code,
            labelKo: g.labelKo,
            mapsToGrade: g.mapsToGrade ?? "",
            sortOrder: g.sortOrder ?? 0,
            active: g.active !== false,
            remark: g.remark ?? "",
          })
        )
      );
    } catch {
      setErr("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstDeptCode = depts[0]?.code ?? "";

  const save = async () => {
    const dRows = depts.filter((d) => d.code.trim());
    const sRows = subDepts.filter((s) => s.code.trim());
    const rRows = roles.filter((r) => r.code.trim());
    const gRows = grades.filter((g) => g.code.trim());
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/org-dictionary", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depts: dRows.map((d) => ({
            code: d.code.trim(),
            labelKo: d.labelKo.trim(),
            sortOrder: d.sortOrder,
            active: d.active,
          })),
          subDepts: sRows.map((s) => ({
            code: s.code.trim(),
            labelKo: s.labelKo.trim(),
            deptCode: s.deptCode.trim(),
            sortOrder: s.sortOrder,
            active: s.active,
          })),
          roles: rRows.map((r) => ({
            code: r.code.trim(),
            labelKo: r.labelKo.trim(),
            permissionKey: r.permissionKey || null,
            sortOrder: r.sortOrder,
            active: r.active,
            remark: r.remark.trim() || null,
          })),
          grades: gRows.map((g) => ({
            code: g.code.trim(),
            labelKo: g.labelKo.trim(),
            mapsToGrade: g.mapsToGrade || null,
            sortOrder: g.sortOrder,
            active: g.active,
            remark: g.remark.trim() || null,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "저장 실패");
        return;
      }
      setMsg("조직 코드가 저장되었습니다. 사용자 화면은 새로고침 후 반영됩니다.");
      await load();
    } catch {
      setErr("네트워크 오류");
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (id: OrgSubTab, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setSubTab(id)}
      className={`px-4 py-2 text-[11px] font-mono uppercase tracking-[0.12em] border-b-2 transition-colors ${
        subTab === id
          ? "border-[var(--accent)] text-[var(--accent)]"
          : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section
      id="section-admin-org-dictionary"
      className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-medium">조직 코드 사전</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[10px] font-mono uppercase disabled:opacity-50"
          >
            새로고침
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-[10px] font-mono uppercase text-white disabled:opacity-50"
          >
            {saving ? "저장 중…" : "전체 저장"}
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-[var(--muted-foreground)]">
        코드(code)는 영문·숫자·밑줄 등 고유 ID(최대 64자), 표시명은 사용자·콤보에
        쓰이는 한글명입니다. 비활성은 목록에 남기고 체크만 해제하세요. 표시명 변경
        시 기존 사용자 데이터와 불일치하지 않도록 사용자 탭에서 함께 점검하세요.
      </p>
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
      {msg && <p className="mb-2 text-sm text-green-700">{msg}</p>}

      <div className="mb-4 flex flex-wrap border-b border-[var(--border)]">
        {tabBtn("dept", "본부")}
        {tabBtn("sub", "센터")}
        {tabBtn("role", "역할")}
        {tabBtn("grade", "등급단")}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>
      ) : (
        <>
          {subTab === "dept" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="bg-[var(--background)] font-mono text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-2 py-2">코드</th>
                    <th className="px-2 py-2">표시명(한글)</th>
                    <th className="px-2 py-2 w-20">순서</th>
                    <th className="px-2 py-2">사용</th>
                  </tr>
                </thead>
                <tbody>
                  {depts.map((d, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={d.code}
                          onChange={(e) => {
                            const next = [...depts];
                            next[i] = { ...d, code: e.target.value };
                            setDepts(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={d.labelKo}
                          onChange={(e) => {
                            const next = [...depts];
                            next[i] = { ...d, labelKo: e.target.value };
                            setDepts(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className={inputClass}
                          value={d.sortOrder}
                          onChange={(e) => {
                            const next = [...depts];
                            next[i] = {
                              ...d,
                              sortOrder: parseInt(e.target.value, 10) || 0,
                            };
                            setDepts(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={d.active}
                          onChange={(e) => {
                            const next = [...depts];
                            next[i] = { ...d, active: e.target.checked };
                            setDepts(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 border border-[var(--border)] px-3 py-1.5 text-[10px] font-mono uppercase"
                onClick={() =>
                  setDepts((prev) => [
                    ...prev,
                    {
                      code: "",
                      labelKo: "",
                      sortOrder: prev.length * 10,
                      active: true,
                    },
                  ])
                }
              >
                행 추가
              </button>
            </div>
          )}

          {subTab === "sub" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-[var(--background)] font-mono text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-2 py-2">코드</th>
                    <th className="px-2 py-2">표시명</th>
                    <th className="px-2 py-2">소속 본부 코드</th>
                    <th className="px-2 py-2 w-20">순서</th>
                    <th className="px-2 py-2">사용</th>
                  </tr>
                </thead>
                <tbody>
                  {subDepts.map((s, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={s.code}
                          onChange={(e) => {
                            const next = [...subDepts];
                            next[i] = { ...s, code: e.target.value };
                            setSubDepts(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={s.labelKo}
                          onChange={(e) => {
                            const next = [...subDepts];
                            next[i] = { ...s, labelKo: e.target.value };
                            setSubDepts(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={inputClass}
                          value={s.deptCode}
                          onChange={(e) => {
                            const next = [...subDepts];
                            next[i] = { ...s, deptCode: e.target.value };
                            setSubDepts(next);
                          }}
                        >
                          {depts
                            .filter((d) => d.code.trim())
                            .map((d) => (
                              <option key={d.code} value={d.code}>
                                {d.code} — {d.labelKo}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className={inputClass}
                          value={s.sortOrder}
                          onChange={(e) => {
                            const next = [...subDepts];
                            next[i] = {
                              ...s,
                              sortOrder: parseInt(e.target.value, 10) || 0,
                            };
                            setSubDepts(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={s.active}
                          onChange={(e) => {
                            const next = [...subDepts];
                            next[i] = { ...s, active: e.target.checked };
                            setSubDepts(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 border border-[var(--border)] px-3 py-1.5 text-[10px] font-mono uppercase"
                onClick={() =>
                  setSubDepts((prev) => [
                    ...prev,
                    {
                      code: "",
                      labelKo: "",
                      deptCode: firstDeptCode,
                      sortOrder: prev.length * 10,
                      active: true,
                    },
                  ])
                }
              >
                행 추가
              </button>
            </div>
          )}

          {subTab === "role" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead className="bg-[var(--background)] font-mono text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-2 py-2">코드</th>
                    <th className="px-2 py-2">표시명</th>
                    <th className="px-2 py-2">권한 매핑</th>
                    <th className="px-2 py-2 w-20">순서</th>
                    <th className="px-2 py-2">사용</th>
                    <th className="px-2 py-2">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={r.code}
                          onChange={(e) => {
                            const next = [...roles];
                            next[i] = { ...r, code: e.target.value };
                            setRoles(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={r.labelKo}
                          onChange={(e) => {
                            const next = [...roles];
                            next[i] = { ...r, labelKo: e.target.value };
                            setRoles(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={inputClass}
                          value={r.permissionKey}
                          onChange={(e) => {
                            const next = [...roles];
                            next[i] = { ...r, permissionKey: e.target.value };
                            setRoles(next);
                          }}
                        >
                          {PERM_OPTIONS.map((o) => (
                            <option key={o.value || "none"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className={inputClass}
                          value={r.sortOrder}
                          onChange={(e) => {
                            const next = [...roles];
                            next[i] = {
                              ...r,
                              sortOrder: parseInt(e.target.value, 10) || 0,
                            };
                            setRoles(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={(e) => {
                            const next = [...roles];
                            next[i] = { ...r, active: e.target.checked };
                            setRoles(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={r.remark}
                          onChange={(e) => {
                            const next = [...roles];
                            next[i] = { ...r, remark: e.target.value };
                            setRoles(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 border border-[var(--border)] px-3 py-1.5 text-[10px] font-mono uppercase"
                onClick={() =>
                  setRoles((prev) => [
                    ...prev,
                    {
                      code: "",
                      labelKo: "",
                      permissionKey: "",
                      sortOrder: prev.length * 10,
                      active: true,
                      remark: "",
                    },
                  ])
                }
              >
                행 추가
              </button>
            </div>
          )}

          {subTab === "grade" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs">
                <thead className="bg-[var(--background)] font-mono text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-2 py-2">코드</th>
                    <th className="px-2 py-2">표시명</th>
                    <th className="px-2 py-2">등급단 매핑</th>
                    <th className="px-2 py-2 w-20">순서</th>
                    <th className="px-2 py-2">사용</th>
                    <th className="px-2 py-2">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((g, i) => (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={g.code}
                          onChange={(e) => {
                            const next = [...grades];
                            next[i] = { ...g, code: e.target.value };
                            setGrades(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={g.labelKo}
                          onChange={(e) => {
                            const next = [...grades];
                            next[i] = { ...g, labelKo: e.target.value };
                            setGrades(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <select
                          className={inputClass}
                          value={g.mapsToGrade}
                          onChange={(e) => {
                            const next = [...grades];
                            next[i] = { ...g, mapsToGrade: e.target.value };
                            setGrades(next);
                          }}
                        >
                          {MAP_GRADE_OPTIONS.map((o) => (
                            <option key={o.value || "none"} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          className={inputClass}
                          value={g.sortOrder}
                          onChange={(e) => {
                            const next = [...grades];
                            next[i] = {
                              ...g,
                              sortOrder: parseInt(e.target.value, 10) || 0,
                            };
                            setGrades(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={g.active}
                          onChange={(e) => {
                            const next = [...grades];
                            next[i] = { ...g, active: e.target.checked };
                            setGrades(next);
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          className={inputClass}
                          value={g.remark}
                          onChange={(e) => {
                            const next = [...grades];
                            next[i] = { ...g, remark: e.target.value };
                            setGrades(next);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-2 border border-[var(--border)] px-3 py-1.5 text-[10px] font-mono uppercase"
                onClick={() =>
                  setGrades((prev) => [
                    ...prev,
                    {
                      code: "",
                      labelKo: "",
                      mapsToGrade: "",
                      sortOrder: prev.length * 10,
                      active: true,
                      remark: "",
                    },
                  ])
                }
              >
                행 추가
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
