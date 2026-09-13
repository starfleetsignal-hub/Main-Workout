import { CATALOG } from '../data/catalog';
import type { CollectionItem } from '../data/types';

export function seriesTracking(owned: CollectionItem[], focusSeries: string[]) {
  const relevantCatalog = focusSeries.length ? CATALOG.filter((m) => focusSeries.includes(m.series)) : CATALOG;
  const total = relevantCatalog.length;
  const ownedCatalogIds = new Set(owned.map((it) => it.catalogId).filter(Boolean));
  const relevantIds = focusSeries.length
    ? new Set(relevantCatalog.map((m) => m.id))
    : null;
  const completed = focusSeries.length
    ? [...ownedCatalogIds].filter((id) => relevantIds!.has(id as string)).length
    : ownedCatalogIds.size;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, pct };
}
