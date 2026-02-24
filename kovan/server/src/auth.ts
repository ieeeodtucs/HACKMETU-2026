import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import pg from "pg";

const DB_URL =
  process.env.DATABASE_URL || "postgresql://postgres@localhost:5432/pardus_c2";

export const auth = betterAuth({
  database: new pg.Pool({ connectionString: DB_URL, max: 5 }),
  basePath: "/api/auth",
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin(),
  ],
  trustedOrigins: ["http://localhost:5173", "http://localhost:4444", "https://pardus-demo.bayburt.lu"],
});
