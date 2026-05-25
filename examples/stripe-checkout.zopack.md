---
format: zopack
version: "1.0"
name: stripe-checkout
description: "Single-product checkout flow with Stripe payments and order tracking"
author: unknown.zo.computer
routes: 4
exported: 2026-05-24
---

# stripe-checkout

Single-product checkout flow with Stripe payments and order tracking

## Routes

### `/` (page, public)

```tsx
import React from "react";

export default function ProductPage() {
  const [loading, setLoading] = React.useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_001" }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Checkout failed: " + (data.error || "Unknown error"));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="max-w-sm w-full space-y-6">
        <div className="aspect-square rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <span className="text-6xl">✦</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Premium Template Pack</h1>
          <p className="text-slate-400">
            A collection of 12 production-ready zo.space templates for dashboards,
            landing pages, and API patterns.
          </p>
          <p className="text-3xl font-bold text-white">$29</p>
        </div>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 font-semibold transition-colors"
        >
          {loading ? "Redirecting to checkout..." : "Buy now"}
        </button>
        <p className="text-xs text-slate-500 text-center">
          Secure payment via Stripe. Instant delivery after purchase.
        </p>
      </div>
    </div>
  );
}
```

### `/success` (page, public)

```tsx
import React from "react";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold">Payment successful!</h1>
        <p className="text-slate-400">
          Thank you for your purchase. Check your email for the download link.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
        >
          Back to store
        </a>
      </div>
    </div>
  );
}
```

### `/api/checkout` (api, public)

```typescript
import Stripe from "stripe";

export default async function handler(c: any) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  const body = await c.req.json();
  const origin = c.req.header("origin") || "https://example.zo.space";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Premium Template Pack" },
            unit_amount: 2900,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: origin,
      metadata: { product_id: body.product_id || "prod_001" },
    });

    return c.json({ url: session.url, session_id: session.id });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
}
```

### `/api/webhook` (api, public)

```typescript
import Stripe from "stripe";

export default async function handler(c: any) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" });
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  if (c.req.method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  const rawBody = await c.req.text();
  const sig = c.req.header("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return c.json({ error: `Webhook verification failed: ${err.message}` }, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const order = {
      id: session.id,
      email: session.customer_details?.email || "unknown",
      amount: session.amount_total,
      product_id: session.metadata?.product_id,
      completed_at: new Date().toISOString(),
    };

    const fs = await import("fs");
    const ordersPath = "/home/workspace/Data/orders.json";
    let orders: any[] = [];
    try {
      orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
    } catch {}
    orders.push(order);
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  }

  return c.json({ received: true });
}
```

## Dependencies

**npm packages** (not in default zo.space):
- `stripe`

## Setup

**Directories to create:**
- `Data`

**Files to initialize:**
- `Data/orders.json` with content: `[]`

**Secrets required** (configure in Settings > Advanced):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
