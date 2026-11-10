(function () {
  "use strict";

  /* ============================================================
     Hulpfuncties
     ============================================================ */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Bouwt een element. Alle tekst gaat via textContent, nooit als HTML: bestelgegevens
  // komen van bezoekers van de website en mogen nooit als code worden uitgevoerd.
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var val = attrs[key];
      if (val === null || val === undefined || val === false) return;
      if (key === "class") el.className = val;
      else if (key === "text") el.textContent = val;
      else if (key.indexOf("on") === 0) el.addEventListener(key.slice(2), val);
      else el.setAttribute(key, val === true ? "" : val);
    });
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return el;
  }

  var numberFmt = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) {
    var v = Number(n) || 0;
    return (v < 0 ? "-" : "") + "€ " + numberFmt.format(Math.abs(v));
  }

  function dateOnly(iso) { // "2026-11-09" -> "09-11-2026"
    return String(iso || "").split("-").reverse().join("-");
  }
  function dateTime(ts) {
    return new Date(ts).toLocaleString("nl-NL", {
      timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  var STATUSES = ["nieuw", "bevestigd", "geleverd", "geannuleerd"];
  var STATUS_LABEL = { nieuw: "Nieuw", bevestigd: "Bevestigd", geleverd: "Geleverd", geannuleerd: "Geannuleerd" };
  function badge(status) {
    var known = STATUSES.indexOf(status) !== -1;
    return h("span", { class: "badge" + (known ? " badge-" + status : ""), text: known ? STATUS_LABEL[status] : String(status) });
  }

  var toastTimer;
  function toast(message, isError) {
    var el = $("#toast");
    el.textContent = message;
    el.classList.toggle("is-error", !!isError);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, isError ? 6000 : 3000);
  }

  function showView(name) {
    ["setup", "login", "app"].forEach(function (v) { $("#view-" + v).hidden = v !== name; });
  }

  function bottlesOf(order) {
    return (order.order_items || []).reduce(function (sum, it) { return sum + it.quantity; }, 0);
  }
  function addressLine(o) {
    return o.street + " " + o.house_number + (o.addition ? " " + o.addition : "");
  }
  // Handmatige bestellingen hebben niet altijd een e-mailadres: dan herkennen we de klant aan naam en postcode.
  function customerKey(o) {
    var email = String(o.email || "").trim().toLowerCase();
    return email || (String(o.name).trim() + "|" + o.postcode).toLowerCase();
  }

  /* ============================================================
     Verbinding
     ============================================================ */

  var config = window.DD_CONFIG || {};
  if (!config.supabaseUrl || !config.supabaseKey || !window.supabase) {
    showView("setup");
    return;
  }
  var sb = window.supabase.createClient(config.supabaseUrl, config.supabaseKey);

  var state = {
    userId: null,
    orders: [],
    invoices: [],   // nieuwste eerst
    returns: [],
    creditNotes: [],
    changes: [],
    priceChanges: [],
    stock: [],
    stockMovements: [],
    stockAll: false,       // false: laatste mutaties tonen; true: de hele lijst
    settings: null,
    products: []
  };

  function invoiceFor(orderId) {
    for (var i = 0; i < state.invoices.length; i++) {
      if (state.invoices[i].order_id === orderId) return state.invoices[i];
    }
    return null;
  }

  /* ============================================================
     Inloggen
     ============================================================ */

  var loginForm = $("#login-form");
  var loginError = $("#login-error");

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("#login-email").value.trim();
    var password = $("#login-password").value;
    loginError.hidden = true;
    if (!email || !password) {
      loginError.textContent = "Vul je e-mailadres en wachtwoord in.";
      loginError.hidden = false;
      return;
    }
    var btn = $("#login-submit");
    btn.disabled = true;
    sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error) {
        loginError.textContent = "Het e-mailadres of wachtwoord klopt niet.";
        loginError.hidden = false;
      }
      $("#login-password").value = "";
    }).catch(function () {
      loginError.textContent = "Inloggen lukt nu niet. Controleer je internetverbinding.";
      loginError.hidden = false;
    }).then(function () { btn.disabled = false; });
  });

  $("#logout").addEventListener("click", function () {
    sb.auth.signOut();
  });

  // Alleen accounts in de tabel "staff" komen binnen. Anderen worden direct uitgelogd.
  function route(session) {
    if (!session) {
      state.userId = null;
      closeDialog();
      showView("login");
      return;
    }
    if (state.userId === session.user.id) return;
    sb.from("staff").select("user_id").maybeSingle().then(function (res) {
      if (res.error || !res.data) {
        sb.auth.signOut();
        loginError.textContent = "Dit account heeft geen toegang tot de back office.";
        loginError.hidden = false;
        showView("login");
        return;
      }
      state.userId = session.user.id;
      $("#user-email").textContent = session.user.email || "";
      showView("app");
      loadAll();
    });
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    // Niet direct in deze callback nieuwe aanvragen doen (bekend probleem van supabase-js).
    setTimeout(function () { route(session); }, 0);
  });

  /* ============================================================
     Gegevens laden
     ============================================================ */

  function showLoadError(message) {
    var el = $("#load-error");
    el.textContent = message || "";
    el.hidden = !message;
  }

  // Supabase geeft standaard maximaal 1000 rijen per aanvraag; haal daarom in porties op.
  function fetchAll(table, columns, orderCol, ascending) {
    var PAGE = 1000;
    var all = [];
    function next(from) {
      return sb.from(table).select(columns).order(orderCol, { ascending: ascending }).range(from, from + PAGE - 1)
        .then(function (res) {
          if (res.error) return res;
          all = all.concat(res.data || []);
          if ((res.data || []).length < PAGE) return { data: all, error: null };
          return next(from + PAGE);
        });
    }
    return next(0);
  }

  function loadAll() {
    showLoadError("");
    return Promise.all([
      fetchAll("orders", "*, order_items(*)", "created_at", false),
      sb.from("invoices").select("*").order("invoice_number", { ascending: false }),
      sb.from("settings").select("*").eq("id", 1).maybeSingle(),
      sb.from("products").select("*").order("sort_order", { ascending: true }),
      fetchAll("product_returns", "*", "created_at", false),
      fetchAll("credit_notes", "*", "credit_number", false),
      fetchAll("order_changes", "*", "changed_at", false),
      fetchAll("price_changes", "*", "changed_at", false),
      sb.from("stock_levels").select("*"),
      state.stockAll
        ? fetchAll("stock_movements", "*", "id", false)
        : sb.from("stock_movements").select("*").order("id", { ascending: false }).limit(STOCK_LOG_RECENT + 1)
    ]).then(function (results) {
      var failed = results.filter(function (r) { return r.error; })[0];
      if (failed) {
        showLoadError("De gegevens konden niet worden geladen. Probeer te vernieuwen. (" + failed.error.message + ")");
        return;
      }
      state.orders = results[0].data || [];
      state.invoices = results[1].data || [];
      state.settings = results[2].data;
      state.products = results[3].data || [];
      state.returns = results[4].data || [];
      state.creditNotes = results[5].data || [];
      state.changes = results[6].data || [];
      state.priceChanges = results[7].data || [];
      state.stock = results[8].data || [];
      state.stockMovements = results[9].data || [];
      renderAll();
    }).catch(function () {
      showLoadError("De gegevens konden niet worden geladen. Controleer je internetverbinding en vernieuw.");
    });
  }

  $("#refresh").addEventListener("click", function () {
    loadAll().then(function () { toast("Bijgewerkt"); });
  });

  /* ============================================================
     Tabs
     ============================================================ */

  function showTab(name) {
    $$(".tabs [data-tab]").forEach(function (btn) {
      btn.setAttribute("aria-selected", String(btn.getAttribute("data-tab") === name));
    });
    ["dashboard", "orders", "stock", "invoices", "settings"].forEach(function (t) { $("#tab-" + t).hidden = t !== name; });
  }
  $$(".tabs [data-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () { showTab(btn.getAttribute("data-tab")); });
  });

  /* ============================================================
     Bestellingen
     ============================================================ */

  function renderAll() {
    renderDashboard();
    renderOrders();
    renderInvoices();
    renderStock();
    renderSettings();
    renderProducts();
  }

  function matchesFilter(order) {
    var f = $("#order-filter").value;
    if (f === "all") return true;
    // Openstaand: nog iets te doen, dus niet geannuleerd en niet (geleverd én betaald).
    if (f === "open") return order.status !== "geannuleerd" && !(order.status === "geleverd" && order.paid_at);
    if (f === "unpaid") return order.status !== "geannuleerd" && !order.paid_at;
    if (f === "paid") return !!order.paid_at;
    return order.status === f;
  }

  function matchesSearch(order, q) {
    if (!q) return true;
    var hay = [order.order_number, order.name, order.email, order.city, order.postcode, order.street].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function visibleOrders() {
    var q = $("#order-search").value.trim().toLowerCase();
    return state.orders.filter(function (o) { return matchesFilter(o) && matchesSearch(o, q); });
  }

  function renderOrders() {
    var rows = visibleOrders();
    var tbody = $("#orders-table tbody");
    tbody.textContent = "";
    rows.forEach(function (o) {
      var inv = invoiceFor(o.id);
      var tr = h("tr", { class: "clickable", onclick: function () { openOrder(o.id); } }, [
        h("td", {}, [h("button", {
          type: "button", class: "link-btn", text: "#" + o.order_number,
          "aria-label": "Bestelling " + o.order_number + " openen",
          onclick: function (e) { e.stopPropagation(); openOrder(o.id); }
        })]),
        h("td", { text: dateTime(o.created_at) }),
        h("td", { text: o.name }),
        h("td", { text: o.city }),
        h("td", { class: "num", text: String(bottlesOf(o)) }),
        h("td", { class: "num", text: money(o.total_incl) }),
        h("td", {}, [
          badge(o.status),
          o.paid_at ? h("span", { class: "badge badge-betaald", text: "Betaald" }) : null,
          o.source === "handmatig" ? h("span", { class: "badge badge-manual", text: "Handmatig" }) : null,
          o.edited_at ? h("span", { class: "badge badge-edited", text: "Aangepast" }) : null
        ]),
        h("td", { text: inv ? inv.invoice_number : "–" })
      ]);
      tbody.appendChild(tr);
    });
    $("#orders-empty").hidden = rows.length > 0;
    $("#orders-table").hidden = rows.length === 0;

    var fresh = state.orders.filter(function (o) { return o.status === "nieuw"; }).length;
    var count = $("#count-orders");
    count.textContent = String(fresh);
    count.hidden = fresh === 0;
  }

  $("#order-filter").addEventListener("change", renderOrders);
  $("#order-search").addEventListener("input", renderOrders);

  /* ============================================================
     Bestelling openen
     ============================================================ */

  var dialog = $("#order-dialog");
  var openOrderId = null;
  var editingOrder = false;

  function closeDialog() {
    if (dialog.open) dialog.close();
    openOrderId = null;
    editingOrder = false;
  }
  dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); });
  dialog.addEventListener("close", function () { openOrderId = null; });

  function openOrder(id) {
    openOrderId = id;
    editingOrder = false;
    renderDialog();
    if (!dialog.open) dialog.showModal();
  }

  function settingsComplete() {
    var s = state.settings || {};
    return !!(s.company_name && s.address_line1 && s.postcode_city && s.kvk && s.vat_number && s.iban);
  }

  function renderDialog() {
    var order = state.orders.filter(function (o) { return o.id === openOrderId; })[0];
    if (!order) { closeDialog(); return; }
    var inv = invoiceFor(order.id);
    dialog.textContent = "";

    var statusSelect = h("select", { id: "dlg-status", "aria-label": "Status" }, STATUSES.map(function (s) {
      return h("option", { value: s, text: STATUS_LABEL[s], selected: s === order.status });
    }));
    statusSelect.addEventListener("change", function () {
      var previous = order.status;
      var next = statusSelect.value;
      sb.from("orders").update({ status: next }).eq("id", order.id).select().then(function (res) {
        if (res.error || !res.data || !res.data.length) {
          statusSelect.value = previous;
          toast("Status wijzigen is niet gelukt.", true);
          return;
        }
        order.status = next;
        renderOrders();
        renderDashboard();
        toast("Status opgeslagen");
        refreshChanges(order);
      });
    });

    var items = (order.order_items || []).slice().sort(function (a, b) { return a.id - b.id; });

    var noteArea = h("textarea", { id: "dlg-note", rows: "3", maxlength: "1000", "aria-label": "Interne notitie" });
    noteArea.value = order.internal_note || "";

    var invoiceBox;
    if (inv) {
      invoiceBox = h("div", { class: "invoice-box" }, [
        h("p", {}, [h("strong", { text: "Factuur " + inv.invoice_number }), " — " + dateOnly(inv.issued_on) + ", betalen vóór " + dateOnly(inv.due_on)]),
        h("button", { type: "button", class: "btn btn-primary btn-small", text: "Download PDF", onclick: function () { downloadInvoice(inv); } })
      ]);
    } else if (order.status === "geannuleerd") {
      invoiceBox = h("div", { class: "invoice-box" }, [h("p", { text: "Voor een geannuleerde bestelling kan geen factuur worden gemaakt." })]);
    } else {
      invoiceBox = h("div", { class: "invoice-box" }, [
        h("p", { text: settingsComplete()
          ? "Er is nog geen factuur. Controleer eerst de gegevens van de klant en de bestelling."
          : "Vul eerst bij Instellingen alle gegevens voor de factuur in (adres, KvK, BTW-nummer en IBAN)." }),
        h("button", {
          type: "button", class: "btn btn-primary btn-small", id: "dlg-make-invoice", text: "Factuur maken",
          onclick: function () { makeInvoice(order); }
        })
      ]);
    }

    dialog.appendChild(h("div", { class: "dialog-head" }, [
      h("div", {}, [
        h("h1", { id: "dialog-title", text: "Bestelling #" + order.order_number }),
        h("p", { text: (order.source === "handmatig" ? "Handmatig toegevoegd, besteld op " : "Ontvangen op ") + dateTime(order.created_at) })
      ]),
      h("button", { type: "button", class: "btn btn-small", text: "Sluiten", onclick: closeDialog })
    ]));
    dialog.setAttribute("aria-labelledby", "dialog-title");

    dialog.appendChild(h("div", { class: "dialog-section row" }, [
      h("strong", { text: "Status" }), statusSelect,
      order.edited_at ? h("span", { class: "badge badge-edited", text: "Aangepast op " + dateTime(order.edited_at) }) : null
    ]));

    if (order.status !== "geannuleerd") {
      var paidBtn = h("button", {
        type: "button", class: order.paid_at ? "btn btn-small" : "btn btn-primary btn-small", id: "dlg-paid",
        text: order.paid_at ? "Betaling ongedaan maken" : "Markeer als betaald"
      });
      paidBtn.addEventListener("click", function () { setPaid(order, !order.paid_at, paidBtn); });
      dialog.appendChild(h("div", { class: "dialog-section row" }, [
        h("strong", { text: "Betaling" }),
        order.paid_at ? h("span", { class: "badge badge-betaald", text: "Betaald op " + dateTime(order.paid_at) }) : h("span", { class: "meta-inline", text: "Nog niet betaald" }),
        paidBtn
      ]));
    }

    dialog.appendChild(h("div", { class: "detail-grid" }, [
      h("div", {}, [
        h("h3", { text: "Klant" }),
        h("p", { text: order.name }),
        order.email ? h("p", {}, [h("a", { href: "mailto:" + order.email, text: order.email })]) : null,
        order.phone ? h("p", { text: order.phone }) : null
      ]),
      h("div", {}, [
        h("h3", { text: "Bezorgadres" }),
        h("p", { text: addressLine(order) }),
        h("p", { text: order.postcode + " " + order.city })
      ])
    ]));

    if (order.message) {
      dialog.appendChild(h("h3", { text: "Bericht van de klant" }));
      dialog.appendChild(h("p", { class: "message-box", text: order.message }));
    }

    dialog.appendChild(itemsSection(order, items, inv));

    dialog.appendChild(h("div", { class: "dialog-section" }, [
      h("h3", { text: "Interne notitie (de klant ziet dit niet)" }),
      noteArea,
      h("div", { class: "row" }, [h("button", {
        type: "button", class: "btn btn-small", text: "Notitie opslaan", onclick: function () {
          sb.from("orders").update({ internal_note: noteArea.value.trim() || null }).eq("id", order.id).select().then(function (res) {
            if (res.error || !res.data || !res.data.length) { toast("Notitie opslaan is niet gelukt.", true); return; }
            order.internal_note = noteArea.value.trim() || null;
            toast("Notitie opgeslagen");
          });
        }
      })])
    ]));

    dialog.appendChild(h("div", { class: "dialog-section" }, [h("h3", { text: "Factuur" }), invoiceBox]));
    dialog.appendChild(returnsSection(order));
    dialog.appendChild(historySection(order));
  }

  var PAID_ERRORS = {
    order_cancelled: "Voor een geannuleerde bestelling kun je geen betaling registreren.",
    already_paid: "Deze bestelling is al als betaald gemarkeerd.",
    not_paid: "Deze bestelling staat niet als betaald."
  };

  function setPaid(order, paid, button) {
    if (!paid && !window.confirm("De betaling van bestelling #" + order.order_number + " ongedaan maken?")) return;
    button.disabled = true;
    sb.rpc("set_order_paid", { p_order_id: order.id, p_paid: paid }).then(function (res) {
      if (res.error) {
        button.disabled = false;
        toast(PAID_ERRORS[res.error.message] || "Opslaan is niet gelukt. Probeer het opnieuw.", true);
        return;
      }
      loadAll().then(function () {
        if (openOrderId === order.id) renderDialog();
        toast(paid ? "Betaling vastgelegd" : "Betaling ongedaan gemaakt");
      });
    });
  }

  /* ============================================================
     Bestelling handmatig toevoegen
     ============================================================ */

  var NEW_ORDER_ERRORS = {
    invalid_input: "Controleer de gegevens van de klant: een veld is leeg of te lang.",
    invalid_email: "Dit e-mailadres klopt niet. Laat het veld leeg als je het niet weet.",
    invalid_postcode: "Vul een geldige postcode in, bijvoorbeeld 1234 AB.",
    invalid_date: "De besteldatum mag niet in de toekomst liggen (en maximaal twee jaar terug).",
    invalid_status: "Kies een geldige status.",
    invalid_quantity: "Vul per wijn een heel aantal tussen 0 en 99 in.",
    invalid_price: "Vul een prijs in tussen € 0,00 en € 999,99.",
    no_items: "Een bestelling moet minstens één fles bevatten.",
    unknown_product: "Deze wijn is niet (meer) beschikbaar.",
    duplicate_product: "Een wijn staat dubbel in de bestelling.",
    not_allowed: "Je hebt geen toegang om bestellingen toe te voegen."
  };
  var NEW_ORDER_STATUSES = ["nieuw", "bevestigd", "geleverd"];

  function openNewOrder() {
    openOrderId = null;
    editingOrder = false;
    renderNewOrder();
    if (!dialog.open) dialog.showModal();
  }

  function renderNewOrder() {
    dialog.textContent = "";
    dialog.setAttribute("aria-labelledby", "dialog-title");

    function text(id, label, attrs) {
      var input = h("input", Object.assign({ type: "text", id: id, autocomplete: "off" }, attrs || {}));
      return { input: input, label: h("label", {}, [label, input]) };
    }
    var f = {
      name: text("new-name", "Naam", { maxlength: "120" }),
      email: text("new-email", "E-mailadres (optioneel)", { type: "email", maxlength: "200" }),
      phone: text("new-phone", "Telefoon (optioneel)", { maxlength: "40" }),
      street: text("new-street", "Straat", { maxlength: "120" }),
      number: text("new-number", "Huisnummer", { maxlength: "20" }),
      addition: text("new-addition", "Toevoeging (optioneel)", { maxlength: "20" }),
      postcode: text("new-postcode", "Postcode", { maxlength: "7", placeholder: "1234 AB" }),
      city: text("new-city", "Plaats", { maxlength: "80" }),
      date: text("new-date", "Besteldatum", { type: "date", max: today(), required: true })
    };
    f.date.input.value = today();
    var status = h("select", { id: "new-status" }, NEW_ORDER_STATUSES.map(function (s) {
      return h("option", { value: s, text: STATUS_LABEL[s] });
    }));
    var paid = h("input", { type: "checkbox", id: "new-paid" });
    var note = h("textarea", { id: "new-note", rows: "2", maxlength: "1000", placeholder: "bijv. telefonisch besteld, betaalt contant bij levering" });

    var rows = state.products.filter(function (p) { return p.active; }).map(function (p) {
      return {
        slug: p.slug, name: p.name, price: Number(p.price_incl),
        qty: h("input", { type: "number", min: "0", max: "99", step: "1", value: "0", "aria-label": "Aantal " + p.name }),
        priceInput: h("input", { type: "text", inputmode: "decimal", autocomplete: "off", value: Number(p.price_incl).toFixed(2).replace(".", ","), "aria-label": "Prijs per fles " + p.name })
      };
    });
    var totalEl = h("span", { class: "num", text: money(0) });

    function parsePrice(r) {
      var v = parseFloat(String(r.priceInput.value).replace(",", "."));
      return v >= 0 && v < 1000 ? Math.round(v * 100) / 100 : NaN;
    }
    function recompute() {
      var total = rows.reduce(function (t, r) {
        var q = parseInt(r.qty.value, 10), p = parsePrice(r);
        return t + (q > 0 && !isNaN(p) ? q * p : 0);
      }, 0);
      totalEl.textContent = money(total);
    }

    var itemsBox = h("div", { class: "edit-box" }, [
      h("div", { class: "edit-row edit-head" }, [h("span", { text: "Wijn" }), h("span", { text: "Prijs per fles" }), h("span", { text: "Aantal" })])
    ]);
    rows.forEach(function (r) {
      r.qty.addEventListener("input", recompute);
      r.priceInput.addEventListener("input", recompute);
      itemsBox.appendChild(h("div", { class: "edit-row" }, [h("span", { text: "Druif & Draad " + r.name + " (voorraad " + stockOf(r.slug) + ")" }), r.priceInput, r.qty]));
    });
    itemsBox.appendChild(h("div", { class: "edit-total" }, [h("span", { text: "Totaal incl. btw" }), totalEl]));

    var save = h("button", { type: "submit", class: "btn btn-primary", id: "new-save", text: "Bestelling toevoegen" });
    var form = h("form", { class: "return-form", novalidate: true }, [
      f.name.label, f.email.label, f.phone.label, h("span"),
      f.street.label, f.number.label, f.addition.label, f.postcode.label,
      f.city.label,
      f.date.label,
      h("label", {}, ["Status", status]),
      h("label", { class: "span-2 check-row" }, [paid, "Al betaald (bijvoorbeeld contant bij een verkoop)"]),
      h("div", { class: "span-2" }, [h("h3", { text: "Wijnen" }), itemsBox]),
      h("label", { class: "span-2" }, ["Interne notitie (optioneel, de klant ziet dit niet)", note]),
      h("div", { class: "span-2 row" }, [
        save,
        h("button", { type: "button", class: "btn", text: "Annuleren", onclick: closeDialog })
      ])
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function v(field) { return field.input.value.trim(); }
      if (!v(f.name) || !v(f.street) || !v(f.number) || !v(f.city)) { toast("Vul naam, straat, huisnummer en plaats in.", true); return; }
      if (!/^[1-9][0-9]{3} ?[A-Za-z]{2}$/.test(v(f.postcode))) { toast(NEW_ORDER_ERRORS.invalid_postcode, true); return; }
      if (v(f.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v(f.email))) { toast(NEW_ORDER_ERRORS.invalid_email, true); return; }
      if (!v(f.date) || v(f.date) > today()) { toast(NEW_ORDER_ERRORS.invalid_date, true); return; }

      var items = [];
      for (var i = 0; i < rows.length; i++) {
        var q = rows[i].qty.value.trim() === "" ? 0 : Number(rows[i].qty.value);
        if (!(q >= 0 && q <= 99 && Math.floor(q) === q)) { toast(NEW_ORDER_ERRORS.invalid_quantity, true); return; }
        if (q === 0) continue;
        var p = parsePrice(rows[i]);
        if (isNaN(p)) { toast(NEW_ORDER_ERRORS.invalid_price, true); return; }
        items.push({ slug: rows[i].slug, quantity: q, unit_price: p });
      }
      if (!items.length) { toast(NEW_ORDER_ERRORS.no_items, true); return; }

      save.disabled = true;
      sb.rpc("create_manual_order", { p_order: {
        name: v(f.name), email: v(f.email), phone: v(f.phone), street: v(f.street), house_number: v(f.number),
        addition: v(f.addition), postcode: v(f.postcode), city: v(f.city), status: status.value, paid: paid.checked,
        order_date: v(f.date), internal_note: note.value.trim(), items: items
      } }).then(function (res) {
        if (res.error || !res.data) {
          save.disabled = false;
          toast(NEW_ORDER_ERRORS[res.error && res.error.message] || "De bestelling kon niet worden opgeslagen. Probeer het opnieuw.", true);
          return;
        }
        var created = res.data;
        loadAll().then(function () {
          toast("Bestelling #" + created.order_number + " toegevoegd");
          openOrder(created.id);
        });
      });
    });

    dialog.appendChild(h("div", { class: "dialog-head" }, [
      h("div", {}, [
        h("h1", { id: "dialog-title", text: "Bestelling toevoegen" }),
        h("p", { text: "Voor bestellingen die niet via de website binnenkomen." })
      ]),
      h("button", { type: "button", class: "btn btn-small", text: "Sluiten", onclick: closeDialog })
    ]));
    dialog.appendChild(form);
  }

  $("#new-order").addEventListener("click", openNewOrder);

  /* ============================================================
     Bestelling aanpassen en logboek
     ============================================================ */

  var EDIT_ERRORS = {
    has_invoice: "Er is al een factuur voor deze bestelling, dus aanpassen kan niet meer. Te veel geleverd? Registreer een retour met creditnota.",
    has_returns: "Er zijn al retouren geregistreerd; aanpassen kan niet meer.",
    order_cancelled: "Een geannuleerde bestelling kan niet worden aangepast.",
    no_change: "Er is niets gewijzigd.",
    no_items: "Een bestelling moet minstens één fles bevatten. Zet de bestelling op Geannuleerd als hij vervalt.",
    invalid_quantity: "Vul per wijn een heel aantal tussen 0 en 99 in.",
    unknown_product: "Deze wijn is niet (meer) beschikbaar."
  };

  function itemsTable(order, items) {
    return h("table", { class: "items" }, [
      h("tbody", {}, items.map(function (it) {
        return h("tr", {}, [
          h("td", { text: it.quantity + " × " + it.product_name }),
          h("td", { class: "num", text: money(it.unit_price_incl) }),
          h("td", { class: "num", text: money(it.quantity * it.unit_price_incl) })
        ]);
      })),
      h("tfoot", {}, [h("tr", {}, [
        h("td", { text: "Totaal incl. btw" }), h("td"), h("td", { class: "num", text: money(order.total_incl) })
      ])])
    ]);
  }

  function itemsSection(order, items, inv) {
    var wrap = h("div", { class: "dialog-section" }, [h("h3", { text: "Bestelling" })]);
    if (editingOrder) {
      wrap.appendChild(itemsEditor(order, items));
      return wrap;
    }
    wrap.appendChild(itemsTable(order, items));
    var hasReturns = state.returns.some(function (r) { return r.order_id === order.id; });
    if (order.status === "geannuleerd") return wrap;
    if (inv) {
      wrap.appendChild(h("p", { class: "hint", text: EDIT_ERRORS.has_invoice }));
    } else if (hasReturns) {
      wrap.appendChild(h("p", { class: "hint", text: EDIT_ERRORS.has_returns }));
    } else {
      wrap.appendChild(h("button", {
        type: "button", class: "btn btn-small", id: "dlg-edit-order", text: "Bestelling aanpassen",
        onclick: function () { editingOrder = true; renderDialog(); }
      }));
    }
    return wrap;
  }

  function itemsEditor(order, items) {
    var existing = {};
    items.forEach(function (it) { existing[it.product_slug] = it; });
    var rows = [];
    state.products.filter(function (p) { return p.active; }).forEach(function (p) {
      var ex = existing[p.slug];
      rows.push({ slug: p.slug, name: p.name, price: ex ? Number(ex.unit_price_incl) : Number(p.price_incl), qty: ex ? ex.quantity : 0 });
    });
    items.forEach(function (it) {
      if (!rows.some(function (r) { return r.slug === it.product_slug; })) {
        rows.push({ slug: it.product_slug, name: it.product_name, price: Number(it.unit_price_incl), qty: it.quantity });
      }
    });

    var totalEl = h("span", { class: "num", text: money(order.total_incl) });
    function current() {
      return rows.map(function (r) {
        var v = parseInt(r.input.value, 10);
        return { row: r, qty: isNaN(v) ? 0 : v };
      });
    }
    function recompute() {
      var total = current().reduce(function (t, c) { return t + Math.max(0, c.qty) * c.row.price; }, 0);
      totalEl.textContent = money(total);
    }

    var box = h("div", { class: "edit-box" });
    rows.forEach(function (r) {
      r.input = h("input", { type: "number", min: "0", max: "99", step: "1", value: String(r.qty), "aria-label": "Aantal " + r.name });
      r.input.addEventListener("input", recompute);
      box.appendChild(h("div", { class: "edit-row" }, [
        h("span", { text: "Druif & Draad " + r.name }),
        h("span", { class: "num", text: money(r.price) }),
        r.input
      ]));
    });
    box.appendChild(h("div", { class: "edit-total" }, [h("span", { text: "Nieuw totaal incl. btw" }), totalEl]));

    var reason = h("input", { type: "text", maxlength: "500", placeholder: "bijv. klant belde: 2 flessen te veel besteld" });
    box.appendChild(h("label", { class: "reason" }, ["Reden van de aanpassing (komt in het logboek)", reason]));

    var save = h("button", { type: "button", class: "btn btn-primary btn-small", text: "Aanpassing opslaan" });
    var cancel = h("button", { type: "button", class: "btn btn-small", text: "Annuleren", onclick: function () { editingOrder = false; renderDialog(); } });
    save.addEventListener("click", function () {
      var counts = current();
      var bad = counts.some(function (c) { return !(c.qty >= 0 && c.qty <= 99); });
      if (bad) { toast(EDIT_ERRORS.invalid_quantity, true); return; }
      var bottles = counts.reduce(function (t, c) { return t + c.qty; }, 0);
      if (bottles === 0) { toast(EDIT_ERRORS.no_items, true); return; }
      var changed = counts.some(function (c) { return c.qty !== c.row.qty; });
      if (!changed) { toast(EDIT_ERRORS.no_change, true); return; }
      var newTotal = counts.reduce(function (t, c) { return t + c.qty * c.row.price; }, 0);
      if (!window.confirm("Bestelling #" + order.order_number + " aanpassen?\n\nTotaal van " + money(order.total_incl) + " naar " + money(newTotal) + ".\nDe aanpassing wordt vastgelegd in het logboek.")) return;

      var payload = {};
      counts.forEach(function (c) { payload[c.row.slug] = c.qty; });
      save.disabled = true;
      sb.rpc("update_order_items", { p_order_id: order.id, p_items: payload, p_reason: reason.value.trim() || null }).then(function (res) {
        if (res.error) {
          save.disabled = false;
          toast(EDIT_ERRORS[res.error.message] || "Aanpassen is niet gelukt. Probeer het opnieuw.", true);
          return;
        }
        editingOrder = false;
        loadAll().then(function () { renderDialog(); toast("Bestelling aangepast en vastgelegd"); });
      });
    });
    box.appendChild(h("div", { class: "row" }, [save, cancel]));
    return box;
  }

  function historySection(order) {
    var mine = state.changes.filter(function (c) { return c.order_id === order.id; });
    var box = h("div", { class: "dialog-section", id: "dlg-history" });
    if (!mine.length) return box;
    box.appendChild(h("h3", { text: "Logboek" }));
    box.appendChild(h("ul", { class: "history" }, mine.map(function (c) {
      var detail = c.kind === "items" && c.old_total !== null && c.new_total !== null
        ? " (totaal " + money(c.old_total) + " → " + money(c.new_total) + ")" : "";
      return h("li", {}, [
        c.summary + detail,
        h("span", { class: "meta", text: dateTime(c.changed_at) + (c.changed_by_email ? " · " + c.changed_by_email : "") }),
        c.reason ? h("span", { class: "meta", text: "Reden: " + c.reason }) : null
      ]);
    })));
    return box;
  }

  // Na een statuswijziging het logboek opnieuw ophalen, zonder de rest van het venster te vernieuwen.
  function refreshChanges(order) {
    fetchAll("order_changes", "*", "changed_at", false).then(function (res) {
      if (res.error) return;
      state.changes = res.data || [];
      var current = $("#dlg-history");
      if (current && openOrderId === order.id) current.replaceWith(historySection(order));
    });
  }

  /* ============================================================
     Retouren
     ============================================================ */

  var RETURN_ERRORS = {
    too_many_bottles: "Er worden meer flessen geretourneerd dan er zijn besteld.",
    refund_too_high: "Het terugbetaalde bedrag is hoger dan het bestelbedrag.",
    order_cancelled: "Voor een geannuleerde bestelling kun je geen retour registreren.",
    invalid_bottles: "Vul een aantal flessen in (minimaal 1).",
    invalid_refund: "Vul een geldig bedrag in (0 als er niets is terugbetaald)."
  };

  function returnsSection(order) {
    var mine = state.returns.filter(function (r) { return r.order_id === order.id; });
    var ordered = bottlesOf(order);
    var returned = mine.reduce(function (sum, r) { return sum + r.bottles; }, 0);
    var left = ordered - returned;

    var hasInvoice = !!invoiceFor(order.id);
    var list = h("ul", { class: "returns-list" }, mine.map(function (r) {
      var cn = creditNoteForReturn(r.id);
      var actions = [];
      if (cn) {
        actions.push(h("button", { type: "button", class: "btn btn-small", text: "Creditnota " + cn.credit_number, onclick: function () { downloadCredit(cn); } }));
      } else {
        if (Number(r.refund_incl) > 0 && hasInvoice) {
          actions.push(h("button", { type: "button", class: "btn btn-primary btn-small", text: "Creditnota maken", onclick: function () { makeCreditNote(r); } }));
        }
        actions.push(h("button", { type: "button", class: "btn btn-small", text: "Verwijderen", onclick: function () { removeReturn(r, order); } }));
      }
      return h("li", {}, [
        h("span", { class: "ret-text" }, [
          r.bottles + (r.bottles === 1 ? " fles" : " flessen") + " retour — " + money(r.refund_incl) + " terugbetaald",
          h("span", { class: "ret-meta", text: dateTime(r.created_at) + (r.reason ? " · " + r.reason : "") })
        ]),
        h("span", { class: "ret-actions" }, actions)
      ]);
    }));

    var box = h("div", { class: "dialog-section" }, [h("h3", { text: "Retouren" })]);
    if (mine.length) box.appendChild(list);
    else box.appendChild(h("p", { class: "hint", text: "Geen retouren bij deze bestelling." }));

    if (order.status === "geannuleerd" || left < 1) {
      if (left < 1 && mine.length) box.appendChild(h("p", { class: "hint", text: "Alle flessen van deze bestelling zijn geretourneerd." }));
      return box;
    }

    var bottles = h("input", { type: "number", min: "1", max: String(left), step: "1", value: "1", id: "ret-bottles" });
    var refund = h("input", { type: "number", min: "0", max: String(order.total_incl), step: "0.01", value: "0", id: "ret-refund" });
    var reason = h("input", { type: "text", maxlength: "500", id: "ret-reason", placeholder: "bijv. beschadigd, verkeerde wijn" });
    var submit = h("button", { type: "submit", class: "btn btn-small", text: "Retour registreren" });
    var form = h("form", { class: "return-form", novalidate: true }, [
      h("label", {}, ["Aantal flessen (nog " + left + " mogelijk)", bottles]),
      h("label", {}, ["Terugbetaald, incl. btw (€)", refund]),
      h("label", { class: "span-2" }, ["Reden (optioneel)", reason]),
      h("div", { class: "span-2" }, [submit])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = parseInt(bottles.value, 10);
      var amount = parseFloat(String(refund.value).replace(",", "."));
      if (!(n >= 1) || n > left) { toast("Vul een aantal flessen in tussen 1 en " + left + ".", true); return; }
      if (!(amount >= 0)) { toast(RETURN_ERRORS.invalid_refund, true); return; }
      submit.disabled = true;
      sb.rpc("register_return", { p_order_id: order.id, p_bottles: n, p_refund: amount, p_reason: reason.value.trim() || null })
        .then(function (res) {
          if (res.error || !res.data) {
            submit.disabled = false;
            toast(RETURN_ERRORS[res.error && res.error.message] || "De retour kon niet worden opgeslagen.", true);
            return;
          }
          state.returns.unshift(Array.isArray(res.data) ? res.data[0] : res.data);
          renderDashboard();
          renderDialog();
          toast("Retour geregistreerd");
        });
    });
    box.appendChild(form);
    return box;
  }

  function creditNoteForReturn(returnId) {
    for (var i = 0; i < state.creditNotes.length; i++) {
      if (state.creditNotes[i].return_id === returnId) return state.creditNotes[i];
    }
    return null;
  }

  var CREDIT_ERRORS = {
    no_invoice: "Maak eerst een factuur voor deze bestelling.",
    no_refund: "Er is niets terugbetaald, dus er is geen creditnota nodig."
  };

  function makeCreditNote(ret) {
    var ok = window.confirm(
      "Creditnota maken voor " + money(ret.refund_incl) + "?\n\n" +
      "Het nummer wordt direct vastgelegd en de creditnota kan daarna niet meer worden gewijzigd of verwijderd. De retour kan dan ook niet meer worden verwijderd."
    );
    if (!ok) return;
    sb.rpc("create_credit_note", { p_return_id: ret.id }).then(function (res) {
      if (res.error || !res.data) {
        toast(CREDIT_ERRORS[res.error && res.error.message] || "De creditnota kon niet worden gemaakt.", true);
        return;
      }
      var cn = Array.isArray(res.data) ? res.data[0] : res.data;
      state.creditNotes = state.creditNotes.filter(function (c) { return c.id !== cn.id; });
      state.creditNotes.unshift(cn);
      renderInvoices();
      renderDialog();
      toast("Creditnota " + cn.credit_number + " gemaakt");
      downloadCredit(cn);
    });
  }

  function removeReturn(ret, order) {
    if (!window.confirm("Deze retour verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    sb.from("product_returns").delete().eq("id", ret.id).select().then(function (res) {
      if (res.error || !res.data || !res.data.length) { toast("Verwijderen is niet gelukt.", true); return; }
      state.returns = state.returns.filter(function (r) { return r.id !== ret.id; });
      renderDashboard();
      renderDialog();
      toast("Retour verwijderd");
    });
  }

  /* ============================================================
     Dashboard
     ============================================================ */

  var ymFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit" });
  function monthKey(ts) { // "2026-11", in Nederlandse tijd
    var y = "", m = "";
    ymFmt.formatToParts(new Date(ts)).forEach(function (p) {
      if (p.type === "year") y = p.value;
      if (p.type === "month") m = p.value;
    });
    return y + "-" + m;
  }
  function shiftMonth(key, delta) {
    var y = parseInt(key.slice(0, 4), 10);
    var m = parseInt(key.slice(5, 7), 10) - 1 + delta;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + "-" + String(m + 1).padStart(2, "0");
  }
  var MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function monthLabel(key) { return MONTHS[parseInt(key.slice(5, 7), 10) - 1] + " " + key.slice(2, 4); }

  // Geeft per periode een test voor een maand-sleutel en de laatste maand van de periode.
  function periodRange(period) {
    var now = monthKey(Date.now());
    if (period === "month") return { has: function (k) { return k === now; }, end: now };
    if (period === "prev") { var p = shiftMonth(now, -1); return { has: function (k) { return k === p; }, end: p }; }
    if (period === "year") return { has: function (k) { return k.slice(0, 4) === now.slice(0, 4); }, end: now };
    return { has: function () { return true; }, end: "9999-12" };
  }

  function sum(list, fn) { return list.reduce(function (t, x) { return t + fn(x); }, 0); }

  function stat(label, value, sub) {
    return h("div", { class: "stat" }, [
      h("div", { class: "stat__label", text: label }),
      h("div", { class: "stat__value", text: value }),
      h("div", { class: "stat__sub", text: sub || "\u00a0" })
    ]);
  }

  function goToOrders(filter) {
    $("#order-filter").value = filter;
    $("#order-search").value = "";
    renderOrders();
    showTab("orders");
  }

  function renderDashboard() {
    var range = periodRange($("#dash-period").value);
    var active = state.orders.filter(function (o) { return o.status !== "geannuleerd"; });
    var inPeriod = active.filter(function (o) { return range.has(monthKey(o.created_at)); });
    var cancelled = state.orders.filter(function (o) { return o.status === "geannuleerd" && range.has(monthKey(o.created_at)); }).length;

    var count = inPeriod.length;
    var revenue = sum(inPeriod, function (o) { return Number(o.total_incl); });
    var vatRate = state.settings ? Number(state.settings.vat_rate) : 21;
    var revenueExcl = revenue / (1 + vatRate / 100);
    var average = count ? revenue / count : 0;

    var rets = state.returns.filter(function (r) { return range.has(monthKey(r.created_at)); });
    var retBottles = sum(rets, function (r) { return r.bottles; });
    var refunded = sum(rets, function (r) { return Number(r.refund_incl); });

    // Terugkerende klanten: klanten uit deze periode die in totaal vaker dan één keer hebben besteld.
    var byCustomer = {};
    active.forEach(function (o) {
      if (monthKey(o.created_at) > range.end) return;
      var key = customerKey(o);
      byCustomer[key] = (byCustomer[key] || 0) + 1;
    });
    var customers = {};
    inPeriod.forEach(function (o) { customers[customerKey(o)] = true; });
    var customerKeys = Object.keys(customers);
    var returning = customerKeys.filter(function (k) { return byCustomer[k] > 1; }).length;
    var pct = customerKeys.length ? Math.round(returning / customerKeys.length * 100) : 0;

    var invoicedIds = {};
    state.invoices.forEach(function (i) { invoicedIds[i.order_id] = true; });
    var openAmount = 0, openCount = 0;
    state.invoices.forEach(function (inv) {
      var order = state.orders.filter(function (o) { return o.id === inv.order_id; })[0];
      if (order && !order.paid_at && order.status !== "geannuleerd") {
        openAmount += Number(inv.total_incl);
        openCount += 1;
      }
    });

    var stats = $("#dash-stats");
    stats.textContent = "";
    [
      stat("Bestellingen", String(count), cancelled ? cancelled + " geannuleerd (niet meegeteld)" : "geen geannuleerd"),
      stat("Totale omzet", money(revenue), money(revenueExcl) + " excl. btw"),
      stat("Gemiddelde bestelwaarde", money(average), count ? "per bestelling, incl. btw" : "nog geen bestellingen"),
      stat("Retouren", String(rets.length), rets.length ? retBottles + (retBottles === 1 ? " fles" : " flessen") + " · " + money(refunded) + " terugbetaald" : "geen retouren"),
      stat("Terugkerende klanten", String(returning), customerKeys.length ? pct + "% van " + customerKeys.length + (customerKeys.length === 1 ? " klant" : " klanten") : "nog geen klanten"),
      stat("Openstaand (gefactureerd)", money(openAmount), openCount ? openCount + (openCount === 1 ? " factuur" : " facturen") + " nog niet betaald" : "alles betaald")
    ].forEach(function (card) { stats.appendChild(card); });

    // Actie nodig
    var fresh = state.orders.filter(function (o) { return o.status === "nieuw"; }).length;
    var toInvoice = active.filter(function (o) { return !invoicedIds[o.id]; }).length;
    var todo = $("#dash-todo");
    todo.textContent = "";
    if (fresh) todo.appendChild(h("button", { type: "button", onclick: function () { goToOrders("nieuw"); } }, [h("strong", { text: String(fresh) }), fresh === 1 ? "nieuwe bestelling" : "nieuwe bestellingen"]));
    if (toInvoice) todo.appendChild(h("button", { type: "button", onclick: function () { goToOrders("open"); } }, [h("strong", { text: String(toInvoice) }), toInvoice === 1 ? "bestelling zonder factuur" : "bestellingen zonder factuur"]));
    var negative = state.stock.filter(function (s) { return s.quantity < 0; }).length;
    if (negative) todo.appendChild(h("button", { type: "button", onclick: function () { showTab("stock"); } }, [h("strong", { text: String(negative) }), negative === 1 ? "wijn met voorraad onder nul" : "wijnen met voorraad onder nul"]));
    if (!fresh && !toInvoice && !negative) todo.appendChild(h("p", { class: "todo-ok", text: "Niets dat actie vraagt." }));

    // Verkocht per wijn
    var perWine = {};
    inPeriod.forEach(function (o) {
      (o.order_items || []).forEach(function (it) {
        var w = perWine[it.product_name] || (perWine[it.product_name] = { bottles: 0, revenue: 0 });
        w.bottles += it.quantity;
        w.revenue += it.quantity * Number(it.unit_price_incl);
      });
    });
    var wineBody = $("#dash-wines tbody");
    wineBody.textContent = "";
    var names = Object.keys(perWine).sort(function (a, b) { return perWine[b].bottles - perWine[a].bottles; });
    names.forEach(function (name) {
      wineBody.appendChild(h("tr", {}, [
        h("td", { text: "Druif & Draad " + name }),
        h("td", { class: "num", text: String(perWine[name].bottles) }),
        h("td", { class: "num", text: money(perWine[name].revenue) })
      ]));
    });
    if (!names.length) wineBody.appendChild(h("tr", {}, [h("td", { text: "Nog geen verkopen in deze periode.", colspan: "3" })]));

    // Bestellingen per plaats of postcodegebied
    var byArea = {};
    inPeriod.forEach(function (o) {
      var area = $("#dash-place-mode").value === "area";
      var key = area ? String(o.postcode).replace(/\s/g, "").slice(0, 2) : String(o.city).trim().toLowerCase();
      var label = area ? key + "xx" : String(o.city).trim();
      var a = byArea[key] || (byArea[key] = { label: label, orders: 0, bottles: 0, revenue: 0 });
      a.orders += 1;
      a.bottles += bottlesOf(o);
      a.revenue += Number(o.total_incl);
    });
    var areas = Object.keys(byArea).map(function (k) { return byArea[k]; }).sort(function (x, y) { return y.revenue - x.revenue; });
    if (areas.length > 10) {
      var rest = areas.slice(9).reduce(function (t, a) {
        return { label: "Overige (" + (areas.length - 9) + ")", orders: t.orders + a.orders, bottles: t.bottles + a.bottles, revenue: t.revenue + a.revenue };
      }, { label: "", orders: 0, bottles: 0, revenue: 0 });
      areas = areas.slice(0, 9).concat([rest]);
    }
    var placeBody = $("#dash-places tbody");
    placeBody.textContent = "";
    areas.forEach(function (a) {
      placeBody.appendChild(h("tr", {}, [
        h("td", { text: a.label }),
        h("td", { class: "num", text: String(a.orders) }),
        h("td", { class: "num", text: String(a.bottles) }),
        h("td", { class: "num", text: money(a.revenue) })
      ]));
    });
    if (!areas.length) placeBody.appendChild(h("tr", {}, [h("td", { text: "Nog geen bestellingen in deze periode.", colspan: "4" })]));

    // Omzet per maand (laatste 12 maanden, los van de gekozen periode)
    var thisMonth = monthKey(Date.now());
    var months = [];
    for (var i = 11; i >= 0; i--) months.push(shiftMonth(thisMonth, -i));
    var perMonth = {};
    active.forEach(function (o) {
      var k = monthKey(o.created_at);
      perMonth[k] = (perMonth[k] || 0) + Number(o.total_incl);
    });
    var max = Math.max.apply(null, months.map(function (k) { return perMonth[k] || 0; }).concat([1]));
    var bars = $("#dash-months");
    bars.textContent = "";
    months.forEach(function (k) {
      var value = perMonth[k] || 0;
      var fill = h("span", { class: "bar-fill" });
      fill.style.width = (value / max * 100) + "%";
      bars.appendChild(h("div", { class: "bar-row" }, [
        h("span", { class: "bar-label", text: monthLabel(k) }),
        h("span", { class: "bar-track" }, [fill]),
        h("span", { class: "bar-value", text: value ? money(value) : "–" })
      ]));
    });
  }

  $("#dash-period").addEventListener("change", renderDashboard);
  $("#dash-place-mode").addEventListener("change", renderDashboard);

  /* ============================================================
     Factuur maken
     ============================================================ */

  function makeInvoice(order) {
    if (!settingsComplete()) {
      closeDialog();
      showTab("settings");
      toast("Vul eerst de gegevens voor de factuur in.", true);
      return;
    }
    var ok = window.confirm(
      "Factuur maken voor bestelling #" + order.order_number + " (" + money(order.total_incl) + ")?\n\n" +
      "Het factuurnummer wordt direct vastgelegd en de factuur kan daarna niet meer worden gewijzigd of verwijderd."
    );
    if (!ok) return;

    var btn = $("#dlg-make-invoice");
    if (btn) btn.disabled = true;
    sb.rpc("create_invoice", { p_order_id: order.id }).then(function (res) {
      if (res.error || !res.data) {
        if (btn) btn.disabled = false;
        var msg = res.error && res.error.message;
        toast(msg === "order_cancelled" ? "Een geannuleerde bestelling kan niet worden gefactureerd."
          : "De factuur kon niet worden gemaakt. Probeer het opnieuw.", true);
        return;
      }
      var inv = Array.isArray(res.data) ? res.data[0] : res.data;
      state.invoices = state.invoices.filter(function (i) { return i.id !== inv.id; });
      state.invoices.unshift(inv);
      renderOrders();
      renderInvoices();
      renderDashboard();
      renderDialog();
      toast("Factuur " + inv.invoice_number + " gemaakt");
      downloadInvoice(inv);
    });
  }

  /* ============================================================
     Facturen
     ============================================================ */

  function renderInvoices() {
    var tbody = $("#invoices-table tbody");
    tbody.textContent = "";
    state.invoices.forEach(function (inv) {
      var customer = (inv.snapshot && inv.snapshot.customer) || {};
      var number = inv.snapshot && inv.snapshot.order_number;
      tbody.appendChild(h("tr", {}, [
        h("td", { text: inv.invoice_number }),
        h("td", { text: dateOnly(inv.issued_on) }),
        h("td", { text: dateOnly(inv.due_on) }),
        h("td", { text: customer.name || "" }),
        h("td", { class: "num", text: money(inv.total_incl) }),
        h("td", {}, [number ? h("button", {
          type: "button", class: "link-btn", text: "#" + number, onclick: function () { openOrder(inv.order_id); }
        }) : null]),
        h("td", {}, [h("button", { type: "button", class: "btn btn-small", text: "PDF", onclick: function () { downloadInvoice(inv); } })])
      ]));
    });
    $("#invoices-empty").hidden = state.invoices.length > 0;
    $("#invoices-table").hidden = state.invoices.length === 0;

    var cbody = $("#credits-table tbody");
    cbody.textContent = "";
    state.creditNotes.forEach(function (cn) {
      var customer = (cn.snapshot && cn.snapshot.customer) || {};
      cbody.appendChild(h("tr", {}, [
        h("td", { text: cn.credit_number }),
        h("td", { text: dateOnly(cn.issued_on) }),
        h("td", { text: (cn.snapshot && cn.snapshot.invoice_number) || "" }),
        h("td", { text: customer.name || "" }),
        h("td", { class: "num", text: money(-cn.total_incl) }),
        h("td", {}, [h("button", { type: "button", class: "btn btn-small", text: "PDF", onclick: function () { downloadCredit(cn); } })])
      ]));
    });
    $("#credits-empty").hidden = state.creditNotes.length > 0;
    $("#credits-table").hidden = state.creditNotes.length === 0;
  }

  /* ============================================================
     PDF (factuur en creditnota)
     ============================================================ */

  var logoPromise;
  function loadLogo() {
    if (!logoPromise) {
      logoPromise = new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve({ data: canvas.toDataURL("image/png"), ratio: img.naturalHeight / img.naturalWidth });
          } catch (err) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = "../assets/img/logo.png";
      });
    }
    return logoPromise;
  }

  // Beide documenten worden eerst naar hetzelfde model vertaald en daarna getekend.
  function invoiceModel(inv) {
    var snap = inv.snapshot || {};
    var seller = snap.seller || {};
    return {
      title: "FACTUUR",
      meta: [
        ["Factuurnummer", inv.invoice_number],
        ["Factuurdatum", dateOnly(inv.issued_on)],
        ["Vervaldatum", dateOnly(inv.due_on)],
        ["Bestelnummer", "#" + (snap.order_number || "")]
      ],
      seller: seller,
      customer: snap.customer || {},
      lines: (snap.lines || []).map(function (l) {
        return { desc: "Druif & Draad " + l.name, qty: l.quantity, unit: l.unit_price_incl, total: l.line_total_incl };
      }),
      vatRate: inv.vat_rate, excl: inv.total_excl, vat: inv.vat_amount, incl: inv.total_incl,
      payText: "Wij verzoeken u het bedrag van " + money(inv.total_incl) + " vóór " + dateOnly(inv.due_on) +
        " over te maken op " + (seller.iban || "") + " t.n.v. " + (seller.company_name || "") +
        ", onder vermelding van " + inv.invoice_number + ".",
      footerNote: seller.footer_note
    };
  }

  function creditModel(cn) {
    var snap = cn.snapshot || {};
    var seller = snap.seller || {};
    var amount = Number(cn.total_incl);
    var bottles = snap.bottles || 0;
    return {
      title: "CREDITNOTA",
      meta: [
        ["Creditnotanummer", cn.credit_number],
        ["Datum", dateOnly(cn.issued_on)],
        ["Betreft factuur", snap.invoice_number || ""],
        ["Bestelnummer", "#" + (snap.order_number || "")]
      ],
      seller: seller,
      customer: snap.customer || {},
      lines: [{
        desc: "Retour: " + bottles + (bottles === 1 ? " fles" : " flessen"),
        sub: snap.reason || "",
        qty: 1, unit: -amount, total: -amount
      }],
      vatRate: cn.vat_rate, excl: -cn.total_excl, vat: -cn.vat_amount, incl: -amount,
      payText: "Het bedrag van " + money(amount) + " is aan u terugbetaald. Deze creditnota hoort bij factuur " +
        (snap.invoice_number || "") + ".",
      footerNote: seller.footer_note
    };
  }

  function renderPdf(model, logo) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("jsPDF niet geladen");
    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    var seller = model.seller;
    var customer = model.customer;
    var L = 20, R = 190;
    var y;

    function text(str, x, yy, opts) { doc.text(String(str), x, yy, opts); }
    function gray() { doc.setTextColor(110, 103, 90); }
    function dark() { doc.setTextColor(42, 38, 32); }

    if (logo) {
      var w = 58;
      doc.addImage(logo.data, "PNG", L, 16, w, w * logo.ratio);
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); dark();
      text(seller.company_name || "", L, 24);
    }

    doc.setFont("helvetica", "normal"); doc.setFontSize(9); gray();
    y = 18;
    [seller.company_name, seller.address_line1, seller.postcode_city, seller.email, seller.phone].forEach(function (line) {
      if (line) { text(line, R, y, { align: "right" }); y += 4.5; }
    });

    doc.setFont("helvetica", "bold"); doc.setFontSize(22); dark();
    text(model.title, L, 58);

    doc.setFontSize(10);
    y = 68;
    model.meta.forEach(function (row) {
      doc.setFont("helvetica", "normal"); gray(); text(row[0], L, y);
      doc.setFont("helvetica", "bold"); dark(); text(row[1], L + 38, y);
      y += 5.5;
    });

    doc.setFont("helvetica", "normal"); gray(); text(model.title === "FACTUUR" ? "Factuur aan" : "Creditnota aan", 120, 68);
    dark();
    var cy = 73.5;
    [
      customer.name,
      (customer.street || "") + " " + (customer.house_number || "") + (customer.addition ? " " + customer.addition : ""),
      (customer.postcode || "") + " " + (customer.city || "")
    ].forEach(function (line, i) {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      text(line, 120, cy); cy += 5.5;
    });

    var top = 105;
    doc.setFillColor(246, 241, 230);
    doc.rect(L, top, R - L, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); dark();
    text("Omschrijving", L + 2, top + 5.4);
    text("Aantal", 118, top + 5.4, { align: "right" });
    text("Prijs incl. btw", 152, top + 5.4, { align: "right" });
    text("Totaal incl. btw", R - 2, top + 5.4, { align: "right" });

    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    y = top + 14;
    model.lines.forEach(function (line) {
      dark(); doc.setFontSize(10);
      text(line.desc, L + 2, y);
      text(String(line.qty), 118, y, { align: "right" });
      text(money(line.unit), 152, y, { align: "right" });
      text(money(line.total), R - 2, y, { align: "right" });
      if (line.sub) {
        gray(); doc.setFontSize(8.5);
        var sub = doc.splitTextToSize(line.sub, 85);
        doc.text(sub, L + 2, y + 4.5);
        y += sub.length * 4;
      }
      doc.setDrawColor(225, 217, 200);
      doc.line(L, y + 2.5, R, y + 2.5);
      y += 8;
    });

    y += 4;
    doc.setFontSize(10);
    gray(); text("Totaal excl. btw", 140, y); dark(); text(money(model.excl), R - 2, y, { align: "right" });
    y += 6;
    gray(); text("BTW " + numberFmt.format(model.vatRate) + "%", 140, y); dark(); text(money(model.vat), R - 2, y, { align: "right" });
    y += 3;
    doc.setDrawColor(42, 38, 32);
    doc.line(140, y, R, y);
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    text("Totaal incl. btw", 140, y); text(money(model.incl), R - 2, y, { align: "right" });

    y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); dark();
    var wrapped = doc.splitTextToSize(model.payText, R - L);
    doc.text(wrapped, L, y);
    y += wrapped.length * 5 + 3;

    if (model.footerNote) {
      gray();
      doc.text(doc.splitTextToSize(model.footerNote, R - L), L, y);
    }

    doc.setDrawColor(225, 217, 200);
    doc.line(L, 278, R, 278);
    doc.setFontSize(8); gray();
    var foot = [
      seller.company_name,
      seller.kvk ? "KvK " + seller.kvk : "",
      seller.vat_number ? "BTW " + seller.vat_number : "",
      seller.iban ? "IBAN " + seller.iban : ""
    ].filter(Boolean).join("  ·  ");
    text(foot, 105, 283, { align: "center" });

    return doc;
  }

  function downloadPdf(model, filename) {
    loadLogo().then(function (logo) {
      try {
        renderPdf(model, logo).save(filename);
      } catch (err) {
        toast("De PDF kon niet worden gemaakt.", true);
      }
    });
  }
  function downloadInvoice(inv) { downloadPdf(invoiceModel(inv), "Factuur " + inv.invoice_number + ".pdf"); }
  function downloadCredit(cn) { downloadPdf(creditModel(cn), "Creditnota " + cn.credit_number + ".pdf"); }

  /* ============================================================
     CSV-export (voor Excel en de boekhouding)
     ============================================================ */

  function num(n) { return { raw: (Math.round(Number(n) * 100) / 100).toFixed(2).replace(".", ",") }; }

  function csvCell(v) {
    if (v && typeof v === "object" && "raw" in v) return v.raw;
    var str = v === null || v === undefined ? "" : String(v);
    // Voorkom dat Excel tekst van klanten als formule uitvoert.
    if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
    if (/[";\n\r]/.test(str)) str = '"' + str.replace(/"/g, '""') + '"';
    return str;
  }

  function downloadCsv(filename, rows) {
    var body = "﻿" + rows.map(function (r) { return r.map(csvCell).join(";"); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" }); }

  $("#export-orders").addEventListener("click", function () {
    var rows = visibleOrders();
    if (!rows.length) { toast("Er zijn geen bestellingen om te exporteren.", true); return; }
    var products = state.products.slice();
    var head = ["Bestelnummer", "Datum", "Herkomst", "Status", "Betaald", "Aangepast", "Naam", "E-mail", "Telefoon", "Straat", "Huisnummer", "Toevoeging", "Postcode", "Plaats", "Flessen"]
      .concat(products.map(function (p) { return p.name; }))
      .concat(["Totaal incl. btw", "Factuurnummer", "Retour flessen", "Terugbetaald"]);
    var data = rows.slice().sort(function (a, b) { return a.order_number - b.order_number; }).map(function (o) {
      var inv = invoiceFor(o.id);
      var rets = state.returns.filter(function (r) { return r.order_id === o.id; });
      return [o.order_number, dateTime(o.created_at), o.source === "handmatig" ? "Handmatig" : "Website", STATUS_LABEL[o.status] || o.status, o.paid_at ? "Ja" : "Nee", o.edited_at ? "Ja" : "Nee",
        o.name, o.email, o.phone, o.street, o.house_number, o.addition, o.postcode, o.city, bottlesOf(o)]
        .concat(products.map(function (p) {
          return (o.order_items || []).filter(function (it) { return it.product_slug === p.slug; }).reduce(function (t, it) { return t + it.quantity; }, 0);
        }))
        .concat([num(o.total_incl), inv ? inv.invoice_number : "", sum(rets, function (r) { return r.bottles; }), num(sum(rets, function (r) { return Number(r.refund_incl); }))]);
    });
    downloadCsv("bestellingen-" + today() + ".csv", [head].concat(data));
  });

  $("#export-invoices").addEventListener("click", function () {
    if (!state.invoices.length && !state.creditNotes.length) { toast("Er zijn nog geen facturen om te exporteren.", true); return; }
    var head = ["Type", "Nummer", "Datum", "Klant", "Bestelnummer", "Excl. btw", "BTW", "Incl. btw", "BTW-percentage", "Betreft factuur", "Betaald"];
    var data = [];
    state.invoices.forEach(function (inv) {
      var snap = inv.snapshot || {};
      var order = state.orders.filter(function (o) { return o.id === inv.order_id; })[0];
      data.push({ date: inv.issued_on, nr: inv.invoice_number, row: ["Factuur", inv.invoice_number, dateOnly(inv.issued_on), (snap.customer || {}).name,
        snap.order_number, num(inv.total_excl), num(inv.vat_amount), num(inv.total_incl), num(inv.vat_rate), "", order && order.paid_at ? "Ja" : "Nee"] });
    });
    state.creditNotes.forEach(function (cn) {
      var snap = cn.snapshot || {};
      data.push({ date: cn.issued_on, nr: cn.credit_number, row: ["Creditnota", cn.credit_number, dateOnly(cn.issued_on), (snap.customer || {}).name,
        snap.order_number, num(-cn.total_excl), num(-cn.vat_amount), num(-cn.total_incl), num(cn.vat_rate), snap.invoice_number, ""] });
    });
    data.sort(function (a, b) { return a.date === b.date ? (a.nr > b.nr ? 1 : -1) : (a.date > b.date ? 1 : -1); });
    downloadCsv("facturen-" + today() + ".csv", [head].concat(data.map(function (d) { return d.row; })));
  });

  /* ============================================================
     Instellingen
     ============================================================ */

  var settingsForm = $("#settings-form");
  var SETTING_FIELDS = ["company_name", "address_line1", "postcode_city", "email", "phone", "kvk", "vat_number", "iban",
    "vat_rate", "payment_days", "invoice_prefix", "footer_note"];

  function renderSettings() {
    var s = state.settings || {};
    SETTING_FIELDS.forEach(function (name) {
      settingsForm.elements[name].value = s[name] === null || s[name] === undefined ? "" : s[name];
    });
  }

  settingsForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!settingsForm.checkValidity()) { settingsForm.reportValidity(); return; }
    var values = {};
    SETTING_FIELDS.forEach(function (name) { values[name] = settingsForm.elements[name].value.trim(); });
    values.vat_rate = Number(values.vat_rate);
    values.payment_days = parseInt(values.payment_days, 10);
    var btn = $("#settings-save");
    btn.disabled = true;
    $("#settings-ok").hidden = true;
    sb.from("settings").update(values).eq("id", 1).select().then(function (res) {
      btn.disabled = false;
      if (res.error || !res.data || !res.data.length) { toast("Opslaan is niet gelukt.", true); return; }
      state.settings = res.data[0];
      $("#settings-ok").hidden = false;
      setTimeout(function () { $("#settings-ok").hidden = true; }, 3000);
    });
  });

  function renderProducts() {
    var tbody = $("#products-table tbody");
    tbody.textContent = "";
    state.products.forEach(function (p) {
      var input = h("input", { type: "text", inputmode: "decimal", autocomplete: "off", class: "price-input", value: Number(p.price_incl).toFixed(2).replace(".", ","), "aria-label": "Prijs " + p.name });
      var save = h("button", { type: "button", class: "btn btn-small", text: "Opslaan" });
      save.addEventListener("click", function () { savePrice(p, input, save); });
      tbody.appendChild(h("tr", {}, [
        h("td", { text: "Druif & Draad " + p.name }),
        h("td", { class: "num" }, [input]),
        h("td", {}, [save])
      ]));
    });

    var log = $("#price-log");
    log.textContent = "";
    state.priceChanges.slice(0, 15).forEach(function (c) {
      var product = state.products.filter(function (p) { return p.slug === c.product_slug; })[0];
      log.appendChild(h("li", {}, [
        (product ? product.name : c.product_slug) + ": " + money(c.old_price) + " → " + money(c.new_price),
        h("span", { class: "meta", text: dateTime(c.changed_at) + (c.changed_by_email ? " · " + c.changed_by_email : "") })
      ]));
    });
    $("#price-log-empty").hidden = state.priceChanges.length > 0;
  }

  function savePrice(product, input, button) {
    var value = parseFloat(String(input.value).replace(",", "."));
    if (!(value > 0 && value < 1000)) { toast("Vul een prijs in tussen € 0,01 en € 999,99.", true); return; }
    value = Math.round(value * 100) / 100;
    if (value === Number(product.price_incl)) { toast("De prijs is niet gewijzigd.", true); return; }
    if (!window.confirm("Prijs van Druif & Draad " + product.name + " wijzigen van " + money(product.price_incl) + " naar " + money(value) + "?\n\nDe website toont de nieuwe prijs direct. Bestaande bestellingen en facturen veranderen niet.")) return;
    button.disabled = true;
    sb.from("products").update({ price_incl: value }).eq("slug", product.slug).select().then(function (res) {
      button.disabled = false;
      if (res.error || !res.data || !res.data.length) { toast("De prijs kon niet worden opgeslagen.", true); return; }
      product.price_incl = res.data[0].price_incl;
      fetchAll("price_changes", "*", "changed_at", false).then(function (r) {
        if (!r.error) state.priceChanges = r.data || [];
        renderProducts();
      });
      toast("Prijs opgeslagen. De website gebruikt hem direct.");
    });
  }

  /* ============================================================
     Voorraad
     ============================================================ */

  var STOCK_KIND_LABEL = {
    pallet: "Binnenkomst in pallets",
    losse_flessen: "Binnenkomst flessen",
    sample: "Sample weggegeven",
    breuk: "Breuk of verlies",
    retour: "Retour terug op voorraad",
    telling: "Telling (stelt de voorraad in)",
    bestelling: "Bestelling",
    aanpassing: "Bestelling aangepast",
    annulering: "Bestelling teruggeboekt"
  };
  var STOCK_LOG_RECENT = 10;
  var STOCK_FORM_KINDS = ["losse_flessen", "sample", "breuk", "retour", "telling"];
  var STOCK_ERRORS = {
    invalid_quantity: "Vul een heel aantal flessen in.",
    unknown_product: "Deze wijn is niet bekend.",
    duplicate_product: "Een wijn staat dubbel in de lijst.",
    no_items: "Vul bij minstens één wijn een aantal in.",
    no_change: "Er is niets gewijzigd: de getelde aantallen zijn gelijk aan de voorraad.",
    invalid_note: "De toelichting is te lang.",
    not_allowed: "Je hebt geen toegang om de voorraad te wijzigen."
  };

  function stockRecord(slug) {
    return state.stock.filter(function (s) { return s.product_slug === slug; })[0] || null;
  }
  function stockOf(slug) {
    var r = stockRecord(slug);
    return r ? r.quantity : 0;
  }
  function productName(slug) {
    var p = state.products.filter(function (x) { return x.slug === slug; })[0];
    return p ? p.name : slug;
  }

  function renderStock() {
    var tbody = $("#stock-table tbody");
    tbody.textContent = "";
    state.products.forEach(function (p) {
      var qty = stockOf(p.slug);
      tbody.appendChild(h("tr", {}, [
        h("td", { text: "Druif & Draad " + p.name }),
        h("td", { class: "num" + (qty < 0 ? " stock-negative" : ""), text: String(qty) })
      ]));
    });

    var log = $("#stock-log-table tbody");
    log.textContent = "";
    var shown = state.stockAll ? state.stockMovements : state.stockMovements.slice(0, STOCK_LOG_RECENT);
    shown.forEach(function (m) {
      log.appendChild(h("tr", {}, [
        h("td", { text: dateTime(m.created_at) }),
        h("td", { text: productName(m.product_slug) }),
        h("td", { class: "num " + (m.delta > 0 ? "stock-in" : "stock-out"), text: (m.delta > 0 ? "+" : "−") + Math.abs(m.delta) }),
        h("td", { text: (STOCK_KIND_LABEL[m.kind] || m.kind) + (m.kind === "pallet" && m.pallets ? " (" + m.pallets + " × " + m.per_pallet + ")" : "") }),
        h("td", { text: m.note || "" }),
        h("td", { text: m.created_by_email || "systeem" })
      ]));
    });
    $("#stock-log-empty").hidden = state.stockMovements.length > 0;
    $("#stock-log-table").hidden = state.stockMovements.length === 0;
    var more = $("#stock-log-more");
    more.hidden = state.stockMovements.length <= STOCK_LOG_RECENT && !state.stockAll;
    more.textContent = state.stockAll ? "Toon alleen de laatste " + STOCK_LOG_RECENT : "Toon alle mutaties";
  }

  function openStock(kind) {
    openOrderId = null;
    editingOrder = false;
    renderStockForm(kind);
    if (!dialog.open) dialog.showModal();
  }

  function renderStockForm(kind) {
    dialog.textContent = "";
    dialog.setAttribute("aria-labelledby", "dialog-title");

    var kindSelect = h("select", { id: "stock-kind" }, STOCK_FORM_KINDS.map(function (k) {
      return h("option", { value: k, text: STOCK_KIND_LABEL[k], selected: k === kind });
    }));
    kindSelect.addEventListener("change", function () { renderStockForm(kindSelect.value); });

    var isCount = kind === "telling";
    var rows = state.products.filter(function (p) { return p.active; }).map(function (p) {
      return {
        slug: p.slug, name: p.name,
        qty: h("input", { type: "number", min: "0", max: "1000000", step: "1", "aria-label": (isCount ? "Getelde voorraad " : "Aantal flessen ") + p.name })
      };
    });

    var box = h("div", { class: "edit-box" });
    box.appendChild(h("div", { class: "stock-row simple head" }, [h("span", { text: "Wijn" }), h("span", { text: "Nu op voorraad" }), h("span", { text: isCount ? "Geteld" : "Aantal flessen" })]));
    rows.forEach(function (r) {
      box.appendChild(h("div", { class: "stock-row simple" }, [
        h("span", { text: "Druif & Draad " + r.name }),
        h("span", { class: "num" + (stockOf(r.slug) < 0 ? " stock-negative" : ""), text: String(stockOf(r.slug)) }),
        r.qty
      ]));
    });

    var hints = {
      losse_flessen: "Aantal flessen dat is binnengekomen. Vul alleen de wijnen in waar iets van is binnengekomen.",
      sample: "Flessen die je weggeeft als proefmonster. Vul alleen de wijnen in die je hebt weggegeven.",
      breuk: "Kapotte of verloren flessen. Vul alleen de wijnen in waar dit voor geldt.",
      retour: "Alleen voor geretourneerde flessen die je nog kunt verkopen. Een retour boekt de voorraad niet vanzelf terug.",
      telling: "Vul het werkelijke aantal flessen in dat je geteld hebt. De voorraad wordt daarop gezet, ook bij 0. Wijnen die je leeg laat blijven ongewijzigd. Hiermee zet je ook de beginstand."
    };
    var note = h("input", { type: "text", id: "stock-note", maxlength: "500", placeholder: kind === "sample" ? "bijv. proeverij bij Restaurant X" : "optioneel" });
    var save = h("button", { type: "submit", class: "btn btn-primary", id: "stock-save", text: "Opslaan" });
    var form = h("form", { class: "stock-form", novalidate: true }, [
      h("label", { class: "stock-kind" }, ["Soort mutatie", kindSelect]),
      h("p", { class: "hint", text: hints[kind] }),
      box,
      h("label", { class: "reason" }, ["Toelichting (komt in het logboek)", note]),
      h("div", { class: "row" }, [save, h("button", { type: "button", class: "btn", text: "Annuleren", onclick: closeDialog })])
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var lines = [];
      var summary = [];
      var overdraw = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.qty.value.trim() === "") continue;
        var q = Number(r.qty.value);
        if (!(Number.isInteger(q) && q >= 0 && q <= 1000000)) { toast(STOCK_ERRORS.invalid_quantity, true); return; }
        if (!isCount && q === 0) continue;
        lines.push({ slug: r.slug, quantity: q });
        if (isCount) summary.push(r.name + ": " + stockOf(r.slug) + " → " + q);
        else {
          summary.push((kind === "sample" || kind === "breuk" ? "−" : "+") + q + " " + r.name);
          if ((kind === "sample" || kind === "breuk") && q > stockOf(r.slug)) overdraw.push(r.name);
        }
      }
      if (!lines.length) { toast(STOCK_ERRORS.no_items, true); return; }
      var question = STOCK_KIND_LABEL[kind] + " vastleggen?\n\n" + summary.join("\n");
      if (overdraw.length) question += "\n\nLet op: er staat minder op voorraad dan je afboekt (" + overdraw.join(", ") + "). De voorraad komt dan onder nul.";
      if (!window.confirm(question)) return;

      save.disabled = true;
      sb.rpc("add_stock_movements", { p_kind: kind, p_lines: lines, p_note: note.value.trim() || null }).then(function (res) {
        if (res.error) {
          save.disabled = false;
          toast(STOCK_ERRORS[res.error.message] || "Opslaan is niet gelukt. Probeer het opnieuw.", true);
          return;
        }
        closeDialog();
        loadAll().then(function () { toast("Voorraad bijgewerkt"); });
      });
    });

    dialog.appendChild(h("div", { class: "dialog-head" }, [
      h("div", {}, [h("h1", { id: "dialog-title", text: "Voorraad bijwerken" })]),
      h("button", { type: "button", class: "btn btn-small", text: "Sluiten", onclick: closeDialog })
    ]));
    dialog.appendChild(form);
  }

  $("#stock-log-more").addEventListener("click", function () {
    state.stockAll = !state.stockAll;
    loadAll();
  });
  $("#stock-add").addEventListener("click", function () { openStock("losse_flessen"); });
  $("#stock-sample").addEventListener("click", function () { openStock("sample"); });
  $("#stock-count").addEventListener("click", function () { openStock("telling"); });

})();
