const router = require("express").Router();
const controller = require("../controllers/sync.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin", "hr"));

router.post("/employees", controller.employees);
router.post("/attendance", controller.attendance);
router.post("/full", controller.full);

module.exports = router;
