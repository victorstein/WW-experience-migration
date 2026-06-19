import { app, getCursor, setCursor, runSlice, sliceCount } from "./api";
import type { AppEnv } from "./db";

export default {
  fetch: app.fetch,

  // Cron-owned cursor: each tick processes the next slice, then advances.
  async scheduled(_event: ScheduledController, env: AppEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const n = sliceCount();
        const cursor = (await getCursor(env.DB)) % n;
        await runSlice(env, cursor, Math.floor(Date.now() / 1000));
        await setCursor(env.DB, (cursor + 1) % n);
      })()
    );
  },
};
