const router = require("express").Router();
const ctrl = require("../controllers/report.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/dashboard", authorize("admin", "hr", "manager"), ctrl.dashboardStats);
router.get("/employee-options", authorize("admin", "hr", "manager"), ctrl.employeeOptions);
router.get("/daily", authorize("admin", "hr", "manager"), ctrl.daily);
router.get("/weekly", authorize("admin", "hr", "manager"), ctrl.weekly);
router.get("/monthly", authorize("admin", "hr", "manager"), ctrl.monthly);
router.get("/summary-monthly", authorize("admin", "hr", "manager"), ctrl.summaryMonthly);
router.get("/employee-daily", authorize("admin", "hr", "manager"), ctrl.employeeDaily);
router.get("/department", authorize("admin", "hr", "manager"), ctrl.department);

module.exports = router;
