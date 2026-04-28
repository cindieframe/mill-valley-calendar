import { parseSweetwater, ParsedEvent } from "./sweetwater";

// Add a new org here when they start forwarding emails
const parsers: Record<string, (text: string) => ParsedEvent[]> = {
  "listings@sweetwatermusichall.org": parseSweetwater,
};

export function getParser(from: string): ((text: string) => ParsedEvent[]) | null {
  const email = from.toLowerCase().match(/<(.+?)>/)?.[1] ?? from.toLowerCase().trim();
  return parsers[email] ?? null;
}

export type { ParsedEvent };