const router = require("express").Router();
const ctrl = require("../controllers/notification.controller");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

router.get("/", ctrl.list);
router.get("/unread-count", ctrl.unreadCount);
router.put("/:id/read", ctrl.markRead);
router.put("/read-all", ctrl.markAllRead);

module.exports = router;
