import type { IncomingMessage, ServerResponse } from 'http';
import { getPool } from '../backend/src/db';

let appModule: any = null;

async function getApp() {
  if (!appModule) {
    appModule = await import('../backend/src/index');
  }
  return appModule;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { app, ensureSchema } = await getApp();

    // Run schema on cold start. Preserve manually entered custom-problem
    // difficulties because legacy schema normalization rewrites them.
    if (!(globalThis as any).__schemaReady) {
      const pool = getPool();
      let customDifficultySnapshot: Array<{ id: number; current_difficulty: number | null }> = [];

      try {
        const snapshotRes = await pool.query(
          'SELECT id, current_difficulty FROM problems WHERE is_custom = TRUE'
        );
        customDifficultySnapshot = snapshotRes.rows;
      } catch {
        // Fresh databases may not have the is_custom column until ensureSchema runs.
      }

      await ensureSchema();

      if (customDifficultySnapshot.length > 0) {
        const params: Array<number | null> = [];
        const values = customDifficultySnapshot.map((row, index) => {
          const base = index * 2;
          params.push(row.id, row.current_difficulty);
          return `($${base + 1}::integer, $${base + 2}::numeric)`;
        }).join(', ');

        await pool.query(
          `UPDATE problems AS p
           SET current_difficulty = snapshot.current_difficulty
           FROM (VALUES ${values}) AS snapshot(id, current_difficulty)
           WHERE p.id = snapshot.id`,
          params
        );
      }

      (globalThis as any).__schemaReady = true;
    }

    return app(req, res);
  } catch (err: any) {
    console.error('Vercel handler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
}

export const config = {
  maxDuration: 30,
};
