import { CLASS_TIMETABLE, DAYS, FIXED_NORMALIZE, GROUPS, TEACHER_FIX } from "./data";
import type { Group, Option } from "./data";

export type ParsedCell =
  | { kind: "empty" }
  | { kind: "fixed"; line1: string }
  | { kind: "group"; groupCode: string; line1: string; line2: string | null };

export function fixTeacher(name: string): string {
  return TEACHER_FIX[name] ?? name;
}

function normalizeFixedSubject(text: string): string {
  return FIXED_NORMALIZE[text] ?? text;
}

// 가/나/다/라/마(이동수업) 또는 A~F(동시수업) 그룹 코드로 시작하는 셀인지 판별
function detectGroupCode(subjectPart: string): string | null {
  const movingPrefixes = ["가", "나", "다", "라", "마"];
  if (subjectPart.length > 0 && movingPrefixes.includes(subjectPart[0]) && (subjectPart.length > 1 || GROUPS[subjectPart])) {
    return subjectPart[0];
  }
  const simulMatch = subjectPart.match(/^([A-F])_/);
  if (simulMatch) return simulMatch[1];
  if (/^[A-F]$/.test(subjectPart)) return subjectPart;
  return null;
}

// 그룹 내에서 원본 셀 텍스트(단축과목명 또는 교사명 기반)에 해당하는 옵션 탐색
function findOption(group: Group, subjectPart: string, teacherPart: string): Option | null {
  const bySort = group.options.find((o) => o.short === subjectPart);
  if (bySort) return bySort;
  const byTeacher = group.options.filter((o) => fixTeacher(o.teacher) === fixTeacher(teacherPart));
  if (byTeacher.length === 1) return byTeacher[0];
  return null;
}

export function parseRawCell(raw: string): { subjectPart: string; teacherPart: string } | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return null;
  const match = trimmed.match(/^(.*?)\(([^)]+)\)$/);
  if (!match) return { subjectPart: trimmed, teacherPart: "" };
  return { subjectPart: match[1].trim(), teacherPart: match[2].trim() };
}

// 특정 반의 시간표에 등장하는 이동/동시수업 그룹 코드와, 원본 셀에 표기된 기본 선택값을 탐지
export function detectGroupsForClass(classNum: number): Record<string, string> {
  const timetable = CLASS_TIMETABLE[classNum];
  const defaults: Record<string, string> = {};
  for (const dayCells of timetable) {
    for (const raw of dayCells) {
      const parsed = parseRawCell(raw);
      if (!parsed) continue;
      const groupCode = detectGroupCode(parsed.subjectPart);
      if (!groupCode || !GROUPS[groupCode]) continue;
      const option = findOption(GROUPS[groupCode], parsed.subjectPart, parsed.teacherPart);
      if (option && !defaults[groupCode]) {
        defaults[groupCode] = option.short;
      }
    }
  }
  return defaults;
}

function formatRoom(room: string): string {
  const num = parseInt(room.slice(1), 10);
  return `3-${num}`;
}

export function homeRoomCode(classNum: number): string {
  return `3${String(classNum).padStart(2, "0")}`;
}

export function generateCell(raw: string, classNum: number, selections: Record<string, string>): ParsedCell {
  const parsed = parseRawCell(raw);
  if (!parsed) return { kind: "empty" };
  const { subjectPart, teacherPart } = parsed;

  const groupCode = detectGroupCode(subjectPart);
  if (groupCode && GROUPS[groupCode]) {
    const group = GROUPS[groupCode];
    const defaultOption = findOption(group, subjectPart, teacherPart);
    const chosenShort = selections[groupCode] ?? defaultOption?.short;
    const option = group.options.find((o) => o.short === chosenShort) ?? defaultOption ?? group.options[0];

    const teacher = fixTeacher(option.teacher);
    const label = `[${groupCode}] ${option.subject} (${teacher})`;
    const home = homeRoomCode(classNum);
    if (option.room === home) {
      return { kind: "group", groupCode, line1: label, line2: null };
    }
    return { kind: "group", groupCode, line1: label, line2: `#${formatRoom(option.room)}` };
  }

  const subjectNorm = normalizeFixedSubject(subjectPart);
  const teacherNorm = teacherPart ? ` (${fixTeacher(teacherPart)})` : "";
  return { kind: "fixed", line1: `${subjectNorm}${teacherNorm}` };
}

export function generateTimetable(classNum: number, selections: Record<string, string>): ParsedCell[][] {
  const timetable = CLASS_TIMETABLE[classNum];
  return timetable.map((dayCells) => dayCells.map((raw) => generateCell(raw, classNum, selections)));
}

export { DAYS };
