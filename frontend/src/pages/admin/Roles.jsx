import { useState } from "react";
import Icon from "../../components/Icon";

const defaultRoles = [
  { name: "employee", display_name: "Employee", permissions: ["read_own_attendance", "submit_requests", "apply_leave", "view_own_profile"] },
  { name: "manager", display_name: "Line Manager", permissions: ["read_own_attendance", "submit_requests", "apply_leave", "read_team_attendance", "approve_requests", "view_reports"] },
  { name: "hr", display_name: "HR Team", permissions: ["read_all_attendance", "manage_leave", "generate_reports", "manage_employees", "approve_requests", "view_all_profiles"] },
  { name: "admin", display_name: "Administrator", permissions: ["manage_users", "manage_settings", "manage_roles", "view_audit", "full_access", "read_all_attendance", "manage_employees"] },
];

const allPermissions = [
  "read_own_attendance", "submit_requests", "apply_leave", "view_own_profile",
  "read_team_attendance", "approve_requests", "view_reports",
  "read_all_attendance", "manage_leave", "generate_reports", "manage_employees", "view_all_profiles",
  "manage_users", "manage_settings", "manage_roles", "view_audit", "full_access",
];

export default function Roles() {
  const [roles, setRoles] = useState(defaultRoles);
  const [editing, setEditing] = useState(null);

  const togglePerm = (roleName, perm) => {
    setRoles((prev) => prev.map((r) => {
      if (r.name !== roleName) return r;
      const has = r.permissions.includes(perm);
      return { ...r, permissions: has ? r.permissions.filter((p) => p !== perm) : [...r.permissions, perm] };
    }));
  };

  return (
    <div className="page-container">
      <div className="page-header page-header-row">
        <div><p className="eyebrow">Administration</p><h1>Role Management</h1><p>Configure roles and their permissions.</p></div>
      </div>

      <div className="roles-grid">
        {roles.map((role) => (
          <div className="panel" key={role.name}>
            <div className="panel-header">
              <div>
                <div className="panel-title">{role.display_name}</div>
                <div className="panel-subtitle">{role.permissions.length} permissions</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(editing === role.name ? null : role.name)}>
                <Icon name="edit" size={14} /> {editing === role.name ? "Close" : "Edit"}
              </button>
            </div>
            {editing === role.name ? (
              <div className="panel-body">
                {allPermissions.map((p) => (
                  <label key={p} className="checkbox-row">
                    <input type="checkbox" checked={role.permissions.includes(p)} onChange={() => togglePerm(role.name, p)} />
                    <span>{p.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="panel-body">
                <div className="perm-tags">
                  {role.permissions.map((p) => <span key={p} className="badge badge-blue">{p.replace(/_/g, " ")}</span>)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
