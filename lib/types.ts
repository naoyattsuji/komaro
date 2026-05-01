export type TableType = "timetable" | "calendar" | "custom";

export type EventStatus = "active" | "expired" | "deleted";

export interface RowMeta {
  start?: string;
  end?: string;
}

export interface ColMeta {
  date?: string;
  dayOfWeek?: string;
}

export interface EventData {
  id: string;
  title: string;
  description?: string | null;
  tableType: TableType;
  rowLabels: string[];
  colLabels: string[];
  rowMeta?: RowMeta[];
  colMeta?: ColMeta[];
  maxParticipants: number;
  status: EventStatus;
  lastUpdatedAt: string;
  createdAt: string;
  currentParticipantCount: number;
}

export interface ParticipantData {
  id: string;
  name: string;
  cells: { rowIndex: number; colIndex: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface CellSummary {
  rowIndex: number;
  colIndex: number;
  count: number;
  isMax: boolean;
}

export interface SummaryData {
  maxCount: number;
  cells: CellSummary[];
}

export interface CommentData {
  id: string;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  tableType: TableType;
  rowLabels: string[];
  colLabels: string[];
  rowMeta?: RowMeta[];
  colMeta?: ColMeta[];
  maxParticipants?: number;
  password?: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
