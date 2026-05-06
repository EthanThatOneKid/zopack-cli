export default async function handler(c: any) {
  const name = c.req.query("name") || "World";
  return c.json({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
    env_check: process.env.DATABASE_URL ? "Configured" : "Missing"
  });
}
