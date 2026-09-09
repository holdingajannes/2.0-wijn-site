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
      "hero.lede": "Drie Franse wijnen, rechtstreeks geïmporteerd van kleinschalige domeinen — geselecteerd op karakter, niet op grootschaligheid.",
      "hero.cta1": "Bekijk de wijnen",
      "hero.cta2": "Ons verhaal",
      "hero.badge": "Blanc · Rosé · Rouge",
      "story.eyebrow": "Ons verhaal",
      "story.heading": "De draad tussen wijngaard en tafel",
      "story.text": "Druif &amp; Draad is een kleine, onafhankelijke wijnimporteur die zich richt op wijnen uit Frankrijk. Het idee ontstond uit een liefde voor Franse wijngaarden en het verlangen om die kwaliteit rechtstreeks, zonder omwegen, naar Nederlandse tafels te brengen. Elke fles wordt met zorg geselecteerd bij kleinschalige domeinen, met aandacht voor karakter boven grootschaligheid. De naam verwijst naar de druif zelf en de draad die de wijngaard, de wijnmaker en de mensen die samen een glas delen met elkaar verbindt.",
      "story.kw1": "Kleinschalig",
      "story.kw2": "Rechtstreeks geïmporteerd",
      "story.kw3": "Karakter boven grootschaligheid",
      "wines.eyebrow": "De collectie",
      "wines.heading": "Drie wijnen, één verhaal",
      "wines.sub": "Elk met een eigen karakter — allemaal met dezelfde zorgvuldige herkomst.",
      "wine.blanc.type": "Witte wijn",
      "wine.blanc.kw1": "Fris", "wine.blanc.kw2": "Elegant", "wine.blanc.kw3": "Verfijnd",
      "wine.blanc.desc": "Een frisse, elegante witte wijn met een verfijnde uitstraling. Licht van karakter, met een stijl die past bij zowel een rustige avond als een feestelijk moment.",
      "wine.blanc.story": "Deze Blanc komt van een klein perceel op een zonovergoten helling in de Rhônevallei, waar de druiven langzaam rijpen dankzij de koele avondwind. De wijnmaker oogst er bewust vroeg in de ochtend om de frisheid in het glas te bewaren.",
      "wine.rose.type": "Rosé",
      "wine.rose.kw1": "Licht", "wine.rose.kw2": "Fruitig", "wine.rose.kw3": "Levendig",
      "wine.rose.desc": "Een toegankelijke rosé met een zachte, fruitige stijl. Levendig in het glas en gemakkelijk te combineren met een zomerse maaltijd of een moment van ontspanning.",
      "wine.rose.story": "De druiven voor deze rosé worden met de hand geplukt op een familiedomein dat al drie generaties dezelfde wijngaard bewerkt. Kort huidcontact geeft de wijn zijn zachte kleur en levendige karakter.",
      "wine.rouge.type": "Rode wijn",
      "wine.rouge.kw1": "Rijk", "wine.rouge.kw2": "Karaktervol", "wine.rouge.kw3": "Rond",
      "wine.rouge.desc": "Een karaktervolle rode wijn met een rijke en ronde indruk. Vol van smaak, met de body en diepgang die je van een goede Franse rode wijn verwacht.",
      "wine.rouge.story": "Deze Rouge rijpt langzaam in oude eiken vaten, in een kelder die al meer dan honderd jaar dienstdoet als opslagplaats voor de beste vaten van het domein.",
      "wine.priceNote": "incl. btw",
      "wine.orderCta": "Bestellen",
      "order.eyebrow": "Bestellen",
      "order.heading": "Vraag je flessen aan",
      "order.sub": "Vul het formulier in en we nemen persoonlijk contact met je op om je bestelling af te ronden.",
      "order.perBottle": "per fles, incl. btw",
      "order.name": "Naam",
      "order.email": "E-mailadres",
      "order.phone": "Telefoonnummer",
      "order.optional": "(optioneel)",
      "order.wine": "Gewenste wijn",
      "order.wineChoose": "Kies een wijn…",
      "order.wineBlanc": "Blanc",
      "order.wineRose": "Rosé",
      "order.wineRouge": "Rouge",
      "order.wineAll": "Proefpakket (alle drie)",
      "order.qty": "Aantal flessen",
      "order.postcode": "Postcode",
      "order.message": "Bericht",
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
      "hero.lede": "Three French wines, imported directly from small-scale estates — selected for character, not for scale.",
      "hero.cta1": "View the wines",
      "hero.cta2": "Our story",
      "hero.badge": "Blanc · Rosé · Rouge",
      "story.eyebrow": "Our story",
      "story.heading": "The thread between vineyard and table",
      "story.text": "Druif &amp; Draad is a small, independent wine importer focused on wines from France. The idea was born from a love for French vineyards and the desire to bring that quality straight to Dutch tables, without detours. Every bottle is carefully selected from small-scale estates, with attention to character rather than scale. The name refers to the grape itself and the thread that connects the vineyard, the winemaker, and the people who share a glass together.",
      "story.kw1": "Small-scale",
      "story.kw2": "Imported directly",
      "story.kw3": "Character over scale",
      "wines.eyebrow": "The collection",
      "wines.heading": "Three wines, one story",
      "wines.sub": "Each with its own character — all with the same careful provenance.",
      "wine.blanc.type": "White wine",
      "wine.blanc.kw1": "Fresh", "wine.blanc.kw2": "Elegant", "wine.blanc.kw3": "Refined",
      "wine.blanc.desc": "A fresh, elegant white wine with a refined character. Light in style, suited to both a quiet evening and a festive occasion.",
      "wine.blanc.story": "This Blanc comes from a small plot on a sun-drenched slope in the Rhône Valley, where the grapes ripen slowly thanks to the cool evening breeze. The winemaker deliberately harvests early in the morning to preserve freshness in the glass.",
      "wine.rose.type": "Rosé",
      "wine.rose.kw1": "Light", "wine.rose.kw2": "Fruity", "wine.rose.kw3": "Lively",
      "wine.rose.desc": "An approachable rosé with a soft, fruity style. Lively in the glass and easy to pair with a summer meal or a moment of relaxation.",
      "wine.rose.story": "The grapes for this rosé are hand-picked on a family estate that has worked the same vineyard for three generations. Brief skin contact gives the wine its soft colour and lively character.",
      "wine.rouge.type": "Red wine",
      "wine.rouge.kw1": "Rich", "wine.rouge.kw2": "Characterful", "wine.rouge.kw3": "Round",
      "wine.rouge.desc": "A characterful red wine with a rich and round impression. Full of flavour, with the body and depth you'd expect from a good French red.",
      "wine.rouge.story": "This Rouge ages slowly in old oak barrels, in a cellar that has served as storage for the estate's finest barrels for over a hundred years.",
      "wine.priceNote": "incl. VAT",
      "wine.orderCta": "Order",
      "order.eyebrow": "Order",
      "order.heading": "Request your bottles",
      "order.sub": "Fill in the form and we'll get in touch personally to finalise your order.",
      "order.perBottle": "per bottle, incl. VAT",
      "order.name": "Name",
      "order.email": "Email address",
      "order.phone": "Phone number",
      "order.optional": "(optional)",
      "order.wine": "Preferred wine",
      "order.wineChoose": "Choose a wine…",
      "order.wineBlanc": "Blanc",
      "order.wineRose": "Rosé",
      "order.wineRouge": "Rouge",
      "order.wineAll": "Tasting set (all three)",
      "order.qty": "Number of bottles",
      "order.postcode": "Postal code",
      "order.message": "Message",
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

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
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
  function initOrderForm() {
    var form = document.getElementById("order-form");
    if (!form) return;

    var wineSelect = document.getElementById("f-wine");
    document.querySelectorAll(".btn-order-wine").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wine = btn.getAttribute("data-wine");
        var map = { blanc: "Blanc", rose: "Rosé", rouge: "Rouge" };
        if (wineSelect && map[wine]) {
          wineSelect.value = map[wine];
        }
        document.getElementById("bestellen").scrollIntoView({ behavior: "smooth", block: "start" });
        var nameField = document.getElementById("f-name");
        window.setTimeout(function () { if (nameField) nameField.focus(); }, 450);
      });
    });

    var submitBtn = document.getElementById("order-submit");
    var status = document.getElementById("form-status");

    // Replace this with your own Formspree endpoint (https://formspree.io) before publishing.
    var FORM_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var dict = translations[getLang()] || translations.nl;
      submitBtn.setAttribute("data-loading", "true");
      submitBtn.disabled = true;
      submitBtn.querySelector(".btn-label").textContent = dict["order.sending"];
      status.className = "form-status";
      status.classList.remove("is-visible");

      var data = new FormData(form);

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
          } else {
            throw new Error("Form submission failed");
          }
        })
        .catch(function () {
          status.innerHTML = dict["order.error"] + ' <a href="mailto:info@druifendraad.nl">info@druifendraad.nl</a>.';
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
