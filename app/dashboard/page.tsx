"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  sortLabelsByDeptOrder,
  sortLabelsBySubDeptOrder,
  type OrgDictionaryPayload,
} from "@/lib/org-dictionary-sort";
import {
  DEFAULT_STAFF_DISTRIBUTION_PCT,
  STAFF_DIST_GRADES,
  recommendedHeadcount,
} from "@/lib/evaluation-staff-distribution";

type TabKey = "전사" | "본부" | "센터" | "개인";
type PhaseKey = "목표수립" | "중간점검" | "최종점검" | "평가결과";
type CompetencyGrade = "A" | "B" | "C" | "D" | "E";
type GoalItem = {
  id: string;
  category: "성과" | "역량" | "재무" | "비재무" | "기타";
  title: string;
  name: string;
  detail: string;
  target: string;
  unit: string;
  weight: string;
  actual: string;
  gradeS?: string;
  gradeB?: string;
  gradeC?: string;
  gradeD?: string;
};
type StaffMember = {
  id: number;
  name: string;
  dept: string;
  subDept: string;
  role: string;
  grade: string;
  gradeLevel: 1 | 2 | 3 | 4;
  employeeNo: string;
  email: string;
  hireDate: string;
  evaluations: EvaluationRecord[];
};
type EvaluationRecord = {
  year: number;
  performance: string;
  competency: string;
  grade: string;
};

const tabs: TabKey[] = ["전사", "본부", "센터", "개인"];
const phaseTabs: PhaseKey[] = [
  "목표수립",
  "중간점검",
  "최종점검",
  "평가결과",
];
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 4 }, (_, index) => currentYear - index);

const performanceOptions = ["탁월", "우수", "보통", "개선필요"];
const competencyOptions = ["A", "B", "C", "D"];
const ratingOptions = ["S", "A", "B", "C", "D"];

/** 등급 기준 입력용 기호 (숫자 + 기호로 범위 표현) */
const GRADE_OP_OPTIONS = ["같음", "이상", "이하", "초과", "미만"] as const;
type GradeOp = (typeof GRADE_OP_OPTIONS)[number];

/** 단일 등급 문자열 파싱 (예: "330 이상" -> { num, op }) */
function parseSingleGrade(str: string): { num: string; op: GradeOp } {
  if (!str || !str.trim()) return { num: "", op: "같음" };
  const trimmed = str.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(이상|이하|초과|미만|같음)?$/);
  if (match) return { num: match[1], op: (match[2] as GradeOp) || "같음" };
  const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)/);
  const opMatch = trimmed.match(/(이상|이하|초과|미만|같음)\s*$/);
  return {
    num: numMatch ? numMatch[1] : "",
    op: opMatch ? (opMatch[1] as GradeOp) : "같음",
  };
}

/** 범위 등급 문자열 파싱 (예: "270 이상 ~ 300 미만") */
function parseRangeGrade(str: string): { num1: string; op1: GradeOp; num2: string; op2: GradeOp } {
  if (!str || !str.trim()) return { num1: "", op1: "이상", num2: "", op2: "미만" };
  const parts = str.split(/\s*~\s*/).map((s) => s.trim());
  const left = parseSingleGrade(parts[0] || "");
  const right = parseSingleGrade(parts[1] || "");
  return { num1: left.num, op1: left.op, num2: right.num, op2: right.op };
}

/** 단일 등급 문자열 생성 */
function buildSingleGrade(num: string, op: GradeOp): string {
  if (!num.trim()) return "";
  return op === "같음" ? num.trim() : `${num.trim()} ${op}`;
}

/** 범위 등급 문자열 생성 */
function buildRangeGrade(num1: string, op1: GradeOp, num2: string, op2: GradeOp): string {
  if (!num1.trim() || !num2.trim()) return "";
  return `${num1.trim()} ${op1} ~ ${num2.trim()} ${op2}`;
}

const competencyGradeRubric: Record<CompetencyGrade, string> = {
  A: "대우수: 최고 수준의 역량을 보여주며 다양한 응용 가능 / 해당 직급 기대 이상의 역량을 보여줌",
  B: "우수: 복잡한 환경에서 역량을 충분히 활용 / 자신의 업무분야 아닌 타 타인용 직무도 수행 가능",
  C: "보통: 역량이 습관화되어 실무에서 자연스럽게 나타남 / 개인 업무의 기대 수준을 만족시킴",
  D: "다소 미흡: 기초 단계를 벗어나 업무를 학습하는 수준 / 원활한 업무 수행을 위해 추가적인 역량개발이 필요",
  E: "매우 미흡: 업무에 체계화가 없고 기초적인 수준이며 업무 수행에 지장을 줌 / 기대수준에 현저히 미달함",
};

const competencyItems = [
  {
    group: "핵심역량",
    rows: [
      {
        key: "core_ownership",
        label: "주인의식",
        indicator:
          "자신의 역할 및 책임과 회사 목표와의 관계를 이해하여 부여된 과제와 목표 달성에 대한 책임감을 가지고 맡은 바 역할을 완수한다",
      },
      {
        key: "core_problemSolving",
        label: "문제해결",
        indicator:
          "선입견이나 감정적인 추측을 배제하고 사실적인 문제에만 집중해 문제 발생 시 다각적인 분석을 통해 본질적 문제 원인을 찾고 문제 핵심 원인을 해결할 수 있는 적절한 대책을 수립하여 문제를 해결한다",
      },
      {
        key: "core_customer",
        label: "고객지향",
        indicator:
          "업무와 관련된 내·외부 고객의 입장에서 사고하여 고객이 원하는 바가 무엇인지 적극적으로 파악하고, 이를 신속하게 충족시킨다",
      },
    ],
  },
  {
    group: "리더십 역량",
    rows: [
      {
        key: "lead_goalManagement",
        label: "목표관리",
        indicator:
          "목표를 설정 시 도전적으로 지속적으로 점검한다. 설정된 목표를 달성하기 위해 계획된 기한을 준수하고 요구수준을 완수한다. 조직의 정책 방향과 목적을 분명히 설정한다",
      },
      {
        key: "lead_drive",
        label: "추진력",
        indicator:
          "주어진 일정을 준수하며, 적기에 목표 달성을 위해 구체적이고 다양한 방법을 활용하여 업무상 장애 및 갈등을 효과적으로 극복하고 신속하고 꾸준히 끝까지 업무를 완수한다",
      },
      {
        key: "lead_challengeInnovation",
        label: "도전 및 혁신",
        indicator:
          "실수를 두려워하지 않고 실패 시 이를 숨기지 않고 이를 통해 배우며, 목표를 정할 때 항상 현재 능력보다 한 단계 높은 수준의 목표를 설정한다. 유연하고 창의적인 사고방식으로 구태의연한 일 처리방식의 문제를 지속적으로 개선하고 상위 수준의 업무성과 목표 달성을 추구하는 태도를 보인다",
      },
    ],
  },
  {
    group: "직무역량",
    rows: [
      {
        key: "job_situation",
        label: "상황대응력",
        indicator:
          "일상적인 업무뿐만 아니라 예외적인 업무 상황 발생 시, 사안에 대한 원인과 이슈를 구조화하고 신속히 판단하여 적기에 대응한다",
      },
      {
        key: "job_teamwork",
        label: "팀웍/협동",
        indicator:
          "부서원들 간에 협력적인 분위기와 신뢰감 있는 관계 형성을 조성한다. 부서원 모두 하나의 팀임을 인지하고 업무체계 및 상호 존중을 기반으로 업무의 일체감을 조성한다. 부서 내에서 상호 존중하며 행동 규범을 지키고 노력한다",
      },
      {
        key: "job_creativity",
        label: "창의성",
        indicator:
          "기존 인식의 틀에서 벗어나 새롭고 다양한 관점에서 생각한다. 문제 해결 시 미처 생각하지 못한 다른 시각에서 해결안을 발견해 낸다. 기존의 방식 개선하기 위한 새로운 시도 및 접근 방법을 모색한다",
      },
      {
        key: "job_motivation",
        label: "동기부여",
        indicator:
          "평소의 의사소통, 관심 등을 통해 팀원 개개인이 추구하는 욕구와 동기요인을 파악한다. 자신감이 없는 직원에게 칭찬 등을 통해 인정감을 쌓고 자신감을 북돋아 준다. 성과에 따라 외적/내적 보상을 부여한다",
      },
    ],
  },
] as const;

/** 센터장 역량평가 항목 (본부장/원장/부원장이 센터 탭·본부 탭에서 평가 시 사용) */
const competencyItemsCenterManager = [
  {
    group: "핵심역량",
    rows: [
      {
        key: "cm_core_ownership",
        label: "주인의식",
        indicator:
          "자신의 역할 및 책임과 회사 목표와의 관계를 이해하여 부여된 과제와 목표 달성에 대한 책임감을 가지고 맡은 바 역할을 완수한다",
      },
      {
        key: "cm_core_problemSolving",
        label: "문제해결",
        indicator:
          "선입견이나 감정적인 추측을 배제하고 사실적인 문제에만 집중해 문제 발생 시 다각적인 분석을 통해 본질적 문제 원인을 찾고 문제 핵심 원인을 해결할 수 있는 적절한 대책을 수립하여 문제를 해결한다",
      },
      {
        key: "cm_core_customer",
        label: "고객지향",
        indicator:
          "업무와 관련된 내·외부 고객의 입장에서 사고하여 고객이 원하는 바가 무엇인지 적극적으로 파악하고, 이를 신속하게 충족시킨다",
      },
      {
        key: "cm_core_coachingFeedback",
        label: "코칭/피드백",
        indicator:
          "개별 부하직원이 자신의 역할·책임 및 필요 역량을 명확히 인식하도록 이끌고, 역량 개발 및 성과에 대한 노력에 적절한 보상을 한다. 부족한 부분에 대해 조언하고 본인의 경험을 공유한다",
      },
      {
        key: "cm_core_orgManagement",
        label: "조직운영능력",
        indicator:
          "단위 조직 목표 달성을 위해 조직 및 자원(인력, 예산 등)을 체계적으로 운영하여 원활한 업무 수행이 가능하도록 한다",
      },
    ],
  },
  {
    group: "리더십 역량",
    rows: [
      {
        key: "cm_lead_plMindset",
        label: "손익마인드",
        indicator:
          "전사적 이익 창출 및 비용 정책을 고려하여 일상 업무에 반영하고, 매출 증대·사업비 절감·원가 개선을 위한 구체적 실행 방안을 지속적으로 제안한다",
      },
      {
        key: "cm_lead_goalManagement",
        label: "목표관리",
        indicator:
          "목표 실행 과정에서 달성 상황을 지속적으로 점검한다. 설정된 목표 달성을 위해 계획된 기한을 준수하고 요구수준을 완수한다. 조직의 정책 방향과 목적을 분명히 설정한다",
      },
      {
        key: "cm_lead_drive",
        label: "추진력",
        indicator:
          "주어진 일정을 준수하며, 적기에 목표 달성을 위해 구체적이고 다양한 방법을 활용하여 업무상 장애 및 갈등을 효과적으로 극복하고 신속하고 꾸준히 끝까지 업무를 완수한다",
      },
    ],
  },
  {
    group: "직무역량",
    rows: [
      {
        key: "cm_job_challengeInnovation",
        label: "도전 및 혁신",
        indicator:
          "실수를 두려워하지 않고 실패 시 이를 숨기지 않고 이를 통해 배우며, 목표를 정할 때 항상 현재 능력보다 한 단계 높은 수준의 목표를 설정한다. 유연하고 창의적인 사고방식으로 구태의연한 일 처리방식의 문제를 지속적으로 개선하고 상위 수준의 업무성과 목표 달성을 추구하는 태도를 보인다",
      },
      {
        key: "cm_job_situation",
        label: "상황대응력",
        indicator:
          "일상적인 업무뿐만 아니라 예외적인 업무 상황 발생 시, 사안에 대한 원인과 이슈를 구조화하고 신속히 판단하여 적기에 대응한다",
      },
    ],
  },
] as const;

/** 본부장 역량평가 항목 (원장/부원장이 본부 탭에서 본부장 평가 시 사용, 첨부 이미지 기준) */
const competencyItemsHqManager = [
  {
    group: "핵심역량",
    rows: [
      {
        key: "hq_core_ownership",
        label: "주인의식",
        indicator:
          "자신의 역할 및 책임과 회사 목표와의 관계를 이해하며 부여된 과제와 목표 달성에 대한 책임감을 가지고 맡은 바 역할을 완수한다",
      },
      {
        key: "hq_core_problemSolving",
        label: "문제해결",
        indicator:
          "선입견이나 감정적인 추측을 배제하고 사실적인 문제에만 집중해서 논의하며, 문제 발생 시 다각적인 분석을 통해 본질적 문제 원인을 찾고, 문제의 핵심 원인을 해결할 수 있는 적절한 대책들을 수립하여 문제를 해결한다",
      },
      {
        key: "hq_core_customer",
        label: "고객지향",
        indicator:
          "업무와 관련된 내, 외부 고객의 입장에서 사고하여, 고객이 원하는 바가 무엇인지를 적극적으로 파악하고, 이를 신속히 충족시킨다",
      },
    ],
  },
  {
    group: "리더십 역량",
    rows: [
      {
        key: "hq_lead_proactiveness",
        label: "솔선수범",
        indicator:
          "내·외부 고객을 비롯한 업무 상 접하게 되는 타인에 대한 폭넓은 이해를 바탕으로 본인의 업무 수행 및 조직성과 향상에 유익한 인간관계를 형성한다. 하기 싫어하거나 어려워하는 일은 남들보다 먼저 시도한다",
      },
      {
        key: "hq_lead_networking",
        label: "네트워킹 능력",
        indicator:
          "내·외부 고객을 비롯한 업무 상 접하게 되는 타인에 대한 폭넓은 이해를 바탕으로 업무 수행 및 조직성과 향상에 유익한 인간관계를 형성한다",
      },
      {
        key: "hq_lead_coachingFeedback",
        label: "코칭/피드백",
        indicator:
          "부서원 개개인이 각자 자신의 역할과 책임, 필요 역량을 분명히 인식하도록 지도한다. 부서원들의 역량개발에 대한 노력과 그 결과에 대해 적절한 보상을 제공한다. 부서원들의 부족한 부분에 대한 조언과 자신의 경험을 전수해 준다",
      },
      {
        key: "hq_lead_orgManagement",
        label: "조직운영능력",
        indicator:
          "단위 조직의 목표 달성을 위해 조직 및 자원(인력, 예산 등)을 체계화하여 원활한 업무 수행이 가능하도록 조직을 운영한다",
      },
      {
        key: "hq_lead_plMindset",
        label: "손익마인드",
        indicator:
          "전사의 이윤 창출과 비용 정책을 고려하여 업무에 상시 적용하고, 매출 증가, 사업비 절감, 원가개선을 위한 구체적인 실행 방안을 지속적으로 제시한다",
      },
      {
        key: "hq_lead_goalManagement",
        label: "목표관리",
        indicator:
          "목표 실행 시 달성도를 지속적으로 점검한다. 설정된 목표를 달성하기 위해 계획된 기한을 준수하고 요구수준을 완수한다. 조직의 정책 방향과 목적을 분명히 설정한다",
      },
      {
        key: "hq_lead_drive",
        label: "추진력",
        indicator:
          "주어진 일정을 준수하며, 적기에 목표 달성을 위해 구체적이고 다양한 방법을 활용하여 업무 상 장애 및 갈등을 효과적으로 극복하고 신속하고 꾸준히 끝까지 업무를 완수한다",
      },
    ],
  },
] as const;

const competencyScoreByGrade: Record<CompetencyGrade, number> = {
  A: 10,
  B: 8,
  C: 6,
  D: 4,
  E: 2,
};

const competencyPoolAll: CompetencyGrade[] = ["A", "B", "C", "D", "E"];

/** 내부 만족도 조사 등급 (S~D) */
type InternalSatGrade = "S" | "A" | "B" | "C" | "D";
const internalSatGradeOptions: InternalSatGrade[] = ["S", "A", "B", "C", "D"];
/** 등급별 환산 비율: S=100%, A=80%, B=60%, C=40%, D=20% */
const internalSatRatio: Record<InternalSatGrade, number> = { S: 1, A: 0.8, B: 0.6, C: 0.4, D: 0.2 };

/** 센터장 내부고객만족도 기준표 (총 6개, 합계 100) */
const internalSatCenterItems: { key: string; label: string; maxPoints: number; criteria: Record<InternalSatGrade, string> }[] = [
  { key: "center_info", label: "정보공유", maxPoints: 20, criteria: { S: "지식·정보를 적극 공유하고 전파함", A: "필요 시 공유함", B: "요청 시 공유하는 편", C: "공유가 미흡함", D: "개인주의로 타인에게 불편을 줌" } },
  { key: "center_self", label: "자기계발", maxPoints: 20, criteria: { S: "지속적 자기관리·역량 개발", A: "꾸준히 노력함", B: "기대수준 정도", C: "노력이 부족함", D: "자기계발 노력이 거의 없음" } },
  { key: "center_lead", label: "통솔력", maxPoints: 15, criteria: { S: "부하를 충분히 장악·협동시키며 신뢰가 매우 두터움", A: "부하 장악·신뢰 두터움", B: "보통 수준", C: "장악 불충분·신뢰 약함", D: "통솔을 거의 하지 않으며 신뢰 극히 약함" } },
  { key: "center_moral", label: "도덕성", maxPoints: 15, criteria: { S: "자신을 희생해 상대를 돕고 힘든 업무도 성실히 수행", A: "상대를 아끼고 협력 우수", B: "조직 분위기·협조 무난", C: "상하 결속 약함", D: "자기중심으로 불화 자주·협조 미흡" } },
  { key: "center_judge", label: "이해판단력", maxPoints: 15, criteria: { S: "일 조건을 빠르게 이해하고 신속·정확한 의사결정", A: "이해·결정 대체로 빠르고 정확", B: "보통 수준", C: "신속성 결여", D: "사소한 일에 구애되어 우유부단" } },
  { key: "center_talent", label: "인재육성력", maxPoints: 15, criteria: { S: "체계적 교육·업무 할당으로 부하 능력 향상에 적극 노력", A: "부하 능력·적성에 따른 교육 노력", B: "육성 노력하나 체계적 교육 없음", C: "육성 관심 적고 업무 할당 정도", D: "육성 관심 없고 방임으로 능력 향상 저해" } },
];

