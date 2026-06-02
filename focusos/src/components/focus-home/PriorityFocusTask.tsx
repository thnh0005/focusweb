"use client";

import * as React from "react";
import { ListTodo } from "lucide-react";

export interface PriorityFocusTaskProps {
  goal: string;
  lastGoal?: string | null;
  onGoalChange: (value: string) => void;
}

export function PriorityFocusTask({
  goal,
  lastGoal,
  onGoalChange,
}: PriorityFocusTaskProps) {
  return (
    <div className="mx-auto mt-7 w-full max-w-xl">
      <label htmlFor="focus-task" className="sr-only">
        Focus task
      </label>
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[rgb(12_15_12/0.46)] px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <ListTodo className="h-4 w-4 shrink-0 text-text-muted stroke-[1.6]" aria-hidden="true" />
        <input
          id="focus-task"
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          placeholder="What are you focusing on?"
          className="min-w-0 flex-1 bg-transparent text-center text-base font-light text-text-primary placeholder:text-text-muted focus:outline-none sm:text-left"
        />
      </div>
      {lastGoal && !goal && (
        <button
          type="button"
          onClick={() => onGoalChange(lastGoal)}
          className="mx-auto mt-3 block rounded-full px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Continue: {lastGoal}
        </button>
      )}
    </div>
  );
}
