import { describe, expect, it } from "vitest";

import {
  extractDuration,
  inferPriority,
  inferType,
  parseNarrative,
} from "../narrativeParser";

const REAL_PLANNING = `Bloque 1: Gestión de Configuración y DevOps

* Día 1: Estudia los conceptos básicos de GCS. Céntrate en por qué la GCS es crítica en el ciclo de vida del software, sus principios, y los flujos típicos de cambio. (Duración: 2 horas)
* Día 2: Repasa el repositorio y el proceso de cambios. Mira cómo se organiza el control de versiones, ramas y peticiones de cambio. (Duración: 2 horas)
* Día 3: Profundiza en build automation y herramientas como Jenkins, GitHub Actions y CircleCI. (Duración: 2 horas)
* Día 4: Estudia despliegue continuo y entornos (dev, staging, prod). (Duración: 2 horas)
* Día 5: 📝 Test de Autoevaluación 1. Dedica la hora y media a hacer el test sin mirar apuntes y revisa los fallos. (Duración: 90 minutos)

Bloque 2: Pruebas de Software

* Día 6: Estudia la pirámide de pruebas y la diferencia entre pruebas unitarias, integración y end-to-end. (Duración: 2 horas)
* Día 7: Repasa TDD y BDD con ejemplos. Memoriza los pasos del ciclo red-green-refactor. (Duración: 2 horas)
* Día 8: Estudia mocks y stubs, cuándo usar cada uno. (Duración: 2 horas)
* Día 9: Implementa una práctica con Jest: monta el proyecto, escribe 5 tests unitarios y 2 de integración. (Duración: 2 horas)
* Día 10: Repasa cobertura de código y métricas. (Duración: 2 horas)
* Día 11: 📝 Test de Autoevaluación 2 sobre pruebas. Dedica la hora y media a contestar. (Duración: 90 minutos)

Bloque 3: Gestión de Proyectos

* Día 12: Estudia metodologías ágiles (Scrum, Kanban) y los roles de cada una. (Duración: 2 horas)
* Día 13: Repasa estimación con story points y planning poker. (Duración: 2 horas)
* Día 14: Estudia métricas de proyecto (velocity, burndown, lead time). (Duración: 2 horas)
* Día 15: Repasa gestión de riesgos. (Duración: 2 horas)
* Día 16: Implementa una práctica: monta un tablero Kanban en Trello con 3 historias de usuario completas. (Duración: 2 horas)
* Día 17: Repasa todos los bloques con una vista global. (Duración: 2 horas)
* Día 18: 📝 Examen final simulacro. Dedica 2 horas y media. (Duración: 150 minutos)
`;

describe("parseNarrative", () => {
  it("parses the real planning into 18 blocks with the right blockGroup", () => {
    const result = parseNarrative(REAL_PLANNING);
    expect(result.ok).toBe(true);
    expect(result.blocks?.length).toBe(18);

    const blocks = result.blocks ?? [];
    expect(blocks.slice(0, 5).every((block) => block.blockGroup === "Gestión de Configuración y DevOps")).toBe(true);
    expect(blocks.slice(5, 11).every((block) => block.blockGroup === "Pruebas de Software")).toBe(true);
    expect(blocks.slice(11, 18).every((block) => block.blockGroup === "Gestión de Proyectos")).toBe(true);

    expect(blocks[0].dayNumber).toBe(1);
    expect(blocks[17].dayNumber).toBe(18);
  });

  it("treats 'Día 5: 📝 Test de Autoevaluación' as exam with high priority and 90 min", () => {
    const result = parseNarrative(REAL_PLANNING);
    const block = result.blocks?.find((b) => b.dayNumber === 5);
    expect(block).toBeDefined();
    expect(block?.durationMinutes).toBe(90);
    expect(block?.type).toBe("exam");
    expect(block?.priority).toBe("high");
  });

  it("recognises explicit duration '2 horas'", () => {
    const result = parseNarrative("* Día 1: Estudia GCS. (2 horas)");
    expect(result.ok).toBe(true);
    expect(result.blocks?.[0].durationMinutes).toBe(120);
  });

  it("ignores lines without 'Día N:' format", () => {
    const result = parseNarrative(`
      Algo aleatorio sin estructura.
      * Día 1: Bloque válido. (1 hora)
      Otra línea suelta.
    `);
    expect(result.ok).toBe(true);
    expect(result.blocks?.length).toBe(1);
    expect(result.blocks?.[0].dayNumber).toBe(1);
  });

  it("returns error when no day lines are present", () => {
    const result = parseNarrative("No hay días aquí, sólo prosa.");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/d[ií]a/i);
  });

  it("infers practice type for hands-on activities", () => {
    const result = parseNarrative(
      "* Día 1: Implementa el laboratorio de Jest. (2 horas)",
    );
    expect(result.blocks?.[0].type).toBe("practice");
  });

  it("infers review type for repaso lines without exam keywords", () => {
    const result = parseNarrative(
      "* Día 1: Repasa los apuntes de la semana. (1 hora)",
    );
    expect(result.blocks?.[0].type).toBe("review");
  });
});

describe("extractDuration", () => {
  it("understands 'hora y media' as 90 minutes", () => {
    expect(extractDuration("Dedica la hora y media a estudiar")).toBe(90);
  });

  it("understands 'media hora' as 30 minutes", () => {
    expect(extractDuration("Solo media hora de repaso")).toBe(30);
  });

  it("understands '2 horas' as 120 minutes", () => {
    expect(extractDuration("Estudia 2 horas")).toBe(120);
  });

  it("understands '90 minutos'", () => {
    expect(extractDuration("Dedica 90 minutos a la práctica")).toBe(90);
  });

  it("understands 'X y media horas'", () => {
    expect(extractDuration("Necesitas 2 horas y media")).toBe(150);
  });

  it("understands '1.5 horas'", () => {
    expect(extractDuration("Reserva 1,5 horas")).toBe(90);
    expect(extractDuration("Reserva 1.5 horas")).toBe(90);
  });

  it("understands 'Xh' shortcut", () => {
    expect(extractDuration("(2h)")).toBe(120);
  });

  it("falls back to 120 minutes when no duration is mentioned", () => {
    expect(extractDuration("Estudia algo")).toBe(120);
  });
});

describe("inferType", () => {
  it("returns 'exam' for tests", () => {
    expect(inferType("📝 Test de Autoevaluación 1")).toBe("exam");
  });

  it("returns 'practice' for laboratorios", () => {
    expect(inferType("Implementa el laboratorio")).toBe("practice");
  });

  it("returns 'review' for repaso", () => {
    expect(inferType("Repasa los apuntes")).toBe("review");
  });

  it("returns 'theory' as default", () => {
    expect(inferType("Estudia conceptos básicos")).toBe("theory");
  });
});

describe("inferPriority", () => {
  it("returns 'high' for exam keywords", () => {
    expect(inferPriority("Test de autoevaluación")).toBe("high");
  });

  it("returns 'high' for emoji marker", () => {
    expect(inferPriority("📝 Repaso final")).toBe("high");
  });

  it("returns 'medium' otherwise", () => {
    expect(inferPriority("Estudia el tema 3")).toBe("medium");
  });
});
