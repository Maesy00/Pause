/*
 * pause-calendar — fonction Supabase (Edge Function) qui sert le calendrier
 * « Sport · Pause » au format iCal, pour l'abonnement depuis l'iPhone :
 *   webcal://<projet>.supabase.co/functions/v1/pause-calendar?token=<lien secret>
 *
 * Le calendrier de l'iPhone ne peut pas se connecter : la vérification JWT
 * de cette fonction est désactivée, et c'est le lien secret qui donne accès
 * aux données, via la fonction SQL pause_calendar_feed (clé publique "anon").
 *
 * Déployée depuis le tableau de bord Supabase (Edge Functions → éditeur).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

// Clé publique "anon" (la même que dans js/supabase-config.js), si l'environnement ne la fournit pas.
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxeWRyZWpmZHB1c3V2eWRjamRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUyOTksImV4cCI6MjEwMjk3MTI5OX0.klBsvnYuG4U9sNZrOjkoYT22EOhMJy8qDuhQFIDf-lo";

const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "https://eqydrejfdpusuvydcjdp.supabase.co", ANON_KEY);

// Plage horaire des créneaux de Ma semaine (heure locale de l'iPhone).
const SLOT_TIMES: Record<string, [string, string, string]> = {
  matin: ["070000", "110000", "le matin"],
  midi: ["120000", "140000", "le midi"],
  apres_midi: ["140000", "180000", "l'après-midi"],
  soir: ["180000", "210000", "le soir"],
};

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// Les lignes iCal ne doivent pas dépasser 75 octets : on les replie.
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    if (encoder.encode(current + char).length > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

type FeedRow = { kind: string; id: string; date: string; slot: string | null; title: string; status: string | null };

function toIcs(rows: FeedRow[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pause//Sport//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Sport · Pause",
    "X-WR-CALDESC:Séances de sport planifiées dans Pause et courses à venir.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const row of rows) {
    lines.push("BEGIN:VEVENT", `UID:${row.id}@pause`, `DTSTAMP:${stamp}`);
    if (row.kind === "race") {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(row.date)}`,
        `DTEND;VALUE=DATE:${compactDate(nextDay(row.date))}`,
        `SUMMARY:${escapeText(`🏁 ${row.title}`)}`,
        "TRANSP:TRANSPARENT"
      );
    } else {
      const [start, end, label] = SLOT_TIMES[row.slot ?? "matin"];
      const done = row.status === "done";
      lines.push(
        `DTSTART:${compactDate(row.date)}T${start}`,
        `DTEND:${compactDate(row.date)}T${end}`,
        `SUMMARY:${escapeText(done ? `${row.title} ✓` : row.title)}`,
        `DESCRIPTION:${escapeText(`Prévu ${label} dans Pause.${done ? " Fait." : ""}`)}`,
        "TRANSP:TRANSPARENT"
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Lien de calendrier invalide.", { status: 404 });

  const { data, error } = await supabase.rpc("pause_calendar_feed", { feed_token: token });
  if (error) return new Response("Calendrier indisponible.", { status: 500 });

  return new Response(toIcs(data as FeedRow[]), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="pause-sport.ics"',
      "Cache-Control": "no-store",
    },
  });
});
