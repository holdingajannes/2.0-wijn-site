/* Verbinding met de database voor de back office (Supabase).
   Beide waarden vind je in Supabase onder Project Settings -> API:
   - supabaseUrl: de "Project URL", bijvoorbeeld https://abcdefgh.supabase.co
   - supabaseKey: de "anon" / "publishable" key. Deze sleutel is bedoeld om openbaar te zijn;
     de beveiliging zit in de database (zie backoffice/schema.sql).
   Gebruik hier NOOIT de "service_role" of "secret" key.
   Zolang dit leeg is, werkt het bestelformulier zoals voorheen alleen via Formspree. */
window.DD_CONFIG = {
  supabaseUrl: "https://fhuvtutxzxxtiyejuyin.supabase.co",
  supabaseKey: "sb_publishable_waNpkIvthAwRL0ZueNhgWA_ufVxpREh"
};
