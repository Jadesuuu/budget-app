// Demo builds only: runs the migrations and the seed once at build time and saves the database to .demo/, so serverless
// cold starts load it (src/lib/demo/database.ts baseDemoDatabase) instead of rebuilding it. A no-op for the real app.
import fs from "node:fs";
import path from "node:path";
import { buildDemoDatabase, SNAPSHOT_FILE, SNAPSHOT_TIME_FILE } from "../src/lib/demo/database.ts";

if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
  const builtAt = Date.now();
  const { db } = await buildDemoDatabase(builtAt);
  const dump = await db.dumpDataDir("gzip");
  await db.close();
  fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, Buffer.from(await dump.arrayBuffer()));
  fs.writeFileSync(SNAPSHOT_TIME_FILE, String(builtAt));
  console.log(`demo snapshot: ${SNAPSHOT_FILE} (${(fs.statSync(SNAPSHOT_FILE).size / 1e6).toFixed(1)} MB)`);
}
