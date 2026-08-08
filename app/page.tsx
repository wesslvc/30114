"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CLASS_LIST, DAYS, GROUP_ORDER, GROUPS, PERIODS, PERIOD_TIMES } from "@/lib/data";
import { detectGroupsForClass, fixTeacher, generateTimetable, homeRoomCode, ParsedCell } from "@/lib/logic";

function groupColorVar(code: string) {
  return `var(--group-${code})`;
}

export default function Home() {
  const [classNum, setClassNum] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const detectedDefaults = useMemo(() => (classNum ? detectGroupsForClass(classNum) : {}), [classNum]);
  const groupCodes = useMemo(
    () =>
      Object.keys(detectedDefaults).sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b)),
    [detectedDefaults]
  );

  useEffect(() => {
    setSelections(detectedDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classNum]);

  const timetable: ParsedCell[][] | null = useMemo(() => {
    if (!classNum) return null;
    return generateTimetable(classNum, selections);
  }, [classNum, selections]);

  const usedGroups = useMemo(() => {
    if (!timetable) return [];
    const set = new Set<string>();
    timetable.forEach((day) => day.forEach((c) => c.kind === "group" && set.add(c.groupCode)));
    return Array.from(set).sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b));
  }, [timetable]);

  const handleExportImage = async () => {
    if (!exportRef.current || !classNum) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const surface = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
      const dataUrl = await toPng(exportRef.current, {
        backgroundColor: surface || "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${classNum}반_시간표.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="page">
      <div className="header">
        <h1>3학년 시간표 자동 생성기</h1>
        <p>
          반을 선택하고 이동수업(가~마)·동시수업(A~F) 선택 과목을 지정하면, 학생 개인별 주간 시간표가
          자동으로 만들어집니다. 자기 반 교실에서 듣는 수업은 교실 표시가 생략됩니다.
        </p>
      </div>

      <section className="card">
        <h2>
          <span className="step-badge">1</span>반 선택
        </h2>
        <div className="class-grid">
          {CLASS_LIST.map((n) => (
            <button
              key={n}
              className={`class-btn${classNum === n ? " active" : ""}`}
              onClick={() => setClassNum(n)}
            >
              {n}반
            </button>
          ))}
        </div>
      </section>

      {classNum && (
        <section className="card">
          <h2>
            <span className="step-badge">2</span>선택 과목 지정 ({classNum}반 · 홈베이스 3-{classNum})
          </h2>
          {groupCodes.length === 0 ? (
            <p className="empty-hint">이 반에는 선택이 필요한 이동/동시 수업이 없습니다.</p>
          ) : (
            <div className="group-list">
              {groupCodes.map((code) => {
                const group = GROUPS[code];
                return (
                  <div className="group-field" key={code}>
                    <label className="group-label">
                      <span className="group-chip" style={{ background: groupColorVar(code) }}>
                        {code}
                      </span>
                      이동/동시 수업
                      <span className="group-time">({group.time})</span>
                    </label>
                    <select
                      className="subject-select"
                      value={selections[code] ?? ""}
                      onChange={(e) =>
                        setSelections((prev) => ({ ...prev, [code]: e.target.value }))
                      }
                    >
                      {group.options.map((opt) => (
                        <option key={opt.short} value={opt.short}>
                          {opt.subject} ({fixTeacher(opt.teacher)})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {classNum && timetable && (
        <section className="card result-card">
          <h2>
            <span className="step-badge">3</span>{classNum}반 개인 시간표
          </h2>
          <div className="toolbar">
            <button className="btn primary" onClick={handleExportImage} disabled={exporting}>
              {exporting ? "이미지 생성 중..." : "이미지로 저장"}
            </button>
          </div>
          <div className="table-wrap">
            <div className="export-target" ref={exportRef}>
              <div className="export-title">{classNum}반 개인 시간표</div>
              <table className="timetable">
                <thead>
                  <tr>
                    <th>교시</th>
                    {DAYS.map((d) => (
                      <th key={d}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, pIdx) => (
                    <tr key={p}>
                      <th>
                        {p}교시
                        <br />
                        {PERIOD_TIMES[pIdx]}
                      </th>
                      {DAYS.map((d, dIdx) => {
                        const cell = timetable[dIdx][pIdx];
                        if (cell.kind === "empty") {
                          return (
                            <td key={d}>
                              <div className="cell empty">-</div>
                            </td>
                          );
                        }
                        if (cell.kind === "fixed") {
                          return (
                            <td key={d}>
                              <div className="cell">
                                <span className="subject-line">{cell.line1}</span>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={d}>
                            <div
                              className="cell group"
                              style={{ borderLeftColor: groupColorVar(cell.groupCode) }}
                            >
                              <span className="subject-line">{cell.line1}</span>
                              {cell.line2 && <span className="room-line">{cell.line2}</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {usedGroups.length > 0 && (
            <div className="legend">
              {usedGroups.map((g) => (
                <span key={g}>
                  <span className="dot" style={{ background: groupColorVar(g) }} />[{g}] 그룹 이동/동시 수업
                  (홈베이스 3-{classNum} 외 교실은 #교실번호 표시)
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="note">
        원본 시간표 및 이동/동시수업 배정표를 기반으로 자동 생성되며, 실제 배정과 차이가 있을 경우
        담임 선생님 안내를 우선합니다. 홈베이스 교실 번호 = 3-{classNum ?? "N"} (교실 {classNum ? homeRoomCode(classNum) : ""}).
      </footer>
    </main>
  );
}
