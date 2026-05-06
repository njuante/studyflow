import { describe, expect, it } from "vitest";

import { scheduleBlocks } from "../autoplanner";
import { parseNarrative } from "../narrativeParser";
import type { AutoplanOptions } from "../types";

const REAL_PLANNING = `Bloque 1: Gestión de Configuración y DevOps

* Día 1: Estudia GCS. (2 horas)
* Día 2: Repasa repositorio. (2 horas)
* Día 3: Build automation. (2 horas)
* Día 4: Despliegue continuo. (2 horas)
* Día 5: 📝 Test de Autoevaluación 1. Dedica la hora y media. (90 minutos)

Bloque 2: Pruebas

* Día 6: Pirámide de pruebas. (2 horas)
* Día 7: TDD y BDD. (2 horas)
* Día 8: Mocks y stubs. (2 horas)
* Día 9: Implementa Jest. (2 horas)
* Día 10: Cobertura. (2 horas)
* Día 11: 📝 Test 2. (90 minutos)

Bloque 3: Gestión

* Día 12: Scrum Kanban. (2 horas)
* Día 13: Story points. (2 horas)
* Día 14: Métricas. (2 horas)
* Día 15: Riesgos. (2 horas)
* Día 16: Tablero Kanban. (2 horas)
* Día 17: Repaso global. (2 horas)
* Día 18: 📝 Examen final. (150 minutos)
`;

function buildOptions(start: Date): AutoplanOptions {
  return {
    startDate: start,
    skipWeekends: true,
    workSlots: [
      { start: "09:00", end: "14:00" },
      { start: "16:00", end: "19:00" },
    ],
    maxHoursPerDay: 8,
    splitIntoPomodoros: false,
    avoidSameTagInRow: true,
    placement: "sequential",
    defaultTagId: null,
  };
}

describe("scheduleBlocks (integration with real planning)", () => {
  it("schedules all 18 blocks across 18 weekdays starting from Monday 2026-05-11", () => {
    const parsed = parseNarrative(REAL_PLANNING);
    expect(parsed.ok).toBe(true);
    expect(parsed.blocks?.length).toBe(18);

    // 2026-05-11 is a Monday (chosen so the skipWeekends behaviour spans 4 weekends)
    const start = new Date(2026, 4, 11);
    const result = scheduleBlocks(parsed.blocks!, buildOptions(start));

    expect(result.scheduledBlocks.length).toBe(18);
    expect(result.inboxBlocks.length).toBe(0);

    const uniqueDates = new Set(result.scheduledBlocks.map((b) => b.date));
    expect(uniqueDates.size).toBe(18);

    for (const block of result.scheduledBlocks) {
      const [year, month, day] = block.date.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      const dow = date.getDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it("places every block inside the configured 9-14 / 16-19 work slots", () => {
    const parsed = parseNarrative(REAL_PLANNING);
    const start = new Date(2026, 4, 11);
    const result = scheduleBlocks(parsed.blocks!, buildOptions(start));

    function inSlots(start: string, durationMinutes: number): boolean {
      const [h, m] = start.split(":").map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + durationMinutes;
      const morning = startMin >= 9 * 60 && endMin <= 14 * 60;
      const afternoon = startMin >= 16 * 60 && endMin <= 19 * 60;
      return morning || afternoon;
    }

    for (const block of result.scheduledBlocks) {
      expect(
        inSlots(block.startTime, block.durationMinutes),
        `block "${block.title}" at ${block.date} ${block.startTime} (${block.durationMinutes}m) outside slots`,
      ).toBe(true);
    }
  });

  it("emits a max-hours warning and pushes overflow to Inbox when a single day has too much", () => {
    const overloaded: ReturnType<typeof parseNarrative> = parseNarrative(`
      * Día 1: Bloque 1. (3 horas)
      * Día 1: Bloque 2. (3 horas)
      * Día 1: Bloque 3. (3 horas)
    `);
    expect(overloaded.ok).toBe(true);

    const start = new Date(2026, 4, 11);
    const result = scheduleBlocks(overloaded.blocks!, {
      ...buildOptions(start),
      maxHoursPerDay: 6,
    });

    expect(result.scheduledBlocks.length).toBe(2);
    expect(result.inboxBlocks.length).toBe(1);
    expect(
      result.warnings.some((warn) => /Inbox/i.test(warn) && warn.includes("Día 1")),
    ).toBe(true);
  });

  it("respects skipWeekends=false and uses every consecutive day", () => {
    const parsed = parseNarrative(REAL_PLANNING);
    const start = new Date(2026, 4, 11); // Monday
    const result = scheduleBlocks(parsed.blocks!, {
      ...buildOptions(start),
      skipWeekends: false,
    });

    const dates = result.scheduledBlocks.map((b) => b.date).sort();
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    const dayDelta = Math.round(
      (last.getTime() - first.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(dayDelta).toBe(17);
  });

  it("splits long blocks into pomodoro chunks when enabled", () => {
    const parsed = parseNarrative("* Día 1: Estudio largo. (3 horas)");
    const result = scheduleBlocks(parsed.blocks!, {
      ...buildOptions(new Date(2026, 4, 11)),
      splitIntoPomodoros: true,
    });

    expect(result.scheduledBlocks.length).toBeGreaterThan(1);
    const totalMinutes = result.scheduledBlocks.reduce(
      (sum, b) => sum + b.durationMinutes,
      0,
    );
    expect(totalMinutes).toBe(180);
    expect(
      result.scheduledBlocks.every((b) => /\(\d+\/\d+\)/.test(b.title)),
    ).toBe(true);
  });
});
