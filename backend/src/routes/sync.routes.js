const router = require("express").Router();

const controller = require("../controllers/sync.controller");


router.post(
    "/employees",
    controller.employees
);


router.post(
    "/attendance",
    controller.attendance
);


module.exports = router;