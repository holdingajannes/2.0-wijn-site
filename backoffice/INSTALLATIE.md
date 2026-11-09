# Back office installeren

Eenmalig, ongeveer 15 minuten. Je hebt een Supabase-account nodig (gratis).

## 1. Project aanmaken
1. Ga naar https://supabase.com en maak een account en een **New project** aan (kies regio *West EU / Frankfurt* of *Amsterdam*, noteer het database-wachtwoord ergens veilig).
2. Wacht tot het project klaar is.

## 2. Database inrichten
1. Open links **SQL Editor** → **New query**.
2. Plak de volledige inhoud van `backoffice/schema.sql` en klik **Run**.
3. Er moet "Success" staan. Zie je een fout, kopieer die dan naar Claude.

## 3. Inlog voor 2 tot 3 personen
1. **Authentication → Sign In / Providers → Email**: zet **Allow new users to sign up** uit (zo kan niemand zichzelf aanmelden).
2. **Authentication → Users → Add user → Create new user**: vul e-mailadres en een sterk wachtwoord in en vink *Auto Confirm User* aan. Herhaal voor elke persoon.
3. Geef deze accounts toegang: **SQL Editor → New query**, plak (met de echte adressen) en Run:
   ```sql
   insert into public.staff (user_id)
   select id from auth.users
   where email in ('naam1@voorbeeld.nl', 'naam2@voorbeeld.nl');
   ```

## 4. De website koppelen
1. **Project Settings → API**: kopieer de **Project URL** en de **anon / publishable key**.
2. Vul die in `js/config.js` in (`supabaseUrl` en `supabaseKey`). Gebruik **nooit** de *service_role* of *secret* key.
3. Publiceer de site opnieuw (zelfde stappen als eerder).

De back office staat daarna op `https://druifendraad.nl/backoffice/` (en `https://jannesholdinga.nl/backoffice/`).

## 5. Eerste keer gebruiken
1. Log in en ga naar **Instellingen**: vul adres, KvK-nummer, BTW-nummer en IBAN in. Zonder deze gegevens kan geen factuur worden gemaakt.
2. Doe een testbestelling op de website en controleer of hij in de back office verschijnt.
3. Maak een testfactuur. Let op: een factuurnummer is definitief en loopt zonder gaten op. Gebruik daarom bij het testen liever een bestelling die je daarna op *Geannuleerd* zet, of start met een leeg project en verwijder testgegevens vóór de echte start (SQL Editor: `delete from public.invoices; delete from public.orders; update public.invoice_counters set last_number = 0;` — alleen vóór echt gebruik).

## Hoe het werkt
- De website slaat een bestelling op via de database-functie `submit_order`. De prijs wordt in de database berekend. Formspree blijft als e-mailmelding en als vangnet werken.
- Facturen worden als PDF in de browser gemaakt en door jullie zelf verstuurd.
- Een prijswijziging moet je op de website **en** in de tabel `products` doorvoeren.
- Een wachtwoord vergeten? Stel het opnieuw in via Supabase → Authentication → Users.
