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

// Allow requests from any frontend
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
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
