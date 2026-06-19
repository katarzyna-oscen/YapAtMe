// Onboarding kit — shared chrome + primitives, drawn from the established
// YapAtMe component vocabulary (settings-view / confirm-dialog / note-view).
// Everything here is exported to window for the screen + app scripts.

// ────────────────────────────────────────────────────────────
//  Icons (inline SVG — the app uses no emoji)
// ────────────────────────────────────────────────────────────
function OnbIcon({ name, size = 16, stroke = 1.6 }) {
  const s = { width: size, height: size, flex: "0 0 auto", display: "block" };
  switch (name) {
    case "arrow":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M9 4l4 4-4 4" /></svg>;
    case "back":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M13 8H3M7 4 3 8l4 4" /></svg>;
    case "warn":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><path d="M8 5.5v3.2" /><circle cx="8" cy="11.4" r="0.55" fill="currentColor" /><path d="M7.13 1.9 1.6 11.6a1 1 0 0 0 .87 1.5h11.06a1 1 0 0 0 .87-1.5L8.87 1.9a1 1 0 0 0-1.74 0Z" /></svg>;
    case "lock":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><rect x="3.2" y="7" width="9.6" height="6.5" rx="1.5" /><path d="M5.4 7V5.2a2.6 2.6 0 0 1 5.2 0V7" /><circle cx="8" cy="10" r="0.7" fill="currentColor" stroke="none" /></svg>;
    case "folder":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.4c.4 0 .77.16 1.06.44L8 4.5h4.5A1.5 1.5 0 0 1 14 6v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5z" /></svg>;
    case "person":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c0-2.5 2.2-4 5-4s5 1.5 5 4" /></svg>;
    case "project":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6h12" /></svg>;
    case "idea":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round"><path d="M5.5 10.5a4 4 0 1 1 5 0v1.5h-5z" /><path d="M6 14h4" /></svg>;
    case "check":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3.5 3.5L13 5" /></svg>;
    case "x":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>;
    case "plus":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>;
    case "external":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h4v4M13 3 7 9M11 9.5V13H3V5h3.5" /></svg>;
    case "spark":
      return <svg viewBox="0 0 16 16" style={s} fill="currentColor"><path d="M8 1 L9.2 6.8 L15 8 L9.2 9.2 L8 15 L6.8 9.2 L1 8 L6.8 6.8 Z" /></svg>;
    case "grid":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke}><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>;
    case "inbox":
      return <svg viewBox="0 0 16 16" style={s} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round"><path d="M2 9.5 4 3h8l2 6.5" /><path d="M2 9.5V13h12V9.5h-3.2a2.3 2.3 0 0 1-4.6 0H2Z" /></svg>;
    default:
      return null;
  }
}

// ────────────────────────────────────────────────────────────
//  Spinner — reuses the sparkle motion idiom from note processing
// ────────────────────────────────────────────────────────────
function OnbSpinner({ size = 13 }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}>
      <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" opacity="0.9" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────
//  Buttons — verbatim styling from settings-view PrimaryButton/SecondaryButton
// ────────────────────────────────────────────────────────────
function PrimaryButton({ children, onClick, disabled, full, size = "md", iconRight }) {
  const [hov, setHov] = React.useState(false);
  const pad = size === "lg" ? "12px 22px" : "10px 18px";
  const fs = size === "lg" ? 14.5 : 13.5;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 9,
        width: full ? "100%" : "auto",
        padding: pad,
        background: disabled ? "oklch(0.80 0.13 80 / 0.10)" : hov ? "oklch(0.80 0.13 80 / 0.34)" : "oklch(0.80 0.13 80 / 0.22)",
        color: disabled ? "oklch(0.80 0.06 80 / 0.55)" : "oklch(0.92 0.13 80)",
        border: `1px solid ${disabled ? "oklch(0.80 0.10 80 / 0.22)" : hov ? "oklch(0.80 0.13 80 / 0.68)" : "oklch(0.80 0.13 80 / 0.45)"}`,
        borderRadius: 9,
        fontSize: fs, fontWeight: 500, whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >
      {children}
      {iconRight && <OnbIcon name={iconRight} size={15} />}
    </button>
  );
}

