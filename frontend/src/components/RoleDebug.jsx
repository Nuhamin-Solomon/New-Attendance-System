import { currentUser } from "../auth/user";

export default function RoleDebug() {
  return (
    <div style={{ background: "#eee", padding: "10px" }}>
      Current Role: <b>{currentUser.role}</b>
    </div>
  );
}
