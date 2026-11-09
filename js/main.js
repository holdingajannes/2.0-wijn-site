(function () {
  "use strict";

  /* ============================================================
     Translations
     ============================================================ */
  var translations = {
    nl: {
      "skip": "Ga naar hoofdinhoud",
      "gate.title": "Ben je 18 jaar of ouder?",
      "gate.text": "Deze website bevat informatie over alcoholhoudende dranken. Je moet 18 jaar of ouder zijn om verder te gaan.",
      "gate.yes": "Ja, ik ben 18 jaar of ouder",
      "gate.no": "Nee",
      "gate.note": "Door verder te gaan bevestig je dat je de wettelijke leeftijd hebt om alcohol te kopen in jouw land.",
      "gate.blocked.title": "Welkom terug wanneer je 18 bent",
      "gate.blocked.text": "Deze website is alleen toegankelijk voor bezoekers van 18 jaar en ouder. Je kunt dit venster nu sluiten.",
      "gate.back": "Terug",
      "nav.toggle": "Menu",
      "nav.story": "Ons verhaal",
      "nav.wines": "Wijnen",
      "nav.order": "Bestellen",
      "nav.contact": "Contact",
      "hero.eyebrow": "Wijnimport uit Frankrijk",
      "hero.tagline": "Ontdek. Proef. <em>Deel.</em>",
      "hero.lede": "Vier Franse wijnen, rechtstreeks geïmporteerd van kleinschalige domeinen — geselecteerd op karakter, niet op grootschaligheid.",
      "hero.cta1": "Bekijk de wijnen",
      "hero.cta2": "Ons verhaal",
      "hero.badge": "Blanc · Rouge · Rosé · Mousseux",
      "story.eyebrow": "Ons verhaal",
      "story.heading": "De draad tussen wijngaard en tafel",
      "story.text": "Druif &amp; Draad is een kleine, onafhankelijke wijnimporteur die zich richt op wijnen uit Frankrijk. Het idee ontstond uit een liefde voor Franse wijngaarden en het verlangen om die kwaliteit rechtstreeks, zonder omwegen, naar Nederlandse tafels te brengen. Elke fles wordt met zorg geselecteerd bij kleinschalige domeinen, met aandacht voor karakter boven grootschaligheid. De naam verwijst naar de druif zelf en de draad die de wijngaard, de wijnmaker en de mensen die samen een glas delen met elkaar verbindt.",
      "story.kw1": "Kleinschalig",
      "story.kw2": "Rechtstreeks geïmporteerd",
      "story.kw3": "Karakter boven grootschaligheid",
      "wines.eyebrow": "De collectie",
      "wines.heading": "Vier wijnen, één verhaal",
      "wines.sub": "Elk met een eigen karakter — allemaal met dezelfde zorgvuldige herkomst.",
      "wine.blanc.type": "Witte wijn",
      "wine.blanc.kw1": "Fris", "wine.blanc.kw2": "Elegant", "wine.blanc.kw3": "Verfijnd",
      "wine.blanc.desc": "Een frisse, elegante witte wijn met een verfijnde uitstraling. Licht van karakter, met een stijl die past bij zowel een rustige avond als een feestelijk moment.",
      "wine.blanc.story": "Deze Blanc komt van een klein perceel op een zonovergoten helling in de Rhônevallei, waar de druiven langzaam rijpen dankzij de koele avondwind. De wijnmaker oogst er bewust vroeg in de ochtend om de frisheid in het glas te bewaren.",
      "wine.blanc.storyFull": "Deze Blanc komt van een klein perceel op een zonovergoten helling in de Rhônevallei, waar de druiven langzaam rijpen dankzij de koele avondwind. De wijnmaker oogst er bewust vroeg in de ochtend om de frisheid in het glas te bewaren. Het resultaat is een wijn die de rust van die heuvel in elke slok meedraagt.",
      "wine.rose.type": "Rosé",
      "wine.rose.kw1": "Licht", "wine.rose.kw2": "Fruitig", "wine.rose.kw3": "Levendig",
      "wine.rose.desc": "Een toegankelijke rosé met een zachte, fruitige stijl. Levendig in het glas en gemakkelijk te combineren met een zomerse maaltijd of een moment van ontspanning.",
      "wine.rose.story": "De druiven voor deze rosé worden met de hand geplukt op een familiedomein dat al drie generaties dezelfde wijngaard bewerkt. Kort huidcontact geeft de wijn zijn zachte kleur en levendige karakter.",
      "wine.rose.storyFull": "De druiven voor deze rosé worden met de hand geplukt op een familiedomein dat al drie generaties dezelfde wijngaard bewerkt. Kort huidcontact geeft de wijn zijn zachte kleur en levendige karakter, precies zoals de familie het al decennia doet, op gevoel en ervaring in plaats van strak protocol.",
      "wine.rouge.type": "Rode wijn",
      "wine.rouge.kw1": "Rijk", "wine.rouge.kw2": "Karaktervol", "wine.rouge.kw3": "Rond",
      "wine.rouge.desc": "Een karaktervolle rode wijn met een rijke en ronde indruk. Vol van smaak, met de body en diepgang die je van een goede Franse rode wijn verwacht.",
      "wine.rouge.story": "Deze Rouge rijpt langzaam in oude eiken vaten, in een kelder die al meer dan honderd jaar dienstdoet als opslagplaats voor de beste vaten van het domein.",
      "wine.rouge.storyFull": "Deze Rouge rijpt langzaam in oude eiken vaten, in een kelder die al meer dan honderd jaar dienstdoet als opslagplaats voor de beste vaten van het domein. De combinatie van oude wijnstokken en geduldige verfijning geeft de wijn zijn ronde, warme karakter.",
      "wine.mousseux.type": "Mousserende wijn",
      "wine.mousseux.kw1": "Fris", "wine.mousseux.kw2": "Fruitig", "wine.mousseux.kw3": "Feestelijk",
      "wine.mousseux.desc": "Een frisse, fruitige mousseux zonder restsuiker, een zogeheten Brut de Brut. Een feestelijke wijn om samen te delen.",
      "wine.mousseux.classification": "Vin de France",
      "wine.mousseux.badge1": "Vegan",
      "wine.mousseux.tasting": "Deze witte wijn is op tank doorgegist en heeft nagenoeg geen restsuiker, een zogeheten Brut de Brut. De aroma&rsquo;s zijn zeer fris, met jong vers fruit zoals appel, abrikoos, perzik en witte aalbes, en een vleugje brioche. De smaak is heerlijk fris en fruitig, met een zeer aangename, frisse afdronk. Kortom: een feestelijke wijn om samen te delen. Sant&eacute;!",
      "wine.mousseux.spec.soil": "Klei-zand en kalk-zand met veel stenen.",
      "wine.mousseux.spec.climate": "Mediterraan.",
      "wine.mousseux.spec.vineyard": "15&ndash;30 jaar oud, op draad, 1,60 meter hoog.",
      "wine.mousseux.spec.yield": "55 hl/ha.",
      "wine.mousseux.spec.harvest": "Volledig handmatig.",
      "wine.mousseux.spec.vinification": "Direct geperst. Vergisting bij maximaal 16&deg;C gedurende ongeveer drie weken, gevolgd door hervergisting op drukvat gedurende minimaal een maand. Alleen klaring met bentoniet. De wijn wordt zoveel mogelijk met behulp van zwaartekracht overgebracht.",
      "wine.mousseux.spec.abv": "13% vol.",
      "wine.mousseux.spec.aging": "Minimaal 3 jaar.",
      "wine.priceNote": "incl. btw",
      "wine.orderCta": "Bestellen",
      "wine.moreCta": "Meer over deze wijn <span aria-hidden=\"true\">&rarr;</span>",
      "winepage.back": "&larr; Alle wijnen",
      "winepage.orderCta": "Bestel deze wijn",
      "winepage.serveLabel": "Serveertip",
      "winepage.othersHeading": "Ontdek ook",
      "winepage.tastingLabel": "Proeverij",
      "winepage.specsHeading": "Wijnfiche",
      "specs.classification": "Classificatie",
      "specs.vintage": "Jaargang",
      "specs.soil": "Grondsoort",
      "specs.climate": "Klimaat",
      "specs.vineyard": "Wijngaard",
      "specs.yield": "Rendement",
      "specs.harvest": "Oogst",
      "specs.vinification": "Vinificatie",
      "specs.abv": "Alcoholpercentage",
      "specs.aging": "Bewaarpotentieel",

      "wine.blanc.classification": "Vin de Pays de M&eacute;diterran&eacute;e",
      "wine.blanc.badge1": "Biologisch",
      "wine.blanc.badge2": "Vegan",
      "wine.blanc.tasting": "Een witte wijn vol fruit, met aroma&rsquo;s van abrikoos, perzik, ananas en een vleugje venkel. De smaak is vol, rond en aangenaam vet, met een lange, elegante afdronk.",
      "wine.blanc.pairing": "Heerlijk als aperitief of bij de maaltijd &mdash; en verrassend lekker bij een kaasplateau.",
      "wine.blanc.spec.soil": "Klei-zand en kalk-zand met veel stenen.",
      "wine.blanc.spec.climate": "Mediterraan.",
      "wine.blanc.spec.vineyard": "Gemiddeld 20 jaar oud.",
      "wine.blanc.spec.yield": "55 hl/ha.",
      "wine.blanc.spec.harvest": "Machinaal en handmatig.",
      "wine.blanc.spec.vinification": "Pneumatisch geperst, 24 uur koud bezinken, temperatuurgestuurde fermentatie bij maximaal 16&deg;C in roestvrijstalen tanks gedurende ongeveer drie weken. Geklaard met bentoniet en zwaartekracht.",
      "wine.blanc.spec.abv": "13,5% vol.",
      "wine.blanc.spec.aging": "Minimaal 3 jaar.",

      "wine.rose.classification": "Vin de France",
      "wine.rose.vintage": "2025",
      "wine.rose.note": "Een geselecteerde wijn van een bevriende producent, waar we net zo trots op zijn als op onze eigen selectie.",
      "wine.rose.tasting": "Opvallend fris en fruitig, met aroma&rsquo;s van perzik, abrikoos, guave, framboos, venkel, een vleugje limoen en een hint van witte bloesem. De smaak is fris en sappig, met een mooie balans tussen zuur en alcohol en een afdronk die zacht blijft hangen.",
      "wine.rose.pairing": "Heerlijk als aperitief, en een uitstekende begeleider bij gegrilde gerechten of een avond tapas met vrienden.",
      "wine.rose.spec.soil": "Klei-zand en kalk-zand met veel stenen.",
      "wine.rose.spec.climate": "Mediterraan.",
      "wine.rose.spec.vineyard": "25&ndash;30 jaar oud.",
      "wine.rose.spec.yield": "60 hl/ha.",
      "wine.rose.spec.harvest": "Machinaal.",
      "wine.rose.spec.vinification": "Pneumatisch geperst, 24 uur koud bezinken, temperatuurgestuurde fermentatie bij maximaal 16&deg;C in roestvrijstalen tanks gedurende ongeveer drie weken. Geklaard met bentoniet en zwaartekracht.",
      "wine.rose.spec.abv": "12% vol.",
      "wine.rose.spec.aging": "Minimaal 2 jaar.",

      "wine.rouge.classification": "Vin de France",
      "wine.rouge.tasting": "Fris en kruidig, met veel aroma&rsquo;s van rijp donkerrood fruit zoals kersen en bramen, aangevuld met Provenc&ccedil;aalse kruiden en een vleugje vanille. De smaak is fris, met een mooie balans tussen zuur en alcohol en een afdronk die zacht blijft hangen.",
      "wine.rouge.pairing": "Wij raden aan deze wijn licht gekoeld te serveren &mdash; een uitstekende keuze bij de barbecue of gegrilde gerechten, en bij zowel mediterrane als Hollandse gerechten.",
      "wine.rouge.spec.soil": "Klei-zand en kalk-zand met veel stenen.",
      "wine.rouge.spec.climate": "Mediterraan.",
      "wine.rouge.spec.vineyard": "15&ndash;25 jaar oud.",
      "wine.rouge.spec.yield": "50 hl/ha.",
      "wine.rouge.spec.harvest": "Gedeeltelijk handmatig, gedeeltelijk machinaal.",
      "wine.rouge.spec.vinification": "Gedeeltelijk koolzuurmaceratie, gedeeltelijk gekneusd, volledig ontsteeld. Vergisting bij maximaal 25&deg;C gedurende ongeveer drie weken; de wijn wordt zoveel mogelijk met behulp van zwaartekracht overgebracht.",
      "wine.rouge.spec.abv": "14% vol.",
      "wine.rouge.spec.aging": "Minimaal 3 jaar.",

      "order.eyebrow": "Bestellen",
      "order.heading": "Vraag je flessen aan",
      "order.sub": "Kies je flessen, vul je gegevens in en we nemen persoonlijk contact met je op om je bestelling af te ronden.",
      "order.yourOrder": "Jouw bestelling",
      "order.contact": "Jouw gegevens",
      "order.name": "Naam",
      "order.email": "E-mailadres",
      "order.phone": "Telefoonnummer",
      "order.optional": "(optioneel)",
      "order.address": "Bezorgadres",
      "order.street": "Straat",
      "order.houseNumber": "Huisnummer",
      "order.addition": "Toevoeging",
      "order.postcode": "Postcode",
      "order.city": "Plaats",
      "order.message": "Bericht",
      "order.total": "Totaal",
      "order.bottle": "fles",
      "order.bottles": "flessen",
      "order.less": "Minder",
      "order.more": "Meer",
      "order.qtyBlanc": "Aantal flessen Blanc",
      "order.qtyRouge": "Aantal flessen Rouge",
      "order.qtyRose": "Aantal flessen Rosé",
      "order.qtyMousseux": "Aantal flessen Mousseux",
      "order.errNoBottles": "Kies minstens één fles om te bestellen.",
      "order.errPostcode": "Vul een geldige postcode in, bijvoorbeeld 1234 AB.",
      "order.mailto": "Je e-mailprogramma wordt geopend met je bestelling. Verstuur de e-mail om je aanvraag af te ronden.",
      "order.submit": "Verstuur bestelaanvraag",
      "order.sending": "Versturen…",
      "order.success": "Bedankt! Je aanvraag is verstuurd — we nemen zo snel mogelijk contact met je op.",
      "order.error": "Er ging iets mis bij het versturen. Mail ons gerust rechtstreeks op",
      "footer.legal": "Door dit formulier te versturen ga je akkoord dat we je gegevens uitsluitend gebruiken om je bestelling te verwerken. Alcohol wordt alleen verkocht aan personen van 18 jaar en ouder."
    },
    en: {
      "skip": "Skip to main content",
      "gate.title": "Are you 18 years or older?",
      "gate.text": "This website contains information about alcoholic beverages. You must be 18 or older to continue.",
      "gate.yes": "Yes, I am 18 or older",
      "gate.no": "No",
      "gate.note": "By continuing you confirm you have reached the legal age to purchase alcohol in your country.",
      "gate.blocked.title": "Welcome back once you turn 18",
      "gate.blocked.text": "This website is only accessible to visitors aged 18 and over. You can close this window now.",
      "gate.back": "Back",
      "nav.toggle": "Menu",
      "nav.story": "Our story",
      "nav.wines": "Wines",
      "nav.order": "Order",
      "nav.contact": "Contact",
      "hero.eyebrow": "Wine import from France",
      "hero.tagline": "Discover. Taste. <em>Share.</em>",
      "hero.lede": "Four French wines, imported directly from small-scale estates — selected for character, not for scale.",
      "hero.cta1": "View the wines",
      "hero.cta2": "Our story",
      "hero.badge": "Blanc · Rouge · Rosé · Mousseux",
      "story.eyebrow": "Our story",
      "story.heading": "The thread between vineyard and table",
      "story.text": "Druif &amp; Draad is a small, independent wine importer focused on wines from France. The idea was born from a love for French vineyards and the desire to bring that quality straight to Dutch tables, without detours. Every bottle is carefully selected from small-scale estates, with attention to character rather than scale. The name refers to the grape itself and the thread that connects the vineyard, the winemaker, and the people who share a glass together.",
      "story.kw1": "Small-scale",
      "story.kw2": "Imported directly",
      "story.kw3": "Character over scale",
      "wines.eyebrow": "The collection",
      "wines.heading": "Four wines, one story",
      "wines.sub": "Each with its own character — all with the same careful provenance.",
      "wine.blanc.type": "White wine",
      "wine.blanc.kw1": "Fresh", "wine.blanc.kw2": "Elegant", "wine.blanc.kw3": "Refined",
      "wine.blanc.desc": "A fresh, elegant white wine with a refined character. Light in style, suited to both a quiet evening and a festive occasion.",
      "wine.blanc.story": "This Blanc comes from a small plot on a sun-drenched slope in the Rhône Valley, where the grapes ripen slowly thanks to the cool evening breeze. The winemaker deliberately harvests early in the morning to preserve freshness in the glass.",
      "wine.blanc.storyFull": "This Blanc comes from a small plot on a sun-drenched slope in the Rhône Valley, where the grapes ripen slowly thanks to the cool evening breeze. The winemaker deliberately harvests early in the morning to preserve freshness in the glass. The result is a wine that carries the calm of that hillside in every sip.",
      "wine.rose.type": "Rosé",
      "wine.rose.kw1": "Light", "wine.rose.kw2": "Fruity", "wine.rose.kw3": "Lively",
      "wine.rose.desc": "An approachable rosé with a soft, fruity style. Lively in the glass and easy to pair with a summer meal or a moment of relaxation.",
      "wine.rose.story": "The grapes for this rosé are hand-picked on a family estate that has worked the same vineyard for three generations. Brief skin contact gives the wine its soft colour and lively character.",
      "wine.rose.storyFull": "The grapes for this rosé are hand-picked on a family estate that has worked the same vineyard for three generations. Brief skin contact gives the wine its soft colour and lively character — a technique the family has relied on for decades, guided by feel and experience rather than strict protocol.",
      "wine.rouge.type": "Red wine",
      "wine.rouge.kw1": "Rich", "wine.rouge.kw2": "Characterful", "wine.rouge.kw3": "Round",
      "wine.rouge.desc": "A characterful red wine with a rich and round impression. Full of flavour, with the body and depth you'd expect from a good French red.",
      "wine.rouge.story": "This Rouge ages slowly in old oak barrels, in a cellar that has served as storage for the estate's finest barrels for over a hundred years.",
      "wine.rouge.storyFull": "This Rouge ages slowly in old oak barrels, in a cellar that has served as storage for the estate's finest barrels for over a hundred years. The combination of old vines and patient refinement gives the wine its round, warm character.",
      "wine.mousseux.type": "Sparkling wine",
      "wine.mousseux.kw1": "Fresh", "wine.mousseux.kw2": "Fruity", "wine.mousseux.kw3": "Festive",
      "wine.mousseux.desc": "A fresh, fruity sparkling wine with no residual sugar, a so-called Brut de Brut. A festive wine to share.",
      "wine.mousseux.classification": "Vin de France",
      "wine.mousseux.badge1": "Vegan",
      "wine.mousseux.tasting": "This white wine is fermented to dryness in tank and has virtually no residual sugar, a so-called Brut de Brut. The aromas are very fresh, with young fresh fruit such as apple, apricot, peach and white currant, and a hint of brioche. The palate is delightfully fresh and fruity, with a very pleasant, fresh finish. In short: a festive wine to share. Sant&eacute;!",
      "wine.mousseux.spec.soil": "Clay-sand and limestone-sand with many stones.",
      "wine.mousseux.spec.climate": "Mediterranean.",
      "wine.mousseux.spec.vineyard": "15&ndash;30 years old, trained on wire, 1.60 metres high.",
      "wine.mousseux.spec.yield": "55 hl/ha.",
      "wine.mousseux.spec.harvest": "Entirely hand-picked.",
      "wine.mousseux.spec.vinification": "Direct pressing. Fermentation at a maximum of 16&deg;C for about three weeks, followed by secondary fermentation in a pressure tank for at least one month. Clarified with bentonite only. The wine is transferred using gravity wherever possible.",
      "wine.mousseux.spec.abv": "13% vol.",
      "wine.mousseux.spec.aging": "At least 3 years.",
      "wine.priceNote": "incl. VAT",
      "wine.orderCta": "Order",
      "wine.moreCta": "More about this wine <span aria-hidden=\"true\">&rarr;</span>",
      "winepage.back": "&larr; All wines",
      "winepage.orderCta": "Order this wine",
      "winepage.serveLabel": "Serving tip",
      "winepage.othersHeading": "Discover more",
      "winepage.tastingLabel": "Tasting notes",
      "winepage.specsHeading": "Wine details",
      "specs.classification": "Classification",
      "specs.vintage": "Vintage",
      "specs.soil": "Soil",
      "specs.climate": "Climate",
      "specs.vineyard": "Vineyard",
      "specs.yield": "Yield",
      "specs.harvest": "Harvest",
      "specs.vinification": "Winemaking",
      "specs.abv": "Alcohol",
      "specs.aging": "Ageing potential",

      "wine.blanc.classification": "Vin de Pays de M&eacute;diterran&eacute;e",
      "wine.blanc.badge1": "Organic",
      "wine.blanc.badge2": "Vegan",
      "wine.blanc.tasting": "A fruit-forward white wine with aromas of apricot, peach, pineapple and a touch of fennel. The palate is full, round and pleasantly rich, with a long, elegant finish.",
      "wine.blanc.pairing": "Lovely as an aperitif or with a meal &mdash; and surprisingly good with a cheese board.",
      "wine.blanc.spec.soil": "Clay-sand and limestone-sand with many stones.",
      "wine.blanc.spec.climate": "Mediterranean.",
      "wine.blanc.spec.vineyard": "On average 20 years old.",
      "wine.blanc.spec.yield": "55 hl/ha.",
      "wine.blanc.spec.harvest": "Mechanical and hand-picked.",
      "wine.blanc.spec.vinification": "Pneumatically pressed, 24-hour cold settling, temperature-controlled fermentation at a maximum of 16&deg;C in stainless steel tanks for about three weeks. Clarified with bentonite and gravity.",
      "wine.blanc.spec.abv": "13.5% vol.",
      "wine.blanc.spec.aging": "At least 3 years.",

      "wine.rose.classification": "Vin de France",
      "wine.rose.vintage": "2025",
      "wine.rose.note": "A wine selected from a fellow producer we&rsquo;re just as proud of as our own selection.",
      "wine.rose.tasting": "Strikingly fresh and fruity, with aromas of peach, apricot, guava, raspberry, fennel, a touch of lime and a hint of white blossom. The palate is fresh and juicy, with a lovely balance between acidity and alcohol and a soft, lingering finish.",
      "wine.rose.pairing": "Delicious as an aperitif, and a great match for grilled dishes or a tapas evening with friends.",
      "wine.rose.spec.soil": "Clay-sand and limestone-sand with many stones.",
      "wine.rose.spec.climate": "Mediterranean.",
      "wine.rose.spec.vineyard": "25&ndash;30 years old.",
      "wine.rose.spec.yield": "60 hl/ha.",
      "wine.rose.spec.harvest": "Mechanical.",
      "wine.rose.spec.vinification": "Pneumatically pressed, 24-hour cold settling, temperature-controlled fermentation at a maximum of 16&deg;C in stainless steel tanks for about three weeks. Clarified with bentonite and gravity.",
      "wine.rose.spec.abv": "12% vol.",
      "wine.rose.spec.aging": "At least 2 years.",

      "wine.rouge.classification": "Vin de France",
      "wine.rouge.tasting": "Fresh and spicy, with plenty of aromas of ripe dark red fruit such as cherry and blackberry, complemented by Proven&ccedil;al herbs and a touch of vanilla. The palate is fresh, with a lovely balance between acidity and alcohol and a soft, lingering finish.",
      "wine.rouge.pairing": "We recommend serving this wine lightly chilled &mdash; an excellent choice for the barbecue or grilled dishes, and equally at home with Mediterranean and Dutch cuisine.",
      "wine.rouge.spec.soil": "Clay-sand and limestone-sand with many stones.",
      "wine.rouge.spec.climate": "Mediterranean.",
      "wine.rouge.spec.vineyard": "15&ndash;25 years old.",
      "wine.rouge.spec.yield": "50 hl/ha.",
      "wine.rouge.spec.harvest": "Partly hand-picked, partly mechanical.",
      "wine.rouge.spec.vinification": "Partly carbonic maceration, partly crushed, fully destemmed. Fermented at a maximum of 25&deg;C for about three weeks; the wine is transferred using gravity wherever possible.",
      "wine.rouge.spec.abv": "14% vol.",
      "wine.rouge.spec.aging": "At least 3 years.",

      "order.eyebrow": "Order",
      "order.heading": "Request your bottles",
      "order.sub": "Choose your bottles, fill in your details and we'll get in touch personally to finalise your order.",
      "order.yourOrder": "Your order",
      "order.contact": "Your details",
      "order.name": "Name",
      "order.email": "Email address",
      "order.phone": "Phone number",
      "order.optional": "(optional)",
      "order.address": "Delivery address",
      "order.street": "Street",
      "order.houseNumber": "House number",
      "order.addition": "Addition",
      "order.postcode": "Postal code",
      "order.city": "City",
      "order.message": "Message",
      "order.total": "Total",
      "order.bottle": "bottle",
      "order.bottles": "bottles",
      "order.less": "Fewer",
      "order.more": "More",
      "order.qtyBlanc": "Number of bottles Blanc",
      "order.qtyRouge": "Number of bottles Rouge",
      "order.qtyRose": "Number of bottles Rosé",
      "order.qtyMousseux": "Number of bottles Mousseux",
      "order.errNoBottles": "Please choose at least one bottle to order.",
      "order.errPostcode": "Please enter a valid postal code, for example 1234 AB.",
      "order.mailto": "Your email app will open with your order. Send the email to complete your request.",
      "order.submit": "Send order request",
      "order.sending": "Sending…",
      "order.success": "Thank you! Your request has been sent — we'll be in touch as soon as possible.",
      "order.error": "Something went wrong while sending. Feel free to email us directly at",
      "footer.legal": "By submitting this form you agree that we will use your details solely to process your order. Alcohol is only sold to persons aged 18 and over."
    }
  };

  var STORAGE_LANG = "dd_lang";
  var STORAGE_AGE = "dd_age_ok";

  function getLang() {
    return localStorage.getItem(STORAGE_LANG) === "en" ? "en" : "nl";
  }

  function applyTranslations(lang) {
    var dict = translations[lang] || translations.nl;
    var fallback = translations.nl;
    document.documentElement.setAttribute("lang", lang);

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var value = dict[key] !== undefined ? dict[key] : fallback[key];
      if (value !== undefined) el.innerHTML = value;
    });

    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      var value = dict[key] !== undefined ? dict[key] : fallback[key];
      if (value !== undefined) el.setAttribute("aria-label", value);
    });

    var btnNl = document.getElementById("lang-nl");
    var btnEn = document.getElementById("lang-en");
    if (btnNl && btnEn) {
      btnNl.setAttribute("aria-pressed", String(lang === "nl"));
      btnEn.setAttribute("aria-pressed", String(lang === "en"));
    }
  }

  function setLang(lang) {
    try { localStorage.setItem(STORAGE_LANG, lang); } catch (e) { /* storage unavailable */ }
    applyTranslations(lang);
    document.dispatchEvent(new CustomEvent("dd:lang"));
  }

  /* ============================================================
     Age gate
     ============================================================ */
  function initAgeGate() {
    var gate = document.getElementById("age-gate");
    var card = document.getElementById("age-gate-card");
    if (!gate || !card) return;

    var lang = getLang();
    var ok = false;
    try { ok = localStorage.getItem(STORAGE_AGE) === "true"; } catch (e) { /* ignore */ }

    if (ok) {
      gate.hidden = true;
      return;
    }

    document.body.style.overflow = "hidden";
    var yesBtn = document.getElementById("age-yes");
    var noBtn = document.getElementById("age-no");

    yesBtn.addEventListener("click", function () {
      try { localStorage.setItem(STORAGE_AGE, "true"); } catch (e) { /* ignore */ }
      gate.hidden = true;
      document.body.style.overflow = "";
    });

    noBtn.addEventListener("click", function () {
      var dict = translations[getLang()] || translations.nl;
      card.innerHTML =
        '<h2>' + dict["gate.blocked.title"] + '</h2>' +
        '<p>' + dict["gate.blocked.text"] + '</p>' +
        '<div class="age-gate__actions">' +
        '<button type="button" class="btn btn-ghost" id="age-back">' + dict["gate.back"] + '</button>' +
        '</div>';
      document.getElementById("age-back").addEventListener("click", function () {
        location.reload();
      });
    });

    // Basic focus trap
    gate.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusable = gate.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    window.requestAnimationFrame(function () {
      var yes = document.getElementById("age-yes");
      if (yes) yes.focus();
    });
  }

  /* ============================================================
     Navigation
     ============================================================ */
  function initNav() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    var backdrop = document.createElement("div");
    backdrop.className = "nav-backdrop";
    document.body.appendChild(backdrop);

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      backdrop.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    }

    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });

    backdrop.addEventListener("click", function () { setOpen(false); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });

    var header = document.getElementById("site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
  }

  /* ============================================================
     Scroll reveal
     ============================================================ */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var groups = {};
    items.forEach(function (el) {
      var parent = el.closest(".wines-grid, .order-layout") || el.parentElement;
      var key = parent ? Array.prototype.indexOf.call(document.querySelectorAll(".wines-grid, .order-layout"), parent) : -1;
      groups[key] = groups[key] || [];
      groups[key].push(el);
    });
    Object.keys(groups).forEach(function (key) {
      groups[key].forEach(function (el, i) {
        el.style.setProperty("--stagger", (i * 90) + "ms");
        el.classList.add("reveal-stagger");
      });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ============================================================
     Order form
     ============================================================ */
  function formatEuro(n) {
    return "€" + n.toFixed(2).replace(".", ",");
  }

  function initOrderForm() {
    var form = document.getElementById("order-form");
    if (!form) return;

    // Formulier-adres van Formspree (https://formspree.io). Bevat dit nog "YOUR_FORM_ID",
    // dan opent het formulier in plaats daarvan het e-mailprogramma van de klant met de bestelling.
    var FORM_ENDPOINT = "https://formspree.io/f/mbggvgbg";
    var ORDER_EMAIL = "info@druifendraad.nl";

    var lines = Array.prototype.slice.call(form.querySelectorAll(".order-line"));
    var totalCount = document.getElementById("order-total-count");
    var totalAmount = document.getElementById("order-total-amount");
    var linesError = document.getElementById("order-lines-error");
    var submitBtn = document.getElementById("order-submit");
    var status = document.getElementById("form-status");

    function dictNow() { return translations[getLang()] || translations.nl; }

    function qtyOf(line) {
      var v = parseInt(line.querySelector(".order-qty").value, 10);
      if (isNaN(v) || v < 0) return 0;
      return Math.min(v, 99);
    }

    function setQty(line, value) {
      var v = Math.max(0, Math.min(99, value));
      line.querySelector(".order-qty").value = v;
      updateTotals();
    }

    function updateTotals() {
      var bottles = 0;
      var amount = 0;
      lines.forEach(function (line) {
        var q = qtyOf(line);
        var price = parseFloat(line.getAttribute("data-price"));
        bottles += q;
        amount += q * price;
        line.querySelector(".order-line__sub").textContent = q ? formatEuro(q * price) : "–";
        line.classList.toggle("has-qty", q > 0);
        line.querySelector('[data-step="-1"]').disabled = q === 0;
        line.querySelector('[data-step="1"]').disabled = q >= 99;
      });
      var d = dictNow();
      totalCount.textContent = bottles + " " + (bottles === 1 ? d["order.bottle"] : d["order.bottles"]);
      totalAmount.textContent = formatEuro(amount);
      if (bottles > 0) linesError.hidden = true;
      return { bottles: bottles, amount: amount };
    }

    lines.forEach(function (line) {
      line.querySelectorAll(".stepper__btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          setQty(line, qtyOf(line) + parseInt(btn.getAttribute("data-step"), 10));
        });
      });
      line.querySelector(".order-qty").addEventListener("input", updateTotals);
      line.querySelector(".order-qty").addEventListener("change", function () { setQty(line, qtyOf(line)); });
    });

    document.addEventListener("dd:lang", updateTotals);

    function lineFor(wine) {
      return form.querySelector('.order-line[data-wine="' + wine + '"]');
    }

    // Een wijn toevoegen vanaf een wijnkaart: staat hij op 0, dan wordt het 1 fles.
    function addWine(wine, opts) {
      opts = opts || {};
      var line = lineFor(wine);
      if (!line) return;
      if (qtyOf(line) === 0) setQty(line, 1);
      if (opts.scroll !== false) {
        var target = document.getElementById("bestellen");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (opts.focus) {
        window.setTimeout(function () { line.querySelector(".order-qty").focus(); }, 450);
      }
    }

    document.querySelectorAll(".btn-order-wine").forEach(function (btn) {
      btn.addEventListener("click", function () {
        addWine(btn.getAttribute("data-wine"), { focus: true });
      });
    });

    // Vanaf een wijnpagina, bijvoorbeeld index.html?wine=rouge#bestellen
    var queryWine = new URLSearchParams(window.location.search).get("wine");
    if (queryWine) addWine(queryWine, { scroll: false });

    updateTotals();

    function buildOrder() {
      var rows = [];
      var bottles = 0;
      var amount = 0;
      lines.forEach(function (line) {
        var q = qtyOf(line);
        if (!q) return;
        var price = parseFloat(line.getAttribute("data-price"));
        bottles += q;
        amount += q * price;
        rows.push(q + " × " + line.getAttribute("data-name") + " (" + formatEuro(price) + ") = " + formatEuro(q * price));
      });
      return { rows: rows, bottles: bottles, amount: amount };
    }

    function value(name) {
      var el = form.elements[name];
      return el ? el.value.trim() : "";
    }

    function addressText() {
      var number = value("huisnummer") + (value("toevoeging") ? " " + value("toevoeging") : "");
      return value("straat") + " " + number + ", " + value("postcode").toUpperCase() + " " + value("plaats");
    }

    function sendMailto(order) {
      var body = [
        "Nieuwe bestelaanvraag via druifendraad.nl",
        "",
        "Bestelling:",
        order.rows.join("\n"),
        "Totaal: " + order.bottles + " fles(sen), " + formatEuro(order.amount) + " incl. btw",
        "",
        "Naam: " + value("naam"),
        "E-mail: " + value("email"),
        "Telefoon: " + (value("telefoon") || "-"),
        "Bezorgadres: " + addressText(),
        "",
        "Bericht: " + (value("bericht") || "-")
      ].join("\n");
      window.location.href = "mailto:" + ORDER_EMAIL +
        "?subject=" + encodeURIComponent("Nieuwe bestelling — " + order.bottles + " fles(sen)") +
        "&body=" + encodeURIComponent(body);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var dict = dictNow();
      status.classList.remove("is-visible");

      var order = buildOrder();
      if (order.bottles === 0) {
        linesError.textContent = dict["order.errNoBottles"];
        linesError.hidden = false;
        lines[0].querySelector(".order-qty").focus();
        return;
      }

      var postcode = form.elements["postcode"];
      if (postcode) postcode.setCustomValidity("");
      if (postcode && postcode.value && !postcode.checkValidity()) {
        postcode.setCustomValidity(dict["order.errPostcode"]);
      }
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (FORM_ENDPOINT.indexOf("YOUR_FORM_ID") !== -1) {
        sendMailto(order);
        status.textContent = dict["order.mailto"];
        status.dataset.state = "success";
        status.classList.add("is-visible");
        return;
      }

      submitBtn.setAttribute("data-loading", "true");
      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-label").textContent = dict["order.sending"];

      var data = new FormData(form);
      lines.forEach(function (line) {
        if (!qtyOf(line)) data.delete(line.querySelector(".order-qty").name);
      });
      data.set("_subject", "Nieuwe bestelling — Druif & Draad (" + order.bottles + " fles(sen), " + formatEuro(order.amount) + ")");
      data.set("bestelling", order.rows.join("\n"));
      data.set("totaal", order.bottles + " fles(sen), " + formatEuro(order.amount) + " incl. btw");
      data.set("bezorgadres", addressText());

      fetch(FORM_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" }
      })
        .then(function (response) {
          if (response.ok) {
            status.textContent = dict["order.success"];
            status.dataset.state = "success";
            status.classList.add("is-visible");
            form.reset();
            updateTotals();
          } else {
            throw new Error("Form submission failed");
          }
        })
        .catch(function () {
          status.innerHTML = dict["order.error"] + ' <a href="mailto:' + ORDER_EMAIL + '">' + ORDER_EMAIL + '</a>.';
          status.dataset.state = "error";
          status.classList.add("is-visible");
        })
        .finally(function () {
          submitBtn.setAttribute("data-loading", "false");
          submitBtn.disabled = false;
          submitBtn.querySelector(".btn-label").textContent = dict["order.submit"];
        });
    });
  }

  /* ============================================================
     Init
     ============================================================ */
  document.addEventListener("DOMContentLoaded", function () {
    applyTranslations(getLang());
    initAgeGate();
    initNav();
    initReveal();
    initOrderForm();

    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    var langNl = document.getElementById("lang-nl");
    var langEn = document.getElementById("lang-en");
    if (langNl) langNl.addEventListener("click", function () { setLang("nl"); });
    if (langEn) langEn.addEventListener("click", function () { setLang("en"); });
  });
})();
