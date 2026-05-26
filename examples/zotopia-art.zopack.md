---
format: zopack
version: "1.0"
name: zotopia-art
description: "Zotopia event art experience — interactive grid landing page with blue gradient theme"
author: etok.zo.computer
routes: 1
exported: 2026-05-26
---

# Zotopia Art Experience

Interactive grid landing page for the Zotopia event. Real-time grid population, blue gradient theme, hover reveals project details.

## Routes

### `/` (page, public)

```tsx
import React, { useState, useEffect } from "react";

// Grid configuration
const GRID_SIZE = 64; // 8x8 grid
const HEX_CODES = [
  "#0a1628", "#0d1f3c", "#102848", "#133154",
  "#163a60", "#19436c", "#1c4c78", "#1f5584",
  "#225e90", "#25679c", "#2870a8", "#2b79b4",
  "#2e82c0", "#318bcc", "#3494d8", "#379de4",
  "#3aa6f0", "#3dafff", "#40b8ff", "#43c1ff",
];

// Visual concept components
const ZOKeyboard = () => (
  <div className="relative">
    <div className="text-6xl font-mono font-bold text-white">
      <span className="bg-blue-600 px-3 py-1 rounded">Z</span>
      <span className="bg-blue-500 px-3 py-1 rounded ml-1">O</span>
    </div>
    <div className="text-xs text-blue-300 mt-2">press any key to continue</div>
  </div>
);

const PixelatedEye = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <rect x="10" y="30" width="80" height="40" fill="white" rx="5" />
    <circle cx="50" cy="50" r="15" fill="#0a1628" />
    <circle cx="55" cy="47" r="5" fill="white" />
    <rect x="45" y="5" width="10" height="25" fill="#1c4c78" />
    <rect x="20" y="35" width="5" height="5" fill="#43c1ff" />
    <rect x="30" y="35" width="5" height="5" fill="#43c1ff" />
    <rect x="65" y="35" width="5" height="5" fill="#43c1ff" />
    <rect x="75" y="35" width="5" height="5" fill="#43c1ff" />
  </svg>
);

const CodeComputer = () => (
  <div className="bg-zinc-900 p-4 rounded-lg border border-blue-500/30">
    <div className="text-xs text-blue-400 mb-2">// zo.space/index.tsx</div>
    <pre className="text-xs text-green-400 overflow-hidden">
{`<Zo onSuccess={() => (
  <Cloud>
    <You />
  </Cloud>
)} />`}
    </pre>
    <div className="h-20 bg-gradient-to-b from-blue-900/50 to-transparent mt-2 rounded" />
  </div>
);

const PersonalCloud = () => (
  <div className="relative">
    <div className="text-4xl">☁️</div>
    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
      <div className="w-6 h-8 bg-blue-300 rounded-t-full" />
      <div className="w-8 h-10 bg-blue-400 rounded-t-full" />
      <div className="w-6 h-8 bg-blue-300 rounded-t-full" />
    </div>
    <div className="text-xs text-blue-200 mt-6 text-center">Your Personal Cloud</div>
  </div>
);

const CursorGlitch = () => (
  <div className="relative font-mono text-sm">
    <span className="text-white">pointer</span>
    <span className="text-blue-400 animate-pulse">_</span>
    <div className="text-xs text-zinc-500 mt-2">Toronto · New York</div>
  </div>
);

const VISUAL_CONCEPTS = [ZOKeyboard, PixelatedEye, CodeComputer, PersonalCloud, CursorGlitch];

// Project data for hover reveals
const PROJECT_DATA = [
  { name: "Zo Space", desc: "Your personal cloud computer", color: "#3aa6f0" },
  { name: "Zopack CLI", desc: "Local dev for Zo spaces", color: "#2e82c0" },
  { name: "Worlds Client", desc: "RDF graph database", color: "#25679c" },
  { name: "EDD Launchpad", desc: "Eval-driven development", color: "#1c4c78" },
];

export default function ZotopiaLanding() {
  const [grid, setGrid] = useState<string[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Simulate real-time grid population
    const timer = setTimeout(() => {
      const newGrid = Array(GRID_SIZE).fill(null).map((_, i) => {
        const colorIndex = Math.floor(Math.random() * HEX_CODES.length);
        return HEX_CODES[colorIndex];
      });
      setGrid(newGrid);
      setLoaded(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getProjectForCell = (index: number) => {
    return PROJECT_DATA[index % PROJECT_DATA.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-blue-50 to-blue-100">
      {/* Header */}
      <div className="pt-12 pb-8 text-center">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-900">
          ZOTOPIA
        </h1>
        <p className="mt-2 text-blue-600/70 text-sm">Interactive Art Experience</p>
      </div>

      {/* Main Grid */}
      <div className="max-w-2xl mx-auto px-4 pb-12">
        <div
          className="grid gap-0 rounded-xl overflow-hidden border border-blue-200/50 shadow-2xl"
          style={{
            gridTemplateColumns: `repeat(8, 1fr)`,
            background: "linear-gradient(135deg, #ffffff 0%, #e0f0ff 50%, #c0d8f0 100%)",
          }}
        >
          {grid.map((color, index) => {
            const project = getProjectForCell(index);
            const isHovered = hoveredIndex === index;
            return (
              <div
                key={index}
                className="aspect-square cursor-pointer transition-all duration-300 relative group"
                style={{ backgroundColor: color || "#e8f4fc" }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {isHovered && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-xs p-2 z-10 animate-in fade-in zoom-in duration-200">
                    <span className="font-bold text-blue-300">{project.name}</span>
                    <span className="text-zinc-300 text-[10px] mt-1">{project.desc}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Grid legend */}
        <div className="mt-6 flex justify-center gap-4 text-xs text-blue-600/60">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: HEX_CODES[0] }} />
            Dark
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: HEX_CODES[HEX_CODES.length - 1] }} />
            Light
          </span>
          <span className="text-blue-400">Hover for details</span>
        </div>
      </div>

      {/* Visual concepts showcase */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-semibold text-blue-900 mb-6 text-center">Design Concepts</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {VISUAL_CONCEPTS.map((Concept, i) => (
            <div
              key={i}
              className="bg-white/50 backdrop-blur rounded-xl p-4 border border-blue-200/30 flex items-center justify-center h-32"
            >
              <Concept />
            </div>
          ))}
        </div>
      </div>

      {/* Download section */}
      <div className="max-w-2xl mx-auto px-4 pb-16 text-center">
        <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-all">
          Download Grid as Art
        </button>
        <p className="mt-2 text-xs text-blue-500/60">Your unique Zotopia artifact</p>
      </div>

      {/* Footer */}
      <div className="text-center pb-8 text-xs text-blue-400/50">
        <span>Built with Zo Computer</span>
        <span className="mx-2">·</span>
        <span>Less than 30 days to execution</span>
      </div>
    </div>
  );
}
```

## Dependencies

**npm packages** (in default zo.space):
- `react` (built-in)

## Setup

No secrets required.