import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { CustomList } from "../types";

const STORAGE_KEY = "arvo.customLists.v1";

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadLists(): CustomList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupted storage
  }
  return [];
}

function saveLists(lists: CustomList[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // ignore
  }
}

interface ListsContextValue {
  lists: CustomList[];
  createList: (name: string) => string;
  deleteList: (id: string) => void;
  renameList: (id: string, name: string) => void;
  addSymbol: (listId: string, symbol: string) => void;
  removeSymbol: (listId: string, symbol: string) => void;
  setNote: (listId: string, symbol: string, note: string) => void;
}

const ListsContext = createContext<ListsContextValue | null>(null);

export function ListsProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<CustomList[]>(loadLists);

  const createList = useCallback((name: string) => {
    const id = makeId();
    const list: CustomList = { id, name, symbols: [], notes: {}, createdAt: Date.now() };
    setLists((prev) => {
      const next = [list, ...prev];
      saveLists(next);
      return next;
    });
    return id;
  }, []);

  const deleteList = useCallback((id: string) => {
    setLists((prev) => {
      const next = prev.filter((l) => l.id !== id);
      saveLists(next);
      return next;
    });
  }, []);

  const renameList = useCallback((id: string, name: string) => {
    setLists((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, name } : l));
      saveLists(next);
      return next;
    });
  }, []);

  const addSymbol = useCallback((listId: string, symbol: string) => {
    setLists((prev) => {
      const next = prev.map((l) =>
        l.id === listId && !l.symbols.includes(symbol) ? { ...l, symbols: [...l.symbols, symbol] } : l,
      );
      saveLists(next);
      return next;
    });
  }, []);

  const removeSymbol = useCallback((listId: string, symbol: string) => {
    setLists((prev) => {
      const next = prev.map((l) => {
        if (l.id !== listId) return l;
        const { [symbol]: _removed, ...notes } = l.notes;
        return { ...l, symbols: l.symbols.filter((s) => s !== symbol), notes };
      });
      saveLists(next);
      return next;
    });
  }, []);

  const setNote = useCallback((listId: string, symbol: string, note: string) => {
    setLists((prev) => {
      const next = prev.map((l) => (l.id === listId ? { ...l, notes: { ...l.notes, [symbol]: note } } : l));
      saveLists(next);
      return next;
    });
  }, []);

  const value: ListsContextValue = {
    lists,
    createList,
    deleteList,
    renameList,
    addSymbol,
    removeSymbol,
    setNote,
  };

  return <ListsContext.Provider value={value}>{children}</ListsContext.Provider>;
}

export function useLists() {
  const ctx = useContext(ListsContext);
  if (!ctx) throw new Error("useLists must be used within ListsProvider");
  return ctx;
}
