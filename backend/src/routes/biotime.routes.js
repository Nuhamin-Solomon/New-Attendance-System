const router = require("express").Router();

const controller = require("../controllers/biotime.controller");


router.get(
    "/employees",
    controller.employees
);


router.get(
    "/attendance/:empCode",
    controller.attendance
);


module.exports = router;