const router = require("express").Router();
const { login, me, changePassword, forceChangePassword, register, forgotPassword, resetPassword, activity } = require("../controllers/auth.controller");
const { authenticate, authorize } = require("../middleware/auth");

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authenticate, me);
router.post("/activity", authenticate, activity);
router.put("/change-password", authenticate, changePassword);
router.put("/force-change-password", authenticate, forceChangePassword);
router.post("/register", authenticate, authorize("admin"), register);

module.exports = router;
