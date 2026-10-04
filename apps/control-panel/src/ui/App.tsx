import { useEffect, useState } from "react";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle.js";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import CircleHelp from "lucide-react/dist/esm/icons/circle-help.js";
import Command from "lucide-react/dist/esm/icons/command.js";
import Gauge from "lucide-react/dist/esm/icons/gauge.js";
import Layers3 from "lucide-react/dist/esm/icons/layers-3.js";
import LockKeyhole from "lucide-react/dist/esm/icons/lock-keyhole.js";
import Menu from "lucide-react/dist/esm/icons/menu.js";
import Radio from "lucide-react/dist/esm/icons/radio.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.js";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square.js";
import X from "lucide-react/dist/esm/icons/x.js";

type Page = "Overview" | "Models" | "Routing policy" | "Usage" | "Sessions & logs" | "Settings";
type Health = {
  state: "starting" | "ready" | "degraded" | "stopped";
  compatibilityVerified: boolean;
  accountState: "disconnected" | "connected";
  lastError: string | null;
};

const pages: Array<{ name: Page; icon: typeof Activity; group: "WORKSPACE" | "PREFERENCES" }> = [
  { name: "Overview", icon: Activity, group: "WORKSPACE" },
  { name: "Models", icon: Layers3, group: "WORKSPACE" },
  { name: "Routing policy", icon: SlidersHorizontal, group: "WORKSPACE" },
  { name: "Usage", icon: Gauge, group: "WORKSPACE" },
  { name: "Sessions & logs", icon: TerminalSquare, group: "WORKSPACE" },
  { name: "Settings", icon: Radio, group: "PREFERENCES" },
];

