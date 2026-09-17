const router = require("express").Router();

const controller = require("../controllers/biotime.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate, authorize("admin", "hr"));

router.get(
    "/employees",
    controller.employees
);


router.get(
    "/attendance/:empCode",
    controller.attendance
);


module.exports = router;