/** 본부장 내부고객만족도 기준표 (총 7개, 합계 100) */
const internalSatHqItems: { key: string; label: string; maxPoints: number; criteria: Record<InternalSatGrade, string> }[] = [
  { key: "hq_manager", label: "경영자 자질", maxPoints: 15, criteria: { S: "경영 전반·회사 방침 이해 탁월, 손익 의식 철저", A: "이해 우수, 손익 의식 충분", B: "대체로 이해함", C: "이해 부족·손익 의식 희박", D: "회사 감각 미약·불만 많음" } },
  { key: "hq_progress", label: "진취정신", maxPoints: 10, criteria: { S: "새롭고 어려운 업무도 실패 불구 강한 도전으로 수행", A: "문제·장애 스스로 극복, 완수 의욕", B: "기대수준", C: "문제 해결 노력 부족", D: "신규 업무 무관심·완수 의욕 낮음" } },
  { key: "hq_responsibility", label: "책임감", maxPoints: 15, criteria: { S: "역할 인식, 어려운 일에도 나서 곤란 극복 후 끝까지 완수", A: "역할 인식, 성실 수행·결과 책임", B: "주어진 일 큰 과오 없이 수행", C: "목표 달성 의지·책임 의식 미흡", D: "일 미루고 결과에 무책임" } },
  { key: "hq_lead", label: "통솔력", maxPoints: 15, criteria: { S: "부하 충분히 장악·협동, 인간적 신뢰 매우 두터움", A: "부하 장악·신뢰 두터움", B: "보통 수준", C: "장악 불충분·신뢰 약함", D: "통솔·교류 결핍, 신뢰 극히 약함" } },
  { key: "hq_moral", label: "도덕성", maxPoints: 15, criteria: { S: "자신 희생해 상대 돕고 힘든 업무도 성실 수행", A: "상대 아끼고 협력 우수, 밝은 분위기", B: "조직 분위기·협조 무난", C: "상하 결속 약해 협조·조정 업무 미숙", D: "자기중심으로 불화 자주·협조 안 됨" } },
  { key: "hq_judge", label: "이해판단력", maxPoints: 15, criteria: { S: "일 제조건 빠르게 이해, 신뢰성 있는 의사결정 신속·정확", A: "이해·결정 대체로 빠르고 정확", B: "보통 수준", C: "신속성 결여로 기회 놓침", D: "사소한 일에 구애되어 우유부단" } },
  { key: "hq_talent", label: "인재육성력", maxPoints: 15, criteria: { S: "부하 능력·적성 정확 파악, 체계적 교육·업무 할당으로 능력 향상 적극 노력", A: "능력·적성에 따른 교육으로 향상 노력", B: "육성 노력하나 체계적 교육 없음", C: "육성 관심 적고 업무 할당 정도 지도", D: "육성 관심 없고 방임으로 능력 향상 저해" } },
];

/** 관리자 설정 평가 등급 허용 규칙 → 선택 풀 필터 */
function lookupEvalGradePool(
  rulesMap: Record<string, string[]>,
  dept: string,
  target: "HQ_HEAD" | "CENTER_HEAD" | "STAFF",
  pool: readonly string[]
): string[] {
  const key = `${dept}|${target}`;
  const allowed = rulesMap[key];
  if (!allowed?.length) return [...pool];
  const hit = pool.filter((g) => allowed.includes(g));
  return hit.length > 0 ? hit : [...pool];
}

const baseGoalsByTab: Record<TabKey, GoalItem[]> = {
  전사: [],
  본부: [],
  센터: [],
  개인: [],
};

const createYearData = (year: number) =>
  Object.fromEntries(
    Object.entries(baseGoalsByTab).map(([key, goals]) => [
      key,
      goals.map((goal) => ({ ...goal })),
    ])
  ) as Record<TabKey, GoalItem[]>;

const initialYearData = yearOptions.reduce(
  (acc, year) => {
    acc[year] = createYearData(year);
    return acc;
  },
  {} as Record<number, Record<TabKey, GoalItem[]>>
);

