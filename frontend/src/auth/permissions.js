export function can(action) {

  const role = localStorage.getItem("role");


  const permissions = {

    super_admin: [
      "create",
      "read",
      "update",
      "delete",
      "manage_admin"
    ],


    admin: [
      "create",
      "read",
      "update",
      "delete"
    ],


    employee: [
      "read"
    ]

  };


  return permissions[role]?.includes(action) || false;

}