/**
 * Seed admin user: admin@admin.com / admin123
 * Deletes existing admin first, then recreates fresh.
 * Run: pnpm run db:seed
 */
import { auth } from "../src/auth.js";
import pg from "pg";

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/kovan";

async function seed() {
  const pool = new pg.Pool({ connectionString: DB_URL });

  try {
    // 1. Delete existing admin and all related records
    console.log("[Seed] Cleaning up old admin user...");
    await pool.query(`DELETE FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE email = 'admin@admin.com')`);
    await pool.query(`DELETE FROM "account" WHERE "userId" IN (SELECT id FROM "user" WHERE email = 'admin@admin.com')`);
    await pool.query(`DELETE FROM user_agent_permissions WHERE user_id IN (SELECT id FROM "user" WHERE email = 'admin@admin.com')`);
    await pool.query(`DELETE FROM "user" WHERE email = 'admin@admin.com'`);
    console.log("[Seed] Old admin removed.");

    // 2. Create fresh admin user
    console.log("[Seed] Creating admin user...");
    const result = await auth.api.signUpEmail({
      body: {
        name: "Admin",
        email: "admin@admin.com",
        password: "admin123",
      },
    });

    if (result?.user) {
      console.log(`[Seed] User created: ${result.user.id}`);
      await pool.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [result.user.id]);
      console.log("[Seed] Admin role assigned!");
    }
  } catch (e: any) {
    console.error("[Seed] Error:", e.message);
  }

  await pool.end();
  console.log("[Seed] Done!");
  process.exit(0);
}

seed();