const extractNumber = (value: string) => {
  const numeric = value.replace(/[^0-9.]/g, "");
  if (!numeric) return null;
  const parsed = Number(numeric);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatCommaNumber = (value: string) => {
  const digitsOnly = value.replace(/[^0-9]/g, "");
  if (!digitsOnly) return "";
  return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const computeRate = (target: string, actual: string) => {
  const targetValue = extractNumber(target);
  const actualValue = extractNumber(actual);
  if (targetValue === null || actualValue === null || targetValue === 0) {
    return 0;
  }
  const percent = Math.round((actualValue / targetValue) * 100);
  return Math.max(percent, 0); // 100% 초과 달성도 표시 (예: 117%)
};

const inputStyle =
  "border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono";
const savedInputStyle =
  "bg-[var(--secondary)] text-[var(--muted-foreground)] border-[var(--border)]";


  const GOAL_UNIT_PRESETS = ["백만원", "%", "점", "건", "종"] as const;
  const GRADE_UNIT_PRESETS = ["백만원", "%", "점", "건", "종"] as const;
function GoalUnitSelect({
  unit,
  onChange,
  isEditing,
  isPerformanceMode,
  ariaLabel,
}: {
  unit: string;
  onChange: (v: string) => void;
  isEditing: boolean;
  isPerformanceMode: boolean;
  ariaLabel: string;
}) {
  const presets = GOAL_UNIT_PRESETS as readonly string[];
  const isPreset = presets.includes(unit);
  const [customMode, setCustomMode] = useState(() => !isPreset && unit !== "");
  useEffect(() => {
    if (presets.includes(unit)) setCustomMode(false);
    else if (unit !== "") setCustomMode(true);
  }, [unit, presets]);
  const selectValue = isPreset
    ? unit
    : customMode || unit !== ""
      ? "__CUSTOM__"
      : "";
  const disabled = !isEditing || isPerformanceMode;
  const readOnlyClass = !isEditing ? savedInputStyle : "";
  const performanceClass = isPerformanceMode
    ? "bg-[var(--secondary)] cursor-not-allowed"
    : "";
  return (
    <div className="flex flex-col gap-1">
      <select
        className={`${inputStyle} w-full h-10 text-center text-xs ${readOnlyClass} ${performanceClass}`}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            setCustomMode(false);
            onChange("");
          } else if (v === "__CUSTOM__") {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(v);
          }
        }}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <option value="">선택</option>
        {GOAL_UNIT_PRESETS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
        <option value="__CUSTOM__">직접입력</option>
      </select>
      {customMode && (
        <input
          type="text"
          className={`${inputStyle} w-full h-9 text-center text-xs ${readOnlyClass} ${performanceClass}`}
          value={unit}
          onChange={(e) => onChange(e.target.value)}
          placeholder="단위입력"
          disabled={disabled}
          aria-label={`${ariaLabel} 직접입력`}
        />
      )}
    </div>
  );
}

  
export default function DashboardPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [orgDictionary, setOrgDictionary] = useState<OrgDictionaryPayload | null>(
    null
  );
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionIsAdmin, setSessionIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("전사");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const lastUserIdRef = useRef<number | null>(null);
  const [activePhase, setActivePhase] = useState<PhaseKey>("목표수립");
  const [activeYear, setActiveYear] = useState<number>(currentYear);
  const [checkCycle, setCheckCycle] = useState<"반기" | "매월">("반기");
  const [selectedHQ, setSelectedHQ] = useState<string>("");
  const [selectedCenter, setSelectedCenter] = useState<string>("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [approvalStatus, setApprovalStatus] = useState<"DRAFT" | "PENDING" | "APPROVED">("DRAFT");
  const [currentGoalId, setCurrentGoalId] = useState<number | null>(null);
  const [currentGoalOwner, setCurrentGoalOwner] = useState<{ name: string; role: string; dept: string } | null>(null);
  const [firstApprover, setFirstApprover] = useState<{ id: number; name: string; email: string } | null>(null);
  const [secondApprover, setSecondApprover] = useState<{ id: number; name: string; email: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<"request" | "approve" | "revoke" | "reject" | "saveGrade" | "approveModification" | "completeCompetencyEval" | "completeInternalSat" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectType, setRejectType] = useState<"goal" | "modification">("goal"); // 거절 유형 (목표 승인 거절 or 목표수정 거절)
  
  // 중간점검/최종점검 관련 상태
  const [isPerformanceMode, setIsPerformanceMode] = useState(false); // 실적 입력 모드
  const [isGoalModificationMode, setIsGoalModificationMode] = useState(false); // 목표 수정 모드
  const [goalModificationReason, setGoalModificationReason] = useState(""); // 목표 수정 사유
  const [isGoalModificationModalOpen, setIsGoalModificationModalOpen] = useState(false); // 목표 수정 사유 모달
  const [modificationStatus, setModificationStatus] = useState<"DRAFT" | "PENDING" | "APPROVED" | "REJECTED">("DRAFT"); // 목표수정 승인 상태
  
  // 목표값/등급 입력 팝업 상태
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingGoalIndex, setEditingGoalIndex] = useState<number | null>(null);
  const [gradeValues, setGradeValues] = useState({
    target: "",
    unit: "",
    detail: "",
    gradeA: "",
    gradeS: "",
    gradeB: "",
    gradeC: "",
    gradeD: "",
    gradeSNum: "",
    gradeSOp: "이상" as GradeOp,
    gradeBNum1: "",
    gradeBOp1: "이상" as GradeOp,
    gradeBNum2: "",
    gradeBOp2: "미만" as GradeOp,
    gradeCNum1: "",
    gradeCOp1: "이상" as GradeOp,
    gradeCNum2: "",
    gradeCOp2: "미만" as GradeOp,
    gradeDNum: "",
    gradeDOp: "미만" as GradeOp,
  });

  // 목표값 및 등급 설정 모달의 "단위 직접입력" UI 상태
  const [gradeUnitCustomMode, setGradeUnitCustomMode] = useState(false);
  const gradeUnitIsPreset = (GRADE_UNIT_PRESETS as readonly string[]).includes(
    gradeValues.unit
  );
  const gradeUnitShouldUseCustom =
    gradeUnitCustomMode || (gradeValues.unit !== "" && !gradeUnitIsPreset);
  
  // 툴팁 hover 상태
  const [hoveredGoalIndex, setHoveredGoalIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  
  // 알림 상태
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  /** 알림 클릭 시 해당 목표를 ID로 직접 로드하기 위한 값 (설정 시 useEffect에서 조회 후 클리어) */
  const [goalIdToLoadFromNotification, setGoalIdToLoadFromNotification] = useState<number | null>(null);
  const goalIdToLoadRef = useRef<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [modalMode, setModalMode] = useState<"confirm" | "alert">("confirm");
  // 최종점검 역량평가 (A~E, 10개 항목)
  const [finalCompetencyGrades, setFinalCompetencyGrades] = useState<Record<string, CompetencyGrade | "">>(() => {
    const initial: Record<string, CompetencyGrade | ""> = {};
    competencyItems.forEach((group) => {
      group.rows.forEach((row) => {
        initial[row.key] = "";
      });
    });
    return initial;
  });
  const [finalCompetencySummary, setFinalCompetencySummary] = useState("");
  /** 일반직원 내부 만족도 조사: 센터장 (key → S/A/B/C/D) */
  const [internalSatCenterGrades, setInternalSatCenterGrades] = useState<Record<string, InternalSatGrade | "">>(() =>
    Object.fromEntries(internalSatCenterItems.map((i) => [i.key, ""]))
  );
  /** 일반직원 내부 만족도 조사: 본부장 */
  const [internalSatHqGrades, setInternalSatHqGrades] = useState<Record<string, InternalSatGrade | "">>(() =>
    Object.fromEntries(internalSatHqItems.map((i) => [i.key, ""]))
  );
  const [savedGoalsByYear, setSavedGoalsByYear] =
    useState<Record<number, Record<TabKey, GoalItem[]>>>(initialYearData);
  const [draftGoalsByYear, setDraftGoalsByYear] =
    useState<Record<number, Record<TabKey, GoalItem[]>>>(initialYearData);
  const [evalGradeRulesMap, setEvalGradeRulesMap] = useState<
    Record<string, string[]>
  >({});
  const [evalStaffPctByDept, setEvalStaffPctByDept] = useState<
    Record<string, Record<string, number>>
  >({});

  useEffect(() => {
    let cancelled = false;
    let skipSessionReady = false;
    (async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });
        if (!meRes.ok) {
          router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
          return;
        }
        const meData = await meRes.json();
        if (!meData.user || cancelled) {
          router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
          return;
        }
        const u = meData.user;
        if (u.mustChangePassword) {
          skipSessionReady = true;
          router.replace(
            `/account/change-password?next=${encodeURIComponent("/dashboard")}`
          );
          return;
        }
        setCurrentUserId(u.id);
        setSessionIsAdmin(
          Boolean(u.isSystemAdmin) ||
            u.role === "PRESIDENT" ||
            u.role === "VICE_PRESIDENT"
        );
        const [dirRes, dictRes] = await Promise.all([
          fetch("/api/staff-directory", { credentials: "include" }),
          fetch("/api/org-dictionary", { credentials: "include" }),
        ]);
        if (!dirRes.ok) {
          router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
          return;
        }
        const dir = await dirRes.json();
        if (!cancelled && Array.isArray(dir.staff)) {
          setStaffList(dir.staff as StaffMember[]);
        }
        if (!cancelled && dictRes.ok) {
          const d = await dictRes.json();
          if (d?.depts && d?.subDepts) {
            setOrgDictionary({
              depts: d.depts,
              subDepts: d.subDepts,
              roles: d.roles ?? [],
              grades: d.grades ?? [],
            });
          }
        }
      } finally {
        if (!cancelled && !skipSessionReady) setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!sessionReady) return;
    let cancelled = false;
    (async () => {
      try {
        const [rulesRes, distRes] = await Promise.all([
          fetch(`/api/evaluation-grade-rules?year=${activeYear}`, {
            credentials: "include",
          }),
          fetch(`/api/evaluation-staff-distribution?year=${activeYear}`, {
            credentials: "include",
          }),
        ]);
        if (rulesRes.ok) {
          const data = await rulesRes.json();
          if (!cancelled && Array.isArray(data.rules)) {
            const m: Record<string, string[]> = {};
            for (const r of data.rules as {
              dept: string;
              targetRole: string;
              grades: string[];
            }[]) {
              m[`${r.dept}|${r.targetRole}`] = r.grades;
            }
            setEvalGradeRulesMap(m);
          }
        }
        if (distRes.ok) {
          const distData = await distRes.json();
          if (!cancelled && Array.isArray(distData.rows)) {
            const pm: Record<string, Record<string, number>> = {};
            for (const row of distData.rows as {
              dept: string;
              percentages: Record<string, number>;
            }[]) {
              pm[row.dept] = {
                ...DEFAULT_STAFF_DISTRIBUTION_PCT,
                ...row.percentages,
              };
            }
            setEvalStaffPctByDept(pm);
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeYear, sessionReady]);

  const currentUser = useMemo((): StaffMember | undefined => {
    if (currentUserId == null) return undefined;
    return staffList.find((member) => member.id === currentUserId);
  }, [staffList, currentUserId]);

  const getSuperior = useCallback(
    (user: StaffMember, list: StaffMember[]): StaffMember | null => {
      if (!user) return null;
      if (user.role === "직원") {
        return (
          list.find((s) => s.subDept === user.subDept && s.role === "센터장") ||
          null
        );
      }
      if (user.role === "센터장") {
        return (
          list.find((s) => s.dept === user.dept && s.role === "본부장") || null
        );
      }
      if (user.role === "본부장") {
        const vicePresident = list.find((s) => s.role === "부원장");
        if (vicePresident) return vicePresident;
        return list.find((s) => s.role === "원장") || null;
      }
      return null;
    },
    []
  );

  const currentSuperior = useMemo(() => {
    if (!currentUser) return null;
    return getSuperior(currentUser, staffList);
  }, [currentUser, staffList, getSuperior]);
  
  // 현재 탭에서 수정 권한 확인
  const canEditCurrentTab = useMemo(() => {
    if (!currentUser) return false;
    
    // 원장/부원장은 전사만 수정 가능
    if (currentUser.role === "원장" || currentUser.role === "부원장") {
      return activeTab === "전사";
    }
    
    // 본부장은 본부만 수정 가능
    if (currentUser.role === "본부장") {
      return activeTab === "본부";
    }
    
    // 센터장은 센터만 수정 가능
    if (currentUser.role === "센터장") {
      return activeTab === "센터";
    }
    
    // 일반직원/직원은 개인만 수정 가능
    if (currentUser.role === "직원" || (currentUser as { role?: string }).role === "일반직원") {
      return activeTab === "개인";
    }
    
    return false;
  }, [currentUser, activeTab]);
  
  // 승인 권한 확인 (상급자가 하급자의 목표를 승인할 수 있는지)
  const canApproveCurrentGoal = useMemo(() => {
    if (!currentUser) return false;
    
    // 목표 소유자 정보가 있을 때 역할 기반으로 판단
    if (currentGoalOwner) {
      // 센터장이 직원 목표 승인
      if (currentUser.role === "센터장" && currentGoalOwner.role === "STAFF") {
        return true;
      }
      
      // 본부장이 센터장 목표 승인
      if (currentUser.role === "본부장" && currentGoalOwner.role === "CENTER_HEAD") {
        return true;
      }
      
      // 부원장이 본부장 목표 승인
      if (currentUser.role === "부원장" && currentGoalOwner.role === "HQ_HEAD") {
        return true;
      }
      
      // 원장이 본부장 목표 2차 승인
      if (currentUser.role === "원장" && currentGoalOwner.role === "HQ_HEAD") {
        return true;
      }
    }
    
    // 목표 소유자 정보가 없을 때는 기존 로직 사용 (선택된 필터 기반)
    // 센터장이 개인(일반직원) 목표를 볼 때
    if (currentUser.role === "센터장" && activeTab === "개인" && selectedEmployee) {
      return true;
    }
    
    // 본부장이 센터 목표를 볼 때
    if (currentUser.role === "본부장" && activeTab === "센터" && selectedCenter) {
      return true;
    }
    
    // 부원장이 본부 목표를 볼 때
    if (currentUser.role === "부원장" && activeTab === "본부" && selectedHQ) {
      return true;
    }
    
    // 원장이 본부 목표를 볼 때 (2차 승인)
    if (currentUser.role === "원장" && activeTab === "본부" && selectedHQ) {
      return true;
    }
    
    return false;
  }, [currentUser, activeTab, selectedEmployee, selectedCenter, selectedHQ, currentGoalOwner]);
  
  // 현재 사용자가 이미 승인했는지 확인
  const hasCurrentUserApproved = useMemo(() => {
    if (currentUserId == null || !currentUser) return false;
    if (firstApprover?.id === currentUserId) return true;
    if (secondApprover?.id === currentUserId) return true;
    if (
      firstApprover?.email &&
      currentUser.email &&
      firstApprover.email === currentUser.email
    )
      return true;
    if (
      secondApprover?.email &&
      currentUser.email &&
      secondApprover.email === currentUser.email
    )
      return true;
    return false;
  }, [firstApprover, secondApprover, currentUser, currentUserId]);
  
  // 본부 목록 추출
  const availableHQs = useMemo(() => {
    if (!currentUser) return [];
    
    // 원장, 부원장은 모든 본부 조회 가능
    if (currentUser.role === "원장" || currentUser.role === "부원장") {
      const allHQs = new Set<string>();
      staffList.forEach((member) => {
        if (member.dept && 
            member.dept !== "기관장" && 
            member.dept !== "공통/기타" && 
            member.role === "본부장") {
          allHQs.add(member.dept);
        }
      });
      const arr = Array.from(allHQs);
      return orgDictionary
        ? sortLabelsByDeptOrder(arr, orgDictionary.depts)
        : arr.sort((a, b) => a.localeCompare(b, "ko"));
    }
    
    // 본부장은 자신의 본부만
    if (currentUser.role === "본부장") {
      return [currentUser.dept];
    }
    
    return [];
  }, [currentUser, staffList, orgDictionary]);
  
  // 본부별 센터 목록 추출
  const availableCenters = useMemo(() => {
    if (!currentUser) return [];
    
    // 원장, 부원장은 모든 센터 조회 가능
    if (currentUser.role === "원장" || currentUser.role === "부원장") {
      const allCenters = new Set<string>();
      
      // selectedHQ가 있으면 해당 본부 산하 센터만, 없으면 모든 센터
      staffList.forEach((member) => {
        if (member.subDept && member.subDept !== "본부직할" && member.subDept !== "원장실" && member.subDept !== "부원장실" && member.subDept !== "휴직") {
          // selectedHQ가 있으면 해당 본부의 센터만 필터링
          if (selectedHQ) {
            if (member.dept === selectedHQ) {
              allCenters.add(member.subDept);
            }
          } else {
            allCenters.add(member.subDept);
          }
        }
      });
      const arr = Array.from(allCenters);
      return orgDictionary
        ? sortLabelsBySubDeptOrder(arr, orgDictionary.subDepts)
        : arr.sort((a, b) => a.localeCompare(b, "ko"));
    }
    
    // 본부장은 자신의 본부 산하 센터만
    if (currentUser.role === "본부장") {
      const centers = new Set<string>();
      staffList.forEach((member) => {
        if (member.dept === currentUser.dept && member.subDept && member.subDept !== "본부직할") {
          centers.add(member.subDept);
        }
      });
      const arr = Array.from(centers);
      return orgDictionary
        ? sortLabelsBySubDeptOrder(arr, orgDictionary.subDepts)
        : arr.sort((a, b) => a.localeCompare(b, "ko"));
    }
    
    // 센터장은 자신의 센터만
    if (currentUser.role === "센터장") {
      return [currentUser.subDept];
    }
    
    // 일반 직원은 자신의 센터만
    if (currentUser.subDept && currentUser.subDept !== "본부직할") {
      return [currentUser.subDept];
    }
    
    return [];
  }, [currentUser, selectedHQ, staffList, orgDictionary]);
  
  // 선택된 센터의 직원 목록 (일반직원이면 본인만, 센터장/본부장 등은 해당 센터 전체)
  const availableEmployees = useMemo(() => {
    if (!selectedCenter) return [];
    const isStaff = currentUser?.role === "직원" || (currentUser as { role?: string })?.role === "일반직원";
    if (isStaff && currentUser?.subDept === selectedCenter && currentUser?.employeeNo) {
      const me = staffList.find((m) => m.employeeNo === currentUser.employeeNo && m.subDept === selectedCenter);
      return me ? [me] : [];
    }
    return staffList.filter((member) => {
      if (member.role === "원장" || member.role === "부원장" || member.role === "본부장" || member.role === "센터장") {
        return false; // 관리자 제외
      }
      return member.subDept === selectedCenter;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedCenter, currentUser?.role, currentUser?.subDept, currentUser?.employeeNo]);
  
  const activeSavedGoals = savedGoalsByYear[activeYear][activeTab];
  const activeDraftGoals = draftGoalsByYear[activeYear][activeTab];
  const isMidCheck = activePhase === "중간점검";
  const isFinalCheck = activePhase === "최종점검";
  const isHqGoalSetup = activePhase === "목표수립" || activePhase === "중간점검" || activePhase === "최종점검"; // 목표수립, 중간점검, 최종점검 모두 동일한 스타일
  const visiblePhaseTabs = phaseTabs;

  // 역량평가 표시: 개인(센터장/본부장→센터원), 센터(본부장/원장/부원장→센터장), 본부(원장/부원장→본부장)
  const canShowCompetencyEval = useMemo(() => {
    if (!isFinalCheck) return false;
    if (activeTab === "개인") {
      return (currentUser?.role === "센터장" || currentUser?.role === "본부장" || currentUser?.role === "부원장") && !!selectedEmployee;
    }
    if (activeTab === "센터") {
      return (currentUser?.role === "본부장" || currentUser?.role === "원장" || currentUser?.role === "부원장") && !!selectedCenter;
    }
    if (activeTab === "본부") {
      return (currentUser?.role === "원장" || currentUser?.role === "부원장") && !!selectedHQ;
    }
    return false;
  }, [isFinalCheck, activeTab, currentUser?.role, selectedEmployee, selectedCenter, selectedHQ]);

  const competencyAllowedGrades = useMemo((): CompetencyGrade[] => {
    if (!canShowCompetencyEval) return competencyPoolAll;
    let dept = "";
    let target: "HQ_HEAD" | "CENTER_HEAD" | "STAFF" | null = null;
    if (activeTab === "개인" && selectedEmployee) {
      const emp =
        availableEmployees.find((e) => e.employeeNo === selectedEmployee) ??
        staffList.find((e) => e.employeeNo === selectedEmployee);
      if (emp) {
        dept = emp.dept;
        if (emp.role === "본부장") target = "HQ_HEAD";
        else if (emp.role === "센터장") target = "CENTER_HEAD";
        else target = "STAFF";
      }
    } else if (activeTab === "센터" && selectedCenter) {
      const head = staffList.find(
        (s) => s.subDept === selectedCenter && s.role === "센터장"
      );
      if (head) {
        dept = head.dept;
        target = "CENTER_HEAD";
      }
    } else if (activeTab === "본부" && selectedHQ) {
      const head = staffList.find(
        (s) => s.dept === selectedHQ && s.role === "본부장"
      );
      dept = head?.dept ?? selectedHQ;
      target = "HQ_HEAD";
    }
    if (!dept || !target) return competencyPoolAll;
    return lookupEvalGradePool(
      evalGradeRulesMap,
      dept,
      target,
      competencyPoolAll
    ) as CompetencyGrade[];
  }, [
    canShowCompetencyEval,
    activeTab,
    selectedEmployee,
    selectedCenter,
    selectedHQ,
    staffList,
    availableEmployees,
    evalGradeRulesMap,
  ]);

  const internalSatAllowedCenter = useMemo((): InternalSatGrade[] => {
    const pool = internalSatGradeOptions;
    if (!currentUser) return pool;
    const head = staffList.find(
      (s) => s.subDept === currentUser.subDept && s.role === "센터장"
    );
    const dept = head?.dept ?? currentUser.dept;
    return lookupEvalGradePool(
      evalGradeRulesMap,
      dept,
      "CENTER_HEAD",
      pool
    ) as InternalSatGrade[];
  }, [currentUser, staffList, evalGradeRulesMap]);

  const internalSatAllowedHq = useMemo((): InternalSatGrade[] => {
    const pool = internalSatGradeOptions;
    if (!currentUser) return pool;
    const head = staffList.find(
      (s) => s.dept === currentUser.dept && s.role === "본부장"
    );
    const dept = head?.dept ?? currentUser.dept;
    return lookupEvalGradePool(
      evalGradeRulesMap,
      dept,
      "HQ_HEAD",
      pool
    ) as InternalSatGrade[];
  }, [currentUser, staffList, evalGradeRulesMap]);

  /** 직원 역량평가 시 본부별 배분율·권장 인원 상한(내림) 안내 */
  const staffCompetencyQuotaHint = useMemo(() => {
    if (!canShowCompetencyEval || activeTab !== "개인" || !selectedEmployee) {
      return null;
    }
    const emp =
      availableEmployees.find((e) => e.employeeNo === selectedEmployee) ??
      staffList.find((e) => e.employeeNo === selectedEmployee);
    if (!emp || emp.role === "본부장" || emp.role === "센터장") return null;
    const dept = emp.dept;
    const pct = {
      ...DEFAULT_STAFF_DISTRIBUTION_PCT,
      ...(evalStaffPctByDept[dept] ?? {}),
    };
    const staffN = staffList.filter((s) => s.dept === dept && s.role === "직원")
      .length;
    const grades = STAFF_DIST_GRADES.map((g) => ({
      grade: g,
      pct: pct[g] ?? 0,
      cap: recommendedHeadcount(staffN, pct[g] ?? 0),
    }));
    return { dept, staffN, grades };
  }, [
    canShowCompetencyEval,
    activeTab,
    selectedEmployee,
    availableEmployees,
    staffList,
    evalStaffPctByDept,
  ]);

  const competencyEvaluateeLabel = useMemo(() => {
    if (activeTab === "개인" && selectedEmployee) {
      const emp = availableEmployees.find((e) => e.employeeNo === selectedEmployee);
      return emp ? `${emp.name} (센터원)` : selectedEmployee;
    }
    if (activeTab === "센터" && selectedCenter) {
      const head = staffList.find((s) => s.subDept === selectedCenter && s.role === "센터장");
      return head ? `${head.name} (센터장)` : `${selectedCenter} 센터장`;
    }
    if (activeTab === "본부" && selectedHQ) {
      const head = staffList.find((s) => s.dept === selectedHQ && s.role === "본부장");
      return head ? `${head.name} (본부장)` : `${selectedHQ} 본부장`;
    }
    return "";
  }, [activeTab, selectedEmployee, selectedCenter, selectedHQ, availableEmployees, staffList]);

  /** 개인 탭 = 일반직원 항목, 센터 탭 = 센터장 항목, 본부 탭 = 본부장 항목 */
  const currentCompetencyItems = useMemo(() => {
    if (activeTab === "본부") return competencyItemsHqManager;
    if (activeTab === "센터") return competencyItemsCenterManager;
    return competencyItems;
  }, [activeTab]);

  const competencyStorageKey = useMemo(() => {
    const ownerKey =
      activeTab === "개인"
        ? (selectedEmployee || currentUser?.employeeNo || "self")
        : activeTab === "센터"
        ? (selectedCenter || "center")
        : activeTab === "본부"
        ? (selectedHQ || "hq")
        : "corp";
    return `kpi:finalCompetency:${activeYear}:${activeTab}:${ownerKey}`;
  }, [activeYear, activeTab, selectedCenter, selectedEmployee, selectedHQ, currentUser?.employeeNo]);
  const competencySummaryStorageKey = useMemo(
    () => `${competencyStorageKey}:summary`,
    [competencyStorageKey]
  );

  // 최종점검 역량평가 로드/저장 (localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(competencyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, CompetencyGrade | "">;
      setFinalCompetencyGrades((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencyStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(competencyStorageKey, JSON.stringify(finalCompetencyGrades));
    } catch {
      // ignore
    }
  }, [competencyStorageKey, finalCompetencyGrades]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(competencySummaryStorageKey);
      if (raw != null) setFinalCompetencySummary(raw);
    } catch {
      // ignore
    }
  }, [competencySummaryStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(competencySummaryStorageKey, finalCompetencySummary);
    } catch {
      // ignore
    }
  }, [competencySummaryStorageKey, finalCompetencySummary]);

  const internalSatUserKey = currentUserId ?? "pending";
  const internalSatCenterStorageKey = useMemo(
    () => `kpi:internalSat:${activeYear}:${internalSatUserKey}:center`,
    [activeYear, internalSatUserKey]
  );
  const internalSatHqStorageKey = useMemo(
    () => `kpi:internalSat:${activeYear}:${internalSatUserKey}:hq`,
    [activeYear, internalSatUserKey]
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(internalSatCenterStorageKey);
      if (raw) setInternalSatCenterGrades((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // ignore
    }
  }, [internalSatCenterStorageKey]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(internalSatCenterStorageKey, JSON.stringify(internalSatCenterGrades));
    } catch {
      // ignore
    }
  }, [internalSatCenterStorageKey, internalSatCenterGrades]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(internalSatHqStorageKey);
      if (raw) setInternalSatHqGrades((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      // ignore
    }
  }, [internalSatHqStorageKey]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(internalSatHqStorageKey, JSON.stringify(internalSatHqGrades));
    } catch {
      // ignore
    }
  }, [internalSatHqStorageKey, internalSatHqGrades]);

  const competencyMissingList = useMemo(() => {
    const missingKeys: string[] = [];
    currentCompetencyItems.forEach((group) => {
      group.rows.forEach((row) => {
        if (!finalCompetencyGrades[row.key]) missingKeys.push(row.key);
      });
    });
    return missingKeys;
  }, [finalCompetencyGrades, currentCompetencyItems]);

  const competencyTotalScore = useMemo(() => {
    let sum = 0;
    currentCompetencyItems.forEach((group) => {
      group.rows.forEach((row) => {
        const grade = finalCompetencyGrades[row.key];
        if (!grade) return;
        sum += competencyScoreByGrade[grade as CompetencyGrade] ?? 0;
      });
    });
    return sum;
  }, [finalCompetencyGrades, currentCompetencyItems]);

  useEffect(() => {
    if (!currentUser) return;
    if (lastUserIdRef.current === currentUser.id) return;
    let nextTab: TabKey = "전사";
    if (currentUser.role === "본부장") {
      nextTab = "본부";
    } else if (currentUser.role === "센터장") {
      nextTab = "센터";
      // 센터장은 자신의 센터 자동 선택
      setSelectedCenter(currentUser.subDept);
    } else if (currentUser.role === "원장" || currentUser.role === "부원장") {
      nextTab = "전사";
      setActivePhase("목표수립");
    } else {
      nextTab = "개인";
      // 일반 직원은 자신의 센터 자동 선택
      if (currentUser.subDept && currentUser.subDept !== "본부직할") {
        setSelectedCenter(currentUser.subDept);
      }
    }
    setActiveTab(nextTab);
    lastUserIdRef.current = currentUser.id;
  }, [currentUser]);

  // DB에서 목표 불러오기
  useEffect(() => {
    const loadGoals = async () => {
      if (!currentUser) return;
      // 알림에서 특정 목표 ID로 로드할 예정이면 목록 API로 덮어쓰지 않음 (ref 사용으로 의존 배열 길이 고정)
      if (goalIdToLoadRef.current != null) return;

      // 센터/직원 전환 시 상태 초기화 (이전 데이터 제거)
      setDraftGoalsByYear((prev) => ({
        ...prev,
        [activeYear]: {
          ...prev[activeYear],
          [activeTab]: [],
        },
      }));
      setSavedGoalsByYear((prev) => ({
        ...prev,
        [activeYear]: {
          ...prev[activeYear],
          [activeTab]: [],
        },
      }));
      setCurrentGoalId(null);
      setApprovalStatus("DRAFT");

      try {
        // 목표 레벨 매핑
        const levelMap: Record<string, string> = {
          "전사": "CORPORATE",
          "본부": "HQ",
          "센터": "CENTER",
          "개인": "PERSONAL",
        };

        const level = levelMap[activeTab];
        if (!level) return;

        let queryParams = `level=${level}&year=${activeYear}`;
        
        // 상급자가 하급자의 목표를 볼 때 필터 추가
        if (activeTab === "센터" && selectedCenter) {
          // 본부장이 특정 센터의 목표를 볼 때
          const centerOwner = staffList.find(
            s => s.subDept === selectedCenter && s.role === "센터장"
          );
          if (centerOwner) {
            queryParams += `&targetName=${encodeURIComponent(centerOwner.name)}`;
          }
        } else if (activeTab === "개인" && selectedEmployee) {
          // 개인 목표 조회 시 API는 owner.name(직원 이름)으로 필터링함. 알림 클릭 직후 availableEmployees가 비어 있을 수 있으므로 본인일 때 currentUser.name 사용
          const emp = availableEmployees.find((e) => e.employeeNo === selectedEmployee);
          const isViewingSelf = currentUser && (selectedEmployee === currentUser.employeeNo || selectedEmployee === currentUser.name);
          const targetNameForApi = emp?.name ?? (isViewingSelf ? currentUser.name : selectedEmployee);
          queryParams += `&targetName=${encodeURIComponent(targetNameForApi)}`;
        } else if (activeTab === "본부" && currentUser.role !== "본부장" && selectedHQ) {
          // 부원장/원장이 특정 본부의 목표를 볼 때
          const hqOwner = staffList.find(
            s => s.dept === selectedHQ && s.role === "본부장"
          );
          if (hqOwner) {
            queryParams += `&targetName=${encodeURIComponent(hqOwner.name)}`;
          }
        }

        const response = await fetch(`/api/goals?${queryParams}`, {
          credentials: "include",
        });

        if (!response.ok) {
          console.error("Failed to load goals");
          return;
        }

        const data = await response.json();
        if (data.goals && data.goals.length > 0) {
          // 가장 최근 목표를 가져옴
          const latestGoal = data.goals[0];
          
          // Goal ID, 상태, 소유자 정보, 승인자 정보 저장
          setCurrentGoalId(latestGoal.id);
          setApprovalStatus(latestGoal.status || "DRAFT");
          setModificationStatus(latestGoal.modificationStatus || "DRAFT");
          setGoalModificationReason(latestGoal.modificationReason || "");
          setFirstApprover(latestGoal.firstApprover || null);
          setSecondApprover(latestGoal.secondApprover || null);
          if (latestGoal.owner) {
            setCurrentGoalOwner({
              name: latestGoal.owner.name,
              role: latestGoal.owner.role,
              dept: latestGoal.owner.dept,
            });
          }
          
          // 메트릭을 GoalItem 형식으로 변환
          const loadedGoals = latestGoal.metrics.map((metric: any, index: number) => {
            // title에서 category 추출 (예: "[재무] 매출성장")
            const categoryMatch = metric.title.match(/^\[(.+?)\]/);
            const category = categoryMatch ? categoryMatch[1] : "재무";
            const title = categoryMatch 
              ? metric.title.replace(/^\[.+?\]\s*/, "") 
              : metric.title;

            return {
              id: `goal-${index + 1}`,
              category: (metric.category || category) as "재무" | "비재무" | "기타",
              title,
              name: (metric.name && metric.name.trim()) ? metric.name : (title || ""),
              detail: metric.detail || "",
              target: metric.targetValue != null ? String(metric.targetValue) : "",
              unit: metric.targetUnit || "",
              weight: metric.weight != null ? String(metric.weight) : "0",
              actual: metric.actualValue != null ? String(metric.actualValue) : "",
              gradeS: metric.gradeS ?? "",
              gradeB: metric.gradeB ?? "",
              gradeC: metric.gradeC ?? "",
              gradeD: metric.gradeD ?? "",
            };
          });

          if (loadedGoals.length > 0) {
            setDraftGoalsByYear((prev) => ({
              ...prev,
              [activeYear]: {
                ...prev[activeYear],
                [activeTab]: loadedGoals,
              },
            }));
            setSavedGoalsByYear((prev) => ({
              ...prev,
              [activeYear]: {
                ...prev[activeYear],
                [activeTab]: loadedGoals,
              },
            }));
          }
        } else {
          // 목표가 없으면 빈 배열로 초기화
          setCurrentGoalId(null);
          setApprovalStatus("DRAFT");
          setDraftGoalsByYear((prev) => ({
            ...prev,
            [activeYear]: {
              ...prev[activeYear],
              [activeTab]: [],
            },
          }));
          setSavedGoalsByYear((prev) => ({
            ...prev,
            [activeYear]: {
              ...prev[activeYear],
              [activeTab]: [],
            },
          }));
        }
      } catch (error) {
        console.error("Error loading goals:", error);
      }
    };

    loadGoals();
  }, [currentUser, activeTab, activeYear, selectedCenter, selectedEmployee, selectedHQ, availableEmployees]);

  // 알림 클릭 후 해당 목표를 ID로 직접 로드 (승인자 화면에서 실적·승인 상태가 정확히 보이도록)
  useEffect(() => {
    if (goalIdToLoadFromNotification == null) return;

    const loadGoalById = async () => {
      try {
        const res = await fetch(
          `/api/goals/${goalIdToLoadFromNotification}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          setGoalIdToLoadFromNotification(null);
          return;
        }
        const data = await res.json();
        const g = data.goal;
        if (!g || !g.metrics) {
          setGoalIdToLoadFromNotification(null);
          return;
        }

        setCurrentGoalId(g.id);
        setApprovalStatus(g.status || "DRAFT");
        setModificationStatus(g.modificationStatus || "DRAFT");
        setGoalModificationReason(g.modificationReason || "");
        setFirstApprover(g.firstApprover || null);
        setSecondApprover(g.secondApprover || null);
        if (g.owner) {
          setCurrentGoalOwner({
            name: g.owner.name,
            role: g.owner.role,
            dept: g.owner.dept,
          });
        }

        const loadedGoals = g.metrics.map((metric: any, index: number) => {
          const categoryMatch = metric.title?.match(/^\[(.+?)\]/);
          const category = categoryMatch ? categoryMatch[1] : "재무";
          const title = categoryMatch
            ? metric.title.replace(/^\[.+?\]\s*/, "")
            : (metric.title || "");
          return {
            id: `goal-${index + 1}`,
            category: (metric.category || category) as "재무" | "비재무" | "기타",
            title,
            name: (metric.name && metric.name.trim()) ? metric.name : (title || ""),
            detail: metric.detail || "",
            target: metric.targetValue != null ? String(metric.targetValue) : "",
            unit: metric.targetUnit || "",
            weight: metric.weight != null ? String(metric.weight) : "0",
            actual: metric.actualValue != null ? String(metric.actualValue) : "",
            gradeS: metric.gradeS ?? "",
            gradeB: metric.gradeB ?? "",
            gradeC: metric.gradeC ?? "",
            gradeD: metric.gradeD ?? "",
          };
        });

        setDraftGoalsByYear((prev) => ({
          ...prev,
          [activeYear]: { ...prev[activeYear], [activeTab]: loadedGoals },
        }));
        setSavedGoalsByYear((prev) => ({
          ...prev,
          [activeYear]: { ...prev[activeYear], [activeTab]: loadedGoals },
        }));
      } catch (e) {
        console.error("Error loading goal by id:", e);
      } finally {
        goalIdToLoadRef.current = null;
        setGoalIdToLoadFromNotification(null);
      }
    };

    loadGoalById();
  }, [goalIdToLoadFromNotification, activeYear, activeTab]);

  // 개인 탭에서 로그인한 직원 본인을 선택된 직원으로 자동 설정
  useEffect(() => {
    if (activeTab !== "개인" || !selectedCenter || selectedEmployee) return;
    const isStaff = currentUser?.role === "직원" || (currentUser as { role?: string })?.role === "일반직원";
    if (isStaff && currentUser?.subDept === selectedCenter && currentUser?.employeeNo) {
      setSelectedEmployee(currentUser.employeeNo);
    }
  }, [activeTab, selectedCenter, selectedEmployee, currentUser]);

  // 알림 가져오기 (5초마다 폴링)
  useEffect(() => {
    const loadNotifications = async () => {
      if (!currentUser) return;
      
      try {
        const response = await fetch("/api/notifications", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Error loading notifications:", error);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 5000); // 5초마다 갱신

    return () => clearInterval(interval);
  }, [currentUser]);

  // 알림 드롭다운 외부 클릭시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isNotificationOpen && !target.closest('.notification-container')) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen]);

  const weightSum = activeDraftGoals.reduce((sum, goal) => {
    const numeric = Number(goal.weight.toString().replace(/[^0-9.]/g, ""));
    if (Number.isNaN(numeric)) return sum;
    return sum + numeric;
  }, 0);
  const needsWeightWarning = activePhase === "목표수립" && weightSum !== 100;

  const dashboardItems = useMemo(
    () =>
      activeSavedGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        target: goal.unit ? `${goal.target}${goal.unit}` : goal.target,
        actual: goal.actual || "-",
        rate: computeRate(goal.target, goal.actual),
      })),
    [activeSavedGoals]
  );

  const updateDraftGoal = (
    index: number,
    field: keyof GoalItem,
    value: string
  ) => {
    setDraftGoalsByYear((prev) => ({
      ...prev,
      [activeYear]: {
        ...prev[activeYear],
        [activeTab]: prev[activeYear][activeTab].map((goal, goalIndex) =>
          goalIndex === index ? { ...goal, [field]: value } : goal
        ),
      },
    }));
  };

  const handleSave = async () => {
    const nextGoals = draftGoalsByYear[activeYear][activeTab].map((goal) => ({
      ...goal,
    }));
    
    // 로컬 상태 업데이트
    setSavedGoalsByYear((prev) => ({
      ...prev,
      [activeYear]: {
        ...prev[activeYear],
        [activeTab]: nextGoals,
      },
    }));
    setIsConfirmed(true);
    setIsEditing(false);
    setIsPerformanceMode(false); // 임시저장 후 실적 입력 모드 해제 → 실적입력 버튼 다시 활성화

    // DB에 저장 (모든 탭)
    if (currentUser && canEditCurrentTab) {
      try {
        // 목표 레벨 매핑
        const levelMap: Record<string, string> = {
          "전사": "CORPORATE",
          "본부": "HQ",
          "센터": "CENTER",
          "개인": "PERSONAL",
        };

        // 기존 목표가 있으면 PUT, 없으면 POST
        const method = currentGoalId ? "PUT" : "POST";
        const url = "/api/goals";
        
        const response = await fetch(url, {
          method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(currentGoalId ? { goalId: currentGoalId } : {}),
            level: levelMap[activeTab] || "HQ",
            year: activeYear,
            metrics: nextGoals.map((goal) => ({
              category: goal.category,
              title: (goal.title && goal.title.trim()) ? goal.title : (goal.name || ""),
              name: goal.name,
              target: goal.target.replace(/,/g, ""), // 쉼표 제거
              unit: goal.unit,
              detail: goal.detail,
              weight: goal.weight,
              actual: (goal.actual != null && String(goal.actual).trim() !== "") ? String(goal.actual).replace(/,/g, "") : undefined,
              gradeS: goal.gradeS ?? "",
              gradeB: goal.gradeB ?? "",
              gradeC: goal.gradeC ?? "",
              gradeD: goal.gradeD ?? "",
            })),
          }),
        });

        if (!response.ok) {
          let errorBody: { error?: string } = {};
          try {
            errorBody = await response.json();
          } catch {
            errorBody = { error: `서버 오류 (${response.status})` };
          }
          console.error("Failed to save goals:", response.status, errorBody);
          setModalMode("alert");
          setModalMessage(`목표 저장에 실패했습니다: ${errorBody.error || `다시 시도해주세요. (${response.status})`}`);
          setIsConfirmOpen(true);
        } else {
          const data = await response.json();
          console.log("✅ API 응답 데이터:", data);
          
          if (data.goal) {
            console.log("✅ Goal ID:", data.goal.id);
            console.log("✅ Goal Status:", data.goal.status);
            
            // 저장된 goal ID, 상태, 소유자 정보, 승인자 정보 업데이트
            setCurrentGoalId(data.goal.id);
            setApprovalStatus(data.goal.status || "DRAFT");
            setFirstApprover(data.goal.firstApprover || null);
            setSecondApprover(data.goal.secondApprover || null);
            if (data.goal.owner) {
              setCurrentGoalOwner({
                name: data.goal.owner.name,
                role: data.goal.owner.role,
                dept: data.goal.owner.dept,
              });
            }
            
            console.log("✅ currentGoalId 설정 완료:", data.goal.id);
            
            // 저장 완료 메시지 표시
            setModalMode("alert");
            setModalMessage(`✅ 목표가 임시저장되었습니다.\n(Goal ID: ${data.goal.id})`);
            setIsConfirmOpen(true);
          } else {
            console.error("❌ data.goal이 없습니다:", data);
            setModalMode("alert");
            setModalMessage("목표 저장 응답이 올바르지 않습니다.");
            setIsConfirmOpen(true);
          }
        }
      } catch (error) {
        console.error("Error saving goals:", error);
        setModalMode("alert");
        setModalMessage("목표 저장 중 오류가 발생했습니다.");
        setIsConfirmOpen(true);
      }
    }
  };

  // 승인 요청
  const handleRequestApproval = async () => {
    if (!currentUser) return;
    
    console.log("🔍 승인요청 시작 - currentGoalId:", currentGoalId);
    console.log("🔍 승인요청 시작 - approvalStatus:", approvalStatus);
    
    if (!currentGoalId) {
      console.error("❌ currentGoalId가 null입니다!");
      setModalMode("alert");
      setModalMessage("먼저 목표를 임시저장해주세요.\n(현재 Goal ID가 설정되지 않았습니다)");
      setIsConfirmOpen(true);
      return;
    }

    try {
      const requestBody =
        isGoalModificationMode && goalModificationReason
          ? {
              modificationType: "GOAL_MODIFICATION",
              modificationReason: goalModificationReason,
            }
          : {};

      const response = await fetch(`/api/goals/${currentGoalId}/request-approval`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "승인 요청에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      if (data.goal) {
        // 상태 즉시 업데이트 - 이것이 화면을 업데이트합니다
        setApprovalStatus("PENDING");
        
        // 완료 후 팝업 표시
        setModalMode("alert");
        const superiorName = currentSuperior ? currentSuperior.name : "상급자";
        const messageType = isGoalModificationMode ? "목표 수정 승인" : "승인";
        setModalMessage(`✅ ${superiorName}님께 ${messageType} 요청이 완료되었습니다.\n승인을 기다리고 있습니다.`);
        setIsConfirmOpen(true);
        
        // 목표수정 모드 초기화
        if (isGoalModificationMode) {
          setIsGoalModificationMode(false);
          setGoalModificationReason("");
        }
      }
    } catch (error) {
      console.error("Error requesting approval:", error);
      setModalMode("alert");
      setModalMessage("승인 요청 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 승인
  const handleApprove = async () => {
    if (!currentGoalId || !currentUser) return;

    try {
      const response = await fetch(`/api/goals/${currentGoalId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "승인에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      console.log("✅ 승인 응답 데이터:", data);
      
      if (data.goal) {
        // 상태 및 승인자 정보 즉시 업데이트
        const newStatus = data.goal.status === "PENDING" ? "PENDING" : "APPROVED";
        console.log("✅ 승인 후 상태:", newStatus);
        console.log("✅ First Approver:", data.goal.firstApprover);
        console.log("✅ Second Approver:", data.goal.secondApprover);
        
        // 상태 업데이트
        setApprovalStatus(newStatus as "DRAFT" | "PENDING" | "APPROVED");
        setFirstApprover(data.goal.firstApprover || null);
        setSecondApprover(data.goal.secondApprover || null);
        
        console.log("✅ State 업데이트 완료");
        console.log("   - approvalStatus:", newStatus);
        console.log("   - firstApprover:", data.goal.firstApprover);
        console.log("   - secondApprover:", data.goal.secondApprover);
        
        // State 업데이트 후 약간의 딜레이를 주고 모달 표시
        setTimeout(() => {
          setModalMode("alert");
          setModalMessage("✅ 승인이 완료되었습니다.");
          setIsConfirmOpen(true);
        }, 100);
      }
    } catch (error) {
      console.error("Error approving goal:", error);
      setModalMode("alert");
      setModalMessage("승인 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 알림 읽음 처리
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notificationId,
        }),
      });

      // 로컬 상태 업데이트
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // 알림 클릭 시 해당 목표 페이지로 이동
  const handleNotificationClick = async (notification: any) => {
    // 읽지 않은 알림이면 읽음 처리
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    // 알림 패널 닫기
    setIsNotificationOpen(false);

    if (!notification.goal) return;

    const goal = notification.goal;
    
    // level에 따라 탭 선택
    const levelToTab: Record<string, TabKey> = {
      CORPORATE: "전사",
      HQ: "본부",
      CENTER: "센터",
      PERSONAL: "개인",
    };
    
    const targetTab = levelToTab[goal.level];
    if (!targetTab) return;

    // 탭 변경
    setActiveTab(targetTab);

    // 승인 요청/목표수정 관련 알림이면 중간점검 탭으로 이동 (목표수립이 아닌 중간점검에서 처리)
    if (notification.type === "APPROVAL_REQUEST" ||
        notification.type === "MODIFICATION_REQUEST" || 
        notification.type === "MODIFICATION_APPROVED" || 
        notification.type === "MODIFICATION_REJECTED") {
      setActivePhase("중간점검");
    }

    // 필터 설정
    if (goal.level === "CENTER" && goal.owner) {
      // 센터 목표 → 센터 선택
      setSelectedCenter(goal.owner.subDept);
    } else if (goal.level === "PERSONAL" && goal.owner) {
      // 개인 목표 → 센터 + 직원 선택 (알림에 subDept 없을 수 있으므로 현재 사용자 센터 유지)
      const nextCenter = goal.owner.subDept || currentUser?.subDept || "";
      setSelectedCenter(nextCenter);
      const personalOwner = staffList.find(
        (s) => s.name === goal.owner.name && (goal.owner.subDept ? s.subDept === goal.owner.subDept : true)
      );
      setSelectedEmployee(personalOwner?.employeeNo ?? goal.owner.name);
    } else if (goal.level === "HQ" && goal.owner) {
      // 본부 목표 → 본부 선택
      setSelectedHQ(goal.owner.dept);
    }

    // 알림의 목표 ID로 직접 로드 (승인자 화면에서 실적/승인 상태가 정확히 반영되도록)
    goalIdToLoadRef.current = goal.id;
    setGoalIdToLoadFromNotification(goal.id);
  };

  // 모든 알림 읽음 처리
  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markAllAsRead: true,
        }),
      });

      // 로컬 상태 업데이트
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // 승인 해제
  const handleRevokeApproval = async () => {
    if (!currentGoalId || !currentUser) return;

    try {
      const response = await fetch(`/api/goals/${currentGoalId}/approve`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "승인 해제에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      if (data.goal) {
        // 상태 즉시 업데이트
        setApprovalStatus("DRAFT");
        
        // 완료 후 팝업 표시
        setModalMode("alert");
        setModalMessage("✅ 승인이 해제되었습니다.");
        setIsConfirmOpen(true);
      }
    } catch (error) {
      console.error("Error revoking approval:", error);
      setModalMode("alert");
      setModalMessage("승인 해제 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 거절
  const handleReject = async () => {
    if (!currentGoalId || !currentUser || !rejectReason.trim()) return;

    try {
      const response = await fetch(`/api/goals/${currentGoalId}/approve`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: rejectReason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "거절 처리에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      if (data.goal) {
        // 상태 즉시 업데이트
        setApprovalStatus("DRAFT");
        setRejectReason("");
        setIsRejectModalOpen(false);
        
        // 완료 후 팝업 표시
        setModalMode("alert");
        setModalMessage("✅ 목표를 거절했습니다.\n거절 사유가 요청자에게 전달되었습니다.");
        setIsConfirmOpen(true);
      }
    } catch (error) {
      console.error("Error rejecting goal:", error);
      setModalMode("alert");
      setModalMessage("거절 처리 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 목표수정 승인 요청
  const handleRequestModification = async () => {
    if (!currentGoalId || !goalModificationReason.trim()) return;

    try {
      const response = await fetch(`/api/goals/${currentGoalId}/request-modification`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modificationReason: goalModificationReason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "목표 수정 승인 요청에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      if (data.goal) {
        setModificationStatus("PENDING");
        setIsGoalModificationModalOpen(false);
        
        setModalMode("alert");
        const superiorName = currentSuperior ? currentSuperior.name : "상급자";
        setModalMessage(`✅ ${superiorName}님께 목표 수정 승인 요청이 완료되었습니다.\n승인을 기다리고 있습니다.`);
        setIsConfirmOpen(true);
      }
    } catch (error) {
      console.error("Error requesting modification:", error);
      setModalMode("alert");
      setModalMessage("목표 수정 승인 요청 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 목표수정 승인
  const handleApproveModification = async () => {
    if (!currentGoalId) return;

    try {
      const response = await fetch(`/api/goals/${currentGoalId}/approve-modification`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "목표 수정 승인에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      if (data.goal) {
        setModificationStatus("APPROVED");
        
        setModalMode("alert");
        setModalMessage("✅ 목표 수정 요청을 승인했습니다.\n요청자가 이제 목표를 수정할 수 있습니다.");
        setIsConfirmOpen(true);
      }
    } catch (error) {
      console.error("Error approving modification:", error);
      setModalMode("alert");
      setModalMessage("목표 수정 승인 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 목표수정 거절
  const handleRejectModification = async (reason: string) => {
    if (!currentGoalId || !reason.trim()) return;

    try {
      const response = await fetch(`/api/goals/${currentGoalId}/approve-modification`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setModalMode("alert");
        setModalMessage(error.error || "목표 수정 거절에 실패했습니다.");
        setIsConfirmOpen(true);
        return;
      }

      const data = await response.json();
      if (data.goal) {
        setModificationStatus("REJECTED");
        
        setModalMode("alert");
        setModalMessage("✅ 목표 수정 요청을 거절했습니다.\n거절 사유가 요청자에게 전달되었습니다.");
        setIsConfirmOpen(true);
      }
    } catch (error) {
      console.error("Error rejecting modification:", error);
      setModalMode("alert");
      setModalMessage("목표 수정 거절 중 오류가 발생했습니다.");
      setIsConfirmOpen(true);
    }
  };

  // 목표수립/중간·최종점검 화면에서는 "목표 항목"이 [카테고리 + 목표명]만 있어 title 입력란이 없음 → title은 비어 있어도 되고, name만 있으면 됨
  const hasMissingFields = () => getMissingFieldsList().length > 0;

  /** 누락된 항목이 있는 행과 필드명 목록을 반환 (메시지 표시용) */
  const getMissingFieldsList = (): { row: number; fields: string[] }[] => {
    const list: { row: number; fields: string[] }[] = [];
    activeDraftGoals.forEach((goal, index) => {
      const hasAnyInput =
        (goal.title && goal.title.trim()) ||
        (goal.name && goal.name.trim()) ||
        (goal.detail && goal.detail.trim()) ||
        (goal.target != null && goal.target.toString().trim()) ||
        (goal.weight != null && goal.weight.toString().trim()) ||
        (goal.unit && goal.unit.trim());
      if (!hasAnyInput) return;

      const fields: string[] = [];
      // 목표 항목: 목표수립/중간·최종점검에서는 목표명(name)만 있으면 됨. 그 외는 title 또는 name 중 하나 이상 필요
      const hasGoalItem = !!(goal.title || "").trim() || !!(goal.name || "").trim();
      if (!hasGoalItem) fields.push(isHqGoalSetup ? "목표명" : "목표 항목");
      if (!(goal.detail || "").trim()) fields.push("상세 내용");
      if (!(goal.target != null ? goal.target.toString() : "").trim()) fields.push("목표값");
      if (!(goal.weight != null ? goal.weight.toString() : "").trim()) fields.push("가중치");
      if (!(goal.unit || "").trim()) fields.push("단위");
      // 중간·최종점검에서는 실적 입력 필수 (목표수정 여부와 무관)
      if ((isMidCheck || isFinalCheck) && !(goal.actual != null ? goal.actual.toString() : "").trim()) {
        fields.push("실적");
      }
      if (fields.length > 0) list.push({ row: index + 1, fields });
    });
    return list;
  };

  const getMissingFieldsMessage = (): string => {
    const missing = getMissingFieldsList();
    if (missing.length === 0) return "";
    const lines = missing.map(({ row, fields }) => `${row}번째 행: ${fields.join(", ")}`);
    return "누락된 항목이 있습니다.\n\n" + lines.join("\n") + "\n\n입력 내용을 확인해주세요.";
  };

  const handleAddGoal = () => {
    setDraftGoalsByYear((prev) => ({
      ...prev,
      [activeYear]: {
        ...prev[activeYear],
        [activeTab]: [
          ...prev[activeYear][activeTab],
          {
            id: `new-${Date.now()}`,
            category: "성과",
            title: "",
            name: "",
            detail: "",
            target: "",
            unit: "",
            weight: "",
            actual: "",
          },
        ],
      },
    }));
  };

  const handleDeleteGoal = (index: number) => {
    setDraftGoalsByYear((prev) => ({
      ...prev,
      [activeYear]: {
        ...prev[activeYear],
        [activeTab]: prev[activeYear][activeTab].filter(
          (_, goalIndex) => goalIndex !== index
        ),
      },
    }));
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans flex items-center justify-center px-6">
        <p className="text-sm font-mono text-[var(--muted-foreground)]">세션 확인 중…</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-center text-[var(--muted-foreground)]">
          로그인 정보를 불러올 수 없습니다. 다시 로그인해 주세요.
        </p>
        <button
          type="button"
          className="rounded-full border border-[var(--border)] px-5 py-2 text-xs font-mono uppercase tracking-[0.2em] hover:bg-[var(--secondary)]"
          onClick={() =>
            router.push(`/login?next=${encodeURIComponent("/dashboard")}`)
          }
        >
          로그인
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-16">
        <header className="flex items-end justify-between gap-4 border-b-2 border-[var(--foreground)] pb-8">
          <div className="space-y-3">
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-[var(--muted-foreground)]">
              KPCQA KPI MANAGEMENT SYSTEM
            </p>
            <div className="flex items-end gap-3">
              <h1 className="text-4xl font-light tracking-tight text-[var(--foreground)]">
                {activePhase}
              </h1>
              {activePhase === "목표수립" && (
                <div className="flex items-center gap-2">
                  {approvalStatus === "PENDING" && (
                    <span className="text-xs font-mono text-[var(--braun-orange)]">
                      [승인요청중]
                    </span>
                  )}
                  {approvalStatus === "APPROVED" && (
                    <span className="text-xs font-mono text-[var(--accent)]">
                      [승인완료]
                    </span>
                  )}
                  {approvalStatus === "DRAFT" && (
                    <span className="text-xs font-mono text-[var(--muted-foreground)]">
                      [임시저장]
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <div className="flex items-center gap-0.5">
              {visiblePhaseTabs.map((phase) => (
                <button
                  key={phase}
                  onClick={() => setActivePhase(phase)}
                  className={`px-3 py-2 text-[12px] font-mono uppercase tracking-[0.15em] transition-all border-b-2 ${
                    activePhase === phase
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]"
                  }`}
                >
                  {phase}
                </button>
              ))}
            </div>
            <div className="h-6 w-px bg-[var(--border)]" />
            <div className="flex items-center gap-2">
              {/* 알림 벨 */}
              <div className="relative notification-container">
                <button
                  className="flex items-center justify-center w-[42px] h-[42px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:bg-[var(--secondary)]"
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[var(--braun-orange)] text-white text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-[var(--background)]">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* 알림 드롭다운 */}
                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-96 border border-[var(--border)] bg-[var(--card)] shadow-lg z-50 max-h-[500px] overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                      <span className="text-sm font-mono font-medium">알림</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[10px] font-mono text-[var(--accent)] hover:underline"
                        >
                          모두 읽음
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto max-h-[450px]">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
                          알림이 없습니다
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-[var(--border)] hover:bg-[var(--secondary)] cursor-pointer transition-colors ${
                              !notification.isRead ? 'bg-[var(--secondary)]/30' : ''
                            }`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="text-sm text-[var(--foreground)]">
                                  {notification.message}
                                </p>
                                {notification.fromUser && (
                                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                    {notification.fromUser.name}
                                  </p>
                                )}
                                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                  {new Date(notification.createdAt).toLocaleString('ko-KR')}
                                </p>
                              </div>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-[var(--braun-orange)] rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {sessionIsAdmin && (
                <button
                  className="flex items-center justify-center w-[42px] h-[42px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--foreground)]"
                  aria-label="통합설정"
                  onClick={() => window.location.assign("/admin")}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      d="M12 3l1.4 2.4 2.7-.2 1.1 2.6 2.6 1.1-.2 2.7L21 12l-2.4 1.4.2 2.7-2.6 1.1-1.1 2.6-2.7-.2L12 21l-1.4-2.4-2.7.2-1.1-2.6-2.6-1.1.2-2.7L3 12l2.4-1.4-.2-2.7 2.6-1.1 1.1-2.6 2.7.2L12 3z"
                    />
                    <circle cx="12" cy="12" r="3.5" />
                  </svg>
                </button>
              )}
              <div className="flex items-center border border-[var(--border)] bg-[var(--card)] h-[42px]">
                <select
                  className="px-3 bg-transparent text-sm font-mono focus:outline-none h-full"
                  value={activeYear}
                  onChange={(event) => setActiveYear(Number(event.target.value))}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="border border-[var(--border)] bg-[var(--card)] px-3 h-[42px] text-[10px] font-mono uppercase tracking-[0.1em] transition-colors hover:bg-[var(--secondary)] flex items-center"
                onClick={async () => {
                  try {
                    await fetch("/api/auth/logout", {
                      method: "POST",
                      credentials: "include",
                    });
                  } catch {
                    // ignore
                  }
                  if (typeof window !== "undefined") {
                    window.localStorage.removeItem("kpiUserEmail");
                    window.localStorage.removeItem("kpiUserEmployeeNo");
                  }
                  router.push(`/login?next=${encodeURIComponent("/dashboard")}`);
                }}
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[var(--accent)]" />
            <span className="text-sm font-mono text-[var(--muted-foreground)]">
              {currentUser.name} / {currentUser.dept} / {currentUser.role}
            </span>
          </div>
          <div className="flex items-stretch gap-4">
            {/* 필터 영역 - 왼쪽 */}
            <div className="flex items-center">
              {/* 본부 선택/표시 (본부 탭일 때만) */}
              {activeTab === "본부" && currentUser && (
                <div className="flex items-center border border-[var(--border)] bg-[var(--card)] h-full">
                  <span className="px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)] border-r border-[var(--border)] whitespace-nowrap">
                    선택된 본부
                  </span>
                  {/* 원장/부원장은 본부 선택 가능 */}
                  {(currentUser.role === "원장" || currentUser.role === "부원장") ? (
                    <select
                      className="px-3 py-2.5 text-sm w-[200px] bg-transparent border-0 focus:outline-none"
                      value={selectedHQ}
                      onChange={(e) => setSelectedHQ(e.target.value)}
                    >
                      <option value="">본부를 선택하세요</option>
                      {availableHQs.map((hq) => (
                        <option key={hq} value={hq}>
                          {hq}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="px-3 py-2.5 text-sm w-[200px]">
                      {currentUser.dept}
                    </span>
                  )}
                </div>
              )}

              {/* 센터 선택/표시 (센터 탭일 때만) */}
              {activeTab === "센터" && (
                <div className="flex items-center border border-[var(--border)] bg-[var(--card)] h-full">
                  <span className="px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)] border-r border-[var(--border)] whitespace-nowrap">
                    선택된 센터
                  </span>
                  {(currentUser?.role === "센터장" || (currentUser?.role === "직원" && currentUser?.subDept && currentUser.subDept !== "본부직할")) ? (
                    <span className="px-3 py-2.5 text-sm w-[200px]">
                      {selectedCenter}
                    </span>
                  ) : (
                    <select
                      className="px-3 py-2.5 bg-transparent text-sm focus:outline-none w-[200px]"
                      value={selectedCenter}
                      onChange={(e) => setSelectedCenter(e.target.value)}
                    >
                      <option value="">선택하세요</option>
                      {availableCenters.map((center) => (
                        <option key={center} value={center}>
                          {center}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* 직원 선택 (개인 탭일 때만, 센터장/본부장 등만 드롭다운 표시 / 일반직원은 본인만 보이므로 드롭다운 숨김) */}
              {activeTab === "개인" && selectedCenter && (currentUser?.role === "센터장" || currentUser?.role === "본부장" || currentUser?.role === "부원장" || currentUser?.role === "원장") && (
                <div className="flex items-center border border-[var(--border)] bg-[var(--card)] h-full">
                  <span className="px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)] border-r border-[var(--border)] whitespace-nowrap">
                    선택된 직원
                  </span>
                  <select
                    className="px-3 py-2.5 bg-transparent text-sm focus:outline-none w-[200px]"
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                  >
                    <option value="">선택하세요</option>
                    {availableEmployees.map((emp) => (
                      <option key={emp.id} value={emp.employeeNo}>
                        {emp.name} ({emp.grade})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 탭 영역 - 오른쪽 */}
            <div className="flex items-center border border-[var(--border)] bg-[var(--card)]">
              {tabs.map((tab, index) => (
                <button
                  key={tab}
                  onClick={() => {
                    if (tab === "본부") {
                      setActiveTab(tab);
                    } else if (tab === "센터") {
                      // 센터장과 일반 직원은 자신의 센터만 자동 선택
                      if (currentUser?.role === "센터장" || (currentUser?.role === "직원" && currentUser?.subDept && currentUser.subDept !== "본부직할")) {
                        setSelectedCenter(currentUser.subDept);
                        setSelectedEmployee("");
                        setActiveTab(tab);
                      } else {
                        // 본부장, 원장, 부원장
                        setSelectedEmployee("");
                        
                        // 본부를 선택했거나 본부장인 경우, 해당 본부의 첫 번째 센터 자동 선택
                        if (selectedHQ || currentUser?.role === "본부장") {
                          const targetHQ = selectedHQ || (currentUser?.role === "본부장" ? currentUser.dept : null);
                          if (targetHQ) {
                            const centersForHQ: string[] = [];
                            staffList.forEach((member) => {
                              if (member.dept === targetHQ && member.subDept && member.subDept !== "본부직할") {
                                if (!centersForHQ.includes(member.subDept)) {
                                  centersForHQ.push(member.subDept);
                                }
                              }
                            });
                            centersForHQ.sort();
                            if (centersForHQ.length > 0 && !centersForHQ.includes(selectedCenter)) {
                              setSelectedCenter(centersForHQ[0]);
                            }
                          }
                        }
                        
                        setActiveTab(tab);
                      }
                    } else if (tab === "개인") {
                      // 센터장이나 일반 직원은 자신의 센터 자동 선택
                      let effectiveCenter = selectedCenter;
                      if (!effectiveCenter && (currentUser?.role === "센터장" || (currentUser?.role === "직원" && currentUser?.subDept && currentUser.subDept !== "본부직할"))) {
                        effectiveCenter = currentUser.subDept;
                        setSelectedCenter(effectiveCenter);
                      }
                      
                      // 개인 탭 클릭 시 센터가 선택되어 있는지 확인
                      if (!effectiveCenter) {
                        setModalMode("alert");
                        setModalMessage("센터를 먼저 선택해주세요.");
                        setIsConfirmOpen(true);
                        return;
                      }
                      // 일반 직원이 개인 탭을 누르면 선택된 직원을 본인으로 설정
                      const isStaff = currentUser?.role === "직원" || (currentUser as { role?: string })?.role === "일반직원";
                      if (isStaff && currentUser?.subDept === effectiveCenter && currentUser?.employeeNo) {
                        setSelectedEmployee(currentUser.employeeNo);
                      }
                      setActiveTab(tab);
                    } else {
                      // 전사 탭 클릭 시
                      setActiveTab(tab);
                    }
                  }}
                  className={`px-6 py-3 text-[11px] font-mono uppercase tracking-[0.15em] transition-all ${
                    index !== tabs.length - 1 ? "border-r border-[var(--border)]" : ""
                  } ${
                    activeTab === tab
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section className="border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-1 h-8 bg-[var(--accent)]" />
              <div>
                <h2 className="text-lg font-light tracking-tight">
                  {activeTab} 정량 목표 대시보드
                  {activeTab === "본부" && (
                    <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                      - {selectedHQ || (currentUser?.role === "본부장" ? currentUser.dept : "")}
                    </span>
                  )}
                  {activeTab === "센터" && selectedCenter && (
                    <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                      - {selectedCenter}
                    </span>
                  )}
                  {activeTab === "개인" && selectedEmployee && (
                    <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                      - {availableEmployees.find(e => e.employeeNo === selectedEmployee)?.name}
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-xs font-mono text-[var(--muted-foreground)]">
                  Performance Achievement Rate
                </p>
              </div>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-[var(--muted-foreground)]">
              TARGET VS ACTUAL
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {dashboardItems.map((item, index) => (
              <div key={item.id} className="px-6 py-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-light text-[var(--muted-foreground)] font-mono w-8">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm font-mono">
                    <span className="text-[var(--muted-foreground)]">
                      <span className="text-[10px] uppercase tracking-wider mr-2">TARGET</span>
                      {item.target}
                    </span>
                    <span className="text-[var(--foreground)]">
                      <span className="text-[10px] uppercase tracking-wider mr-2">ACTUAL</span>
                      {item.actual}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-[var(--secondary)]">
                    <div
                      className="h-3 bg-[var(--chart-2)] transition-all duration-500"
                      style={{ width: `${Math.min(item.rate, 100)}%` }}
                    />
                  </div>
                  <span className="text-lg font-mono font-light w-16 text-right">
                    {item.rate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[var(--border)] bg-[var(--card)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
            <div>
              <h2 className="text-lg font-light tracking-tight">
                {activeTab} 목표 {isMidCheck ? "중간점검" : isFinalCheck ? "최종점검" : "입력/수정"}
                {activeTab === "본부" && (
                  <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                    - {selectedHQ || (currentUser?.role === "본부장" ? currentUser.dept : "")}
                  </span>
                )}
                {activeTab === "센터" && selectedCenter && (
                  <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                    - {selectedCenter}
                  </span>
                )}
                {activeTab === "개인" && selectedEmployee && (
                  <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                    - {availableEmployees.find(e => e.employeeNo === selectedEmployee)?.name}
                  </span>
                )}
              </h2>
              <p className="mt-1 text-xs font-mono text-[var(--muted-foreground)]">
                Goal Configuration
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(isMidCheck || isFinalCheck) && (
                <div className="flex items-center border border-[var(--border)] bg-[var(--card)]">
                  <span className="px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--muted-foreground)] border-r border-[var(--border)] whitespace-nowrap">
                    점검주기
                  </span>
                  <span className="px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] w-[120px] text-center">
                    {checkCycle}
                  </span>
                </div>
              )}
              {/* 목표수립 화면 버튼 */}
              {activePhase === "목표수립" && (
                <>
                  {canEditCurrentTab && (
                    <button
                      onClick={() => {
                        if (!isEditing) {
                          setIsEditing(true);
                        }
                        setIsConfirmed(false);
                        handleAddGoal();
                      }}
                      className="border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px]"
                    >
                      항목 추가
                    </button>
                  )}
                  {canEditCurrentTab && (
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setIsConfirmed(false);
                      }}
                      className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                        isEditing
                          ? "border-[var(--border)]/50 bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed opacity-60"
                          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                      }`}
                      disabled={isEditing}
                    >
                      수정
                    </button>
                  )}
                  {canEditCurrentTab && (
                    <button
                      onClick={() => {
                        if (hasMissingFields()) {
                          setModalMode("alert");
                          setModalMessage(getMissingFieldsMessage());
                          setIsConfirmOpen(true);
                          return;
                        }
                        setModalMode("confirm");
                        setModalMessage(
                          needsWeightWarning
                            ? "가중치 총합이 100%가 아닙니다. 이대로 임시저장하시겠습니까?"
                            : "입력한 내용을 임시저장할까요?"
                        );
                        setIsConfirmOpen(true);
                      }}
                      className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                        !isEditing
                          ? "border-[var(--accent)]/50 bg-[var(--accent)]/50 text-[var(--accent-foreground)] cursor-not-allowed opacity-60"
                          : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
                      }`}
                      disabled={!isEditing}
                    >
                      임시저장
                    </button>
                  )}
                  {canEditCurrentTab && (
                    <button
                      onClick={() => {
                        if (approvalStatus === "DRAFT" && !isEditing && currentGoalId) {
                          setPendingAction("request");
                          setModalMode("confirm");
                          const superiorName = currentSuperior ? currentSuperior.name : "상급자";
                          setModalMessage(`${superiorName}님에게 승인요청하시겠습니까?`);
                          setIsConfirmOpen(true);
                        } else if (isEditing) {
                          setModalMode("alert");
                          setModalMessage("임시저장 후 승인요청이 가능합니다.");
                          setIsConfirmOpen(true);
                        } else if (approvalStatus === "PENDING") {
                          setModalMode("alert");
                          const superiorName = currentSuperior ? currentSuperior.name : "상급자";
                          setModalMessage(`이미 ${superiorName}님께 승인요청 중입니다.`);
                          setIsConfirmOpen(true);
                        } else if (approvalStatus === "APPROVED") {
                          setModalMode("alert");
                          setModalMessage("이미 승인된 목표입니다.");
                          setIsConfirmOpen(true);
                        } else if (!currentGoalId) {
                          setModalMode("alert");
                          setModalMessage("먼저 목표를 임시저장해주세요.");
                          setIsConfirmOpen(true);
                        }
                      }}
                      className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                        approvalStatus === "PENDING"
                          ? "border-[var(--foreground)]/30 bg-[var(--foreground)]/30 text-[var(--background)]/50 cursor-not-allowed"
                          : approvalStatus === "APPROVED"
                          ? "border-[var(--border)]/30 bg-[var(--secondary)]/50 text-[var(--muted-foreground)] cursor-not-allowed opacity-50"
                          : isEditing || !currentGoalId
                          ? "border-[var(--border)]/50 bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed opacity-60"
                          : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                      }`}
                      disabled={isEditing || approvalStatus !== "DRAFT" || !currentGoalId}
                    >
                      {approvalStatus === "PENDING" ? "승인요청중" : approvalStatus === "APPROVED" ? "승인완료됨" : "승인요청"}
                    </button>
                  )}
                </>
              )}
              
              {/* 중간점검/최종점검 화면 버튼 (최종점검에서는 목표수정 불가, 실적입력·승인요청만) */}
              {(isMidCheck || isFinalCheck) && canEditCurrentTab && (
                <>
                  {isMidCheck && (
                    <button
                      onClick={() => {
                        if (modificationStatus === "DRAFT" || modificationStatus === "REJECTED") {
                          setIsGoalModificationModalOpen(true);
                        } else if (modificationStatus === "APPROVED") {
                          setIsGoalModificationMode(true);
                          setIsEditing(true);
                          setModalMode("alert");
                          setModalMessage("목표 수정이 승인되었습니다.\n목표를 수정한 후 임시저장하고 승인요청하세요.");
                          setIsConfirmOpen(true);
                        }
                      }}
                      className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                        modificationStatus === "PENDING"
                          ? "border-[var(--border)]/50 bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed opacity-60"
                          : modificationStatus === "APPROVED"
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
                          : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                      }`}
                      disabled={modificationStatus === "PENDING"}
                    >
                      {modificationStatus === "PENDING" ? "목표수정 승인대기중" : modificationStatus === "APPROVED" ? "목표수정 (승인됨)" : "목표수정"}
                    </button>
                  )}
                  {/* 실적입력: 목표수정 없이도 클릭 가능. 목표수정 후 실적입력까지 하면 승인요청 가능 */}
                  <button
                    onClick={() => {
                      setIsPerformanceMode(true);
                      setIsEditing(true);
                    }}
                    className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                      isPerformanceMode
                        ? "border-[var(--border)]/50 bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed opacity-60"
                        : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                    }`}
                    disabled={isPerformanceMode}
                  >
                    실적입력
                  </button>
                  <button
                    onClick={() => {
                      if (hasMissingFields()) {
                        setModalMode("alert");
                        setModalMessage(getMissingFieldsMessage());
                        setIsConfirmOpen(true);
                        return;
                      }
                      setModalMode("confirm");
                      setModalMessage("입력한 내용을 임시저장할까요?");
                      setIsConfirmOpen(true);
                    }}
                    className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                      !isEditing
                        ? "border-[var(--accent)]/50 bg-[var(--accent)]/50 text-[var(--accent-foreground)] cursor-not-allowed opacity-60"
                        : "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90"
                    }`}
                    disabled={!isEditing}
                  >
                    임시저장
                  </button>
                  <button
                    onClick={() => {
                      if (approvalStatus === "DRAFT" && !isEditing && currentGoalId) {
                        setPendingAction("request");
                        setModalMode("confirm");
                        const superiorName = currentSuperior ? currentSuperior.name : "상급자";
                        const requestType = isGoalModificationMode ? "목표 수정 승인요청" : "승인요청";
                        const roleDesc = currentUser?.role === "일반직원" ? "센터장" : 
                                        currentUser?.role === "센터장" ? "본부장" :
                                        currentUser?.role === "본부장" ? "부원장" : "상급자";
                        setModalMessage(`${superiorName} ${roleDesc}님에게 ${requestType}하시겠습니까?${isGoalModificationMode ? `\n\n수정 사유: ${goalModificationReason}` : ""}`);
                        setIsConfirmOpen(true);
                      } else if (isEditing) {
                        setModalMode("alert");
                        setModalMessage("임시저장 후 승인요청이 가능합니다.");
                        setIsConfirmOpen(true);
                      } else if (!currentGoalId) {
                        setModalMode("alert");
                        setModalMessage("먼저 목표를 임시저장해주세요.");
                        setIsConfirmOpen(true);
                      }
                    }}
                    className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                      approvalStatus === "PENDING"
                        ? "border-[var(--foreground)]/30 bg-[var(--foreground)]/30 text-[var(--background)]/50 cursor-not-allowed"
                        : isEditing || !currentGoalId
                        ? "border-[var(--border)]/50 bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed opacity-60"
                        : "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                    }`}
                    disabled={isEditing || approvalStatus !== "DRAFT" || !currentGoalId}
                  >
                    {approvalStatus === "PENDING" ? (isGoalModificationMode ? "수정승인요청중" : "승인요청중") : (isGoalModificationMode ? "수정승인요청" : "승인요청")}
                  </button>
                </>
              )}
              
              {/* 상급자 승인/거절/해제 버튼 */}
              {canApproveCurrentGoal && approvalStatus !== "DRAFT" && (
                <>
                  <button
                    onClick={() => {
                      if (approvalStatus === "PENDING" && !hasCurrentUserApproved) {
                        setPendingAction("approve");
                        setModalMode("confirm");
                        setModalMessage("이 목표를 승인하시겠습니까?");
                        setIsConfirmOpen(true);
                      }
                    }}
                    className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                      approvalStatus === "APPROVED" || hasCurrentUserApproved
                        ? "border-[var(--border)]/50 bg-[var(--secondary)] text-[var(--muted-foreground)] cursor-not-allowed opacity-60"
                        : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                    }`}
                    disabled={approvalStatus === "APPROVED" || hasCurrentUserApproved}
                  >
                    {approvalStatus === "APPROVED" || hasCurrentUserApproved ? "승인완료" : "승인"}
                  </button>
                  <button
                    onClick={() => {
                      if (approvalStatus === "PENDING" && !hasCurrentUserApproved) {
                        setRejectType("goal");
                        setIsRejectModalOpen(true);
                      } else if (approvalStatus === "APPROVED" || hasCurrentUserApproved) {
                        setPendingAction("revoke");
                        setModalMode("confirm");
                        setModalMessage("승인을 해제하시겠습니까?");
                        setIsConfirmOpen(true);
                      }
                    }}
                    className={`border px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[100px] ${
                      approvalStatus === "APPROVED" || hasCurrentUserApproved
                        ? "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                        : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)]"
                    }`}
                  >
                    {approvalStatus === "APPROVED" || hasCurrentUserApproved ? "승인해제" : "거절"}
                  </button>
                </>
              )}
              
              {/* 상급자 목표수정 승인/거절 버튼 (중간점검에서만) */}
              {canApproveCurrentGoal && modificationStatus === "PENDING" && isMidCheck && (
                <>
                  <button
                    onClick={() => {
                      setModalMode("confirm");
                      setModalMessage(`목표 수정 요청을 승인하시겠습니까?\n\n수정 사유: ${goalModificationReason}`);
                      setPendingAction("approveModification");
                      setIsConfirmOpen(true);
                    }}
                    className="border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[120px] hover:opacity-90"
                  >
                    수정승인
                  </button>
                  <button
                    onClick={() => {
                      setRejectType("modification");
                      setIsRejectModalOpen(true);
                    }}
                    className="border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] transition-colors min-w-[120px]"
                  >
                    수정거절
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 px-6 pb-6">
            <div className="border border-[var(--border)] bg-white/70 overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-[var(--background)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[200px]">
                      목표 항목
                    </th>
                    <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[300px]">
                      상세 내용
                    </th>
                    <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[110px]">
                      목표값
                    </th>
                    <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[100px]">
                      단위
                    </th>
                    <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[100px]">
                      가중치
                    </th>
                    {(isMidCheck || isFinalCheck) && (
                      <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[100px]">
                        실적
                      </th>
                    )}
                    {!isMidCheck && !isFinalCheck && (
                      <th className="px-3 py-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center whitespace-nowrap font-medium min-w-[80px]">
                        삭제
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeDraftGoals.map((goal, index) => (
                    <tr key={goal.id} className="border-b border-[var(--border)] hover:bg-[var(--secondary)]/30 transition-colors">
                      {/* 목표 항목 */}
                      <td className="px-1 py-2 align-middle">
                        <div className="px-2 flex items-center gap-1">
                          {isHqGoalSetup ? (
                            <>
                              <select
                                className={`${inputStyle} w-24 h-10 text-center text-xs ${
                                  !isEditing ? savedInputStyle : ""
                                } ${isPerformanceMode ? "bg-[var(--secondary)] cursor-not-allowed" : ""}`}
                                value={goal.category}
                                onChange={(event) =>
                                  updateDraftGoal(
                                    index,
                                    "category",
                                    event.target.value as GoalItem["category"]
                                  )
                                }
                                aria-label={`${goal.title} 구분`}
                                disabled={!isEditing || isPerformanceMode}
                              >
                                <option value="재무">재무</option>
                                <option value="비재무">비재무</option>
                                <option value="기타">기타</option>
                              </select>
                              <input
                                className={`${inputStyle} w-32 h-10 text-xs ${
                                  !isEditing ? savedInputStyle : ""
                                } ${isPerformanceMode ? "bg-[var(--secondary)] cursor-not-allowed" : ""}`}
                                value={goal.name}
                                onChange={(event) =>
                                  updateDraftGoal(index, "name", event.target.value)
                                }
                                aria-label={`${goal.title} 목표명`}
                                disabled={!isEditing || isPerformanceMode}
                                placeholder="목표명"
                              />
                            </>
                          ) : (
                            <>
                              <input
                                className={`${inputStyle} w-20 h-10 text-xs ${!isEditing ? savedInputStyle : ""} ${isPerformanceMode ? "bg-[var(--secondary)] cursor-not-allowed" : ""}`}
                                value={goal.title}
                                onChange={(event) =>
                                  updateDraftGoal(index, "title", event.target.value)
                                }
                                aria-label={`${goal.title} 목표 항목`}
                                disabled={!isEditing || isPerformanceMode}
                                placeholder="항목"
                              />
                              <input
                                className={`${inputStyle} w-32 h-10 text-xs ${
                                  !isEditing ? savedInputStyle : ""
                                } ${isPerformanceMode ? "bg-[var(--secondary)] cursor-not-allowed" : ""}`}
                                value={goal.name}
                                onChange={(event) =>
                                  updateDraftGoal(index, "name", event.target.value)
                                }
                                aria-label={`${goal.title} 목표명`}
                                disabled={!isEditing || isPerformanceMode}
                                placeholder="목표명"
                              />
                            </>
                          )}
                        </div>
                      </td>
                      
                      {/* 상세 내용 */}
                      <td className="px-1 py-2 align-middle">
                        <div className="px-2">
                          <input
                            type="text"
                            className={`${inputStyle} w-full h-10 text-left text-xs overflow-x-auto whitespace-nowrap ${
                              !isEditing ? savedInputStyle : ""
                            } ${isPerformanceMode ? "bg-[var(--secondary)] cursor-not-allowed" : ""}`}
                            value={goal.detail}
                            onChange={(event) =>
                              updateDraftGoal(index, "detail", event.target.value)
                            }
                            aria-label={`${goal.title} 상세 내용`}
                            disabled={!isEditing || isPerformanceMode}
                            placeholder="상세 내용 입력"
                          />
                        </div>
                      </td>
                      
                      {/* 목표값 */}
                      <td className="px-1 py-2 align-middle relative">
                        <div
                          className="relative px-2 cursor-pointer hover:bg-[var(--secondary)]/20 rounded transition-colors"
                          onMouseEnter={(event) => {
                            setHoveredGoalIndex(index);
                            setTooltipPosition({ x: event.clientX + 12, y: event.clientY + 12 });
                          }}
                          onMouseMove={(event) => {
                            // 마우스를 움직일 때마다 툴팁 위치를 함께 이동
                            if (hoveredGoalIndex === index) {
                              setTooltipPosition({ x: event.clientX + 12, y: event.clientY + 12 });
                            }
                          }}
                          onMouseLeave={() => {
                            setHoveredGoalIndex(null);
                            setTooltipPosition(null);
                          }}
                          onClick={() => {
                            const targetStr = goal.target.replace(/,/g, "");
                            const s = parseSingleGrade(goal.gradeS || "");
                            const b = parseRangeGrade(goal.gradeB || "");
                            const c = parseRangeGrade(goal.gradeC || "");
                            const d = parseSingleGrade(goal.gradeD || "");
                            setEditingGoalIndex(index);
                            setGradeValues({
                              target: targetStr,
                              unit: goal.unit || "",
                              detail: goal.detail || "",
                              gradeA: targetStr,
                              gradeS: goal.gradeS || "",
                              gradeB: goal.gradeB || "",
                              gradeC: goal.gradeC || "",
                              gradeD: goal.gradeD || "",
                              gradeSNum: s.num,
                              gradeSOp: s.num ? s.op : "이상",
                              gradeBNum1: b.num1,
                              gradeBOp1: b.op1,
                              gradeBNum2: b.num2,
                              gradeBOp2: b.op2,
                              gradeCNum1: c.num1,
                              gradeCOp1: c.op1,
                              gradeCNum2: c.num2,
                              gradeCOp2: c.op2,
                              gradeDNum: d.num,
                              gradeDOp: d.num ? d.op : "미만",
                            });
                            setIsGradeModalOpen(true);
                          }}
                          title="클릭하여 등급 기준 확인"
                        >
                          <input
                            className={`${inputStyle} w-full h-10 text-right text-xs pointer-events-none ${
                              !isEditing ? savedInputStyle : ""
                            } ${isPerformanceMode ? "bg-[var(--secondary)]" : ""}`}
                            type="text"
                            value={goal.target}
                            readOnly
                            tabIndex={-1}
                            aria-label={`${goal.title} 목표값`}
                          />
                          {(goal.target || goal.gradeS || goal.gradeB || goal.gradeC || goal.gradeD) && (
                            <div
                              className="absolute top-0 right-0 w-2 h-2 bg-purple-500 rounded-full pointer-events-none"
                              title="등급 설정됨"
                            ></div>
                          )}
                        </div>
                      </td>
                      
                      {/* 단위 */}
                      <td className="px-1 py-2 align-middle">
                        <div className="px-2">
                          <GoalUnitSelect
                            key={goal.id}
                            unit={goal.unit}
                            onChange={(v) => updateDraftGoal(index, "unit", v)}
                            isEditing={isEditing}
                            isPerformanceMode={isPerformanceMode}
                            ariaLabel={`${goal.title} 단위`}
                          />
                        </div>
                      </td>
                      
                      {/* 가중치 */}
                      <td className="px-1 py-2 align-middle">
                        <div className="px-2 flex items-center justify-center gap-1">
                          <input
                            className={`${inputStyle} w-16 h-10 text-center text-xs ${
                              !isEditing ? savedInputStyle : ""
                            } ${isPerformanceMode ? "bg-[var(--secondary)] cursor-not-allowed" : ""}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max="100"
                            value={goal.weight}
                            onChange={(event) =>
                              updateDraftGoal(index, "weight", event.target.value)
                            }
                            aria-label={`${goal.title} 가중치`}
                            disabled={!isEditing || isPerformanceMode}
                          />
                          <span className="text-xs text-[var(--muted)]">%</span>
                        </div>
                      </td>
                      
                      {/* 실적 (중간점검/최종점검만) */}
                      {(isMidCheck || isFinalCheck) && (
                        <td className="px-1 py-2 align-middle">
                          <div className="px-2">
                            <input
                              className={`${inputStyle} w-full h-10 text-center text-xs ${
                                !isEditing || !isPerformanceMode ? savedInputStyle : ""
                              }`}
                              value={goal.actual}
                              onChange={(event) =>
                                updateDraftGoal(index, "actual", event.target.value)
                              }
                              aria-label={`${goal.title} 실적`}
                              disabled={!isEditing || !isPerformanceMode}
                            />
                          </div>
                        </td>
                      )}
                      
                      {/* 삭제 (목표수립만) */}
                      {!isMidCheck && !isFinalCheck && (
                        <td className="px-1 py-2 align-middle text-center">
                          <div className="px-2">
                            <button
                              className="w-14 h-10 rounded-full border border-black/20 px-3 text-xs uppercase tracking-[0.25em] text-[var(--muted)] transition hover:border-black/40 disabled:opacity-60 flex items-center justify-center mx-auto"
                              onClick={() => handleDeleteGoal(index)}
                              disabled={!isEditing || !canEditCurrentTab}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 최종점검 - 역량평가 (개인: 센터장/본부장→센터원, 센터: 본부장/원장/부원장→센터장, 본부: 원장/부원장→본부장) */}
            {canShowCompetencyEval && (
              <div className="mt-6 border border-[var(--border)] bg-white/70">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
                  <div>
                    <h3 className="text-base font-medium">역량평가</h3>
                    {competencyEvaluateeLabel && (
                      <p className="mt-1 text-xs font-medium text-[var(--foreground)]">
                        평가 대상: {competencyEvaluateeLabel}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs font-mono text-[var(--muted-foreground)]">
                      핵심역량 · 리더십역량 · 직무역량 (총 10개 항목) / 등급 A~E 선택
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className={`rounded-full px-3 py-1 border ${
                      competencyMissingList.length > 0 ? "border-[var(--braun-orange)] text-[var(--braun-orange)]" : "border-[var(--accent)] text-[var(--accent)]"
                    }`}>
                      {competencyMissingList.length > 0 ? `미입력 ${competencyMissingList.length}개` : "모두 입력 완료"}
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-3 py-1 text-[var(--foreground)]">
                      환산 점수 합계: {competencyTotalScore} / 100
                    </span>
                    <button
                      type="button"
                      className="rounded-full border border-black/20 px-3 py-1 text-xs uppercase tracking-[0.25em] transition hover:border-black/40"
                      onClick={() => {
                        setFinalCompetencyGrades((prev) => {
                          const next = { ...prev };
                          currentCompetencyItems.forEach((g) => g.rows.forEach((r) => (next[r.key] = "")));
                          return next;
                        });
                        setModalMode("alert");
                        setModalMessage("역량평가 입력이 초기화되었습니다.");
                        setIsConfirmOpen(true);
                      }}
                    >
                      초기화
                    </button>
                  </div>
                </div>

                <div className="px-6 py-4">
                  {staffCompetencyQuotaHint && (
                    <div className="mb-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-4 py-3 text-xs">
                      <p className="font-medium text-[var(--foreground)]">
                        직원 등급 배분 기준 — {staffCompetencyQuotaHint.dept} (정규직{" "}
                        {staffCompetencyQuotaHint.staffN}명, {activeYear}년 DB 설정)
                      </p>
                      <p className="mt-1 text-[var(--muted-foreground)]">
                        등급별 배분율에 따른 권장 부여 상한(소수점 이하 버림)입니다. 실제
                        확정·집계는 조직 절차 및 향후 시스템 연동 범위에 따릅니다.
                      </p>
                      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 font-mono text-[11px]">
                        {staffCompetencyQuotaHint.grades.map(({ grade, pct, cap }) => (
                          <li key={grade}>
                            <span className="font-semibold">{grade}</span> {pct}% → 약{" "}
                            {cap}명
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <details className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
                    <summary className="cursor-pointer text-xs font-mono uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
                      등급 기준표 보기 (A~E)
                    </summary>
                    <div className="mt-3 grid gap-2 text-sm">
                      {competencyAllowedGrades.map((grade) => (
                        <div key={grade} className="flex gap-3">
                          <span className="w-6 shrink-0 font-mono font-semibold">{grade}</span>
                          <span className="text-[var(--muted-foreground)]">{competencyGradeRubric[grade]}</span>
                        </div>
                      ))}
                    </div>
                  </details>

                  {currentCompetencyItems.map((group) => (
                    <div key={group.group} className="mb-6 last:mb-0">
                      <div className="mb-2 text-xs font-mono uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
                        {group.group}
                      </div>
                      <div className="overflow-x-auto border border-[var(--border)]">
                        <table className="w-full min-w-[900px]">
                          <thead className="bg-[var(--background)]">
                            <tr className="border-b border-[var(--border)]">
                              <th className="px-3 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-left font-medium min-w-[140px]">
                                평가 항목
                              </th>
                              <th className="px-3 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-left font-medium min-w-[520px]">
                                행동지표
                              </th>
                              <th className="px-3 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center font-medium min-w-[80px]">
                                배점
                              </th>
                              <th className="px-3 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center font-medium min-w-[120px]">
                                등급 (A~E)
                              </th>
                              <th className="px-3 py-2 text-xs uppercase tracking-[0.25em] text-[var(--muted)] text-center font-medium min-w-[120px]">
                                점수환산
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((row) => {
                              const grade = finalCompetencyGrades[row.key];
                              const isMissing = !grade;
                              const converted = grade ? competencyScoreByGrade[grade as CompetencyGrade] : 0;
                              return (
                                <tr key={row.key} className="border-b border-[var(--border)] last:border-b-0">
                                  <td className="px-3 py-3 align-top text-sm font-medium">
                                    {row.label}
                                  </td>
                                  <td className="px-3 py-3 align-top text-sm text-[var(--muted-foreground)]">
                                    {row.indicator}
                                  </td>
                                  <td className="px-3 py-3 align-top text-center text-sm font-mono">
                                    10
                                  </td>
                                  <td className="px-3 py-3 align-top text-center">
                                    <select
                                      className={`h-10 w-24 rounded-xl border px-2 text-sm focus:outline-none ${
                                        isMissing ? "border-[var(--braun-orange)] bg-[#fff7ed]" : "border-[var(--border)] bg-white"
                                      }`}
                                      value={grade}
                                      onChange={(e) =>
                                        setFinalCompetencyGrades((prev) => ({
                                          ...prev,
                                          [row.key]: (e.target.value as CompetencyGrade | ""),
                                        }))
                                      }
                                    >
                                      <option value="">선택</option>
                                      {competencyAllowedGrades.map((g) => (
                                        <option key={g} value={g}>
                                          {g}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-3 py-3 align-top text-center text-sm font-mono">
                                    {converted}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-mono uppercase tracking-[0.25em] text-[var(--muted-foreground)]">
                        종합의견
                      </label>
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                        {finalCompetencySummary.length}자
                      </span>
                    </div>
                    <textarea
                      className="mt-3 h-28 w-full rounded-xl border border-[#cfcfcf] bg-white px-3 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[var(--accent)]"
                      value={finalCompetencySummary}
                      onChange={(e) => setFinalCompetencySummary(e.target.value)}
                      placeholder="평가자 종합의견을 입력하세요."
                    />
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        className="h-11 min-w-[120px] rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-xs font-mono uppercase tracking-[0.2em] text-[var(--foreground)] transition hover:bg-[var(--secondary)]"
                        onClick={() => {
                          setModalMode("alert");
                          setModalMessage("저장되었습니다.");
                          setIsConfirmOpen(true);
                        }}
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        disabled={competencyMissingList.length > 0 || !finalCompetencySummary.trim()}
                        className="h-11 min-w-[120px] rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-mono uppercase tracking-[0.2em] text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
                        onClick={() => {
                          if (competencyMissingList.length > 0 || !finalCompetencySummary.trim()) return;
                          setPendingAction("completeCompetencyEval");
                          setModalMode("confirm");
                          setModalMessage("평가를 완료하시겠습니까?");
                          setIsConfirmOpen(true);
                        }}
                      >
                        평가완료
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 최종점검 - 일반직원 내부 만족도 조사 (센터장·본부장) */}
            {isFinalCheck && (currentUser?.role === "직원" || (currentUser as { role?: string })?.role === "일반직원") && (
              <div className="mt-6 border border-[var(--border)] bg-white/70">
                <div className="border-b border-[var(--border)] px-6 py-4">
                  <h3 className="text-base font-medium">내부 만족도 조사</h3>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    센터장·본부장에 대한 내부고객만족도 평가 (S/A/B/C/D 등급, 환산점수 합계 100)
                  </p>
                </div>
                <div className="px-6 py-4 space-y-8">
                  {/* 센터장 내부 만족도 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">센터장 내부고객만족도</h4>
                    <div className="overflow-x-auto border border-[var(--border)]">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-[var(--background)]">
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">①구분</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">②평가척도 착안점</th>
                            <th className="px-3 py-2 text-center font-medium text-[var(--muted)] w-16">③배점</th>
                            <th className="px-3 py-2 text-center font-medium text-[var(--muted)] w-24">④평가등급</th>
                            <th className="px-3 py-2 text-center font-medium text-[var(--muted)] w-20">환산점수</th>
                          </tr>
                        </thead>
                        <tbody>
                          {internalSatCenterItems.map((item) => {
                            const grade = internalSatCenterGrades[item.key];
                            const converted = grade ? Math.round(item.maxPoints * internalSatRatio[grade]) : 0;
                            return (
                              <tr key={item.key} className="border-b border-[var(--border)]">
                                <td className="px-3 py-2 font-medium">{item.label}</td>
                                <td className="px-3 py-2 text-[var(--muted-foreground)]">
                                  <details className="text-xs">
                                    <summary className="cursor-pointer">등급별 기준 보기</summary>
                                    <ul className="mt-1 space-y-0.5 list-none">
                                      {(Object.keys(item.criteria) as InternalSatGrade[]).map((g) => (
                                        <li key={g}><span className="font-mono">{g}:</span> {item.criteria[g]}</li>
                                      ))}
                                    </ul>
                                  </details>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{item.maxPoints}</td>
                                <td className="px-3 py-2 text-center">
                                  <select
                                    className="h-9 w-20 rounded border border-[var(--border)] bg-white px-1 text-center text-xs"
                                    value={grade}
                                    onChange={(e) => setInternalSatCenterGrades((prev) => ({ ...prev, [item.key]: (e.target.value as InternalSatGrade) || "" }))}
                                  >
                                    <option value="">선택</option>
                                    {internalSatAllowedCenter.map((g) => (
                                      <option key={g} value={g}>
                                        {g}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{converted}</td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 border-[var(--border)] bg-[var(--background)] font-medium">
                            <td colSpan={2} className="px-3 py-2 text-right">⑤합계</td>
                            <td className="px-3 py-2 text-center font-mono">100</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-center font-mono">
                              {internalSatCenterItems.reduce((sum, item) => {
                                const g = internalSatCenterGrades[item.key];
                                if (!g) return sum;
                                return sum + Math.round(item.maxPoints * internalSatRatio[g]);
                              }, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {/* 본부장 내부 만족도 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">본부장 내부고객만족도</h4>
                    <div className="overflow-x-auto border border-[var(--border)]">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-[var(--background)]">
                          <tr className="border-b border-[var(--border)]">
                            <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">①구분</th>
                            <th className="px-3 py-2 text-left font-medium text-[var(--muted)]">②평가척도 착안점</th>
                            <th className="px-3 py-2 text-center font-medium text-[var(--muted)] w-16">③배점</th>
                            <th className="px-3 py-2 text-center font-medium text-[var(--muted)] w-24">④평가등급</th>
                            <th className="px-3 py-2 text-center font-medium text-[var(--muted)] w-20">환산점수</th>
                          </tr>
                        </thead>
                        <tbody>
                          {internalSatHqItems.map((item) => {
                            const grade = internalSatHqGrades[item.key];
                            const converted = grade ? Math.round(item.maxPoints * internalSatRatio[grade]) : 0;
                            return (
                              <tr key={item.key} className="border-b border-[var(--border)]">
                                <td className="px-3 py-2 font-medium">{item.label}</td>
                                <td className="px-3 py-2 text-[var(--muted-foreground)]">
                                  <details className="text-xs">
                                    <summary className="cursor-pointer">등급별 기준 보기</summary>
                                    <ul className="mt-1 space-y-0.5 list-none">
                                      {(Object.keys(item.criteria) as InternalSatGrade[]).map((g) => (
                                        <li key={g}><span className="font-mono">{g}:</span> {item.criteria[g]}</li>
                                      ))}
                                    </ul>
                                  </details>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{item.maxPoints}</td>
                                <td className="px-3 py-2 text-center">
                                  <select
                                    className="h-9 w-20 rounded border border-[var(--border)] bg-white px-1 text-center text-xs"
                                    value={grade}
                                    onChange={(e) => setInternalSatHqGrades((prev) => ({ ...prev, [item.key]: (e.target.value as InternalSatGrade) || "" }))}
                                  >
                                    <option value="">선택</option>
                                    {internalSatAllowedHq.map((g) => (
                                      <option key={g} value={g}>
                                        {g}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-center font-mono">{converted}</td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 border-[var(--border)] bg-[var(--background)] font-medium">
                            <td colSpan={2} className="px-3 py-2 text-right">⑤합계</td>
                            <td className="px-3 py-2 text-center font-mono">100</td>
                            <td className="px-3 py-2" />
                            <td className="px-3 py-2 text-center font-mono">
                              {internalSatHqItems.reduce((sum, item) => {
                                const g = internalSatHqGrades[item.key];
                                if (!g) return sum;
                                return sum + Math.round(item.maxPoints * internalSatRatio[g]);
                              }, 0)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                    <div className="mt-6 flex items-center justify-center gap-3">
                      {(() => {
                        const centerComplete = internalSatCenterItems.every((item) => !!internalSatCenterGrades[item.key]);
                        const hqComplete = internalSatHqItems.every((item) => !!internalSatHqGrades[item.key]);
                        const internalSatAllComplete = centerComplete && hqComplete;
                        return (
                          <>
                            <button
                              type="button"
                              className="h-11 min-w-[120px] rounded-full border border-[var(--border)] bg-[var(--card)] px-4 text-xs font-mono uppercase tracking-[0.2em] text-[var(--foreground)] transition hover:bg-[var(--secondary)]"
                              onClick={() => {
                                setModalMode("alert");
                                setModalMessage("저장되었습니다.");
                                setIsConfirmOpen(true);
                              }}
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              disabled={!internalSatAllComplete}
                              className="h-11 min-w-[120px] rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 text-xs font-mono uppercase tracking-[0.2em] text-[var(--accent-foreground)] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50"
                              onClick={() => {
                                if (!internalSatAllComplete) return;
                                setModalMode("confirm");
                                setModalMessage("내부 만족도 평가를 완료하시겠습니까?");
                                setIsConfirmOpen(true);
                                setPendingAction("completeInternalSat");
                              }}
                            >
                              평가완료
                            </button>
                          </>
                        );
                      })()}
                    </div>
                </div>
              </div>
            )}
            
            {/* 등급 기준 툴팁 */}
            {hoveredGoalIndex !== null && tooltipPosition && activeDraftGoals[hoveredGoalIndex] && (
              (() => {
                const goal = activeDraftGoals[hoveredGoalIndex];
                // 목표값이나 등급이 하나라도 있으면 툴팁 표시
                const hasGradeInfo = goal.target || goal.gradeS || goal.gradeB || goal.gradeC || goal.gradeD;
                if (!hasGradeInfo) return null;
                
                return (
                  <div 
                    className="fixed z-[100] w-72 bg-white border-2 border-[var(--border)] rounded-lg shadow-2xl p-4 pointer-events-none"
                    style={{
                      left: tooltipPosition.x,
                      top: tooltipPosition.y,
                    }}
                  >
                    <div className="font-semibold mb-3 text-sm text-[var(--foreground)] border-b border-[var(--border)] pb-2">등급별 기준</div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-semibold text-purple-600 min-w-[50px]">S등급:</span>
                        <span className="text-[var(--foreground)] font-mono text-right">
                          {goal.gradeS || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-semibold text-green-600 min-w-[50px]">A등급:</span>
                        <span className="text-[var(--foreground)] font-mono text-right">
                          {goal.target || "-"} {goal.unit && `(${goal.unit})`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-semibold text-blue-600 min-w-[50px]">B등급:</span>
                        <span className="text-[var(--foreground)] font-mono text-right">
                          {goal.gradeB || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-semibold text-orange-600 min-w-[50px]">C등급:</span>
                        <span className="text-[var(--foreground)] font-mono text-right">
                          {goal.gradeC || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-3">
                        <span className="font-semibold text-red-600 min-w-[50px]">D등급:</span>
                        <span className="text-[var(--foreground)] font-mono text-right">
                          {goal.gradeD || "-"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)] text-center">
                      클릭하면 상세 정보를 확인할 수 있습니다
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </section>

        {isConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 px-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-lg">
              <h3 className="text-lg font-medium">저장 확인</h3>
              <p className="mt-2 text-sm text-[var(--muted)] whitespace-pre-line">{modalMessage}</p>
              <div className="mt-6 flex items-center justify-end gap-3">
                {modalMode === "confirm" ? (
                  <>
                    <button
                      className="rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.25em] transition hover:border-black/40"
                      onClick={() => {
                        setPendingAction(null);
                        setIsConfirmOpen(false);
                      }}
                    >
                      취소
                    </button>
                    <button
                      className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.25em] text-[var(--accent)] transition hover:border-black/40"
                      onClick={async () => {
                        if (pendingAction === "request") {
                          setIsConfirmOpen(false);
                          await handleRequestApproval();
                        } else if (pendingAction === "approve") {
                          setIsConfirmOpen(false);
                          await handleApprove();
                        } else if (pendingAction === "revoke") {
                          setIsConfirmOpen(false);
                          await handleRevokeApproval();
                        } else if (pendingAction === "reject") {
                          setIsConfirmOpen(false);
                          await handleReject();
                        } else if (pendingAction === "approveModification") {
                          setIsConfirmOpen(false);
                          await handleApproveModification();
                        } else if (pendingAction === "completeCompetencyEval") {
                          setIsConfirmOpen(false);
                          setPendingAction(null);
                          try {
                            if (typeof window !== "undefined") {
                              window.localStorage.setItem(`${competencyStorageKey}:completed`, new Date().toISOString());
                            }
                          } catch {
                            // ignore
                          }
                          setModalMode("alert");
                          setModalMessage("평가가 완료되었습니다.");
                          setIsConfirmOpen(true);
                        } else if (pendingAction === "completeInternalSat") {
                          setIsConfirmOpen(false);
                          setPendingAction(null);
                          try {
                            if (typeof window !== "undefined") {
                              window.localStorage.setItem(`${internalSatCenterStorageKey}:completed`, new Date().toISOString());
                              window.localStorage.setItem(`${internalSatHqStorageKey}:completed`, new Date().toISOString());
                            }
                          } catch {
                            // ignore
                          }
                          setModalMode("alert");
                          setModalMessage("평가가 완료되었습니다.");
                          setIsConfirmOpen(true);
} else if (pendingAction === "saveGrade") {
                          setIsConfirmOpen(false);
                          if (editingGoalIndex !== null) {
                            const isNumeric = !isNaN(parseFloat(gradeValues.target));
                            const formattedValue = isNumeric ? formatCommaNumber(gradeValues.target) : gradeValues.target;
                            const builtGradeS = buildSingleGrade(gradeValues.gradeSNum, gradeValues.gradeSOp);
                            const builtGradeB = buildRangeGrade(gradeValues.gradeBNum1, gradeValues.gradeBOp1, gradeValues.gradeBNum2, gradeValues.gradeBOp2);
                            const builtGradeC = buildRangeGrade(gradeValues.gradeCNum1, gradeValues.gradeCOp1, gradeValues.gradeCNum2, gradeValues.gradeCOp2);
                            const builtGradeD = buildSingleGrade(gradeValues.gradeDNum, gradeValues.gradeDOp);
                            const updatedGoals = [...activeDraftGoals];
                            updatedGoals[editingGoalIndex] = {
                              ...updatedGoals[editingGoalIndex],
                              detail: gradeValues.detail,
                              target: formattedValue,
                              unit: gradeValues.unit,
                              gradeS: builtGradeS,
                              gradeB: builtGradeB,
                              gradeC: builtGradeC,
                              gradeD: builtGradeD,
                            };
                            setDraftGoalsByYear((prev) => ({
                              ...prev,
                              [activeYear]: { ...prev[activeYear], [activeTab]: updatedGoals },
                            }));
                          }
                          setIsGradeModalOpen(false);
                          setEditingGoalIndex(null);
                          setGradeValues({
                            target: "",
                            unit: "",
                            detail: "",
                            gradeA: "",
                            gradeS: "",
                            gradeB: "",
                            gradeC: "",
                            gradeD: "",
                            gradeSNum: "",
                            gradeSOp: "이상",
                            gradeBNum1: "",
                            gradeBOp1: "이상",
                            gradeBNum2: "",
                            gradeBOp2: "미만",
                            gradeCNum1: "",
                            gradeCOp1: "이상",
                            gradeCNum2: "",
                            gradeCOp2: "미만",
                            gradeDNum: "",
                            gradeDOp: "미만",
                          });
                        } else {
                          // 임시저장의 경우 저장 완료 후 모달 닫기
                          await handleSave();
                          setIsConfirmOpen(false);
                        }
                        setPendingAction(null);
                      }}
                    >
                      확인
                    </button>
                  </>
                ) : (
                  <button
                    className="rounded-full border border-[var(--accent)] px-4 py-2 text-xs uppercase tracking-[0.25em] text-[var(--accent)] transition hover:border-black/40"
                    onClick={() => {
                      setPendingAction(null);
                      setIsConfirmOpen(false);
                    }}
                  >
                    확인
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* 목표값 및 등급 설정 모달 */}
        {isGradeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
            <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-5 shadow-lg max-h-[85vh] overflow-y-auto">
              <h3 className="text-lg font-medium">
                {isEditing && !isPerformanceMode ? "목표값 및 등급 설정" : "목표값 및 등급 조회"}
              </h3>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {isEditing && !isPerformanceMode 
                  ? "목표값과 각 등급별 기준을 입력해주세요." 
                  : "설정된 목표값과 등급 기준을 확인할 수 있습니다."}
              </p>
              <div className="mt-4 space-y-2.5">
                <div>
                  <label className="block text-xs font-medium mb-1.5">목표 부연설명</label>
                  <textarea
                    className={`w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                    value={gradeValues.detail}
                    onChange={(e) => setGradeValues({ ...gradeValues, detail: e.target.value })}
                    placeholder="목표에 대한 설명을 입력하세요."
                    readOnly={!isEditing || isPerformanceMode}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">목표값</label>
                  <input
                    type="number"
                    step="any"
                    className={`w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                    value={gradeValues.target}
                    onChange={(e) => {
                      const v = e.target.value;
                      setGradeValues({ ...gradeValues, target: v, gradeA: v });
                    }}
                    placeholder="예: 300"
                    readOnly={!isEditing || isPerformanceMode}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">단위</label>
                  <select
                    className={`w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                    value={gradeValues.unit}
                    onChange={(e) => setGradeValues({ ...gradeValues, unit: e.target.value })}
                    disabled={!isEditing || isPerformanceMode}
                  >
                    <option value="">선택</option>
                    <option value="백만원">백만원</option>
                    <option value="%">%</option>
                    <option value="건">건</option>
                    <option value="점">점</option>
                    <option value="종">종</option>
                    <option value="단위입력">직접입력</option>
                  </select>
                  {gradeUnitShouldUseCustom && (
                    <input
                      type="text"
                      className={`mt-2 w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.unit}
                      onChange={(e) => {
                        const v = e.target.value;
                        setGradeValues({ ...gradeValues, unit: v });
                        setGradeUnitCustomMode(
                          v === "" ||
                            !((GRADE_UNIT_PRESETS as readonly string[]).includes(v))
                        );
                      }}
                      disabled={!isEditing || isPerformanceMode}
                      placeholder="단위를 직접 입력"
                      aria-label="단위(직접입력)"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">S등급</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      className={`w-24 border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeSNum}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeSNum: e.target.value })}
                      placeholder="숫자"
                      readOnly={!isEditing || isPerformanceMode}
                    />
                    <select
                      className={`w-20 border border-[var(--border)] rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeSOp}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeSOp: e.target.value as GradeOp })}
                      disabled={!isEditing || isPerformanceMode}
                    >
                      {GRADE_OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">A등급 (목표값)</label>
                  <input
                    type="text"
                    className="w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm bg-[var(--secondary)]"
                    value={gradeValues.gradeA}
                    readOnly
                    placeholder="목표값과 동일"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">B등급</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    <input
                      type="number"
                      step="any"
                      className={`w-20 border border-[var(--border)] rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeBNum1}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeBNum1: e.target.value })}
                      placeholder="숫자"
                      readOnly={!isEditing || isPerformanceMode}
                    />
                    <select
                      className={`w-16 border border-[var(--border)] rounded-md px-1 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeBOp1}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeBOp1: e.target.value as GradeOp })}
                      disabled={!isEditing || isPerformanceMode}
                    >
                      {GRADE_OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                    <span className="text-xs text-[var(--muted)]">~</span>
                    <input
                      type="number"
                      step="any"
                      className={`w-20 border border-[var(--border)] rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeBNum2}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeBNum2: e.target.value })}
                      placeholder="숫자"
                      readOnly={!isEditing || isPerformanceMode}
                    />
                    <select
                      className={`w-16 border border-[var(--border)] rounded-md px-1 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeBOp2}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeBOp2: e.target.value as GradeOp })}
                      disabled={!isEditing || isPerformanceMode}
                    >
                      {GRADE_OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">C등급</label>
                  <div className="flex items-center gap-1 flex-wrap">
                    <input
                      type="number"
                      step="any"
                      className={`w-20 border border-[var(--border)] rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeCNum1}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeCNum1: e.target.value })}
                      placeholder="숫자"
                      readOnly={!isEditing || isPerformanceMode}
                    />
                    <select
                      className={`w-16 border border-[var(--border)] rounded-md px-1 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeCOp1}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeCOp1: e.target.value as GradeOp })}
                      disabled={!isEditing || isPerformanceMode}
                    >
                      {GRADE_OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                    <span className="text-xs text-[var(--muted)]">~</span>
                    <input
                      type="number"
                      step="any"
                      className={`w-20 border border-[var(--border)] rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeCNum2}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeCNum2: e.target.value })}
                      placeholder="숫자"
                      readOnly={!isEditing || isPerformanceMode}
                    />
                    <select
                      className={`w-16 border border-[var(--border)] rounded-md px-1 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeCOp2}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeCOp2: e.target.value as GradeOp })}
                      disabled={!isEditing || isPerformanceMode}
                    >
                      {GRADE_OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">D등급</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="any"
                      className={`w-24 border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeDNum}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeDNum: e.target.value })}
                      placeholder="숫자"
                      readOnly={!isEditing || isPerformanceMode}
                    />
                    <select
                      className={`w-20 border border-[var(--border)] rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${(!isEditing || isPerformanceMode) ? "bg-[var(--secondary)]" : ""}`}
                      value={gradeValues.gradeDOp}
                      onChange={(e) => setGradeValues({ ...gradeValues, gradeDOp: e.target.value as GradeOp })}
                      disabled={!isEditing || isPerformanceMode}
                    >
                      {GRADE_OP_OPTIONS.map((op) => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  className="border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] px-4 py-2 text-xs uppercase tracking-[0.25em] transition"
                  onClick={() => {
                    setIsGradeModalOpen(false);
                    setEditingGoalIndex(null);
                    setGradeValues({
                      target: "",
                      unit: "",
                      detail: "",
                      gradeA: "",
                      gradeS: "",
                      gradeB: "",
                      gradeC: "",
                      gradeD: "",
                      gradeSNum: "",
                      gradeSOp: "이상",
                      gradeBNum1: "",
                      gradeBOp1: "이상",
                      gradeBNum2: "",
                      gradeBOp2: "미만",
                      gradeCNum1: "",
                      gradeCOp1: "이상",
                      gradeCNum2: "",
                      gradeCOp2: "미만",
                      gradeDNum: "",
                      gradeDOp: "미만",
                    });
                  }}
                >
                  {isEditing && !isPerformanceMode ? "취소" : "닫기"}
                </button>
                {isEditing && !isPerformanceMode && (
                  <button
                    className="border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--secondary)] px-4 py-2 text-xs uppercase tracking-[0.25em] transition disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                    if (!gradeValues.target) {
                      setModalMode("alert");
                      setModalMessage("목표값을 입력해주세요.");
                      setIsConfirmOpen(true);
                      return;
                    }

                    if (!gradeValues.unit) {
                      setModalMode("alert");
                      setModalMessage("단위를 선택해주세요.");
                      setIsConfirmOpen(true);
                      return;
                    }

                    // 등급 문자열 생성 (숫자+기호)
                    const builtGradeS = buildSingleGrade(gradeValues.gradeSNum, gradeValues.gradeSOp);
                    const builtGradeB = buildRangeGrade(gradeValues.gradeBNum1, gradeValues.gradeBOp1, gradeValues.gradeBNum2, gradeValues.gradeBOp2);
                    const builtGradeC = buildRangeGrade(gradeValues.gradeCNum1, gradeValues.gradeCOp1, gradeValues.gradeCNum2, gradeValues.gradeCOp2);
                    const builtGradeD = buildSingleGrade(gradeValues.gradeDNum, gradeValues.gradeDOp);

                    const isNumericTarget = !isNaN(parseFloat(gradeValues.target));
                    let warnings: string[] = [];
                    if (isNumericTarget) {
                      const targetNum = parseFloat(gradeValues.target);
                      const gradeSNum = parseFloat(gradeValues.gradeSNum);
                      if (gradeValues.gradeSNum && !isNaN(gradeSNum) && Math.abs(gradeSNum - targetNum * 1.1) > 0.1) {
                        warnings.push("• S등급이 A등급(목표값)의 110% 수준이 아닙니다.");
                      }
                    }

                    if (warnings.length > 0) {
                      setModalMode("confirm");
                      setModalMessage(`다음 사항을 확인해주세요:\n\n${warnings.join("\n")}\n\n이대로 저장하시겠습니까?`);
                      setPendingAction("saveGrade");
                      setIsConfirmOpen(true);
                    } else {
                      if (editingGoalIndex !== null) {
                        const formattedValue = isNumericTarget ? formatCommaNumber(gradeValues.target) : gradeValues.target;
                        const updatedGoals = [...activeDraftGoals];
                        updatedGoals[editingGoalIndex] = {
                          ...updatedGoals[editingGoalIndex],
                          detail: gradeValues.detail,
                          target: formattedValue,
                          unit: gradeValues.unit,
                          gradeS: builtGradeS,
                          gradeB: builtGradeB,
                          gradeC: builtGradeC,
                          gradeD: builtGradeD,
                        };
                        setDraftGoalsByYear((prev) => ({
                          ...prev,
                          [activeYear]: { ...prev[activeYear], [activeTab]: updatedGoals },
                        }));
                      }
                      setIsGradeModalOpen(false);
                      setEditingGoalIndex(null);
                      setGradeValues({
                        target: "",
                        unit: "",
                        detail: "",
                        gradeA: "",
                        gradeS: "",
                        gradeB: "",
                        gradeC: "",
                        gradeD: "",
                        gradeSNum: "",
                        gradeSOp: "이상",
                        gradeBNum1: "",
                        gradeBOp1: "이상",
                        gradeBNum2: "",
                        gradeBOp2: "미만",
                        gradeCNum1: "",
                        gradeCOp1: "이상",
                        gradeCNum2: "",
                        gradeCOp2: "미만",
                        gradeDNum: "",
                        gradeDOp: "미만",
                      });
                    }
                  }}
                    disabled={!gradeValues.target || !gradeValues.unit}
                  >
                    확인
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {isGoalModificationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-lg">
              <h3 className="text-lg font-medium">목표 수정 요청</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                목표를 수정해야 하는 사유를 입력해주세요.<br />
                상위 승인권자의 승인 후 수정이 가능합니다.
              </p>
              <textarea
                className="mt-4 w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[120px]"
                placeholder="목표 수정이 필요한 사유를 구체적으로 입력하세요..."
                value={goalModificationReason}
                onChange={(e) => setGoalModificationReason(e.target.value)}
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  className="rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.25em] transition hover:border-black/40"
                  onClick={() => {
                    setIsGoalModificationModalOpen(false);
                    setGoalModificationReason("");
                  }}
                >
                  취소
                </button>
                <button
                  className="rounded-full border border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] px-4 py-2 text-xs uppercase tracking-[0.25em] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => {
                    if (!goalModificationReason.trim()) {
                      setModalMode("alert");
                      setModalMessage("목표 수정 사유를 입력해주세요.");
                      setIsConfirmOpen(true);
                      return;
                    }
                    // 목표수정 승인요청
                    handleRequestModification();
                  }}
                  disabled={!goalModificationReason.trim()}
                >
                  승인요청
                </button>
              </div>
            </div>
          </div>
        )}

        {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-6">
            <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-lg">
              <h3 className="text-lg font-medium">{rejectType === "goal" ? "목표 거절" : "목표수정 거절"}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">거절 사유를 입력해주세요.</p>
              <textarea
                className="mt-4 w-full border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] min-h-[120px]"
                placeholder="거절 사유를 상세히 작성해주세요..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  className="rounded-full border border-black/20 px-4 py-2 text-xs uppercase tracking-[0.25em] transition hover:border-black/40"
                  onClick={() => {
                    setIsRejectModalOpen(false);
                    setRejectReason("");
                  }}
                >
                  취소
                </button>
                <button
                  className="rounded-full border border-[var(--destructive)] bg-[var(--destructive)] text-[var(--destructive-foreground)] px-4 py-2 text-xs uppercase tracking-[0.25em] transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={async () => {
                    if (!rejectReason.trim()) {
                      setModalMode("alert");
                      setModalMessage("거절 사유를 입력해주세요.");
                      setIsConfirmOpen(true);
                      return;
                    }
                    if (rejectType === "goal") {
                      await handleReject();
                    } else {
                      await handleRejectModification(rejectReason);
                    }
                    setIsRejectModalOpen(false);
                    setRejectReason("");
                  }}
                  disabled={!rejectReason.trim()}
                >
                  거절
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
