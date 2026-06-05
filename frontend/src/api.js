const BASE = "/api";

async function request(method, path, body) {
  const opts = {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    let detail = "שגיאה";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => request("POST", "/auth/login", { username, password }),
  logout: () => request("POST", "/auth/logout"),
  me: () => request("GET", "/auth/me"),
  wsToken: () => request("GET", "/auth/ws-token"),

  // Board
  board: () => request("GET", "/board"),

  // Columns
  listColumns: () => request("GET", "/columns"),
  createColumn: (data) => request("POST", "/columns", data),
  updateColumn: (id, data) => request("PATCH", `/columns/${id}`, data),
  deleteColumn: (id) => request("DELETE", `/columns/${id}`),
  reorderColumns: (ids) => request("POST", "/columns/reorder", { ids }),

  // Tasks
  listTasks: () => request("GET", "/tasks"),
  createTask: (data) => request("POST", "/tasks", data),
  getTask: (id) => request("GET", `/tasks/${id}`),
  updateTask: (id, data) => request("PATCH", `/tasks/${id}`, data),
  deleteTask: (id) => request("DELETE", `/tasks/${id}`),
  moveTask: (id, column_id, position) => request("POST", `/tasks/${id}/move`, { column_id, position }),
  upsertProperties: (id, properties) => request("PUT", `/tasks/${id}/properties`, properties),

  // Property defs
  listPropertyDefs: () => request("GET", "/admin/property-defs"),
  createPropertyDef: (data) => request("POST", "/admin/property-defs", data),
  updatePropertyDef: (id, data) => request("PATCH", `/admin/property-defs/${id}`, data),
  deletePropertyDef: (id) => request("DELETE", `/admin/property-defs/${id}`),
  reorderPropertyDefs: (ids) => request("POST", "/admin/property-defs/reorder", { ids }),

  // Users (admin)
  listUsers: () => request("GET", "/admin/users"),
  createUser: (data) => request("POST", "/admin/users", data),
  updateUser: (id, data) => request("PATCH", `/admin/users/${id}`, data),
  deleteUser: (id) => request("DELETE", `/admin/users/${id}`),
};

export function createBoardWebSocket(token, onMessage) {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const url = `${proto}//${host}/api/ws/board?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data));
    } catch {}
  };
  return ws;
}
