export interface Tag {
  id: string;
  name: string;
  color: string;
  icon?: string;
  createdAt: string;
  sortOrder: number;
}

export interface StudyEvent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  tagId: string | null;
  type: "theory" | "practice" | "review" | "exam";
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  scheduled: boolean;
  completed: boolean;
  completedAt: string | null;
}

export interface ImportedPlanning {
  events: StudyEvent[];
  warnings: string[];
}
