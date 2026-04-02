/* eslint-disable no-console */
const { PrismaClient, OrgRole, GradeLevel } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const currentYear = new Date().getFullYear();

const normalizeRole = (role) => (role === "일반직원" ? "직원" : role);
const buildEmployeeNo = (id) => String(2026000000 + id).padStart(10, "0");
const buildEmail = (id) => `user${String(id).padStart(3, "0")}@kpcqa.or.kr`;
const buildHireDate = (id) => {
  const year = 2012 + (id % 8);
  return `${year}-03-01`;
};
const buildGradeLevel = (grade) => {
  const match = grade.match(/[1-4]/);
  return match ? Number(match[0]) : 3;
};

const roleMap = {
  원장: OrgRole.PRESIDENT,
  부원장: OrgRole.VICE_PRESIDENT,
  본부장: OrgRole.HQ_HEAD,
  센터장: OrgRole.CENTER_HEAD,
  직원: OrgRole.STAFF,
};

const performanceOptions = ["탁월", "우수", "보통", "개선필요"];
const competencyOptions = ["A", "B", "C", "D"];
const ratingOptions = ["S", "A", "B", "C", "D"];

const buildEvaluations = (hireDate, seed) => {
  const hireYear = Number(hireDate.split("-")[0]);
  const totalYears = Math.max(1, currentYear - hireYear);
  return Array.from({ length: totalYears }, (_, index) => ({
    year: hireYear + index,
    performance: performanceOptions[(seed + index) % performanceOptions.length],
    competency: competencyOptions[(seed + index * 2) % competencyOptions.length],
    grade: ratingOptions[(seed + index * 3) % ratingOptions.length],
  }));
};

