// ═══════════════════════════════════════════════════════════════
// Task Types — FocusOS (Checklist & Task management)
// ═══════════════════════════════════════════════════════════════

export interface Task {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  sessionId?: string; // Linked to a specific active/historical focus session
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  dueDate?: string;
  sessionId?: string;
}

export interface UpdateTaskPayload {
  title?: string;
  completed?: boolean;
  dueDate?: string;
  sessionId?: string;
}
