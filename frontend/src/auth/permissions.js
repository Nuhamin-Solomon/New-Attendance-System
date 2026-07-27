export function can(action) {
  const role = localStorage.getItem("role");
  const permissions = {
    admin: ["create", "read", "update", "delete", "manage_admin"],
    hr: ["create", "read", "update", "delete"],
    manager: ["read", "approve"],
    employee: ["read"],
  };
  return permissions[role]?.includes(action) || false;
}
