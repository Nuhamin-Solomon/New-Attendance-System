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

const { fullSync, computeAttendanceSummary } = require("./src/services/syncService");

const app = express();

app.use(cors());
app.use(express.json());

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

app.get("/", (req, res) => {
  res.json({ success: true, message: "Kifiya Attendance Backend Running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  console.log("Computing attendance summary from existing data...");
  try {
    await computeAttendanceSummary();
    console.log("Initial summary computation done.");
  } catch (e) {
    console.error("Initial computation error:", e.message);
  }

  console.log("Starting auto-sync every 60 seconds from BioTime...");
  setInterval(async () => {
    try {
      await fullSync();
    } catch (e) {
      console.error("Auto-sync error:", e.message);
    }
  }, 60 * 1000);
});
