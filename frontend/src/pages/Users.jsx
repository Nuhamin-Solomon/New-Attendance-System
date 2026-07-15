import { useState } from "react";
import { can } from "../auth/permissions";
import Icon from "../components/Icon";

export default function Users() {
  const [users, setUsers] = useState([{ id: 1, username: "superadmin", role: "super_admin" }, { id: 2, username: "admin", role: "admin" }]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("admin");
  const addUser = (event) => { event.preventDefault(); if (!username.trim()) return; setUsers((current) => [...current, { id: Date.now(), username: username.trim(), role }]); setUsername(""); };
  return <section className="fade-in"><div className="page-header"><p className="eyebrow">Administration</p><h1>User management</h1><p>Create and review local system access.</p></div>
    {can("manage_admin") && <form className="user-form panel" onSubmit={addUser}><div><div className="panel-title">Add a user</div><div className="panel-subtitle">New accounts are stored for this browser session.</div></div><input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" aria-label="Username"/><select className="form-input role-select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="admin">Administrator</option><option value="employee">Employee</option></select><button className="btn btn-primary" type="submit"><Icon name="plus" size={16}/> Add user</button></form>}
    <div className="panel"><div className="panel-header"><div><div className="panel-title">System users</div><div className="panel-subtitle">{users.length} active user accounts</div></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>ID</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td className="strong-cell">{user.username}</td><td><span className="badge badge-orange">{user.role.replace("_", " ")}</span></td><td className="td-muted">#{user.id}</td></tr>)}</tbody></table></div></div>
  </section>;
}
