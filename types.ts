
export interface Point {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface Rope {
  id: string;
  p1: string;
  p2: string;
  color: string;
}

export interface LevelData {
  points: Point[];
  ropes: Rope[];
}
