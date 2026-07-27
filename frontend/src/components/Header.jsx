import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";
import Icon from "./Icon";

export default function Header({ title, subtitle }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    API.get("/notifications/unread-count")
      .then((r) => setUnreadCount(r.data.count))
      .catch(() => {});
  }, []);

  return (
    <div className="page-header page-header-row">
      <div>
        <p className="eyebrow">{subtitle || "Workspace"}</p>
        <h1>{title || `Good day, ${user?.full_name || user?.username || "User"}`}</h1>
        <p>{new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <div className="header-actions">
        <button className="btn btn-ghost notification-bell" onClick={() => window.location.href = "/notifications"}>
          <Icon name="bell" size={18} />
          {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
        </button>
      </div>
    </div>
  );
}
