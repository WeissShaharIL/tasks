import { createContext, useContext, useEffect, useReducer, useRef } from "react";
import { api, createBoardWebSocket } from "../api";
import { useAuth } from "./AuthContext";

const BoardContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...action.payload, loaded: true };

    case "TASK_CREATED":
      if (state.tasks.some((t) => t.id === action.task.id)) return state;
      return { ...state, tasks: [...state.tasks, action.task] };

    case "TASK_UPDATED": {
      const tasks = state.tasks.map((t) =>
        t.id === action.task.id ? { ...t, ...action.task } : t
      );
      return { ...state, tasks };
    }

    case "TASK_MOVED": {
      const { id, column_id, position } = action.data;
      const tasks = state.tasks.map((t) =>
        t.id === id ? { ...t, column_id, position } : t
      );
      return { ...state, tasks };
    }

    case "TASK_DELETED":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case "COLUMN_CREATED":
      return { ...state, columns: [...state.columns, action.column] };

    case "COLUMN_UPDATED": {
      const columns = state.columns.map((c) =>
        c.id === action.column.id ? { ...c, ...action.column } : c
      );
      return { ...state, columns };
    }

    case "COLUMN_DELETED":
      return { ...state, columns: state.columns.filter((c) => c.id !== action.id) };

    case "COLUMNS_REORDERED": {
      const { ordered_ids } = action.data;
      const map = {};
      state.columns.forEach((c) => (map[c.id] = c));
      const columns = ordered_ids.map((id, i) => ({ ...map[id], position: i }));
      return { ...state, columns };
    }

    case "PROPERTY_DEFS_RELOAD":
      return { ...state, property_defs: action.defs };

    default:
      return state;
  }
}

const INITIAL = { columns: [], tasks: [], property_defs: [], users: [], loaded: false };

export function BoardProvider({ children }) {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    // `active` is true only while THIS effect instance is alive.
    // When the component unmounts or `user` changes, cleanup sets it false.
    // Any in-flight reconnect timers check this before opening a new connection,
    // preventing the race where an old onclose timer fires after a new effect
    // already opened its own connection — which caused duplicate WS connections
    // and therefore duplicate task_created dispatches.
    let active = true;

    function onMessage(msg) {
      switch (msg.type) {
        case "task_created":
          dispatch({ type: "TASK_CREATED", task: msg.data });
          break;
        case "task_updated":
          dispatch({ type: "TASK_UPDATED", task: msg.data });
          break;
        case "task_moved":
          dispatch({ type: "TASK_MOVED", data: msg.data });
          break;
        case "task_deleted":
          dispatch({ type: "TASK_DELETED", id: msg.data.id });
          break;
        case "column_created":
          dispatch({ type: "COLUMN_CREATED", column: msg.data });
          break;
        case "column_updated":
          dispatch({ type: "COLUMN_UPDATED", column: msg.data });
          break;
        case "column_deleted":
          dispatch({ type: "COLUMN_DELETED", id: msg.data.id });
          break;
        case "columns_reordered":
          dispatch({ type: "COLUMNS_REORDERED", data: msg.data });
          break;
        case "property_def_changed":
          api.listPropertyDefs().then((defs) =>
            dispatch({ type: "PROPERTY_DEFS_RELOAD", defs })
          );
          break;
      }
    }

    function connect(token) {
      if (!active) return;
      const ws = createBoardWebSocket(token, onMessage);
      wsRef.current = ws;
      ws.onclose = () => {
        if (!active) return; // this effect is gone — don't reconnect
        setTimeout(() => connect(token), 3000);
      };
    }

    api.board().then((data) => {
      if (!active) return;
      dispatch({ type: "LOAD", payload: data });
    });

    api.wsToken().then(({ token }) => {
      if (!active) return;
      connect(token);
    });

    return () => {
      active = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user]);

  return (
    <BoardContext.Provider value={{ ...state, dispatch }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  return useContext(BoardContext);
}
