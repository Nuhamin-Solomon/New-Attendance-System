const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./src/routes/auth.routes");
const userRoutes = require("./src/routes/user.routes");
const employeeRoutes = require("./src/routes/employee.routes");
const attendanceRoutes = require("./src/routes/attendance.routes");
const syncRoutes = require("./src/routes/sync.routes");
const biotimeRoutes = require("./src/routes/biotime.routes");
const leaveRoutes = require("./src/routes/leave.routes");
const requestRoutes = require("./src/routes/request.routes");
const reportRoutes = require("./src/routes/report.routes");
const notificationRoutes = require("./src/routes/notification.routes");
const settingsRoutes = require("./src/routes/settings.routes");
const auditRoutes = require("./src/routes/audit.routes");
const summaryRoutes = require("./src/routes/summary.routes");
const departmentRoutes = require("./src/routes/department.routes");
const dataRoutes = require("./src/routes/data.routes");

const {
  fullSync,
  computeAttendanceSummary,
} = require("./src/services/syncService");

const app = express();

// CORS. The Vercel-hosted frontend (https://*.vercel.app) talks to this API
// cross-origin. We allow any configured origin plus all Vercel app domains:
//   - CORS_ORIGINS   : comma-separated list (default = local dev origins)
//   - *.vercel.app   : Vercel preview/production frontend
// Non-allowed origins do NOT cause a 500; they simply get no CORS headers and
// the browser blocks them (same behaviour as before, but no server crash).
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/\.vercel\.app$/i.test(origin)) return true;
  return false;
}

app.use(cors({
  origin(origin, callback) {
    if (isOriginAllowed(origin)) return callback(null, true);
    console.error(`[cors] Blocked cross-origin request from: ${origin}`);
    return callback(null, false);
  },
}));

// Parse JSON
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/biotime", biotimeRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/data", dataRoutes);

// Root
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Attendance Backend Running",
  });
});

// Health Check
app.get("/api/health", async (req, res) => {
  const pool = require("./src/config/db");
  let db = false;
  try {
    const result = await pool.query("SELECT NOW() AS now");
    db = result.rows.length > 0;
  } catch (e) {
    db = false;
  }
  res.json({
    ok: true,
    uptime: process.uptime(),
    db,
    env: process.env.NODE_ENV || "development",
  });
});

// 404 handler (JSON for the SPA/API)
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler: always log the real backend error so it can be
// identified in Vercel function logs, and return a safe JSON message.
app.use((err, req, res, next) => {
  const code = err.status || err.statusCode || 500;
  const message = (err.response && err.response.data && (err.response.data.error || err.response.data.message))
    || err.message || "Internal server error";
  console.error(`[api-error] ${req.method} ${req.originalUrl} -> ${code}`, err);
  res.status(code).json({ error: message });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);

    console.log("Computing attendance summary...");

    try {
      await computeAttendanceSummary();
      console.log("Attendance summary completed.");
    } catch (err) {
      console.error(err);
    }

    console.log("Starting BioTime Auto Sync...");

    const SYNC_INTERVAL_MS = parseInt(process.env.BIOTIME_SYNC_INTERVAL_MS || "60000", 10);
    let syncRunning = false;

    setInterval(async () => {
      if (syncRunning) return;
      syncRunning = true;
      try {
        await fullSync();
      } catch (err) {
        console.error(err);
      } finally {
        syncRunning = false;
      }
    }, SYNC_INTERVAL_MS);
  });
}
