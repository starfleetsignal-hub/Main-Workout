import { getModelById } from '../data/catalog';
import type { CatalogModel, CollectionItem } from '../data/types';

export interface ResolvedEntry {
  number: string;
  name: string;
  series: string;
  year?: number;
  category?: CatalogModel['category'];
}

export function resolveEntry(item: CollectionItem): ResolvedEntry {
  const model = item.catalogId ? getModelById(item.catalogId) : undefined;
  return {
    number: item.number ?? model?.number ?? '—',
    name: item.name || model?.name || 'Custom entry',
    series: item.series || model?.series || 'Custom',
    year: item.year ?? model?.year,
    category: item.category ?? model?.category,
  };
}
