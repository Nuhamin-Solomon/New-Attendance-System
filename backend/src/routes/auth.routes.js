const router = require("express").Router();
const { login, me, changePassword, forceChangePassword, register } = require("../controllers/auth.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.post("/login", login);
router.get("/me", authenticate, me);
router.put("/change-password", authenticate, changePassword);
router.put("/force-change-password", authenticate, forceChangePassword);
router.post("/register", authenticate, authorize("admin"), register);

module.exports = router;
