export type Condition = 'Mint' | 'Excellent' | 'Good' | 'Fair' | 'Poor';

export const CONDITIONS: Condition[] = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor'];

export type Category =
  | 'Muscle Car'
  | 'Sports Car'
  | 'Classic'
  | 'SUV & Truck'
  | 'Emergency & Rescue'
  | 'Construction'
  | 'Military'
  | 'Bus & Van'
  | 'Motorcycle'
  | 'Racing'
  | 'Novelty';

export const CATEGORIES: Category[] = [
  'Muscle Car',
  'Sports Car',
  'Classic',
  'SUV & Truck',
  'Emergency & Rescue',
  'Construction',
  'Military',
  'Bus & Van',
  'Motorcycle',
  'Racing',
  'Novelty',
];

/**
 * A model in the master reference catalog. Model numbers here use a simple
 * in-app "#MB__" scheme for browsing/searching, not official Mattel catalog
 * numbers (those vary by year, country, and reissue). Colors listed are
 * commonly seen variants, not an exhaustive registry.
 */
export interface CatalogModel {
  id: string;
  number: string;
  name: string;
  series: string;
  year: number;
  category: Category;
  colors: string[];
  scale?: string;
  notes?: string;
}

export type CollectionStatus = 'owned' | 'wishlist';

/**
 * A personal record: either linked to a catalog model (catalogId set) or a
 * fully custom entry for a piece not in the curated catalog.
 */
export interface CollectionItem {
  id: string;
  catalogId?: string;
  status: CollectionStatus;
  name: string;
  number?: string;
  series: string;
  year?: number;
  category?: Category;
  color: string;
  condition: Condition;
  hasBox: boolean;
  quantity: number;
  purchasePrice?: number;
  purchaseDate?: string;
  notes?: string;
  photoUri?: string;
  dateAdded: string;
}
