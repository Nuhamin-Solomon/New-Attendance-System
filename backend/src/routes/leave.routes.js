const router = require("express").Router();
const ctrl = require("../controllers/leave.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/types", ctrl.listTypes);
router.get("/balances/:employeeId?", ctrl.balances);
router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.put("/:id/cancel", ctrl.cancel);
router.put("/:id/approve", authorize("hr", "admin"), ctrl.approve);
router.put("/:id/reject", authorize("hr", "admin"), ctrl.reject);

module.exports = router;
