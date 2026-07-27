import { useEffect, useState } from "react";
import API from "../services/api";
import Icon from "../components/Icon";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => { API.get("/notifications").then((r) => setNotifications(r.data)).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await API.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await API.put("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unread = notifications.filter((n) => !n.is_read).length;

  const typeIcon = (type) => {
    const map = { approval: "check-circle", sync: "sync", leave: "calendar", request_update: "file-text", system: "settings" };
    return map[type] || "bell";
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">System</p><h1>Notifications</h1><p>{unread > 0 ? `${unread} unread notification${unread > 1 ? "s" : ""}` : "All caught up!"}</p></div>
        {unread > 0 && <button className="btn btn-ghost" onClick={markAllRead}>Mark all as read</button>}
      </div>

      <div className="panel">
        <div className="table-wrap">
          {loading ? <div className="table-message">Loading...</div>
          : notifications.length ? notifications.map((n) => (
            <div key={n.id} className={`notification-item ${n.is_read ? "" : "notification-unread"}`} onClick={() => !n.is_read && markRead(n.id)}>
              <div className="notification-icon"><Icon name={typeIcon(n.type)} size={18} /></div>
              <div className="notification-content">
                <div className="notification-title">{n.title}</div>
                <div className="notification-message">{n.message}</div>
                <div className="notification-time">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.is_read && <div className="notification-dot" />}
            </div>
          )) : <div className="table-message">No notifications.</div>}
        </div>
      </div>
    </div>
  );
}