function SecondaryButton({ children, onClick, danger, full, iconLeft, size = "md" }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        width: full ? "100%" : "auto",
        padding: size === "lg" ? "12px 22px" : "10px 18px",
        background: danger ? (hov ? "oklch(0.70 0.18 22 / 0.16)" : "transparent") : (hov ? "var(--panel-2)" : "var(--panel)"),
        color: danger ? (hov ? "oklch(0.88 0.16 22)" : "oklch(0.78 0.16 22)") : (hov ? "var(--text)" : "var(--text-dim)"),
        border: `1px solid ${danger ? (hov ? "oklch(0.70 0.18 22 / 0.55)" : "oklch(0.70 0.18 22 / 0.30)") : (hov ? "var(--border-strong)" : "var(--border)")}`,
        borderRadius: 9,
        fontSize: 13.5, whiteSpace: "nowrap",
        cursor: "pointer",
        transition: "background .15s, border-color .15s, color .15s",
      }}
    >
      {iconLeft && <OnbIcon name={iconLeft} size={15} />}
      {children}
    </button>
  );
}

// Quiet text link (e.g. "Where do I get a key?", "Skip")
function TextLink({ children, onClick, icon }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: "transparent", border: "none", padding: 0,
        color: hov ? "var(--text)" : "var(--text-dim)",
        fontSize: 13, cursor: "pointer", whiteSpace: "nowrap",
        textDecoration: hov ? "underline" : "none",
        textUnderlineOffset: 3,
        transition: "color .12s",
      }}
    >
      {children}
      {icon && <OnbIcon name={icon} size={13} />}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
//  Form fields — from settings-view (focus border → accent)
// ────────────────────────────────────────────────────────────
function fieldBase() {
  return {
    width: "100%", padding: "11px 13px",
    background: "var(--panel)", color: "var(--text)",
    border: "1px solid var(--border)", borderRadius: 9,
    fontSize: 14, outline: "none", transition: "border-color .12s",
  };
}

function FieldLabel({ children }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text-dim)", marginBottom: 8 }}>{children}</label>
  );
}

function TextField({ value, onChange, type = "text", placeholder, mono, autoFocus, onEnter, invalid }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        ...fieldBase(),
        borderColor: invalid ? "oklch(0.70 0.18 22 / 0.7)" : focus ? "var(--accent)" : "var(--border)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontVariantNumeric: mono ? "tabular-nums" : "normal",
      }}
    />
  );
}

