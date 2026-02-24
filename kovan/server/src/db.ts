/**
 * PostgreSQL connection pool — CVE veritabani
 */
import pg from "pg";

const DB_URL =
  process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/pardus_c2";

export const pool = new pg.Pool({ connectionString: DB_URL, max: 10 });

// Test connection on startup
pool.query("SELECT 1").then(() => {
  console.log("[DB] PostgreSQL baglantisi basarili");
}).catch((err) => {
  console.error("[DB] PostgreSQL baglanamadi:", err.message);
});
