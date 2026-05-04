export interface ParsedEvent {
  date: string;
  title: string;
  genre: string;
  time: string;
  ticketStatus: string;
  sourceOrg: string;
}

export function parseSweetwater(text: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  // Strip markdown links: [text](url) → text
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/__/g, "")
    .replace(/\r/g, "");

  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentDate = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Date line: "Tuesday, April 28"
    const dateMatch = line.match(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d+$/
    );
    if (dateMatch) {
      currentDate = line;
      i++;
      continue;
    }

    // Event title line: ends with "(Genre-LIVE MUSIC)" or "(OPEN MIC)"
    const titleMatch = line.match(/\((.+?)(?:[-—–]LIVE MUSIC|OPEN MIC)\)\s*$/i);
    if (titleMatch && currentDate) {
      const genre = titleMatch[1];
      const title = line.replace(/\s*\(.*\)\s*$/, "").trim();

      // Next line should be the time line
      const timeLine = lines[i + 1] ?? "";
      const timeMatch = timeLine.match(/^(\d+(?::\d+)?\s*(?:am|pm))/i);
      const time = timeMatch ? timeMatch[1] : "";

      const ticketStatus = timeLine.includes("Sold Out")
        ? "Sold Out"
        : timeLine.includes("No Cover")
        ? "No Cover"
        : timeLine.includes("Tickets")
        ? "Tickets"
        : "More Information";

      if (title) {
        events.push({ date: currentDate, title, genre, time, ticketStatus, sourceOrg: "Sweetwater Music Hall" });
      }
      i += 2;
      continue;
    }

    i++;
  }

  return events;
}