function SelectField({ value, onChange, options }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const current = options.find((o) => o.value === value) || options[0];
  React.useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ ...fieldBase(), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", borderColor: open ? "var(--border-strong)" : "var(--border)", textAlign: "left" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          {current.icon && <span style={{ color: "var(--text-dim)", display: "inline-flex" }}><OnbIcon name={current.icon} size={15} /></span>}
          {current.label}
        </span>
        <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor" style={{ opacity: 0.55, color: "var(--text-dim)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s", flex: "0 0 10px" }}>
          <path d="M1 3 L5 7 L9 3 Z" />
        </svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 50, padding: 4, background: "var(--panel-pop)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02)" }}>
          {options.map((o) => {
            const active = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13.5, color: active ? "var(--text)" : "var(--text-dim)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--panel-2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {o.icon && <span style={{ color: "var(--text-dim)", display: "inline-flex" }}><OnbIcon name={o.icon} size={15} /></span>}
                <span style={{ flex: 1 }}>{o.label}</span>
                {active && <span style={{ color: "var(--text-very-dim)" }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Checkbox glyph — verbatim from settings-view SettingsCheckbox
function Checkbox({ checked }) {
  return (
    <span style={{ width: 18, height: 18, borderRadius: 4, border: "1.5px solid", borderColor: checked ? "var(--accent)" : "var(--border-strong)", background: checked ? "var(--accent)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#1a1408", flex: "0 0 18px" }}>
      {checked && <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="m3 8 3.5 3.5L13 5" /></svg>}
    </span>
  );
}

// iOS-style switch for module rows
function Switch({ checked, onToggle }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: 38, height: 22, borderRadius: 999, flex: "0 0 38px", position: "relative", cursor: "pointer",
        display: "inline-block",
        background: checked ? "oklch(0.80 0.13 80 / 0.85)" : "var(--border-strong)",
        transition: "background .16s",
      }}
    >
      <span style={{ position: "absolute", top: 3, left: checked ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: checked ? "#1a1408" : "var(--text-dim)", transition: "left .16s, background .16s" }} />
    </span>
  );
}

// ────────────────────────────────────────────────────────────
//  Notice — amber warning / blue info / lock security block
// ────────────────────────────────────────────────────────────
function Notice({ tone = "amber", icon, title, children, compact }) {
  const hue = tone === "amber" ? 80 : tone === "info" ? 240 : tone === "danger" ? 22 : 80;
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      padding: compact ? "11px 13px" : "14px 16px",
      background: `oklch(0.80 0.13 ${hue} / 0.07)`,
      border: `1px solid oklch(0.80 0.13 ${hue} / 0.28)`,
      borderRadius: 10,
    }}>
      <span style={{ color: `oklch(0.84 0.13 ${hue})`, display: "inline-flex", marginTop: 1, flex: "0 0 auto" }}>
        <OnbIcon name={icon} size={compact ? 15 : 16} />
      </span>
      <div style={{ minWidth: 0 }}>
        {title && <div style={{ fontSize: 13, fontWeight: 600, color: `oklch(0.88 0.10 ${hue})`, marginBottom: children ? 4 : 0 }}>{title}</div>}
        {children && <div style={{ fontSize: 12.8, lineHeight: 1.55, color: "var(--text-dim)", textWrap: "pretty" }}>{children}</div>}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Screen scaffold — progress nav + back + animated content column
// ────────────────────────────────────────────────────────────
function ProgressDots({ total, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <span key={i} style={{
            height: 6, borderRadius: 999,
            width: active ? 22 : 6,
            background: active ? "var(--accent)" : done ? "oklch(0.80 0.13 80 / 0.45)" : "var(--border-strong)",
            transition: "width .25s, background .25s",
          }} />
        );
      })}
    </div>
  );
}

// Title + intro paragraph block used at the top of each screen body.
function ScreenHeading({ title, children, kicker }) {
  return (
    <div style={{ marginBottom: 26 }}>
      {kicker && (
        <div style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 600, color: "var(--text-very-dim)", textTransform: "uppercase", marginBottom: 12 }}>{kicker}</div>
      )}
      <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "var(--text)", textWrap: "balance" }}>{title}</h1>
      {children && (
        <p style={{ margin: "14px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-dim)", textWrap: "pretty", maxWidth: 520 }}>{children}</p>
      )}
    </div>
  );
}

// The centered card the whole flow lives inside.
function OnbShell({ stepKey, total, current, showBack, onBack, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        {/* Brand + progress header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, padding: "0 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "oklch(0.80 0.13 80 / 0.16)", color: "var(--accent)", border: "1px solid oklch(0.80 0.13 80 / 0.3)" }}>
              <OnbIcon name="grid" size={13} />
            </span>
            <span style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>YapAtMe</span>
          </div>
          <ProgressDots total={total} current={current} />
        </div>

        {/* Card */}
        <div style={{
          position: "relative",
          background: "linear-gradient(180deg, oklch(0.80 0.13 80 / 0.018), transparent 30%), var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "0 24px 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015)",
          padding: "30px 34px 34px",
          overflow: "hidden",
        }}>
          {showBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 18, background: "transparent", border: "none", padding: 0, color: "var(--text-very-dim)", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-very-dim)"}
            >
              <OnbIcon name="back" size={14} /> Back
            </button>
          )}
          <div key={stepKey} style={{ animation: "screenIn .28s ease-out" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  OnbIcon, OnbSpinner, PrimaryButton, SecondaryButton, TextLink,
  TextField, SelectField, Checkbox, Switch, FieldLabel, fieldBase,
  Notice, ProgressDots, ScreenHeading, OnbShell,
});
