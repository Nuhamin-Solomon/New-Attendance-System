import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Icon from "./Icon";

const navConfig = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin", "hr", "manager", "employee"] },
  { id: "employees", path: "/employees", label: "Employees", icon: "users", roles: ["admin", "hr"] },
  { id: "my-attendance", path: "/my-attendance", label: "My Attendance", icon: "clock", roles: ["employee", "manager"] },
  { id: "attendance-summary", path: "/attendance-summary", label: "Attendance Summary", icon: "attendance", roles: ["admin", "hr", "manager"] },
  { id: "attendance-transactions", path: "/attendance-transactions", label: "Transactions", icon: "database", roles: ["admin", "hr"] },
  { id: "my-team", path: "/my-team", label: "My Team", icon: "team", roles: ["manager", "hr"] },
  { id: "leave", path: "/leave", label: "Leave Management", icon: "calendar", roles: ["admin", "hr", "manager", "employee"] },
  { id: "requests", path: "/requests", label: "Duty Requests", icon: "file-text", roles: ["admin", "hr", "manager", "employee"] },
  { id: "my-requests", path: "/my-requests", label: "My Requests", icon: "file-text", roles: ["employee", "manager"] },
  { id: "approvals", path: "/approvals", label: "Approvals", icon: "check-circle", roles: ["manager", "hr", "admin"] },
  { id: "daily-report", path: "/daily-report", label: "Daily Report", icon: "calendar", roles: ["admin", "hr", "manager"] },
  { id: "weekly-report", path: "/weekly-report", label: "Weekly Report", icon: "calendar", roles: ["admin", "hr", "manager"] },
  { id: "monthly-report", path: "/monthly-report", label: "Monthly Report", icon: "calendar", roles: ["admin", "hr", "manager"] },
  { id: "department-report", path: "/department-report", label: "Department Report", icon: "building", roles: ["admin", "hr", "manager"] },
  { id: "notifications", path: "/notifications", label: "Notifications", icon: "bell", roles: ["admin", "hr", "manager", "employee"] },
  { id: "admin-users", path: "/admin/users", label: "User Management", icon: "settings", roles: ["admin"] },
  { id: "admin-departments", path: "/admin/departments", label: "Departments", icon: "building", roles: ["admin"] },
  { id: "admin-roles", path: "/admin/roles", label: "Roles", icon: "shield", roles: ["admin"] },
  { id: "admin-settings", path: "/admin/settings", label: "Settings", icon: "settings", roles: ["admin"] },
  { id: "admin-audit", path: "/admin/audit", label: "Audit Log", icon: "eye", roles: ["admin"] },
];

const sectionMap = {
  dashboard: "Overview",
  employees: "People",
  "my-attendance": "People",
  "attendance-summary": "Attendance",
  "attendance-transactions": "Attendance",
  "my-team": "Team",
  leave: "Workplace",
  requests: "Workplace",
  "my-requests": "Workplace",
  approvals: "Workplace",
  "daily-report": "Reports",
  "weekly-report": "Reports",
  "monthly-report": "Reports",
  "department-report": "Reports",
  notifications: "System",
  "admin-users": "Administration",
  "admin-departments": "Administration",
  "admin-roles": "Administration",
  "admin-settings": "Administration",
  "admin-audit": "Administration",
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const activeId = navConfig.find((n) => location.pathname.startsWith(n.path))?.id || "dashboard";
  const visible = navConfig.filter((item) => item.roles.includes(user?.role));

  let lastSection = "";
  const sections = [];
  for (const item of visible) {
    const section = sectionMap[item.id] || "Other";
    if (section !== lastSection) {
      sections.push({ type: "label", label: section, key: `label-${section}` });
      lastSection = section;
    }
    sections.push({ type: "item", ...item, key: item.id });
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-logo">
        <div className="brand-mark"><Icon name="building" size={20} /></div>
        {!collapsed && (
          <div>
            <h1>Kifiya</h1>
            <p>Attendance Platform</p>
          </div>
        )}
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          <Icon name={collapsed ? "arrow-right" : "arrow-left"} size={16} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {sections.map((s) =>
          s.type === "label" ? (
            !collapsed && <div key={s.key} className="sidebar-section-label">{s.label}</div>
          ) : (
            <button
              key={s.key}
              className={`nav-btn ${activeId === s.id ? "active" : ""}`}
              onClick={() => navigate(s.path)}
              title={collapsed ? s.label : undefined}
            >
              <Icon name={s.icon} size={18} />
              {!collapsed && <span>{s.label}</span>}
            </button>
          )
        )}
      </nav>

      <div className="sidebar-bottom">
        {!collapsed && (
          <div className="sidebar-user">
            <div className="avatar-sm">{user?.full_name?.[0] || user?.username?.[0] || "?"}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.full_name || user?.username}</div>
              <div className="sidebar-user-role">{user?.role?.replace("_", " ")}</div>
            </div>
          </div>
        )}
        <button className="logout-btn" onClick={logout}>
          <Icon name="logout" size={16} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
