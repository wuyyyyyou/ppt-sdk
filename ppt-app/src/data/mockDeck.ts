export interface Slide {
  title: string;
  subtitle: string;
}

export interface OutlineDetail {
  title: string;
  summary: string;
  bullets: string[];
}

export interface LocalDeck {
  name: string;
  editedLabelKey: "today" | "yesterday" | "date";
  editedDate?: string;
  slides: number;
}

export const initialDeck: Slide[] = [
  {
    title: "AI Agents That Do the Work",
    subtitle:
      "Repeatable workflows transformed into reusable AI skills for the enterprise."
  },
  {
    title: "The Cost of Manual Work",
    subtitle:
      "Research, notes, spreadsheets, and emails create hidden operational drag."
  },
  {
    title: "From Tasks to Reusable Skills",
    subtitle: "Repeated workflows can become reusable AI capabilities."
  },
  {
    title: "How Anna Executes Across Tools",
    subtitle: "Anna connects reasoning, local execution, and approved tools."
  },
  {
    title: "Business Development Example",
    subtitle: "Turn one company name into a pitch-ready collaboration package."
  },
  {
    title: "Security Boundaries",
    subtitle: "Authority, data, and execution must be bounded by the system."
  },
  {
    title: "Build Your First AI Skill",
    subtitle:
      "Start with one repeated workflow and package it into a reusable skill."
  }
];

export const outlineDetails: OutlineDetail[] = [
  {
    title: "AI Agents That Do the Work",
    summary:
      "Frame the shift from chat-based AI to agents that execute repeatable workflows.",
    bullets: [
      "AI is moving from answering to doing",
      "Repeated workflows can become reusable skills",
      "Anna turns instructions into executable work"
    ]
  },
  {
    title: "The Cost of Manual Work",
    summary:
      "Show the hidden operational drag of research, notes, spreadsheets, and emails.",
    bullets: [
      "Work fragments across tabs, docs, and tools",
      "Copy-paste creates errors and delay",
      "Teams repeat the same process every week"
    ]
  },
  {
    title: "From Tasks to Reusable Skills",
    summary: "Explain how one-off tasks become repeatable AI capabilities.",
    bullets: [
      "Capture the workflow once",
      "Turn steps into a reusable skill",
      "Run it again with new inputs"
    ]
  },
  {
    title: "How Anna Executes Across Tools",
    summary:
      "Introduce Anna's hybrid execution model across local tools, browser, and approved services.",
    bullets: [
      "Reasoning happens in conversation",
      "Execution happens through tools",
      "Users stay in control of sensitive actions"
    ]
  },
  {
    title: "Business Development Example",
    summary: "Use BD research as a concrete workflow example.",
    bullets: [
      "Start with one company name",
      "Research, organize, and summarize findings",
      "Produce a pitch-ready brief"
    ]
  },
  {
    title: "Security Boundaries",
    summary:
      "Explain why real agent action needs boundaries for authority, data, and execution.",
    bullets: [
      "Prompts are not a security boundary",
      "Credentials should be mediated",
      "File and tool access should be scoped"
    ]
  },
  {
    title: "Build Your First AI Skill",
    summary:
      "End with a clear next step for turning one repeated workflow into a skill.",
    bullets: [
      "Pick one repeated process",
      "Define inputs, steps, and outputs",
      "Let Anna run it again"
    ]
  }
];

export const localDecks: LocalDeck[] = [
  { name: "AI Agent Workflows", editedLabelKey: "today", slides: 7 },
  { name: "BD Workflow Pitch", editedLabelKey: "yesterday", slides: 9 },
  {
    name: "Security Boundaries",
    editedLabelKey: "date",
    editedDate: "May 6",
    slides: 6
  },
  {
    name: "Investor Update",
    editedLabelKey: "date",
    editedDate: "May 3",
    slides: 12
  }
];

export function createLocalProjectDeck(projectName: string): Slide[] {
  const count =
    localDecks.find((deck) => deck.name === projectName)?.slides ?? 7;

  return Array.from({ length: count }, (_, index) => ({
    title: `${projectName} Slide ${index + 1}`,
    subtitle: "Local project data"
  }));
}
