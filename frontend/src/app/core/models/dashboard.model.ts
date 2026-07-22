import { CellType, OpenMode } from './enums';

export interface Cell {
  slot: number;
  type: CellType;
  url?: string;
  title?: string;
  catalogAppId?: string;
  iconUrl?: string;
  openMode: OpenMode;
}

export interface Dashboard {
  cells: Cell[]; // always length 6, indexed by slot 0..5
  parkedApp?: Cell; // set only after a downgrade with no empty slot; the user is prompted to place or discard it
}
