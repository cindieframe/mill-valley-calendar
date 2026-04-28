import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseSweetwater } from "@/lib/email-parsers/sweetwater";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const parsed = parseSweetwater(text);

  const events = parsed.map((e) => ({
    title: e.title,
    date: parseDate(e.date),
    time: e.time,
    location: "Sweetwater Music Hall",
    address: "19 Corte Madera Avenue, Mill Valley, CA 94941",
    organization: "Sweetwater Music Hall",
    category: e.genre,
    status: "pending",
    source: "sweetwater-email",
    town: "Mill Valley",
    cost: e.ticketStatus === "No Cover" ? "Free" : e.ticketStatus === "Sold Out" ? "Sold Out" : "",
    website: "https://sweetwatermusichall.org",
  }));

  const { data, error } = await supabase
  .from("events")
  .upsert(events, { onConflict: "title,date", ignoreDuplicates: true })
  .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: data.length, events: data });
}

// Converts "Tuesday, April 28" → "2026-04-28"
function parseDate(dateStr: string): string {
  const current = new Date();
  const year = current.getFullYear();
  const parsed = new Date(`${dateStr}, ${year}`);
  // If the date is in the past, it's probably next year
  if (parsed < current) {
    parsed.setFullYear(year + 1);
  }
  return parsed.toISOString().split("T")[0];
}