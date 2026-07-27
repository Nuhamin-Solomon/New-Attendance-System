const router = require("express").Router();
const ctrl = require("../controllers/request.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.put("/:id/cancel", ctrl.cancel);
router.put("/:id/manager", authorize("manager", "hr", "admin"), ctrl.approveManager);
router.put("/:id/hr", authorize("hr", "admin"), ctrl.approveHR);

module.exports = router;
