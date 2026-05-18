export interface Slide {
  title: string;
  subtitle: string;
}

export interface OutlineDetail {
  title: string;
  outline: string;
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
    outline:
      "Frame the shift from chat-based AI to agents that execute repeatable workflows. Show that repeated processes can become reusable AI skills, and position Anna as the system that turns instructions into executable work."
  },
  {
    title: "The Cost of Manual Work",
    outline:
      "Show the hidden operational drag of research, notes, spreadsheets, and emails. Emphasize fragmented work, copy-paste errors, and repeated weekly processes that slow teams down."
  },
  {
    title: "From Tasks to Reusable Skills",
    outline:
      "Explain how one-off tasks become repeatable AI capabilities. Cover capturing the workflow once, packaging the steps as a reusable skill, and running it again with new inputs."
  },
  {
    title: "How Anna Executes Across Tools",
    outline:
      "Introduce Anna's hybrid execution model across local tools, browser, and approved services. Explain the split between reasoning in conversation and execution through approved tools while users stay in control."
  },
  {
    title: "Business Development Example",
    outline:
      "Use business development research as a concrete workflow example. Start with one company name, research and organize findings, then produce a pitch-ready brief."
  },
  {
    title: "Security Boundaries",
    outline:
      "Explain why real agent action needs boundaries for authority, data, and execution. Make clear that prompts are not a security boundary and that credentials, files, and tools should be mediated."
  },
  {
    title: "Build Your First AI Skill",
    outline:
      "End with a clear next step for turning one repeated workflow into a skill. Ask the audience to pick one repeated process, define inputs and outputs, and let Anna run it again."
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
