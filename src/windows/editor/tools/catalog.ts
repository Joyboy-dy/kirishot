// The editor's tools, their key and their place in the bar (spec J2 § 4.2).
import {
  ArrowUpRight,
  Circle,
  Crop,
  Grid3x3,
  Highlighter,
  ListOrdered,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react';

export type ToolId =
  | 'select'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'pen'
  | 'highlighter'
  | 'text'
  | 'step'
  | 'pixelate'
  | 'crop';

export type ToolInfo = { id: ToolId; key: string; label: string; icon: LucideIcon };

export const TOOLS: ToolInfo[] = [
  { id: 'select', key: 'V', label: 'Sélection', icon: MousePointer2 },
  { id: 'arrow', key: 'A', label: 'Flèche', icon: ArrowUpRight },
  { id: 'rect', key: 'R', label: 'Rectangle', icon: Square },
  { id: 'ellipse', key: 'E', label: 'Ellipse', icon: Circle },
  { id: 'line', key: 'L', label: 'Ligne', icon: Minus },
  { id: 'pen', key: 'P', label: 'Crayon', icon: Pencil },
  { id: 'highlighter', key: 'H', label: 'Surligneur', icon: Highlighter },
  { id: 'text', key: 'T', label: 'Texte', icon: Type },
  { id: 'step', key: 'N', label: 'Étapes', icon: ListOrdered },
  { id: 'pixelate', key: 'B', label: 'Masquer', icon: Grid3x3 },
  { id: 'crop', key: 'C', label: 'Recadrer', icon: Crop },
];
