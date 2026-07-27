const router = require("express").Router();
const ctrl = require("../controllers/settings.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", ctrl.list);
router.put("/", ctrl.update);

module.exports = router;
