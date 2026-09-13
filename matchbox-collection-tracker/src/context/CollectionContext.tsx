import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CollectionItem, CollectionStatus } from '../data/types';

const STORAGE_KEY = 'matchboxcollector.items.v1';

type NewCollectionItem = Omit<CollectionItem, 'id' | 'dateAdded'>;

interface CollectionContextValue {
  items: CollectionItem[];
  loaded: boolean;
  addItem: (item: NewCollectionItem) => CollectionItem;
  updateItem: (id: string, changes: Partial<CollectionItem>) => void;
  removeItem: (id: string) => void;
  getItem: (id: string) => CollectionItem | undefined;
  itemsForModel: (catalogId: string) => CollectionItem[];
  statusForModel: (catalogId: string) => CollectionStatus | undefined;
  owned: CollectionItem[];
  wishlist: CollectionItem[];
}

const CollectionContext = createContext<CollectionContextValue | undefined>(undefined);

function makeId() {
  return `c${Date.now()}${Math.floor(Math.random() * 10000)}`;
}

export function CollectionProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setItems(parsed);
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

  const addItem = useCallback(
    (item: NewCollectionItem) => {
      const newItem: CollectionItem = {
        ...item,
        id: makeId(),
        dateAdded: new Date().toISOString(),
      };
      setItems((prev) => {
        const next = [newItem, ...prev];
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      return newItem;
    },
    []
  );

  const updateItem = useCallback(
    (id: string, changes: Partial<CollectionItem>) => {
      setItems((prev) => {
        const next = prev.map((it) => (it.id === id ? { ...it, ...changes } : it));
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const getItem = useCallback((id: string) => items.find((it) => it.id === id), [items]);

  const itemsForModel = useCallback(
    (catalogId: string) => items.filter((it) => it.catalogId === catalogId),
    [items]
  );

  const statusForModel = useCallback(
    (catalogId: string): CollectionStatus | undefined => {
      const matches = items.filter((it) => it.catalogId === catalogId);
      if (matches.some((m) => m.status === 'owned')) return 'owned';
      if (matches.some((m) => m.status === 'wishlist')) return 'wishlist';
      return undefined;
    },
    [items]
  );

  const owned = useMemo(() => items.filter((it) => it.status === 'owned'), [items]);
  const wishlist = useMemo(() => items.filter((it) => it.status === 'wishlist'), [items]);

  const value = useMemo(
    () => ({
      items,
      loaded,
      addItem,
      updateItem,
      removeItem,
      getItem,
      itemsForModel,
      statusForModel,
      owned,
      wishlist,
    }),
    [items, loaded, addItem, updateItem, removeItem, getItem, itemsForModel, statusForModel, owned, wishlist]
  );

  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection() {
  const ctx = useContext(CollectionContext);
  if (!ctx) throw new Error('useCollection must be used within a CollectionProvider');
  return ctx;
}
