import { useEffect, useState, useCallback } from "react";
import API from "../services/api";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";

const PAGE_SIZE = 25;

export default function Notifications() {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notifRes, unreadRes] = await Promise.all([
        API.get("/notifications", { params: { page, limit: PAGE_SIZE } }),
        API.get("/notifications/unread-count"),
      ]);
      const d = notifRes.data;
      if (Array.isArray(d)) {
        const start = (page - 1) * PAGE_SIZE;
        setNotifications(d.slice(start, start + PAGE_SIZE));
        setTotal(d.length);
        setTotalPages(Math.max(1, Math.ceil(d.length / PAGE_SIZE)));
      } else {
        setNotifications(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      }
      setUnreadCount(unreadRes.data.count || 0);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await API.put(`/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await API.put("/notifications/read-all");
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const typeIcon = (type) => {
    const map = { approval: "check-circle", sync: "sync", leave: "calendar", request_update: "file-text", system: "settings" };
    return map[type] || "bell";
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">System</p><h1>Notifications</h1><p>{unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}</p></div>
        {unreadCount > 0 && <button className="btn btn-ghost" onClick={markAllRead}>Mark all as read</button>}
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
        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="notifications" showInfo={false} />
      </div>
    </div>
  );
}
