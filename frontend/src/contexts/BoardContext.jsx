import { createContext, useCallback, useContext, useEffect, useReducer, useRef } from "react";
import { api } from "../api";
import { useAuth } from "./AuthContext";
import { createBoardWebSocket } from "../api";

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
  const wsTokenRef = useRef(null);

  const reload = useCallback(async () => {
    const data = await api.board();
    dispatch({ type: "LOAD", payload: data });
  }, []);

  useEffect(() => {
    if (!user) return;
    reload();

    api.wsToken().then(({ token }) => {
      wsTokenRef.current = token;
      const ws = createBoardWebSocket(token, handleWsMessage);
      wsRef.current = ws;

      ws.onclose = () => {
        // Reconnect after 3s
        setTimeout(() => {
          if (!wsTokenRef.current) return;
          const newWs = createBoardWebSocket(wsTokenRef.current, handleWsMessage);
          wsRef.current = newWs;
        }, 3000);
      };
    });

    return () => {
      wsTokenRef.current = null;
      if (wsRef.current) wsRef.current.close();
    };
  }, [user]);

  function handleWsMessage(msg) {
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

  return (
    <BoardContext.Provider value={{ ...state, dispatch, reload }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  return useContext(BoardContext);
}
