
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
  const blocks = text.split(/\n{2,}/);
  let currentDate = "";

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const dateMatch = lines[0].match(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d+$/
    );
    if (dateMatch) {
      currentDate = lines[0];
      continue;
    }

    if (!currentDate || lines.length < 2) continue;

    const titleLine = lines[0];
    const timeLine = lines[1];

    const genreMatch = titleLine.match(/\((.+?)-LIVE MUSIC\)\s*$/i);
    const genre = genreMatch ? genreMatch[1] : "";
    const title = titleLine.replace(/\s*\(.*\)\s*$/, "").trim();

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
  }

  return events;
}