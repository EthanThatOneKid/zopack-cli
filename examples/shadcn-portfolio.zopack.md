---
format: zopack
version: "1.0"
name: shadcn-portfolio
description: "Polished developer portfolio using shadcn/ui and AnimateUI components"
author: demo.zo.computer
routes: 3
exported: 2026-05-24
---

# shadcn-portfolio

Polished developer portfolio using shadcn/ui and AnimateUI components

## Routes

### `/` (page, public)

```tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FadeIn } from "@/components/animate-ui/fade-in";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-12">
        <FadeIn>
          <header className="flex items-center gap-6">
            <Avatar className="w-20 h-20">
              <AvatarImage src="https://{{HANDLE}}.zo.space/assets/avatar.jpg" />
              <AvatarFallback>ZO</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">{{HANDLE}}</h1>
              <p className="text-muted-foreground text-lg">Full-stack developer</p>
            </div>
          </header>
        </FadeIn>

        <FadeIn>
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">About</h2>
            <p className="text-muted-foreground leading-relaxed">
              I build tools that make developers' lives easier. Passionate about
              open source, personal computing, and clean interfaces.
            </p>
          </section>
        </FadeIn>

        <div className="flex gap-3">
          <Button asChild>
            <a href="/projects">View projects</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/contact">Get in touch</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### `/projects` (page, public)

```tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animate-ui/fade-in";

const projects = [
  { title: "Zopack CLI", description: "Package and share zo.space setups", url: "https://github.com/example/zopack-cli", tech: "TypeScript, Bun" },
  { title: "Task Flow", description: "Kanban board for personal task management", url: "https://github.com/example/task-flow", tech: "React, SQLite" },
  { title: "Markdown Notes", description: "A notes app with live preview", url: "https://github.com/example/md-notes", tech: "Hono, marked" },
];

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">Things I've built</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <FadeIn key={project.title}>
              <Card>
                <CardHeader>
                  <CardTitle>{project.title}</CardTitle>
                  <CardDescription>{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{project.tech}</p>
                  <Button size="sm" variant="outline" asChild>
                    <a href={project.url} target="_blank" rel="noopener">View source</a>
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
        <Button variant="ghost" asChild>
          <a href="/">← Back home</a>
        </Button>
      </div>
    </div>
  );
}
```

### `/contact` (page, public)

```tsx
import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  const [sent, setSent] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-md mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Contact</h1>
          <p className="text-muted-foreground mt-1">Send me a message</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Get in touch</CardTitle>
          </CardHeader>
          <CardContent>
            {sent ? (
              <p className="text-green-500 font-medium">Message sent! I'll get back to you soon.</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="your@email.com"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <textarea
                  placeholder="Your message..."
                  required
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button type="submit" className="w-full">Send message</Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Button variant="ghost" asChild>
          <a href="/">← Back home</a>
        </Button>
      </div>
    </div>
  );
}
```

## Dependencies

**Components** (install via shadcn CLI):
- `shadcn:button`
- `shadcn:card`
- `shadcn:avatar`
- `https://animate-ui.com/r/fade-in.json`

## Variables

| Placeholder | Description |
|---|---|
| `{{HANDLE}}` | Your zo.space handle (replaces `demo`) |
