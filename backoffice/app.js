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
  function money(n) { return "€ " + numberFmt.format(Number(n) || 0); }

  function dateOnly(iso) { // "2026-11-09" -> "09-11-2026"
    return String(iso || "").split("-").reverse().join("-");
  }
  function dateTime(ts) {
    return new Date(ts).toLocaleString("nl-NL", {
      timeZone: "Europe/Amsterdam", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  var STATUSES = ["nieuw", "bevestigd", "geleverd", "betaald", "geannuleerd"];
  var STATUS_LABEL = { nieuw: "Nieuw", bevestigd: "Bevestigd", geleverd: "Geleverd", betaald: "Betaald", geannuleerd: "Geannuleerd" };
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
      fetchAll("product_returns", "*", "created_at", false)
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
    ["dashboard", "orders", "invoices", "settings"].forEach(function (t) { $("#tab-" + t).hidden = t !== name; });
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
    renderSettings();
    renderProducts();
  }

  function matchesFilter(order) {
    var f = $("#order-filter").value;
    if (f === "all") return true;
    if (f === "open") return ["nieuw", "bevestigd", "geleverd"].indexOf(order.status) !== -1;
    return order.status === f;
  }

  function matchesSearch(order, q) {
    if (!q) return true;
    var hay = [order.order_number, order.name, order.email, order.city, order.postcode, order.street].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderOrders() {
    var q = $("#order-search").value.trim().toLowerCase();
    var rows = state.orders.filter(function (o) { return matchesFilter(o) && matchesSearch(o, q); });
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
        h("td", {}, [badge(o.status)]),
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

  function closeDialog() {
    if (dialog.open) dialog.close();
    openOrderId = null;
  }
  dialog.addEventListener("click", function (e) { if (e.target === dialog) closeDialog(); });
  dialog.addEventListener("close", function () { openOrderId = null; });

  function openOrder(id) {
    openOrderId = id;
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
        h("p", { text: "Ontvangen op " + dateTime(order.created_at) })
      ]),
      h("button", { type: "button", class: "btn btn-small", text: "Sluiten", onclick: closeDialog })
    ]));
    dialog.setAttribute("aria-labelledby", "dialog-title");

    dialog.appendChild(h("div", { class: "dialog-section row" }, [h("strong", { text: "Status" }), statusSelect]));

    dialog.appendChild(h("div", { class: "detail-grid" }, [
      h("div", {}, [
        h("h3", { text: "Klant" }),
        h("p", { text: order.name }),
        h("p", {}, [h("a", { href: "mailto:" + order.email, text: order.email })]),
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

    dialog.appendChild(h("h3", { text: "Bestelling" }));
    dialog.appendChild(h("table", { class: "items" }, [
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
    ]));

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

    var list = h("ul", { class: "returns-list" }, mine.map(function (r) {
      return h("li", {}, [
        h("span", { class: "ret-text" }, [
          r.bottles + (r.bottles === 1 ? " fles" : " flessen") + " retour — " + money(r.refund_incl) + " terugbetaald",
          h("span", { class: "ret-meta", text: dateTime(r.created_at) + (r.reason ? " · " + r.reason : "") })
        ]),
        h("button", { type: "button", class: "btn btn-small", text: "Verwijderen", onclick: function () { removeReturn(r, order); } })
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
      var key = String(o.email).trim().toLowerCase();
      byCustomer[key] = (byCustomer[key] || 0) + 1;
    });
    var customers = {};
    inPeriod.forEach(function (o) { customers[String(o.email).trim().toLowerCase()] = true; });
    var customerKeys = Object.keys(customers);
    var returning = customerKeys.filter(function (k) { return byCustomer[k] > 1; }).length;
    var pct = customerKeys.length ? Math.round(returning / customerKeys.length * 100) : 0;

    var invoicedIds = {};
    state.invoices.forEach(function (i) { invoicedIds[i.order_id] = true; });
    var openAmount = 0, openCount = 0;
    state.invoices.forEach(function (inv) {
      var order = state.orders.filter(function (o) { return o.id === inv.order_id; })[0];
      if (order && order.status !== "betaald" && order.status !== "geannuleerd") {
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
    if (!fresh && !toInvoice) todo.appendChild(h("p", { class: "todo-ok", text: "Niets dat actie vraagt." }));

    // Verkocht per wijn
    var perWine = {};
    var ids = {};
    inPeriod.forEach(function (o) { ids[o.id] = true; });
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
  }

  /* ============================================================
     PDF
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

  function buildPdf(inv, logo) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error("jsPDF niet geladen");
    var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    var snap = inv.snapshot || {};
    var seller = snap.seller || {};
    var customer = snap.customer || {};
    var lines = snap.lines || [];
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
    text("FACTUUR", L, 58);

    doc.setFontSize(10);
    var meta = [
      ["Factuurnummer", inv.invoice_number],
      ["Factuurdatum", dateOnly(inv.issued_on)],
      ["Vervaldatum", dateOnly(inv.due_on)],
      ["Bestelnummer", "#" + (snap.order_number || "")]
    ];
    y = 68;
    meta.forEach(function (row) {
      doc.setFont("helvetica", "normal"); gray(); text(row[0], L, y);
      doc.setFont("helvetica", "bold"); dark(); text(row[1], L + 38, y);
      y += 5.5;
    });

    doc.setFont("helvetica", "normal"); gray(); text("Factuur aan", 120, 68);
    dark(); doc.setFont("helvetica", "bold");
    var cy = 73.5;
    var address = [
      customer.name,
      (customer.street || "") + " " + (customer.house_number || "") + (customer.addition ? " " + customer.addition : ""),
      (customer.postcode || "") + " " + (customer.city || "")
    ];
    address.forEach(function (line, i) {
      doc.setFont("helvetica", i === 0 ? "bold" : "normal");
      text(line, 120, cy); cy += 5.5;
    });

    // Tabel
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
    lines.forEach(function (line) {
      text("Druif & Draad " + line.name, L + 2, y);
      text(String(line.quantity), 118, y, { align: "right" });
      text(money(line.unit_price_incl), 152, y, { align: "right" });
      text(money(line.line_total_incl), R - 2, y, { align: "right" });
      doc.setDrawColor(225, 217, 200);
      doc.line(L, y + 2.5, R, y + 2.5);
      y += 8;
    });

    // Totalen
    y += 4;
    doc.setFontSize(10);
    gray(); text("Totaal excl. btw", 140, y); dark(); text(money(inv.total_excl), R - 2, y, { align: "right" });
    y += 6;
    gray(); text("BTW " + numberFmt.format(inv.vat_rate) + "%", 140, y); dark(); text(money(inv.vat_amount), R - 2, y, { align: "right" });
    y += 3;
    doc.setDrawColor(42, 38, 32);
    doc.line(140, y, R, y);
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    text("Totaal incl. btw", 140, y); text(money(inv.total_incl), R - 2, y, { align: "right" });

    // Betaalinformatie
    y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); dark();
    var pay = "Wij verzoeken u het bedrag van " + money(inv.total_incl) + " vóór " + dateOnly(inv.due_on) +
      " over te maken op " + (seller.iban || "") + " t.n.v. " + (seller.company_name || "") +
      ", onder vermelding van " + inv.invoice_number + ".";
    var wrapped = doc.splitTextToSize(pay, R - L);
    doc.text(wrapped, L, y);
    y += wrapped.length * 5 + 3;

    if (seller.footer_note) {
      gray();
      var note = doc.splitTextToSize(seller.footer_note, R - L);
      doc.text(note, L, y);
    }

    // Voet
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

  function downloadInvoice(inv) {
    loadLogo().then(function (logo) {
      try {
        var doc = buildPdf(inv, logo);
        doc.save("Factuur " + inv.invoice_number + ".pdf");
      } catch (err) {
        toast("De PDF kon niet worden gemaakt.", true);
      }
    });
  }

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
      tbody.appendChild(h("tr", {}, [
        h("td", { text: "Druif & Draad " + p.name }),
        h("td", { class: "num", text: money(p.price_incl) }),
        h("td", { text: p.active ? "Ja" : "Nee" })
      ]));
    });
  }
})();
