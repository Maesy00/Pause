/*
 * supabase-config.js — connexion à la base de données en ligne.
 * Même projet Supabase qu'Aurora (tables séparées, préfixées "pause_"),
 * donc le même compte permet de se connecter aux deux apps.
 * L'URL et la clé "anon" ci-dessous sont publiques par design : la
 * sécurité vient des règles définies dans Supabase (chacun ne peut
 * lire/écrire que ses propres données), pas du secret de cette clé.
 */

const SUPABASE_URL = "https://eqydrejfdpusuvydcjdp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxeWRyZWpmZHB1c3V2eWRjamRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUyOTksImV4cCI6MjEwMjk3MTI5OX0.klBsvnYuG4U9sNZrOjkoYT22EOhMJy8qDuhQFIDf-lo";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
