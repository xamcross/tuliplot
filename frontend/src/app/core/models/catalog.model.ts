import { Compatibility } from './enums';

export interface CatalogApp {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  category: string;
  order: number;
  compatibility: Compatibility;
}
