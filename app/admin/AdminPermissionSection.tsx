"use client";

export default function AdminPermissionSection() {
  return (
    <section
      id="section-admin-permission"
      className="scroll-mt-24 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
    >
      <h2 className="text-xl font-medium mb-6">권한 관리</h2>
      <div className="space-y-4">
        <div className="p-4 border border-[var(--border)] rounded-lg bg-[var(--secondary)]/30">
          <h3 className="text-sm font-medium mb-3">권한 레벨</h3>
          <ul className="space-y-2 text-xs text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <span className="w-20 font-medium text-foreground">원장:</span>
              <span>전사/본부/센터/개인 목표 조회 및 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-20 font-medium text-foreground">부원장:</span>
              <span>전사/본부/센터/개인 목표 조회 및 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-20 font-medium text-foreground">본부장:</span>
              <span>본부/센터/직원 목표 조회 및 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-20 font-medium text-foreground">센터장:</span>
              <span>센터/직원 목표 조회 및 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="w-20 font-medium text-foreground">일반직원:</span>
              <span>개인 목표 수립 및 조회</span>
            </li>
          </ul>
        </div>
        <div className="p-4 border border-[var(--border)] rounded-lg bg-[var(--secondary)]/30">
          <h3 className="text-sm font-medium mb-3">승인 프로세스</h3>
          <ul className="space-y-2 text-xs text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <span className="font-medium text-foreground">1단계:</span>
              <span>직원 → 센터장 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium text-foreground">2단계:</span>
              <span>센터장 → 본부장 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium text-foreground">3단계:</span>
              <span>본부장 → 부원장 승인</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-medium text-foreground">4단계:</span>
              <span>부원장 → 원장 최종 승인</span>
            </li>
          </ul>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          시스템 관리자·원장·부원장만 이 통합설정 화면에 접근할 수 있습니다. 역할
          변경은 사용자 목록에서 저장하세요.
        </p>
      </div>
    </section>
  );
}
