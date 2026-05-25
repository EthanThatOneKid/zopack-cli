---
format: zopack
version: "1.0"
name: personal-landing
description: "A minimal personal landing page with bio, links, and social profiles"
author: unknown.zo.computer
routes: 1
exported: 2026-05-24
---

# personal-landing

A minimal personal landing page with bio, links, and social profiles

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <img
          src="https://api.dicebear.com/9.x/initials/svg?seed=ZO"
          alt="Avatar"
          className="w-24 h-24 rounded-full mx-auto ring-4 ring-blue-500/30"
        />
        <div>
          <h1 className="text-3xl font-bold text-white">Your Name</h1>
          <p className="text-slate-400 mt-1">Developer &amp; maker of things</p>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          Building tools for the web. Currently working on open-source projects
          and exploring what's possible with personal computing.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="https://github.com"
            className="block px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://twitter.com"
            className="block px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Twitter / X
          </a>
          <a
            href="mailto:hello@example.com"
            className="block px-4 py-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Email me
          </a>
        </div>
      </div>
    </div>
  );
}
```
