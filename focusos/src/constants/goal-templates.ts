// ═══════════════════════════════════════════════════════════════
// Goal Templates — FocusOS
// Built-in goal presets for Quick Start (U01)
// ═══════════════════════════════════════════════════════════════

import type { GoalTemplate } from "@/types/session.types";

export const BUILT_IN_GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "tpl-code-project",
    label: "Code Project",
    text: "Work on my coding project",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-read-docs",
    label: "Read Documentation",
    text: "Read and understand technical documentation",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-assignment",
    label: "Complete Assignment",
    text: "Complete my current assignment",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-revision",
    label: "Revision / Review",
    text: "Review and revise study materials",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-write-report",
    label: "Write Report",
    text: "Write and edit my report",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-research",
    label: "Research",
    text: "Research a specific topic in depth",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-leetcode",
    label: "Problem Solving",
    text: "Solve algorithmic problems and exercises",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-design",
    label: "Design Work",
    text: "Work on UI/UX design tasks",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-learn-concept",
    label: "Learn Concept",
    text: "Deep dive into a new concept or technology",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-debug",
    label: "Debug / Fix Issues",
    text: "Debug and resolve technical issues",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-review-code",
    label: "Code Review",
    text: "Review and provide feedback on code",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-plan",
    label: "Plan & Architecture",
    text: "Plan project architecture and technical decisions",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-study-exam",
    label: "Exam Preparation",
    text: "Study and prepare for upcoming exam",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-language",
    label: "Language Learning",
    text: "Practice and improve language skills",
    isBuiltIn: true,
    usageCount: 0,
  },
  {
    id: "tpl-creative",
    label: "Creative Work",
    text: "Focus on creative writing or content creation",
    isBuiltIn: true,
    usageCount: 0,
  },
];

export const DEFAULT_TEMPLATE_IDS = BUILT_IN_GOAL_TEMPLATES.map((t) => t.id);
