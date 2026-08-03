require("dotenv").config();

const { Pool, types } = require("pg");

// BioTime stores punch times as local wall-clock times in the device timezone
// (UTC+3 / Africa/Nairobi). The database keeps them in `timestamp without time
// zone` columns. node-postgres would otherwise interpret those wall-clock values
// as Date objects in the Node process timezone and re-serialize them as UTC
// instants, shifting every displayed time. To preserve the exact BioTime
// wall-clock value end-to-end, return `timestamp without time zone` (OID 1114)
// and `date` (OID 1082) as their raw strings and pin the session timezone so
// insert/AT TIME ZONE conversions are deterministic.
types.setTypeParser(1114, (str) => str);
types.setTypeParser(1082, (str) => str);

// Support managed Postgres: a single DATABASE_URL connection string takes
// precedence. Individual DB_* vars remain as the fallback (local dev).
const isManagedHost = (host = "") =>
  /\.(railway\.app|render\.com|neon\.tech|rds\.amazonaws\.com|supabase\.co)$/i.test(host);

let poolConfig;
if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isManagedHost(new URL(process.env.DATABASE_URL).hostname) && process.env.DB_SSL !== "false",
  };
} else {
  poolConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

poolConfig.options = "-c TimeZone=Africa/Nairobi";
poolConfig.connectionTimeoutMillis = 10000;

const pool = new Pool(poolConfig);


pool.connect()
.then(() => {
    console.log("Database connected successfully");
})
.catch((error)=>{
    console.error(
        "Database connection error:",
        error.message
    );
});


module.exports = pool;