const staffSeed = [
  { id: 1, name: "강도준", dept: "기관장", subDept: "원장실", role: "원장", grade: "1급갑" },
  { id: 2, name: "이서윤", dept: "기관장", subDept: "부원장실", role: "부원장", grade: "1급갑" },
  { id: 3, name: "박민호", dept: "미래성장전략본부", subDept: "본부직할", role: "본부장", grade: "1급을" },
  { id: 4, name: "김철수", dept: "경영기획본부", subDept: "본부직할", role: "본부장", grade: "1급을" },
  { id: 5, name: "최성원", dept: "녹색건축본부", subDept: "본부직할", role: "본부장", grade: "1급을" },
  { id: 6, name: "정우성", dept: "건물에너지본부", subDept: "본부직할", role: "본부장", grade: "1급을" },
  { id: 7, name: "한지민", dept: "표준인증본부", subDept: "본부직할", role: "본부장", grade: "1급을" },
  { id: 8, name: "정해인", dept: "경영기획본부", subDept: "경영기획센터", role: "센터장", grade: "2급갑" },
  { id: 9, name: "이민정", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "센터장", grade: "2급갑" },
  { id: 10, name: "오지호", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "센터장", grade: "2급을" },
  { id: 11, name: "송중기", dept: "건물에너지본부", subDept: "제로에너지인증센터", role: "센터장", grade: "2급갑" },
  { id: 12, name: "전지현", dept: "건물에너지본부", subDept: "에너지효율검토센터", role: "센터장", grade: "2급을" },
  { id: 13, name: "유재석", dept: "표준인증본부", subDept: "적합성인증센터", role: "센터장", grade: "2급갑" },
  { id: 14, name: "김혜수", dept: "표준인증본부", subDept: "ESG인증센터", role: "센터장", grade: "2급을" },
  { id: 15, name: "공유", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "센터장", grade: "2급갑" },
  { id: 16, name: "손예진", dept: "미래성장전략본부", subDept: "DX인증센터", role: "센터장", grade: "2급을" },
  { id: 17, name: "이정재", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "센터장", grade: "2급갑" },
  { id: 18, name: "지창욱", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "3급갑" },
  { id: 19, name: "김지원", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "3급을" },
  { id: 20, name: "김민석", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "3급병" },
  { id: 21, name: "소주연", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "4급갑" },
  { id: 22, name: "류경수", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "4급을" },
  { id: 23, name: "양경원", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "3급을" },
  { id: 24, name: "이유비", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "4급갑" },
  { id: 25, name: "한지선", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "4급을" },
  { id: 26, name: "김무열", dept: "미래성장전략본부", subDept: "기후변화인증센터", role: "일반직원", grade: "3급병" },
  { id: 27, name: "송강호", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "3급갑" },
  { id: 28, name: "배두나", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "3급을" },
  { id: 29, name: "이성민", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "3급병" },
  { id: 30, name: "임시완", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "4급갑" },
  { id: 31, name: "박해수", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "4급을" },
  { id: 32, name: "조우진", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "3급을" },
  { id: 33, name: "전여빈", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "4급갑" },
  { id: 34, name: "유재명", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "4급을" },
  { id: 35, name: "이희준", dept: "미래성장전략본부", subDept: "DX인증센터", role: "일반직원", grade: "3급병" },
  { id: 36, name: "이병헌", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "3급갑" },
  { id: 37, name: "조승우", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "3급을" },
  { id: 38, name: "백윤식", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "3급병" },
  { id: 39, name: "배성우", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "4급갑" },
  { id: 40, name: "박형식", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "4급을" },
  { id: 41, name: "진경", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "3급을" },
  { id: 42, name: "한효주", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "4급을" },
  { id: 43, name: "조인성", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "3급병" },
  { id: 44, name: "김대명", dept: "미래성장전략본부", subDept: "글로벌사업센터", role: "일반직원", grade: "4급갑" },
  { id: 45, name: "김다미", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "3급갑" },
  { id: 46, name: "박서준", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "3급을" },
  { id: 47, name: "최우식", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "3급병" },
  { id: 48, name: "김고은", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "4급갑" },
  { id: 49, name: "안보현", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "4급을" },
  { id: 50, name: "조이현", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "4급을" },
  { id: 51, name: "이도현", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "3급을" },
  { id: 52, name: "고민시", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "4급갑" },
  { id: 53, name: "서강준", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "3급병" },
  { id: 54, name: "공명", dept: "경영기획본부", subDept: "경영기획센터", role: "일반직원", grade: "4급을" },
  { id: 55, name: "남주혁", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "3급갑" },
  { id: 56, name: "수지", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "3급을" },
  { id: 57, name: "김선호", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "3급병" },
  { id: 58, name: "강한나", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "4급갑" },
  { id: 59, name: "도경수", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "4급을" },
  { id: 60, name: "박은빈", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "3급병" },
  { id: 61, name: "로운", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "4급갑" },
  { id: 62, name: "신혜선", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "4급을" },
  { id: 63, name: "안효섭", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "3급을" },
  { id: 64, name: "김세정", dept: "녹색건축본부", subDept: "녹색건축인증센터", role: "일반직원", grade: "4급갑" },
  { id: 65, name: "조정석", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "3급갑" },
  { id: 66, name: "유연석", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "3급을" },
  { id: 67, name: "정경호", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "3급병" },
  { id: 68, name: "김대명", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "4급갑" },
  { id: 69, name: "전미도", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "4급을" },
  { id: 70, name: "차은우", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "4급갑" },
  { id: 71, name: "문가영", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "4급을" },
  { id: 72, name: "신현빈", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "3급을" },
  { id: 73, name: "김준한", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "4급갑" },
  { id: 74, name: "안은진", dept: "녹색건축본부", subDept: "건축안전인증센터", role: "일반직원", grade: "4급을" },
  { id: 75, name: "현빈", dept: "건물에너지본부", subDept: "제로에너지인증센터", role: "일반직원", grade: "3급갑" },
  { id: 85, name: "이준기", dept: "건물에너지본부", subDept: "에너지효율검토센터", role: "일반직원", grade: "3급갑" },
  { id: 91, name: "김수현", dept: "표준인증본부", subDept: "ESG인증센터", role: "일반직원", grade: "3급갑" },
  { id: 92, name: "서예지", dept: "표준인증본부", subDept: "ESG인증센터", role: "일반직원", grade: "3급을" },
  { id: 93, name: "오정세", dept: "표준인증본부", subDept: "ESG인증센터", role: "일반직원", grade: "3급병" },
  { id: 94, name: "박규영", dept: "표준인증본부", subDept: "ESG인증센터", role: "일반직원", grade: "4급갑" },
  { id: 95, name: "유재명", dept: "표준인증본부", subDept: "적합성인증센터", role: "일반직원", grade: "3급갑" },
  { id: 96, name: "이정은", dept: "공통/기타", subDept: "휴직", role: "일반직원", grade: "3급을" },
  { id: 97, name: "박명훈", dept: "공통/기타", subDept: "휴직", role: "일반직원", grade: "3급병" },
  { id: 98, name: "장혜진", dept: "공통/기타", subDept: "휴직", role: "일반직원", grade: "4급갑" },
  { id: 99, name: "박소담", dept: "공통/기타", subDept: "휴직", role: "일반직원", grade: "4급을" },
  { id: 100, name: "최우식", dept: "공통/기타", subDept: "휴직", role: "일반직원", grade: "4급갑" },
];

