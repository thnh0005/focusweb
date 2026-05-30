import { create } from "zustand";
import { tasksApi } from "@/services/tasks.api";
import { AudioManager } from "@/lib/audio/AudioManager";
import type { Task } from "@/types/task.types";

export interface TasksState {
  tasks: Task[];
  isLoading: boolean;

  // Actions
  fetchTasks: (sessionId?: string) => Promise<void>;
  createTask: (title: string, sessionId?: string) => Promise<Task>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  isLoading: false,

  fetchTasks: async (sessionId) => {
    set({ isLoading: true });
    try {
      const tasks = await tasksApi.getTasks(sessionId);
      set({ tasks, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createTask: async (title, sessionId) => {
    set({ isLoading: true });
    try {
      const newTask = await tasksApi.createTask({ title, sessionId });
      set((state) => ({
        tasks: [...state.tasks, newTask],
        isLoading: false,
      }));
      return newTask;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  toggleTask: async (id) => {
    const { tasks } = get();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const nextCompleted = !task.completed;

    // Optimistic Update
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : undefined,
            }
          : t
      ),
    }));

    // Trigger complete sound cue on success completion per specs §11 Sound Event Mapping
    if (nextCompleted) {
      AudioManager.playEventSound("task_complete");
    }

    try {
      await tasksApi.updateTask(id, { completed: nextCompleted });
    } catch (error) {
      // Revert on failure
      set({ tasks });
      throw error;
    }
  },

  deleteTask: async (id) => {
    const { tasks } = get();
    // Optimistic Update
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));

    try {
      await tasksApi.deleteTask(id);
    } catch (error) {
      // Revert on failure
      set({ tasks });
      throw error;
    }
  },
}));
