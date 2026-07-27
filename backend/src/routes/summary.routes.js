const router = require("express").Router();
const ctrl = require("../controllers/summary.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", authorize("hr", "admin", "manager"), ctrl.list);
router.get("/my", ctrl.myAttendance);
router.get("/my-team", authorize("manager"), ctrl.myTeam);

module.exports = router;
