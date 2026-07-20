"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { KioskProduct, KioskCustomer } from "@/lib/shopify";
import { KioskCategory } from "@/lib/categories";
import Lockup from "./Lockup";

const kr = (n: number) =>
  "kr " + n.toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KB_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "å"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", "ø", "æ"],
  ["z", "x", "c", "v", "b", "n", "m", "-"],
];

const IDLE_MS = 60000;

type Screen = "attract" | "menu" | "done";

interface Props {
  categories: KioskCategory[];
  demo: boolean;
}

export default function Kiosk({ categories, demo }: Props) {
  const [screen, setScreen] = useState<Screen>("attract");
  const [cat, setCat] = useState(categories[0]?.handle || "");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<KioskProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cart, setCart] = useState<Record<string, { p: KioskProduct; q: number }>>({});
  const [sheet, setSheet] = useState(false);
  const [ref, setRef] = useState("");
  const [customer, setCustomer] = useState<KioskCustomer | null>(null);
  const [custResults, setCustResults] = useState<KioskCustomer[]>([]);
  const [custLoading, setCustLoading] = useState(false);
  const [kbTarget, setKbTarget] = useState<null | "search" | "ref">(null);
  const [qp, setQp] = useState<{ p: KioskProduct; val: string; typing: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [orderNo, setOrderNo] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  const kbRef = useRef<HTMLDivElement>(null);
  const [kbh, setKbh] = useState(0);

  // Measure the on-screen keyboard's real height whenever it opens, so the
  // layout can reserve exactly that much space (see --kbh usage below). Without
  // this the keyboard slides up *over* the product grid and hides the results.
  useEffect(() => {
    if (kbTarget && kbRef.current) setKbh(kbRef.current.offsetHeight);
    else setKbh(0);
  }, [kbTarget]);

  // Live customer typeahead in the order sheet. Debounced so we don't hit
  // Shopify on every keystroke, and skipped once a customer is locked in.
  useEffect(() => {
    if (customer) return;
    const term = ref.trim();
    if (term.length < 2) {
      setCustResults([]);
      setCustLoading(false);
      return;
    }
    setCustLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/customers?q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setCustResults(d.customers || []);
      } catch {
        setCustResults([]);
      }
      setCustLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [ref, customer]);

  const pickCustomer = (c: KioskCustomer) => {
    setCustomer(c);
    setRef(c.label);
    setCustResults([]);
    setKbTarget(null);
  };

  const clearCustomer = () => {
    setCustomer(null);
    setRef("");
    setCustResults([]);
  };

  /* ---------- data ---------- */
  const load = useCallback(
    async (opts: { cat?: string; q?: string; cursor?: string | null; append?: boolean }) => {
      const mine = ++reqId.current;
      opts.append ? setLoadingMore(true) : setLoading(true);
      setErr(null);
      const params = new URLSearchParams();
      if (opts.q && opts.q.trim()) params.set("q", opts.q.trim());
      else params.set("cat", opts.cat || cat);
      if (opts.cursor) params.set("cursor", opts.cursor);
      try {
        const r = await fetch(`/api/products?${params}`);
        const d = await r.json();
        if (mine !== reqId.current) return; // a newer request won
        if (d.error) setErr(d.error);
        setItems((prev) => (opts.append ? [...prev, ...(d.products || [])] : d.products || []));
        setCursor(d.cursor ?? null);
        setHasNext(Boolean(d.hasNext));
      } catch {
        if (mine === reqId.current) setErr("Kunne ikke hente varer");
      } finally {
        if (mine === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [cat]
  );

  useEffect(() => {
    load({ cat });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce search
  useEffect(() => {
    if (screen === "attract") return;
    const t = setTimeout(() => {
      if (query.trim()) load({ q: query });
      else load({ cat });
    }, 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // infinite scroll
  const onScroll = () => {
    const el = gridRef.current;
    if (!el || !hasNext || loadingMore || loading) return;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 600) {
      load({ cat, q: query, cursor, append: true });
    }
  };

  /* ---------- idle ---------- */
  const resetIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    if (screen === "menu") idleRef.current = setTimeout(() => goAttract(), IDLE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    const h = () => resetIdle();
    ["pointerdown", "keydown", "touchstart"].forEach((e) =>
      document.addEventListener(e, h, { passive: true })
    );
    resetIdle();
    return () => {
      ["pointerdown", "keydown", "touchstart"].forEach((e) => document.removeEventListener(e, h));
      if (idleRef.current) clearTimeout(idleRef.current);
    };
  }, [resetIdle]);

  /* ---------- cart ---------- */
  const totalQty = useMemo(() => Object.values(cart).reduce((a, b) => a + b.q, 0), [cart]);
  const totalKr = useMemo(
    () => Object.values(cart).reduce((s, { p, q }) => s + p.casePrice * q, 0),
    [cart]
  );

  const add = (p: KioskProduct) => {
    if (p.stock <= 0) return;
    setCart((c) => ({ ...c, [p.id]: { p, q: (c[p.id]?.q || 0) + 1 } }));
  };
  const dec = (p: KioskProduct) =>
    setCart((c) => {
      const n = (c[p.id]?.q || 0) - 1;
      const next = { ...c };
      if (n <= 0) delete next[p.id];
      else next[p.id] = { p, q: n };
      return next;
    });
  const setQty = (p: KioskProduct, n: number) =>
    setCart((c) => {
      const next = { ...c };
      if (n <= 0) delete next[p.id];
      else next[p.id] = { p, q: n };
      return next;
    });

  const clearCart = () => {
    setCart({});
    setSheet(false);
  };

  const goAttract = () => {
    if (idleRef.current) clearTimeout(idleRef.current);
    setCart({});
    setRef("");
    setCustomer(null);
    setCustResults([]);
    setQuery("");
    setSheet(false);
    setKbTarget(null);
    setQp(null);
    setScreen("attract");
  };

  const startOrder = () => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => void;
    };
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn && !document.fullscreenElement) {
      try {
        fn.call(el);
      } catch {}
    }
    setScreen("menu");
  };

  const send = async () => {
    if (!totalQty || sending) return;
    setSending(true);
    const lines = Object.values(cart).map(({ p, q }) => ({ variantId: p.id, quantity: q }));
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, reference: ref, customerId: customer?.id }),
      });
      const d = await r.json();
      setOrderNo(d.ok ? d.name : "NE-" + Math.floor(1000 + Math.random() * 9000));
    } catch {
      setOrderNo("NE-" + Math.floor(1000 + Math.random() * 9000));
    }
    setSheet(false);
    setScreen("done");
    setCart({});
    setRef("");
    setCustomer(null);
    setCustResults([]);
    setSending(false);
  };

  /* ---------- keyboard ---------- */
  const kbType = (ch: string) => {
    if (kbTarget === "search") setQuery((q) => q + ch);
    else if (kbTarget === "ref") setRef((r) => r + ch);
  };
  const kbBack = () => {
    if (kbTarget === "search") setQuery((q) => q.slice(0, -1));
    else if (kbTarget === "ref") setRef((r) => r.slice(0, -1));
  };

  /* ---------- qty pad ---------- */
  const qpNum = qp ? parseInt(qp.val || "0", 10) || 0 : 0;
  const qpType = (d: string) =>
    setQp((s) => {
      if (!s) return s;
      const base = s.typing ? s.val : "";
      if (base.length >= 4) return s;
      return { ...s, val: (base + d).replace(/^0+(?=\d)/, ""), typing: true };
    });
  const qpApply = () => {
    if (!qp) return;
    setQty(qp.p, qpNum);
    setQp(null);
  };

  const activeCat = categories.find((c) => c.handle === cat);
  const searching = Boolean(query.trim());

  // Out-of-stock always at the bottom of the display. Shopify can't sort a
  // collection by inventory, so pages come back sorted only within themselves —
  // this stable partition keeps every available item above every sold-out one
  // across all loaded pages, preserving each group's server order.
  const shown = useMemo(
    () => [...items.filter((p) => p.stock > 0), ...items.filter((p) => p.stock <= 0)],
    [items]
  );

  const stockNote = (s: number) => {
    if (s <= 0) return null;
    if (s <= 10) return <> · <span className="st low">Kun {s} igjen</span></>;
    return <> · <span className="st ok">{s} på lager</span></>;
  };

  return (
    <div
      className={"kiosk" + (kbTarget ? " kb-open" : "")}
      style={{ ["--kbh"]: kbh + "px" } as CSSProperties}
    >
      {/* HEADER — search only */}
      <div className="head">
        <div
          className={"searchbox" + (kbTarget === "search" ? " active" : "") + (query ? " has" : "")}
          onClick={() => setKbTarget("search")}
        >
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <span className={"q" + (query ? "" : " ph")}>
            {query || "Søk i hele sortimentet …"}
          </span>
          <span className="caret" />
          {query && (
            <button
              className="clr"
              onClick={(e) => {
                e.stopPropagation();
                setQuery("");
                setKbTarget(null);
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="body">
        {/* RAIL */}
        <div className="rail">
          {categories.map((c) => (
            <button
              key={c.handle}
              className={"cat" + (!searching && c.handle === cat ? " on" : "")}
              onClick={() => {
                setCat(c.handle);
                setQuery("");
                setKbTarget(null);
                load({ cat: c.handle });
                if (gridRef.current) gridRef.current.scrollTop = 0;
              }}
            >
              <span className="ic">{c.icon}</span>
              <span className="lbl">
                {c.name}
                <span className="n">{c.count} varer</span>
              </span>
            </button>
          ))}
        </div>

        {/* GRID */}
        <div className="grid-wrap" ref={gridRef} onScroll={onScroll}>
          <div className="gh-eyebrow">{searching ? "Søkeresultat" : "Sortiment"}</div>
          <div className="gh-row">
            <h2>{searching ? `«${query}»` : activeCat?.name}</h2>
            <span className="cnt">
              {searching ? `${items.length} treff` : `${activeCat?.count ?? items.length} varer`}
            </span>
          </div>
          <div className="gh-rule" />

          {err && (
            <div className="noresult">
              <b>Kunne ikke hente varer</b>
              <span>{err}</span>
            </div>
          )}

          {loading ? (
            <div className="noresult"><b>Laster …</b></div>
          ) : items.length === 0 && !err ? (
            <div className="noresult">
              <b>{demo ? "Demo-modus" : "Ingen treff"}</b>
              <span>
                {demo
                  ? "Legg inn SHOPIFY_ADMIN_TOKEN for å hente ekte varer."
                  : "Prøv et annet søkeord."}
              </span>
            </div>
          ) : (
            <div className="grid">
              {shown.map((p) => {
                const q = cart[p.id]?.q || 0;
                const out = p.stock <= 0;
                return (
                  <div
                    key={p.id}
                    className={"card" + (q ? " has" : "") + (out ? " out" : "")}
                    onClick={() => add(p)}
                  >
                    {p.ny && !out && (
                      <div className="ribbon">
                        <span>NYHET</span>
                      </div>
                    )}
                    {out ? (
                      <div className="outtag">Ikke på lager</div>
                    ) : q > 0 ? (
                      <div className="qbadge">{q}</div>
                    ) : null}
                    <div className={"thumb" + (p.image ? "" : " noimg")}>
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.parentElement?.classList.add("noimg");
                            e.currentTarget.remove();
                          }}
                        />
                      )}
                      <div className="fallback">{p.vendor}</div>
                    </div>
                    <div className="meta">
                      <div className="nm">{p.name}</div>
                      <div className="sub">
                        {p.vendor}
                        {stockNote(p.stock)}
                      </div>
                      <div className="pricerow">
                        <div className="unit">
                          kr {p.unit},-<span>/stk</span>
                        </div>
                        <div className="actionslot">
                          {q > 0 ? (
                            <div className="cstep" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => dec(p)}>−</button>
                              <span onClick={() => setQp({ p, val: String(q), typing: false })}>
                                {q}
                              </span>
                              <button onClick={() => add(p)}>+</button>
                            </div>
                          ) : (
                            <div className="plus">+</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {loadingMore && <div className="noresult"><span>Laster flere …</span></div>}
        </div>
      </div>

      {/* CART BAR */}
      <div className="cartbar">
        <div className="info">
          <b>
            {totalQty} {totalQty === 1 ? "vare" : "varer"}
          </b>
          <small>
            {totalQty ? `${kr(totalKr)} · inkl. mva` : "Trykk på varene du vil bestille"}
          </small>
        </div>
        <div className="sp" />
        <button className="seebtn" disabled={totalQty === 0} onClick={() => setSheet(true)}>
          <span className="c">{totalQty}</span> Se bestilling
        </button>
      </div>

      {/* KEYBOARD */}
      <div id="kb" ref={kbRef} className={kbTarget ? "show" : ""}>
        {KB_ROWS.map((row, i) => (
          <div className="kbrow" key={i}>
            {row.map((k) => (
              <button className="key" key={k} onClick={() => kbType(k)}>
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        ))}
        <div className="kbrow">
          <button className="key wide" onClick={kbBack}>⌫ Slett</button>
          <button className="key space" onClick={() => kbType(" ")}>mellomrom</button>
          <button className="key wide gold" onClick={() => setKbTarget(null)}>Ferdig</button>
        </div>
      </div>

      {/* CART SHEET */}
      <div className={"scrim" + (sheet ? " show" : "")} onClick={() => setSheet(false)} />
      <div className={"sheet" + (sheet ? " show" : "")}>
        <div className="grab" />
        <h3>
          Din bestilling
          <button className="clearbtn" disabled={!totalQty} onClick={clearCart}>
            Tøm handlekurv
          </button>
          <button className="x" onClick={() => setSheet(false)}>×</button>
        </h3>
        <div className="sheet-body">
        <div className="lines">
          {totalQty === 0 ? (
            <div className="emptycart">Kurven er tom.</div>
          ) : (
            Object.values(cart).map(({ p, q }) => (
              <div className="line" key={p.id}>
                <div className="lim">
                  {p.image && (
                    <img
                      src={p.image}
                      alt=""
                      referrerPolicy="no-referrer"
                      onError={(e) => e.currentTarget.remove()}
                    />
                  )}
                </div>
                <div className="lmeta">
                  <b>{p.name}</b>
                  <small>
                    {p.vendor} · {kr(p.casePrice)}/kolli
                  </small>
                </div>
                <div className="stepper">
                  <button onClick={() => dec(p)}>−</button>
                  <span onClick={() => setQp({ p, val: String(q), typing: false })}>{q}</span>
                  <button onClick={() => add(p)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="nameblock">
          <label>Kunde — søk navn, firma, e-post eller telefon</label>
          {customer ? (
            <div className="cust-chip">
              <div>
                <b>{customer.label}</b>
                {customer.sublabel && <small>{customer.sublabel}</small>}
              </div>
              <span className="cust-orders">{customer.orders} ordre</span>
              <button className="cust-change" onClick={clearCustomer}>
                Endre
              </button>
            </div>
          ) : (
            <>
              <div
                className={"fakeinput" + (kbTarget === "ref" ? " active" : "")}
                onClick={() => setKbTarget("ref")}
              >
                <span className={ref ? "" : "ph"}>{ref || "Søk kunde …"}</span>
                <span className="caret" />
              </div>
              {ref.trim().length >= 2 && (
                <div className="cust-results">
                  {custLoading && <div className="cust-hint">Søker …</div>}
                  {!custLoading && custResults.length === 0 && (
                    <div className="cust-hint">Ingen kunde funnet</div>
                  )}
                  {custResults.map((c) => (
                    <button className="cust-row" key={c.id} onClick={() => pickCustomer(c)}>
                      <div>
                        <b>{c.label}</b>
                        {c.sublabel && <small>{c.sublabel}</small>}
                      </div>
                      <span className="cust-orders">{c.orders} ordre</span>
                    </button>
                  ))}
                </div>
              )}
              {ref.trim().length >= 2 && (
                <button className="cust-new" onClick={() => setKbTarget(null)}>
                  Fortsett med «{ref.trim()}» — ny kunde (opprettes i kassa)
                </button>
              )}
            </>
          )}
        </div>
        </div>
        <div className="sheet-foot">
          <div className="totalrow">
            <span>Sum · inkl. mva</span>
            <b>{kr(totalKr)}</b>
          </div>
          <button className="sendbtn" disabled={sending || !totalQty} onClick={send}>
            {sending ? "Sender …" : "Send bestilling"}
          </button>
        </div>
      </div>

      {/* QTY PAD */}
      <div id="qtyScrim" className={qp ? "show" : ""} onClick={() => setQp(null)} />
      <div id="qtyPad" className={qp ? "show" : ""}>
        {qp && (
          <>
            <div className="qp-head">
              <div className="qp-img">
                {qp.p.image && <img src={qp.p.image} alt="" referrerPolicy="no-referrer" />}
              </div>
              <div className="qp-meta">
                <b>{qp.p.name}</b>
                <small>
                  {qp.p.vendor} · {kr(qp.p.casePrice)}/kolli
                </small>
              </div>
              <button className="qp-x" onClick={() => setQp(null)}>×</button>
            </div>
            <div className="qp-display">
              <button
                className="qp-round"
                onClick={() => setQp((s) => (s ? { ...s, val: String(Math.max(0, qpNum - 1)), typing: false } : s))}
              >
                −
              </button>
              <div className="qp-num">
                <span>{qpNum}</span>
                <small>kolli</small>
              </div>
              <button
                className="qp-round"
                onClick={() => setQp((s) => (s ? { ...s, val: String(qpNum + 1), typing: false } : s))}
              >
                +
              </button>
            </div>
            <div className="qp-quick">
              {[5, 10, 25, 50].map((n) => (
                <button
                  key={n}
                  onClick={() =>
                    setQp((s) => (s ? { ...s, val: String(Math.min(9999, qpNum + n)), typing: false } : s))
                  }
                >
                  +{n}
                </button>
              ))}
            </div>
            <div className="qp-keys">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} onClick={() => qpType(d)}>{d}</button>
              ))}
              <button className="fn" onClick={() => setQp((s) => (s ? { ...s, val: "0", typing: true } : s))}>C</button>
              <button onClick={() => qpType("0")}>0</button>
              <button
                className="fn"
                onClick={() => setQp((s) => (s ? { ...s, val: s.val.slice(0, -1) || "0", typing: true } : s))}
              >
                ⌫
              </button>
            </div>
            <div className="qp-sum">
              {qpNum} × {kr(qp.p.casePrice)} = <b>{kr(qpNum * qp.p.casePrice)}</b>
            </div>
            <div className="qp-foot">
              <button className="qp-del" onClick={() => { setQty(qp.p, 0); setQp(null); }}>
                Fjern
              </button>
              <button className="qp-ok" onClick={qpApply}>Oppdater</button>
            </div>
          </>
        )}
      </div>

      {/* ATTRACT */}
      {screen === "attract" && (
        <div id="attract" onClick={startOrder}>
          <div className="glow" />
          <Lockup />
          <div className="eyebrow">Selvbetjent bestilling</div>
          <div className="attract-h">
            Bestill fra
            <br />
            hele sortimentet
          </div>
          <div className="attract-sub">
            Søk eller bla i kategoriene, legg i kurven og send bestillingen.
          </div>
          <div className="tap-pill">👆 Trykk for å starte</div>
        </div>
      )}

      {/* DONE */}
      {screen === "done" && (
        <div id="done" className="show">
          <div className="check">✓</div>
          <h1>Bestilling sendt!</h1>
          <div className="ordno">{orderNo}</div>
          <p>Vi pakker bestillingen. Du får beskjed når den er klar.</p>
          <button className="newbtn" onClick={goAttract}>Ny bestilling</button>
        </div>
      )}
    </div>
  );
}