const offline: Health = {
  state: "stopped", compatibilityVerified: false, accountState: "disconnected", lastError: "service_unavailable",
};

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [health, setHealth] = useState<Health>(offline);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch("http://127.0.0.1:4187/health", { cache: "no-store" });
      if (!response.ok) throw new Error("router offline");
      setHealth(await response.json() as Health);
    } catch {
      setHealth(offline);
    } finally {
      setCheckedAt(new Date().toISOString());
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const connected = health.accountState === "connected";
  const ready = health.compatibilityVerified && health.state === "ready";
  const serviceUp = health.state === "degraded" || health.state === "ready";
  const serviceLabel = ready ? "Routing enabled" : serviceUp ? "Setup required" : "Service offline";

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><Command size={17} strokeWidth={1.8} /></div>
          <div className="brand-copy"><strong>codex<span>/</span>router</strong><small>WINDOWS · LOCAL</small></div>
          <button className="icon-button close-menu" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        </div>

        <div className="install-card">
          <span className="install-monogram">CR</span>
          <span className="install-copy"><strong>Personal install</strong><small>Windows workspace</small></span>
          <span className="install-state" title={serviceLabel}><i className={ready ? "is-ready" : serviceUp ? "is-waiting" : ""} /></span>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          <NavGroup label="WORKSPACE" items={pages.filter((item) => item.group === "WORKSPACE")} page={page} onNavigate={navigate} />
          <NavGroup label="PREFERENCES" items={pages.filter((item) => item.group === "PREFERENCES")} page={page} onNavigate={navigate} />
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note"><LockKeyhole size={14} /><span><strong>Local by default</strong><small>Request content stays out of decision logs.</small></span></div>
          <div className="sidebar-meta"><span className="version-label">v0.1.0 preview</span><button onClick={() => navigate("Settings")}><CircleHelp size={14} />Help</button></div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-context"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={18} /></button><span>Codex Router</span><span className="path-separator">/</span><strong>{page}</strong></div>
          <div className="topbar-tools"><span className={`connection-state${ready ? " connection-ready" : serviceUp ? " connection-waiting" : ""}`}><i />{serviceLabel}</span><span className="build-tag">DEV</span></div>
        </header>

        <div className="page-content">
          {page === "Overview" ? (
            <Overview ready={ready} serviceUp={serviceUp} loading={loading} onRefresh={() => void refresh()} onSettings={() => navigate("Settings")} onModels={() => navigate("Models")} checkedAt={checkedAt} />
          ) : page === "Settings" ? (
            <Settings health={health} serviceUp={serviceUp} loading={loading} onRefresh={() => void refresh()} />
          ) : (
            <PendingPage page={page} connected={connected} onConnect={() => navigate("Settings")} />
          )}
        </div>

        <footer className="app-footer"><span><span className="footer-mark">CR</span> Local routing control plane</span><span>{checkedAt ? `Health checked ${new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Checking service health"}</span></footer>
      </main>
    </div>
  );
}

function NavGroup({ label, items, page, onNavigate }: {
  label: string; items: Array<{ name: Page; icon: typeof Activity }>; page: Page; onNavigate: (page: Page) => void;
}) {
  return <section className="nav-group"><h2>{label}</h2>{items.map(({ name, icon: Icon }) => (
    <button key={name} className={`nav-item${page === name ? " active" : ""}`} aria-current={page === name ? "page" : undefined} onClick={() => onNavigate(name)}>
      <Icon size={16} strokeWidth={1.8} /><span>{name}</span>{page === name && <i aria-hidden="true" />}
    </button>
  ))}</section>;
}

function Overview({ ready, serviceUp, loading, onRefresh, onSettings, onModels, checkedAt }: {
  ready: boolean; serviceUp: boolean; loading: boolean; onRefresh: () => void; onSettings: () => void; onModels: () => void; checkedAt: string | null;
}) {
  return <section className="overview-page">
    <div className="page-heading">
      <div><div className="eyebrow"><span>01</span> WORKSPACE</div><h1>Overview</h1><p>Local routing status and integration readiness.</p></div>
      <div className="heading-actions"><button className="button quiet-button" onClick={onSettings}>Diagnostics <ArrowRight size={14} /></button><button className="button secondary-button" disabled={loading} onClick={onRefresh}><RefreshCw size={14} className={loading ? "spin" : ""} />Recheck</button></div>
    </div>

    <section className={`status-banner${ready ? " status-banner-ready" : ""}`} aria-labelledby="status-title">
      <div className="status-signal"><span /><span /><span /><i>{ready ? <Check size={19} /> : <Radio size={19} />}</i></div>
      <div className="status-copy"><div className="section-kicker">ROUTING STATUS <span>·</span> {ready ? "ALL CHECKS PASSED" : "FAIL-CLOSED"}</div><h2 id="status-title">{ready ? "Ready for a verified route" : "Inference forwarding is off"}</h2><p>{ready ? "The integration checks passed. Review model eligibility before connecting Codex Desktop." : "Codex requests are not being forwarded. The compatibility gate must pass before this service can route inference."}</p></div>
      <button className="banner-action" onClick={onSettings}>View diagnostics <ArrowRight size={15} /></button>
      <span className="banner-index">CR / 01</span>
    </section>

    <div className="metric-strip" aria-label="Current routing metrics">
      <Metric label="ROUTER SERVICE" value={serviceUp ? "Responding" : "Offline"} detail={serviceUp ? "Local control API" : "127.0.0.1 · :4187"} state={serviceUp ? "positive" : "warning"} />
      <Metric label="ELIGIBLE MODELS" value="—" detail="Account catalog not verified" state="neutral" />
      <Metric label="USAGE SIGNAL" value="—" detail="No trusted quota snapshot" state="neutral" />
      <Metric label="ROUTES TODAY" value="0" detail="No requests recorded" state="neutral" last />
    </div>

    <div className="overview-grid">
      <section className="surface activity-surface">
        <div className="surface-heading"><div><div className="section-kicker">ROUTER JOURNAL</div><h2>Recent decisions</h2></div><span className="quiet-count">00</span></div>
        <div className="empty-journal"><span className="journal-icon"><TerminalSquare size={17} strokeWidth={1.7} /></span><div><strong>No routed requests yet</strong><p>Decisions will appear here after a verified Codex request passes through the local router.</p></div><span className="empty-rule" /></div>
        <div className="surface-foot"><span><i /> Request bodies are never recorded</span><span>{checkedAt ? "LIVE HEALTH" : "WAITING"}</span></div>
      </section>

      <section className="surface gate-surface">
        <div className="surface-heading"><div><div className="section-kicker">RELEASE GATE</div><h2>Compatibility checks</h2></div><span className="gate-count">{ready ? "04" : serviceUp ? "01" : "00"}<i> / 04</i></span></div>
        <div className="gate-list">
          <GateStep number="01" title="Local service" detail={serviceUp ? "Health endpoint responds" : "Waiting for router process"} state={serviceUp ? "done" : "current"} />
          <GateStep number="02" title="Account and usage" detail="Same-account catalog and quota" state="pending" />
          <GateStep number="03" title="Inference path" detail="Streaming, cancellation, continuation" state="pending" />
          <GateStep number="04" title="Codex Desktop" detail="Safe model switch at a boundary" state="pending" last />
        </div>
        <button className="gate-link" onClick={onSettings}>Open integration diagnostics <ArrowRight size={14} /></button>
      </section>
    </div>

    <div className="integrity-line"><ShieldCheck size={15} /><span><strong>Authorization stays in the router.</strong> Recommendations cannot enable a model or bypass the final eligibility check.</span><button onClick={onModels}>Model controls <ArrowRight size={13} /></button></div>
  </section>;
}

function Metric({ label, value, detail, state, last = false }: { label: string; value: string; detail: string; state: "positive" | "warning" | "neutral"; last?: boolean }) {
  return <article className={`metric${last ? " metric-last" : ""}`}><div className="metric-label"><i className={`metric-indicator ${state}`} />{label}</div><strong className={state === "neutral" ? "is-muted" : ""}>{value}</strong><span>{detail}</span></article>;
}

function GateStep({ number, title, detail, state, last = false }: { number: string; title: string; detail: string; state: "done" | "current" | "pending"; last?: boolean }) {
  return <div className={`gate-step${last ? " gate-step-last" : ""}`}><span className={`step-number step-${state}`}>{state === "done" ? <Check size={12} /> : number}</span><span className="step-copy"><strong>{title}</strong><small>{detail}</small></span><span className={`step-state step-state-${state}`}>{state === "done" ? "PASS" : state === "current" ? "NOW" : "WAITING"}</span></div>;
}

function PendingPage({ page, connected, onConnect }: { page: Page; connected: boolean; onConnect: () => void }) {
  const Icon = pages.find((item) => item.name === page)?.icon ?? Layers3;
  const descriptions: Record<Page, string> = {
    Overview: "", Models: "Account-visible models, capability evidence, and the models allowed to route.",
    "Routing policy": "Task requirements are evaluated before allowance preferences.",
    Usage: "Account usage windows with source timestamps and freshness state.",
    "Sessions & logs": "Redacted route decisions, session state, and operational errors.",
    Settings: "",
  };
  return <section className="subpage">
    <div className="page-heading"><div><div className="eyebrow"><span>{String(pages.findIndex((item) => item.name === page) + 1).padStart(2, "0")}</span> WORKSPACE</div><h1>{page}</h1><p>{descriptions[page]}</p></div></div>
    <div className="planned-surface"><div className="planned-icon"><Icon size={19} strokeWidth={1.7} /></div><div className="planned-copy"><div className="section-kicker">INTEGRATION PENDING</div><h2>{connected ? "Waiting for verified model data" : "This view is not connected yet"}</h2><p>{page === "Models" ? "Model records stay empty until account-specific discovery and capability checks are implemented." : "This section will use live router and account data. It will not show placeholder models, quota estimates, or fabricated decisions."}</p><button className="button secondary-button" onClick={onConnect}>Review diagnostics <ArrowRight size={14} /></button></div><div className="planned-index">ROUTER / {String(pages.findIndex((item) => item.name === page) + 1).padStart(2, "0")}</div></div>
    <div className="pending-footnote"><LockKeyhole size={14} /><span>The compatibility spike is a hard gate. Account state remains disconnected until the real request path is proven.</span></div>
  </section>;
}

function Settings({ health, serviceUp, loading, onRefresh }: { health: Health; serviceUp: boolean; loading: boolean; onRefresh: () => void }) {
  return <section className="subpage settings-page">
    <div className="page-heading"><div><div className="eyebrow"><span>06</span> PREFERENCES</div><h1>Settings & diagnostics</h1><p>Local service, account path, and compatibility state.</p></div><button className="button secondary-button" disabled={loading} onClick={onRefresh}><RefreshCw size={14} className={loading ? "spin" : ""} />Recheck</button></div>

    <section className="settings-surface">
      <div className="surface-heading"><div><div className="section-kicker">PROCESS</div><h2>Router service</h2></div><StatusTag state={serviceUp ? "waiting" : "offline"} label={serviceUp ? "SETUP REQUIRED" : "OFFLINE"} /></div>
      <SettingRow label="Control API" value={serviceUp ? "127.0.0.1 · port 4187" : "No response · port 4187"} />
      <SettingRow label="Inference forwarding" value={health.compatibilityVerified ? "Enabled" : "Disabled until compatibility passes"} />
      <SettingRow label="Codex account" value={health.accountState === "connected" ? "Connected" : "Not connected"} />
      <SettingRow label="Data store" value="Local · current Windows user" />
      <SettingRow label="Request content in logs" value="Never" last />
      {health.lastError && <div className="diagnostic-note"><AlertCircle size={15} /><span>Last health result <code>{health.lastError}</code></span></div>}
    </section>

    <section className="settings-surface">
      <div className="surface-heading"><div><div className="section-kicker">ACCOUNT</div><h2>Credentials & discovery</h2></div><StatusTag state="offline" label="NOT VERIFIED" /></div>
      <div className="account-state"><LockKeyhole size={16} /><div><strong>Sign-in is not enabled</strong><p>Credential storage and account-specific discovery follow the compatibility spike.</p></div></div>
    </section>

    <section className="settings-surface">
      <div className="surface-heading"><div><div className="section-kicker">RETENTION</div><h2>Privacy</h2></div><span className="privacy-mark"><ShieldCheck size={15} /> LOCAL</span></div>
      <SettingRow label="Decision metadata retention" value="30 days" />
      <p className="privacy-detail">Prompts, source code, images, and credentials do not enter the decision log.</p>
    </section>
  </section>;
}

function StatusTag({ state, label }: { state: "waiting" | "offline"; label: string }) {
  return <span className={`status-tag status-tag-${state}`}><i />{label}</span>;
}

function SettingRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={`setting-row${last ? " setting-row-last" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}
