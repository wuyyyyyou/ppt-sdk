export interface Slide {
  title: string;
  subtitle: string;
}

export interface OutlineDetail {
  title: string;
  core_message: string;
  required_content: string;
}

export function outlineDetailToText(item: OutlineDetail): string {
  return [item.core_message, item.required_content].filter(Boolean).join("\n");
}

export function legacyOutlineTextToDetail(title: string, value: string): OutlineDetail {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const coreMessage = lines[0] ?? title;
  const contentLines = lines.length > 1 ? lines.slice(1) : [coreMessage];
  return {
    title,
    core_message: coreMessage,
    required_content: contentLines
      .map((line) => `- ${line.replace(/^(?:[-*+•]|\d+[.)])\s+/, "")}`)
      .join("\n"),
  };
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
    core_message: "AI is shifting from answering questions to executing repeatable work.",
    required_content: "- Contrast chat-based AI with agents that execute workflows.\n- Explain how repeated processes become reusable AI skills.\n- Position Anna as the system that turns instructions into executable work."
  },
  {
    title: "The Cost of Manual Work",
    core_message: "Fragmented manual workflows create hidden operational drag.",
    required_content: "- Cover research, notes, spreadsheets, and email handoffs.\n- Highlight copy-paste errors and fragmentation.\n- Show the cost of repeated weekly processes."
  },
  {
    title: "From Tasks to Reusable Skills",
    core_message: "One-off tasks become more valuable when captured as reusable skills.",
    required_content: "- Capture the workflow once.\n- Package the steps as a reusable skill.\n- Run the same capability again with new inputs."
  },
  {
    title: "How Anna Executes Across Tools",
    core_message: "Anna combines reasoning with controlled execution across approved tools.",
    required_content: "- Introduce local tools, browser actions, and approved services.\n- Separate conversational reasoning from execution.\n- Emphasize that users remain in control."
  },
  {
    title: "Business Development Example",
    core_message: "A reusable agent workflow can turn one company name into a pitch-ready brief.",
    required_content: "- Start with one company name.\n- Research and organize the findings.\n- Produce a pitch-ready collaboration brief."
  },
  {
    title: "Security Boundaries",
    core_message: "Useful agent action requires explicit boundaries for authority, data, and execution.",
    required_content: "- Explain why prompts are not a security boundary.\n- Cover mediated access to credentials, files, and tools.\n- Show how authority remains bounded."
  },
  {
    title: "Build Your First AI Skill",
    core_message: "The best first AI skill starts with one repeated workflow.",
    required_content: "- Choose one repeated process.\n- Define its inputs and outputs.\n- Package it so Anna can run it again."
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
