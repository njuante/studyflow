import { useEffect, useState } from "react";

import styles from "./AmbientMesh.module.css";

type Blob = { x: number; y: number; color: string; size: number };
type MeshKeyframe = {
  hour: number;
  blobs: Blob[];
  base: string;
};

const LIGHT_KEYFRAMES: MeshKeyframe[] = [
  {
    hour: 6,
    base: "#FFE5D0",
    blobs: [
      { x: 12, y: 18, color: "#FFB37A", size: 38 },
      { x: 88, y: 8, color: "#FF8E5C", size: 35 },
      { x: 75, y: 88, color: "#FF9CAF", size: 38 },
      { x: 25, y: 72, color: "#7AB8E0", size: 40 },
    ],
  },
  {
    hour: 13,
    base: "#E8F2FB",
    blobs: [
      { x: 18, y: 28, color: "#A0D4F0", size: 42 },
      { x: 82, y: 18, color: "#FFF1C0", size: 40 },
      { x: 62, y: 92, color: "#C5E8FA", size: 40 },
      { x: 38, y: 62, color: "#FFD9A0", size: 36 },
    ],
  },
  {
    hour: 19,
    base: "#FFD8DC",
    blobs: [
      { x: 8, y: 22, color: "#FF9AB5", size: 40 },
      { x: 92, y: 12, color: "#FF7050", size: 36 },
      { x: 78, y: 82, color: "#C589DD", size: 42 },
      { x: 22, y: 78, color: "#FF8E5C", size: 38 },
    ],
  },
  {
    hour: 0,
    base: "#0F1530",
    blobs: [
      { x: 18, y: 22, color: "#3B4F8A", size: 45 },
      { x: 82, y: 12, color: "#5A4A95", size: 42 },
      { x: 68, y: 82, color: "#1F2C42", size: 48 },
      { x: 28, y: 72, color: "#2B3F58", size: 42 },
    ],
  },
];

const DARK_KEYFRAMES: MeshKeyframe[] = [
  {
    hour: 6,
    base: "#0A0F1A",
    blobs: [
      { x: 12, y: 18, color: "#3D2A18", size: 42 },
      { x: 88, y: 8, color: "#42261C", size: 38 },
      { x: 75, y: 88, color: "#2F1F2F", size: 40 },
      { x: 25, y: 72, color: "#152838", size: 42 },
    ],
  },
  {
    hour: 13,
    base: "#070C18",
    blobs: [
      { x: 18, y: 28, color: "#1A2D45", size: 45 },
      { x: 82, y: 18, color: "#322B18", size: 40 },
      { x: 62, y: 92, color: "#15263A", size: 42 },
      { x: 38, y: 62, color: "#382816", size: 38 },
    ],
  },
  {
    hour: 19,
    base: "#15081C",
    blobs: [
      { x: 8, y: 22, color: "#3D1E32", size: 42 },
      { x: 92, y: 12, color: "#421F18", size: 38 },
      { x: 78, y: 82, color: "#2E1A40", size: 45 },
      { x: 22, y: 78, color: "#3D1F1F", size: 40 },
    ],
  },
  {
    hour: 0,
    base: "#04060C",
    blobs: [
      { x: 18, y: 22, color: "#152138", size: 45 },
      { x: 82, y: 12, color: "#1F1838", size: 42 },
      { x: 68, y: 82, color: "#0A1422", size: 48 },
      { x: 28, y: 72, color: "#0F1828", size: 42 },
    ],
  },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function interpolateMesh(now: Date, dark: boolean): MeshKeyframe {
  const keyframes = dark ? DARK_KEYFRAMES : LIGHT_KEYFRAMES;
  const hourFloat = now.getHours() + now.getMinutes() / 60;

  const sorted = [...keyframes, { ...keyframes[0], hour: 24 }];
  let prev = sorted[0];
  let next = sorted[1];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    if (hourFloat >= sorted[i].hour && hourFloat < sorted[i + 1].hour) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }
  const span = next.hour - prev.hour;
  const t = span === 0 ? 0 : (hourFloat - prev.hour) / span;

  return {
    hour: hourFloat,
    base: lerpColor(prev.base, next.base, t),
    blobs: prev.blobs.map((blob, index) => ({
      x: lerp(blob.x, next.blobs[index].x, t),
      y: lerp(blob.y, next.blobs[index].y, t),
      size: lerp(blob.size, next.blobs[index].size, t),
      color: lerpColor(blob.color, next.blobs[index].color, t),
    })),
  };
}

function buildBackgroundCss(mesh: MeshKeyframe): string {
  const layers = mesh.blobs
    .map(
      (blob) =>
        `radial-gradient(at ${blob.x}% ${blob.y}%, ${blob.color} 0%, transparent ${blob.size}%)`,
    )
    .join(", ");
  return `${layers}, ${mesh.base}`;
}

interface AmbientMeshProps {
  dark: boolean;
}

export function AmbientMesh({ dark }: AmbientMeshProps) {
  const [bg, setBg] = useState(() =>
    buildBackgroundCss(interpolateMesh(new Date(), dark)),
  );

  useEffect(() => {
    function update() {
      setBg(buildBackgroundCss(interpolateMesh(new Date(), dark)));
    }
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [dark]);

  return (
    <div aria-hidden="true" className={styles.mesh} style={{ background: bg }} />
  );
}