async function seedOrgDictionary() {
  const depts = [
    { code: "dept_inst", labelKo: "기관장", sortOrder: 10 },
    { code: "dept_future", labelKo: "미래성장전략본부", sortOrder: 20 },
    { code: "dept_plan", labelKo: "경영기획본부", sortOrder: 30 },
    { code: "dept_green", labelKo: "녹색건축본부", sortOrder: 40 },
    { code: "dept_energy", labelKo: "건물에너지본부", sortOrder: 50 },
    { code: "dept_std", labelKo: "표준인증본부", sortOrder: 60 },
    { code: "dept_common", labelKo: "공통/기타", sortOrder: 90 },
  ];
  await prisma.orgDeptCode.createMany({ data: depts });

  const subDepts = [
    { code: "sd_office_pres", deptCode: "dept_inst", labelKo: "원장실", sortOrder: 10 },
    { code: "sd_office_vp", deptCode: "dept_inst", labelKo: "부원장실", sortOrder: 20 },
    { code: "sd_hq_future", deptCode: "dept_future", labelKo: "본부직할", sortOrder: 10 },
    { code: "sd_climate", deptCode: "dept_future", labelKo: "기후변화인증센터", sortOrder: 20 },
    { code: "sd_dx", deptCode: "dept_future", labelKo: "DX인증센터", sortOrder: 30 },
    { code: "sd_global", deptCode: "dept_future", labelKo: "글로벌사업센터", sortOrder: 40 },
    { code: "sd_hq_plan", deptCode: "dept_plan", labelKo: "본부직할", sortOrder: 10 },
    { code: "sd_plan_center", deptCode: "dept_plan", labelKo: "경영기획센터", sortOrder: 20 },
    { code: "sd_hq_green", deptCode: "dept_green", labelKo: "본부직할", sortOrder: 10 },
    { code: "sd_green_cert", deptCode: "dept_green", labelKo: "녹색건축인증센터", sortOrder: 20 },
    { code: "sd_arch_safe", deptCode: "dept_green", labelKo: "건축안전인증센터", sortOrder: 30 },
    { code: "sd_hq_energy", deptCode: "dept_energy", labelKo: "본부직할", sortOrder: 10 },
    { code: "sd_zero_energy", deptCode: "dept_energy", labelKo: "제로에너지인증센터", sortOrder: 20 },
    { code: "sd_energy_review", deptCode: "dept_energy", labelKo: "에너지효율검토센터", sortOrder: 30 },
    { code: "sd_hq_std", deptCode: "dept_std", labelKo: "본부직할", sortOrder: 10 },
    { code: "sd_conform", deptCode: "dept_std", labelKo: "적합성인증센터", sortOrder: 20 },
    { code: "sd_esg", deptCode: "dept_std", labelKo: "ESG인증센터", sortOrder: 30 },
    { code: "sd_leave", deptCode: "dept_common", labelKo: "휴직", sortOrder: 10 },
  ];
  await prisma.orgSubDeptCode.createMany({ data: subDepts });

  await prisma.orgRoleCode.createMany({
    data: [
      { code: "role_president", labelKo: "원장", permissionKey: OrgRole.PRESIDENT, sortOrder: 10 },
      { code: "role_vp", labelKo: "부원장", permissionKey: OrgRole.VICE_PRESIDENT, sortOrder: 20 },
      { code: "role_hq_head", labelKo: "본부장", permissionKey: OrgRole.HQ_HEAD, sortOrder: 30 },
      { code: "role_center_head", labelKo: "센터장", permissionKey: OrgRole.CENTER_HEAD, sortOrder: 40 },
      { code: "role_staff", labelKo: "직원", permissionKey: OrgRole.STAFF, sortOrder: 50 },
      {
        code: "role_intern",
        labelKo: "수습",
        permissionKey: null,
        sortOrder: 60,
        remark: "권한 없는 표시용 직함 예시",
      },
    ],
  });

  await prisma.orgGradeCode.createMany({
    data: [
      { code: "grade_lv1_ga", labelKo: "1급갑", mapsToGrade: GradeLevel.LEVEL_1, sortOrder: 11 },
      { code: "grade_lv1_eul", labelKo: "1급을", mapsToGrade: GradeLevel.LEVEL_1, sortOrder: 12 },
      { code: "grade_lv2_ga", labelKo: "2급갑", mapsToGrade: GradeLevel.LEVEL_2, sortOrder: 21 },
      { code: "grade_lv2_eul", labelKo: "2급을", mapsToGrade: GradeLevel.LEVEL_2, sortOrder: 22 },
      { code: "grade_lv3_ga", labelKo: "3급갑", mapsToGrade: GradeLevel.LEVEL_3, sortOrder: 31 },
      { code: "grade_lv3_eul", labelKo: "3급을", mapsToGrade: GradeLevel.LEVEL_3, sortOrder: 32 },
      { code: "grade_lv3_by", labelKo: "3급병", mapsToGrade: GradeLevel.LEVEL_3, sortOrder: 33 },
      { code: "grade_lv4_ga", labelKo: "4급갑", mapsToGrade: GradeLevel.LEVEL_4, sortOrder: 41 },
      { code: "grade_lv4_eul", labelKo: "4급을", mapsToGrade: GradeLevel.LEVEL_4, sortOrder: 42 },
      {
        code: "grade_custom",
        labelKo: "특임",
        mapsToGrade: null,
        sortOrder: 99,
        remark: "enum 미매핑 표시용 예시",
      },
    ],
  });

  console.log("Org dictionary seeded.");
}

