const router = require("express").Router();
const ctrl = require("../controllers/user.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", ctrl.list);
router.get("/:id", ctrl.get);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.put("/:id/reset-password", ctrl.resetPassword);
router.delete("/:id", ctrl.remove);

module.exports = router;
