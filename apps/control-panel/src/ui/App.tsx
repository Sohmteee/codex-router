import { useEffect, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import Activity01Icon from "@hugeicons/core-free-icons/Activity01Icon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import CommandIcon from "@hugeicons/core-free-icons/CommandIcon";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import Layers01Icon from "@hugeicons/core-free-icons/Layers01Icon";
import LockKeyholeIcon from "@hugeicons/core-free-icons/LockKeyholeIcon";
import Menu01Icon from "@hugeicons/core-free-icons/Menu01Icon";
import Radio01Icon from "@hugeicons/core-free-icons/Radio01Icon";
import RefreshIcon from "@hugeicons/core-free-icons/RefreshIcon";
import Shield01Icon from "@hugeicons/core-free-icons/Shield01Icon";
import SlidersHorizontalIcon from "@hugeicons/core-free-icons/SlidersHorizontalIcon";
import SquareTerminalIcon from "@hugeicons/core-free-icons/SquareTerminalIcon";
import Tick01Icon from "@hugeicons/core-free-icons/Tick01Icon";

type Page = "Overview" | "Models" | "Routing policy" | "Usage" | "Sessions & logs" | "Settings";
type Health = {
  state: "starting" | "ready" | "degraded" | "stopped";
  compatibilityVerified: boolean;
  accountState: "disconnected" | "connected";
  lastError: string | null;
};

const pages: Array<{ name: Page; icon: IconSvgElement; group: "WORKSPACE" | "PREFERENCES" }> = [
  { name: "Overview", icon: Activity01Icon, group: "WORKSPACE" },
  { name: "Models", icon: Layers01Icon, group: "WORKSPACE" },
  { name: "Routing policy", icon: SlidersHorizontalIcon, group: "WORKSPACE" },
  { name: "Usage", icon: DashboardSquare01Icon, group: "WORKSPACE" },
  { name: "Sessions & logs", icon: SquareTerminalIcon, group: "WORKSPACE" },
  { name: "Settings", icon: Radio01Icon, group: "PREFERENCES" },
];

function UiIcon({ icon, size, strokeWidth = 1.8, className }: { icon: IconSvgElement; size: number; strokeWidth?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

const offline: Health = {
  state: "stopped", compatibilityVerified: false, accountState: "disconnected", lastError: "service_unavailable",
};

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
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

  useEffect(() => {
    const syncPage = () => {
      setPage(pageFromHash());
      setMenuOpen(false);
    };
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const connected = health.accountState === "connected";
  const ready = health.compatibilityVerified && health.state === "ready";
  const serviceUp = health.state === "degraded" || health.state === "ready";
  const serviceLabel = ready ? "Routing enabled" : serviceUp ? "Setup required" : "Service offline";

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMenuOpen(false);
    const nextHash = `#${pageSlug(nextPage)}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><UiIcon icon={CommandIcon} size={17} /></div>
          <div className="brand-copy"><strong translate="no">codex<span>/</span>router</strong><small>WINDOWS · LOCAL</small></div>
          <button className="icon-button close-menu" aria-label="Close navigation" aria-controls="primary-navigation" onClick={() => setMenuOpen(false)}><UiIcon icon={Cancel01Icon} size={18} /></button>
        </div>

        <div className="install-card">
          <span className="install-monogram">CR</span>
          <span className="install-copy"><strong>Personal install</strong><small>Windows workspace</small></span>
          <span className="install-state" aria-hidden="true"><i className={ready ? "is-ready" : serviceUp ? "is-waiting" : ""} /></span>
        </div>

        <nav id="primary-navigation" className="side-nav" aria-label="Main navigation">
          <NavGroup label="WORKSPACE" items={pages.filter((item) => item.group === "WORKSPACE")} page={page} />
          <NavGroup label="PREFERENCES" items={pages.filter((item) => item.group === "PREFERENCES")} page={page} />
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note"><UiIcon icon={LockKeyholeIcon} size={14} /><span><strong>Local by default</strong><small>Request content stays out of decision logs.</small></span></div>
          <div className="sidebar-meta"><span className="version-label">v0.1.0 preview</span><button onClick={() => navigate("Settings")}><UiIcon icon={Radio01Icon} size={14} />Diagnostics</button></div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <main className="main-area" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-context"><button className="icon-button menu-button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen(true)}><UiIcon icon={Menu01Icon} size={18} /></button><span>Codex Router</span><span className="path-separator" aria-hidden="true">/</span><strong>{page}</strong></div>
          <div className="topbar-tools"><span role="status" aria-live="polite" aria-atomic="true" className={`connection-state${ready ? " connection-ready" : serviceUp ? " connection-waiting" : ""}`}><i aria-hidden="true" />{serviceLabel}</span><span className="build-tag">DEV</span></div>
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

        <footer className="app-footer"><span><span className="footer-mark" aria-hidden="true">CR</span> Local routing control plane</span><span>{checkedAt ? `Health checked ${formatTime(checkedAt)}` : "Checking service health…"}</span></footer>
      </main>
    </div>
  );
}

function pageSlug(page: Page) {
  return page.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-");
}

function pageFromHash(): Page {
  const slug = window.location.hash.slice(1);
  return pages.find(({ name }) => pageSlug(name) === slug)?.name ?? "Overview";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function NavGroup({ label, items, page }: {
  label: string; items: Array<{ name: Page; icon: IconSvgElement }>; page: Page;
}) {
  return <section className="nav-group"><div className="nav-heading">{label}</div>{items.map(({ name, icon: Icon }) => (
    <a key={name} className={`nav-item${page === name ? " active" : ""}`} href={`#${pageSlug(name)}`} aria-current={page === name ? "page" : undefined}>
      <UiIcon icon={Icon} size={16} strokeWidth={1.8} /><span>{name}</span>{page === name && <i aria-hidden="true" />}
    </a>
  ))}</section>;
}

function Overview({ ready, serviceUp, loading, onRefresh, onSettings, onModels, checkedAt }: {
  ready: boolean; serviceUp: boolean; loading: boolean; onRefresh: () => void; onSettings: () => void; onModels: () => void; checkedAt: string | null;
}) {
  return <section className="overview-page">
    <div className="page-heading">
      <div><div className="eyebrow"><span>01</span> WORKSPACE</div><h1>Overview</h1><p>Local routing status and integration readiness.</p></div>
      <div className="heading-actions"><button className="button quiet-button" onClick={onSettings}>Diagnostics <UiIcon icon={ArrowRight01Icon} size={14} /></button><button className="button secondary-button" disabled={loading} onClick={onRefresh}><UiIcon icon={RefreshIcon} size={14} className={loading ? "spin" : ""} />Recheck</button></div>
    </div>

    <section className={`status-banner${ready ? " status-banner-ready" : ""}`} aria-labelledby="status-title">
      <div className="status-copy"><div className="section-kicker"><i className={ready ? "state-led led-ready" : "state-led"} aria-hidden="true" />ROUTING STATUS <span>·</span> {ready ? "ALL CHECKS PASSED" : "FAIL-CLOSED"}</div><h2 id="status-title">{ready ? "Ready for a verified route" : "Inference forwarding is off"}</h2><p>{ready ? "The integration checks passed. Review model eligibility before connecting Codex Desktop." : "Codex requests are not being forwarded. The compatibility gate must pass before this service can route inference."}</p></div>
      <div className="gate-result"><span>DISPATCH GATE</span><strong><i className={ready ? "gate-led led-ready" : "gate-led"} aria-hidden="true" />{ready ? "OPEN" : "LOCKED"}</strong></div>
      <button className="banner-action" onClick={onSettings}>View diagnostics <UiIcon icon={ArrowRight01Icon} size={15} /></button>
      <span className="banner-index">CR / 01</span>
    </section>

    <section className="metric-strip" aria-label="Current routing metrics">
      <Metric label="ROUTER SERVICE" value={serviceUp ? "Responding" : "Offline"} detail={serviceUp ? "Local control API" : "127.0.0.1 · :4187"} state={serviceUp ? "positive" : "warning"} />
      <Metric label="ELIGIBLE MODELS" value="—" detail="Account catalog not verified" state="neutral" />
      <Metric label="USAGE SIGNAL" value="—" detail="No trusted quota snapshot" state="neutral" />
      <Metric label="ROUTES TODAY" value="0" detail="No requests recorded" state="neutral" last />
    </section>

    <div className="overview-grid">
      <section className="surface activity-surface">
        <div className="surface-heading"><div><div className="section-kicker">ROUTER JOURNAL</div><h2>Recent decisions</h2></div><span className="quiet-count">00</span></div>
        <div className="empty-journal"><span className="journal-icon" aria-hidden="true"><UiIcon icon={SquareTerminalIcon} size={17} strokeWidth={1.7} /></span><div><strong>No routed requests yet</strong><p>Decisions will appear here after a verified Codex request passes through the local router.</p></div><span className="empty-rule" aria-hidden="true" /></div>
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
        <button className="gate-link" onClick={onSettings}>Open integration diagnostics <UiIcon icon={ArrowRight01Icon} size={14} /></button>
      </section>
    </div>

    <div className="integrity-line"><UiIcon icon={Shield01Icon} size={15} /><span><strong>Authorization stays in the router.</strong> Recommendations cannot enable a model or bypass the final eligibility check.</span><button onClick={onModels}>Model controls <UiIcon icon={ArrowRight01Icon} size={13} /></button></div>
  </section>;
}

function Metric({ label, value, detail, state, last = false }: { label: string; value: string; detail: string; state: "positive" | "warning" | "neutral"; last?: boolean }) {
  return <article className={`metric${last ? " metric-last" : ""}`}><div className="metric-label"><i className={`metric-indicator ${state}`} aria-hidden="true" />{label}</div><strong className={state === "neutral" ? "is-muted" : ""}>{value}</strong><span>{detail}</span></article>;
}

function GateStep({ number, title, detail, state, last = false }: { number: string; title: string; detail: string; state: "done" | "current" | "pending"; last?: boolean }) {
  return <div className={`gate-step${last ? " gate-step-last" : ""}`}><span className={`step-number step-${state}`} aria-hidden={state === "done"}>{state === "done" ? <UiIcon icon={Tick01Icon} size={12} /> : number}</span><span className="step-copy"><strong>{title}</strong><small>{detail}</small></span><span className={`step-state step-state-${state}`}>{state === "done" ? "PASS" : state === "current" ? "NOW" : "WAITING"}</span></div>;
}

function PendingPage({ page, connected, onConnect }: { page: Page; connected: boolean; onConnect: () => void }) {
  const Icon = pages.find((item) => item.name === page)?.icon ?? Layers01Icon;
  const descriptions: Record<Page, string> = {
    Overview: "", Models: "Account-visible models, capability evidence, and the models allowed to route.",
    "Routing policy": "Task requirements are evaluated before allowance preferences.",
    Usage: "Account usage windows with source timestamps and freshness state.",
    "Sessions & logs": "Redacted route decisions, session state, and operational errors.",
    Settings: "",
  };
  return <section className="subpage">
    <div className="page-heading"><div><div className="eyebrow"><span>{String(pages.findIndex((item) => item.name === page) + 1).padStart(2, "0")}</span> WORKSPACE</div><h1>{page}</h1><p>{descriptions[page]}</p></div></div>
    <div className="planned-surface"><div className="planned-icon" aria-hidden="true"><UiIcon icon={Icon} size={19} strokeWidth={1.7} /></div><div className="planned-copy"><div className="section-kicker">INTEGRATION PENDING</div><h2>{connected ? "Waiting for verified model data" : "This view is not connected yet"}</h2><p>{page === "Models" ? "Model records stay empty until account-specific discovery and capability checks are implemented." : "This section will use live router and account data. It will not show placeholder models, quota estimates, or fabricated decisions."}</p><button className="button secondary-button" onClick={onConnect}>Review diagnostics <UiIcon icon={ArrowRight01Icon} size={14} /></button></div><div className="planned-index">ROUTER / {String(pages.findIndex((item) => item.name === page) + 1).padStart(2, "0")}</div></div>
    <div className="pending-footnote"><UiIcon icon={LockKeyholeIcon} size={14} /><span>The compatibility spike is a hard gate. Account state remains disconnected until the real request path is proven.</span></div>
  </section>;
}

function Settings({ health, serviceUp, loading, onRefresh }: { health: Health; serviceUp: boolean; loading: boolean; onRefresh: () => void }) {
  return <section className="subpage settings-page">
    <div className="page-heading"><div><div className="eyebrow"><span>06</span> PREFERENCES</div><h1>Settings & diagnostics</h1><p>Local service, account path, and compatibility state.</p></div><button className="button secondary-button" disabled={loading} onClick={onRefresh}><UiIcon icon={RefreshIcon} size={14} className={loading ? "spin" : ""} />Recheck</button></div>

    <section className="settings-surface">
      <div className="surface-heading"><div><div className="section-kicker">PROCESS</div><h2>Router service</h2></div><StatusTag state={serviceUp ? "waiting" : "offline"} label={serviceUp ? "SETUP REQUIRED" : "OFFLINE"} /></div>
      <SettingRow label="Control API" value={serviceUp ? "127.0.0.1 · port 4187" : "No response · port 4187"} />
      <SettingRow label="Inference forwarding" value={health.compatibilityVerified ? "Enabled" : "Disabled until compatibility passes"} />
      <SettingRow label="Codex account" value={health.accountState === "connected" ? "Connected" : "Not connected"} />
      <SettingRow label="Data store" value="Local · current Windows user" />
      <SettingRow label="Request content in logs" value="Never" last />
      {health.lastError && <div className="diagnostic-note"><UiIcon icon={AlertCircleIcon} size={15} /><span>Last health result <code translate="no">{health.lastError}</code>. Start the router service, then recheck.</span></div>}
    </section>

    <section className="settings-surface">
      <div className="surface-heading"><div><div className="section-kicker">ACCOUNT</div><h2>Credentials & discovery</h2></div><StatusTag state="offline" label="NOT VERIFIED" /></div>
      <div className="account-state"><UiIcon icon={LockKeyholeIcon} size={16} /><div><strong>Sign-in is not enabled</strong><p>Credential storage and account-specific discovery follow the compatibility spike.</p></div></div>
    </section>

    <section className="settings-surface">
      <div className="surface-heading"><div><div className="section-kicker">RETENTION</div><h2>Privacy</h2></div><span className="privacy-mark"><UiIcon icon={Shield01Icon} size={15} /> LOCAL</span></div>
      <SettingRow label="Decision metadata retention" value="30 days" />
      <p className="privacy-detail">Prompts, source code, images, and credentials do not enter the decision log.</p>
    </section>
  </section>;
}

function StatusTag({ state, label }: { state: "waiting" | "offline"; label: string }) {
  return <span className={`status-tag status-tag-${state}`}><i aria-hidden="true" />{label}</span>;
}

function SettingRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={`setting-row${last ? " setting-row-last" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}
