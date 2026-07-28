const router = require("express").Router();
const ctrl = require("../controllers/department.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", ctrl.list);
router.get("/:id", ctrl.get);
router.post("/", ctrl.create);
router.put("/:id", ctrl.update);
router.delete("/:id", ctrl.remove);
router.post("/:id/assign", ctrl.assignUser);
router.delete("/:id/assignments/:assignmentId", ctrl.removeAssignment);

module.exports = router;
