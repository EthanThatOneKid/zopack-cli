---
format: zopack
version: "1.0"
name: blog-engine
description: "Self-hosted blog with markdown posts, a public feed, and a private admin panel"
author: unknown.zo.computer
routes: 5
exported: 2026-05-24
---

# blog-engine

Self-hosted blog with markdown posts, a public feed, and a private admin panel

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function BlogIndex() {
  const [posts, setPosts] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch("/api/posts").then((r) => r.json()).then((d) => setPosts(d.posts || []));
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">Blog</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Thoughts and notes</p>
        </header>
        <div className="space-y-6">
          {posts.map((post) => (
            <article key={post.id} className="border-b border-slate-200 dark:border-slate-800 pb-6">
              <a href={`/post/${post.id}`} className="block group">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                  {post.title}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{post.date}</p>
                <p className="text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">{post.excerpt}</p>
              </a>
            </article>
          ))}
          {posts.length === 0 && (
            <p className="text-slate-400">No posts yet. Create one from the admin panel.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### `/post/:id` (page, public)

```tsx
import React from "react";

export default function PostPage() {
  const [post, setPost] = React.useState<any>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const id = window.location.pathname.split("/").pop();
    fetch(`/api/posts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setPost)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <p className="text-slate-500">Post not found.</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
        <p className="text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-8">
      <article className="max-w-2xl mx-auto space-y-6">
        <a href="/" className="text-blue-600 text-sm hover:underline">← All posts</a>
        <header>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{post.title}</h1>
          <p className="text-slate-500 text-sm mt-2">{post.date}</p>
        </header>
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />
      </article>
    </div>
  );
}
```

### `/admin` (page, private)

```tsx
import React from "react";

export default function AdminPage() {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${prompt("Enter admin token:")}`,
      },
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) {
      setStatus("Published!");
      setTitle("");
      setContent("");
    } else {
      const err = await res.json();
      setStatus(`Error: ${err.error}`);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin: New post</h1>
        <form onSubmit={handlePublish} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            required
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-slate-900 dark:text-white"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write in markdown..."
            required
            rows={12}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-slate-900 dark:text-white font-mono text-sm"
          />
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Publish
          </button>
        </form>
        {status && <p className="text-sm text-slate-500">{status}</p>}
      </div>
    </div>
  );
}
```

### `/api/posts` (api, public)

```typescript
import { marked } from "marked";

export default async function handler(c: any) {
  const fs = await import("fs");
  const dataPath = "/home/workspace/Data/posts/index.json";

  let posts: any[] = [];
  try {
    posts = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch {}

  if (c.req.method === "GET") {
    const summaries = posts.map((p: any) => ({
      id: p.id,
      title: p.title,
      date: p.date,
      excerpt: p.content.slice(0, 120) + (p.content.length > 120 ? "..." : ""),
    }));
    return c.json({ posts: summaries, count: posts.length });
  }

  if (c.req.method === "POST") {
    const token = c.req.header("authorization")?.replace("Bearer ", "");
    if (token !== process.env.ADMIN_TOKEN) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    if (!body.title || !body.content) {
      return c.json({ error: "title and content required" }, 400);
    }

    const post = {
      id: Date.now().toString(36),
      title: body.title,
      content: body.content,
      date: new Date().toISOString().split("T")[0],
    };
    posts.unshift(post);
    fs.writeFileSync(dataPath, JSON.stringify(posts, null, 2));
    return c.json({ created: post.id }, 201);
  }

  return c.json({ error: "Method not allowed" }, 405);
}
```

### `/api/posts/:id` (api, public)

```typescript
import { marked } from "marked";

export default async function handler(c: any) {
  const fs = await import("fs");
  const dataPath = "/home/workspace/Data/posts/index.json";
  const id = c.req.param("id");

  let posts: any[] = [];
  try {
    posts = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch {}

  const post = posts.find((p: any) => p.id === id);
  if (!post) return c.json({ error: "Not found" }, 404);

  if (c.req.method === "GET") {
    return c.json({
      ...post,
      html: marked(post.content),
    });
  }

  if (c.req.method === "DELETE") {
    const token = c.req.header("authorization")?.replace("Bearer ", "");
    if (token !== process.env.ADMIN_TOKEN) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const filtered = posts.filter((p: any) => p.id !== id);
    fs.writeFileSync(dataPath, JSON.stringify(filtered, null, 2));
    return c.json({ deleted: id });
  }

  return c.json({ error: "Method not allowed" }, 405);
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `marked`

## Setup

**Directories to create:**
- `Data/posts`

**Files to initialize:**
- `Data/posts/index.json` with content: `[]`

**Secrets required** (configure in Settings > Advanced):
- `ADMIN_TOKEN`
