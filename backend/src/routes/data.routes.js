const router = require("express").Router();
const controller = require("../controllers/data.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin", "hr"));

router.post("/import/employees", controller.importEmployees);
router.post("/import/attendance", controller.importAttendance);
router.get("/export/employees", controller.exportEmployees);
router.get("/export/attendance", controller.exportAttendance);

module.exports = router;
