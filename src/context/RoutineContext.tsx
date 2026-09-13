import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CatalogEntry, Routine, RoutineItem } from '../data/types';

const STORAGE_KEY = 'muscleguide.routines.v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

interface RoutineContextValue {
  routines: Routine[];
  loaded: boolean;
  createRoutine: (name: string) => string;
  renameRoutine: (routineId: string, name: string) => void;
  deleteRoutine: (routineId: string) => void;
  getRoutine: (routineId: string) => Routine | undefined;
  addItem: (routineId: string, entry: CatalogEntry) => void;
  removeItem: (routineId: string, itemId: string) => void;
  moveItem: (routineId: string, itemId: string, direction: -1 | 1) => void;
}

const RoutineContext = createContext<RoutineContextValue | undefined>(undefined);

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setRoutines(parsed);
        } catch {
          // ignore corrupt storage
        }
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback((next: Routine[]) => {
    setRoutines(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const createRoutine = useCallback(
    (name: string) => {
      const id = uid();
      const routine: Routine = { id, name: name.trim() || 'My Routine', createdAt: Date.now(), items: [] };
      setRoutines((prev) => {
        const next = [routine, ...prev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return id;
    },
    []
  );

  const renameRoutine = useCallback(
    (routineId: string, name: string) => {
      setRoutines((prev) => {
        const next = prev.map((r) => (r.id === routineId ? { ...r, name: name.trim() || r.name } : r));
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const deleteRoutine = useCallback((routineId: string) => {
    setRoutines((prev) => {
      const next = prev.filter((r) => r.id !== routineId);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getRoutine = useCallback((routineId: string) => routines.find((r) => r.id === routineId), [routines]);

  const addItem = useCallback((routineId: string, entry: CatalogEntry) => {
    setRoutines((prev) => {
      const next = prev.map((r) => {
        if (r.id !== routineId) return r;
        const item: RoutineItem = { ...entry, id: `${entry.entryId}:${uid()}` };
        return { ...r, items: [...r.items, item] };
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeItem = useCallback((routineId: string, itemId: string) => {
    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === routineId ? { ...r, items: r.items.filter((i) => i.id !== itemId) } : r));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const moveItem = useCallback((routineId: string, itemId: string, direction: -1 | 1) => {
    setRoutines((prev) => {
      const next = prev.map((r) => {
        if (r.id !== routineId) return r;
        const idx = r.items.findIndex((i) => i.id === itemId);
        const swapWith = idx + direction;
        if (idx === -1 || swapWith < 0 || swapWith >= r.items.length) return r;
        const items = [...r.items];
        [items[idx], items[swapWith]] = [items[swapWith], items[idx]];
        return { ...r, items };
      });
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ routines, loaded, createRoutine, renameRoutine, deleteRoutine, getRoutine, addItem, removeItem, moveItem }),
    [routines, loaded, createRoutine, renameRoutine, deleteRoutine, getRoutine, addItem, removeItem, moveItem]
  );

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>;
}

export function useRoutines() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error('useRoutines must be used within a RoutineProvider');
  return ctx;
}
