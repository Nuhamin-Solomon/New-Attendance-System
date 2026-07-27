require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "migration.sql"), "utf8");
    await pool.query(sql);
    console.log("Migration completed successfully.");
  } catch (e) {
    console.error("Migration failed:", e.message);
  } finally {
    pool.end();
  }
}
migrate();
