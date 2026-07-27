const router = require("express").Router();
const ctrl = require("../controllers/audit.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);
router.use(authorize("admin"));

router.get("/", ctrl.list);

module.exports = router;
