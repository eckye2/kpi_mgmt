"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgDictionaryPayload } from "@/lib/org-dictionary-sort";

type ApiUser = {
  id: number;
  employeeNo: string;
  email: string;
  name: string;
  dept: string;
  subDept: string;
  role: string;
  gradeLevel: string;
  hireDate: string;
  isSystemAdmin: boolean;
};

function csvEscapeCell(s: string): string {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function formatHireForCsv(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function buildUsersCsv(rows: ApiUser[]): string {
  const header =
    "employeeNo,email,name,dept,subDept,role,gradeLevel,hireDate,isSystemAdmin";
  const lines = rows.map((u) =>
    [
      u.employeeNo,
      u.email,
      u.name,
      u.dept,
      u.subDept,
      u.role,
      u.gradeLevel,
      formatHireForCsv(u.hireDate),
      u.isSystemAdmin ? "true" : "false",
    ]
      .map(csvEscapeCell)
      .join(",")
  );
  return "\uFEFF" + header + "\n" + lines.join("\n");
}

function emptyUserDraft() {
  return {
    employeeNo: "",
    email: "",
    name: "",
    dept: "",
    subDept: "",
    role: "STAFF",
    gradeLevel: "LEVEL_1",
    hireDate: new Date().toISOString().slice(0, 10),
    initialPassword: "",
    isSystemAdmin: false,
  };
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "STAFF", label: "직원" },
  { value: "CENTER_HEAD", label: "센터장" },
  { value: "HQ_HEAD", label: "본부장" },
  { value: "VICE_PRESIDENT", label: "부원장" },
  { value: "PRESIDENT", label: "원장" },
];

const GRADE_OPTIONS: { value: string; label: string }[] = [
  { value: "LEVEL_1", label: "1단" },
  { value: "LEVEL_2", label: "2단" },
  { value: "LEVEL_3", label: "3단" },
  { value: "LEVEL_4", label: "4단" },
];

const inputClass =
  "w-full min-w-[100px] border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";

type Props = { currentUserId: number };

export default function AdminUsersSection({ currentUserId }: Props) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importDryRun, setImportDryRun] = useState(true);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [orgDict, setOrgDict] = useState<OrgDictionaryPayload | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [draft, setDraft] = useState(emptyUserDraft);

  const subDeptLabelsForDept = useCallback(
    (deptLabel: string) => {
      if (!orgDict) return [];
      const dept = orgDict.depts.find((d) => d.labelKo === deptLabel);
      if (!dept) return [];
      return orgDict.subDepts
        .filter((sd) => sd.deptCode === dept.code)
        .map((sd) => sd.labelKo);
    },
    [orgDict]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/org-dictionary", {
          credentials: "include",
        });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled || !d?.depts || !d?.subDepts) return;
        setOrgDict({
          depts: d.depts,
          subDepts: d.subDepts,
          roles: d.roles ?? [],
          grades: d.grades ?? [],
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadUsers = useCallback(async () => {
    setListError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(
          typeof data.error === "string" ? data.error : "목록을 불러오지 못했습니다."
        );
        setUsers([]);
        return;
      }
      const list = Array.isArray(data.users) ? data.users : [];
      setUsers(
        list.map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          employeeNo: String(row.employeeNo ?? ""),
          email: String(row.email ?? ""),
          name: String(row.name ?? ""),
          dept: String(row.dept ?? ""),
          subDept: String(row.subDept ?? ""),
          role: String(row.role ?? "STAFF"),
          gradeLevel: String(row.gradeLevel ?? "LEVEL_1"),
          hireDate:
            typeof row.hireDate === "string" ? row.hireDate : "",
          isSystemAdmin: Boolean(row.isSystemAdmin),
        }))
      );
    } catch {
      setListError("네트워크 오류");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateLocal = (id: number, patch: Partial<ApiUser>) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
    );
  };

  const saveUser = async (u: ApiUser) => {
    setBusyId(u.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          name: u.name,
          dept: u.dept,
          subDept: u.subDept,
          role: u.role,
          gradeLevel: u.gradeLevel,
          isSystemAdmin: u.isSystemAdmin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          typeof data.error === "string" ? data.error : "저장에 실패했습니다."
        );
        return;
      }
      if (data.user) {
        const r = data.user as Record<string, unknown>;
        setUsers((prev) =>
          prev.map((row) =>
            row.id === u.id
              ? {
                  ...row,
                  ...data.user,
                  hireDate:
                    typeof r.hireDate === "string"
                      ? r.hireDate
                      : row.hireDate,
                }
              : row
          )
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u: ApiUser) => {
    const pw = window.prompt(`${u.name} — 새 비밀번호 (8자 이상)`);
    if (pw == null) return;
    if (pw.length < 6) {
      window.alert("8자 이상 입력하세요.");
      return;
    }
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}/password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: pw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          typeof data.error === "string" ? data.error : "초기화에 실패했습니다."
        );
        return;
      }
      window.alert("비밀번호가 변경되었습니다.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadUsersCsv = () => {
    const blob = new Blob([buildUsersCsv(users)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createUser = async () => {
    const emp = draft.employeeNo.trim();
    const em = draft.email.trim();
    const nm = draft.name.trim();
    if (!emp || !em || !nm || !draft.dept.trim() || !draft.subDept.trim()) {
      window.alert("사번, 이메일, 이름, 본부, 센터를 입력하세요.");
      return;
    }
    setAddBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeNo: emp,
          email: em,
          name: nm,
          dept: draft.dept.trim(),
          subDept: draft.subDept.trim(),
          role: draft.role,
          gradeLevel: draft.gradeLevel,
          hireDate: draft.hireDate,
          initialPassword: draft.initialPassword,
          isSystemAdmin: draft.isSystemAdmin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          typeof data.error === "string" ? data.error : "등록에 실패했습니다."
        );
        return;
      }
      window.alert("사용자가 등록되었습니다.");
      setDraft(emptyUserDraft());
      setShowAddForm(false);
      await loadUsers();
    } finally {
      setAddBusy(false);
    }
  };

  const deleteUser = async (u: ApiUser) => {
    if (
      !window.confirm(
        `${u.name} (${u.email}) 계정을 삭제할까요?\n연결된 평가·알림 등은 함께 정리됩니다. 이 작업은 되돌릴 수 없습니다.`
      )
    ) {
      return;
    }
    setBusyId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(
          typeof data.error === "string" ? data.error : "삭제에 실패했습니다."
        );
        return;
      }
      setUsers((prev) => prev.filter((row) => row.id !== u.id));
    } finally {
      setBusyId(null);
    }
  };

  const runImport = async () => {
    setImportMessage("");
    setImportBusy(true);
    try {
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText, dryRun: importDryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMessage(
          typeof data.error === "string" ? data.error : "Import 요청 실패"
        );
        return;
      }
      setImportMessage(JSON.stringify(data, null, 2));
      if (!importDryRun) await loadUsers();
    } catch {
      setImportMessage("네트워크 오류");
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <section
        id="section-admin-users"
        className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-medium">사용자</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadUsersCsv()}
              disabled={loading || users.length === 0}
              className="border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] hover:bg-[var(--secondary)] disabled:opacity-50"
            >
              CSV 다운로드
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm((open) => {
                  const next = !open;
                  if (next && orgDict?.depts?.length && !draft.dept) {
                    const firstDept = orgDict.depts[0].labelKo;
                    const deptRow = orgDict.depts[0];
                    const subLabel =
                      orgDict.subDepts.find((s) => s.deptCode === deptRow.code)
                        ?.labelKo ?? "";
                    setDraft((d) => ({
                      ...d,
                      dept: firstDept,
                      subDept: subLabel,
                    }));
                  }
                  return next;
                });
              }}
              className="border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] text-white hover:opacity-90"
            >
              {showAddForm ? "추가 폼 닫기" : "사용자 추가"}
            </button>
            <button
              type="button"
              onClick={() => loadUsers()}
              disabled={loading}
              className="border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.15em] hover:bg-[var(--secondary)] disabled:opacity-50"
            >
              새로고침
            </button>
          </div>
        </div>
        {listError && (
          <p className="mb-3 text-sm text-red-600">{listError}</p>
        )}
        {showAddForm && (
          <div className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
            <h3 className="text-sm font-medium">새 사용자 등록</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              초기 비밀번호를 비우면 사번이 임시 비밀번호가 되며, 최초 로그인 시 변경이
              요구됩니다. 직접 입력 시 8자 이상이어야 합니다.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  사번
                </span>
                <input
                  className={inputClass}
                  value={draft.employeeNo}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, employeeNo: e.target.value }))
                  }
                  maxLength={10}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  이메일
                </span>
                <input
                  className={inputClass}
                  type="email"
                  value={draft.email}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, email: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  이름
                </span>
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  본부
                </span>
                {orgDict ? (
                  <select
                    className={inputClass}
                    value={draft.dept}
                    onChange={(e) => {
                      const nd = e.target.value;
                      const subs = subDeptLabelsForDept(nd);
                      const nextSub = subs.includes(draft.subDept)
                        ? draft.subDept
                        : subs[0] ?? "";
                      setDraft((d) => ({ ...d, dept: nd, subDept: nextSub }));
                    }}
                  >
                    {orgDict.depts.map((d) => (
                      <option key={d.code} value={d.labelKo}>
                        {d.labelKo}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={draft.dept}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, dept: e.target.value }))
                    }
                  />
                )}
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  센터
                </span>
                {orgDict ? (
                  <select
                    className={inputClass}
                    value={draft.subDept}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subDept: e.target.value }))
                    }
                  >
                    {subDeptLabelsForDept(draft.dept).map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    value={draft.subDept}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subDept: e.target.value }))
                    }
                  />
                )}
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  입사일
                </span>
                <input
                  className={inputClass}
                  type="date"
                  value={draft.hireDate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, hireDate: e.target.value }))
                  }
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  역할
                </span>
                <select
                  className={inputClass}
                  value={draft.role}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, role: e.target.value }))
                  }
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  등급단
                </span>
                <select
                  className={inputClass}
                  value={draft.gradeLevel}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, gradeLevel: e.target.value }))
                  }
                >
                  {GRADE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs sm:col-span-2">
                <span className="mb-1 block text-[var(--muted-foreground)]">
                  초기 비밀번호 (선택)
                </span>
                <input
                  className={inputClass}
                  type="password"
                  autoComplete="new-password"
                  value={draft.initialPassword}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, initialPassword: e.target.value }))
                  }
                  placeholder="비우면 사번 사용"
                />
              </label>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.isSystemAdmin}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      isSystemAdmin: e.target.checked,
                    }))
                  }
                  className="h-4 w-4"
                />
                시스템 관리자
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={addBusy}
                onClick={() => createUser()}
                className="border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[10px] font-mono uppercase text-white disabled:opacity-50"
              >
                {addBusy ? "등록 중…" : "등록"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(emptyUserDraft());
                  setShowAddForm(false);
                }}
                className="border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-[10px] font-mono uppercase hover:bg-[var(--secondary)]"
              >
                취소
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>
        ) : (
          <div className="overflow-x-auto border border-[var(--border)]">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead className="bg-[var(--background)] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-2 py-2">이름</th>
                  <th className="px-2 py-2">이메일</th>
                  <th className="px-2 py-2">사번</th>
                  <th className="px-2 py-2">본부</th>
                  <th className="px-2 py-2">센터</th>
                  <th className="px-2 py-2">역할</th>
                  <th className="px-2 py-2">등급단</th>
                  <th className="px-2 py-2">시스템관리자</th>
                  <th className="px-2 py-2">동작</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-[var(--border)] align-top"
                  >
                    <td className="px-2 py-2">
                      <input
                        className={inputClass}
                        value={u.name}
                        onChange={(e) => updateLocal(u.id, { name: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-[var(--muted-foreground)]">
                      {u.email}
                    </td>
                    <td className="px-2 py-2 font-mono">{u.employeeNo}</td>
                    <td className="px-2 py-2">
                      {orgDict ? (
                        <select
                          className={inputClass}
                          value={u.dept}
                          onChange={(e) => {
                            const nd = e.target.value;
                            const subs = subDeptLabelsForDept(nd);
                            const nextSub = subs.includes(u.subDept)
                              ? u.subDept
                              : subs[0] ?? "";
                            updateLocal(u.id, { dept: nd, subDept: nextSub });
                          }}
                        >
                          {[
                            ...new Set([
                              u.dept,
                              ...orgDict.depts.map((d) => d.labelKo),
                            ]),
                          ]
                            .sort((a, b) => a.localeCompare(b, "ko"))
                            .map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <input
                          className={inputClass}
                          value={u.dept}
                          onChange={(e) =>
                            updateLocal(u.id, { dept: e.target.value })
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {orgDict ? (
                        <select
                          className={inputClass}
                          value={u.subDept}
                          onChange={(e) =>
                            updateLocal(u.id, { subDept: e.target.value })
                          }
                        >
                          {[
                            ...new Set([
                              u.subDept,
                              ...subDeptLabelsForDept(u.dept),
                            ]),
                          ].map((label) => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className={inputClass}
                          value={u.subDept}
                          onChange={(e) =>
                            updateLocal(u.id, { subDept: e.target.value })
                          }
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={inputClass}
                        value={u.role}
                        onChange={(e) => updateLocal(u.id, { role: e.target.value })}
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        className={inputClass}
                        value={u.gradeLevel}
                        onChange={(e) =>
                          updateLocal(u.id, { gradeLevel: e.target.value })
                        }
                      >
                        {GRADE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={u.isSystemAdmin}
                        onChange={(e) =>
                          updateLocal(u.id, { isSystemAdmin: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => saveUser(u)}
                        className="mr-1 border border-[var(--border)] px-2 py-1 text-[10px] font-mono uppercase hover:bg-[var(--secondary)] disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => resetPassword(u)}
                        className="border border-[var(--border)] px-2 py-1 text-[10px] font-mono uppercase hover:bg-[var(--secondary)] disabled:opacity-50"
                      >
                        암호
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => deleteUser(u)}
                          className="ml-1 border border-red-200 px-2 py-1 text-[10px] font-mono uppercase text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        id="section-admin-import"
        className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h2 className="text-xl font-medium mb-2">사용자 Import (CSV / Excel)</h2>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          헤더: employeeNo,email,name,dept,subDept,role,gradeLevel,hireDate
          (날짜 YYYY-MM-DD). role은 한글(직원·센터장…) 또는 영문 enum. Excel은
          첫 시트를 CSV로 변환해 동일 형식으로 처리합니다.
        </p>
        <div className="mb-3">
          <label className="inline-flex cursor-pointer items-center gap-2 border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[10px] font-mono uppercase tracking-[0.1em] hover:bg-[var(--secondary)]">
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setImportMessage("");
                try {
                  const name = file.name.toLowerCase();
                  if (name.endsWith(".csv")) {
                    setCsvText(await file.text());
                    return;
                  }
                  const XLSX = await import("xlsx");
                  const buf = await file.arrayBuffer();
                  const wb = XLSX.read(buf, { type: "array" });
                  const first = wb.SheetNames[0];
                  if (!first) {
                    setImportMessage("시트가 없습니다.");
                    return;
                  }
                  setCsvText(XLSX.utils.sheet_to_csv(wb.Sheets[first]));
                } catch {
                  setImportMessage("파일을 읽지 못했습니다.");
                }
              }}
            />
            파일 선택 (.csv / .xlsx)
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs mb-2">
          <input
            type="checkbox"
            checked={importDryRun}
            onChange={(e) => setImportDryRun(e.target.checked)}
          />
          드라이런(미적용)
        </label>
        <textarea
          className="w-full min-h-[140px] border border-[var(--border)] bg-white p-3 font-mono text-xs"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="CSV 내용을 붙여넣기…"
        />
        <button
          type="button"
          disabled={importBusy}
          onClick={() => runImport()}
          className="mt-3 border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[10px] font-mono uppercase text-white disabled:opacity-50"
        >
          {importBusy ? "처리 중…" : "실행"}
        </button>
        {importMessage && (
          <pre className="mt-3 max-h-48 overflow-auto rounded border border-[var(--border)] bg-[var(--background)] p-3 text-[11px]">
            {importMessage}
          </pre>
        )}
      </section>
    </div>
  );
}
