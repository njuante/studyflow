export const NARRATIVE_TEMPLATE = `# Planning de estudio

Genera mi plan de estudio siguiendo este formato exacto. NO añadas markdown ni explicaciones extra, solo el plan.

Bloque 1: [Nombre del bloque temático]

* Día 1: [Título corto]. [Descripción detallada de qué estudiar y cómo, ~2 frases]. (Duración: 2 horas)
* Día 2: [Título]. [Descripción]. (Duración: 90 minutos)
* Día 3: [Título]. [Descripción]. (Duración: 2 horas)
...

Bloque 2: [Otro bloque temático]

* Día 6: [Título]. [Descripción]. (Duración: 90 minutos)
* Día 7: [Título]. [Descripción]. (Duración: 2 horas)
...

Reglas:
- Cada día puede tener una o varias actividades, pero no más de 8 horas en total
- Indica siempre la duración entre paréntesis al final
- Usa 'Día N:' al principio (con la N en arábigo)
- Agrupa por bloques temáticos numerados ('Bloque 1:', 'Bloque 2:'...)
`;

export const JSON_TEMPLATE = `[
  {
    "title": "TFG · Marco teórico",
    "description": "Lectura de los 3 papers base y resumen en una página",
    "date": "2026-05-06",
    "startTime": "09:00",
    "durationMinutes": 120,
    "tagId": "tfg",
    "type": "theory",
    "priority": "medium"
  },
  {
    "title": "eJPT · Lab nmap",
    "description": "Reconocimiento de la red 10.10.0.0/16",
    "date": "2026-05-06",
    "startTime": "16:00",
    "durationMinutes": 90,
    "tagId": "ejpt",
    "type": "practice",
    "priority": "high"
  }
]
`;
