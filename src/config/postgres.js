import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

export async function checkPostgres() {
  const result = await pool.query("SELECT NOW()");
  return result.rows[0];
}