async function main() {
  console.log("Seeding org dictionary + users...");

  await prisma.orgSubDeptCode.deleteMany();
  await prisma.orgDeptCode.deleteMany();
  await prisma.orgRoleCode.deleteMany();
  await prisma.orgGradeCode.deleteMany();
  await seedOrgDictionary();

  await prisma.adminAuditLog.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.competencyEval.deleteMany();
  await prisma.kpiMetric.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.user.deleteMany();

  for (const member of staffSeed) {
    const role = normalizeRole(member.role);
    const hireDate = buildHireDate(member.id);
    const gradeLevel = buildGradeLevel(member.grade);
    const evaluations = buildEvaluations(hireDate, member.id);

    const empNo = buildEmployeeNo(member.id);
    const passwordHash = bcrypt.hashSync(empNo, 10);

    const created = await prisma.user.create({
      data: {
        employeeNo: empNo,
        email: buildEmail(member.id),
        passwordHash,
        name: member.name,
        dept: member.dept,
        subDept: member.subDept,
        role: roleMap[role] ?? OrgRole.STAFF,
        isSystemAdmin: member.id === 1 || member.id === 2,
        mustChangePassword: true,
        gradeLevel:
          gradeLevel === 1
            ? GradeLevel.LEVEL_1
            : gradeLevel === 2
              ? GradeLevel.LEVEL_2
              : gradeLevel === 3
                ? GradeLevel.LEVEL_3
                : GradeLevel.LEVEL_4,
        hireDate: new Date(hireDate),
      },
    });

    if (evaluations.length) {
      await prisma.performanceReview.createMany({
        data: evaluations.map((record) => ({
          userId: created.id,
          year: record.year,
          performance: record.performance,
          competency: record.competency,
          grade: record.grade,
        })),
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
