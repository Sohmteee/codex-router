import { useEffect, useState } from "react";
import Activity from "lucide-react/dist/esm/icons/activity.js";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle.js";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.js";
import Bot from "lucide-react/dist/esm/icons/bot.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.js";
import CircleHelp from "lucide-react/dist/esm/icons/circle-help.js";
import Command from "lucide-react/dist/esm/icons/command.js";
import Gauge from "lucide-react/dist/esm/icons/gauge.js";
import Layers3 from "lucide-react/dist/esm/icons/layers-3.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import LockKeyhole from "lucide-react/dist/esm/icons/lock-keyhole.js";
import Menu from "lucide-react/dist/esm/icons/menu.js";
import Radio from "lucide-react/dist/esm/icons/radio.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal.js";
import Sparkles from "lucide-react/dist/esm/icons/sparkles.js";
import TerminalSquare from "lucide-react/dist/esm/icons/terminal-square.js";
import X from "lucide-react/dist/esm/icons/x.js";

type Page = "Overview" | "Models" | "Routing policy" | "Usage" | "Sessions & logs" | "Settings";
type Health = {
  state: "starting" | "ready" | "degraded" | "stopped";
  compatibilityVerified: boolean;
  accountState: "disconnected" | "connected";
  lastError: string | null;
};

const pages: Array<{ name: Page; icon: typeof Activity }> = [
  { name: "Overview", icon: Activity },
  { name: "Models", icon: Layers3 },
  { name: "Routing policy", icon: SlidersHorizontal },
  { name: "Usage", icon: Gauge },
  { name: "Sessions & logs", icon: TerminalSquare },
  { name: "Settings", icon: Radio },
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

  return (
    <div className="shell">
      <aside className={"sidebar" + (menuOpen ? " sidebar-open" : "")}>
        <div className="brand">
          <div className="brand-mark"><Command size={18} /></div>
          <div><strong>Codex Router</strong><small>LOCAL CONTROL PLANE</small></div>
          <button className="icon-button close-menu" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={18} /></button>
        </div>
        <button className="workspace" onClick={() => setPage("Settings")}>
          <span className="workspace-monogram">W</span>
          <span className="workspace-label"><strong>Windows workspace</strong><small>Personal installation</small></span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-heading">CONTROL</div>
        <nav aria-label="Main navigation">
          {pages.slice(0, 5).map(({ name, icon: Icon }) => (
            <button key={name} className={"nav-item" + (page === name ? " active" : "")} onClick={() => { setPage(name); setMenuOpen(false); }}>
              <Icon size={17} /><span>{name}</span>
              {name === "Models" && !connected && <i>—</i>}
            </button>
          ))}
        </nav>
        <div className="nav-heading prefs-heading">PREFERENCES</div>
        <button className={"nav-item" + (page === "Settings" ? " active" : "")} onClick={() => setPage("Settings")}><Radio size={17} /><span>Settings</span></button>
        <div className="sidebar-spacer" />
        <div className="local-note">
          <span className="local-note-icon"><LockKeyhole size={15} /></span>
          <div><strong>Your router stays local</strong><p>Prompts stay out of decision logs. Jev sees only a short routing brief.</p></div>
        </div>
        <div className="sidebar-bottom">
          <span className="version"><i />V0.1.0 · PREVIEW</span>
          <button onClick={() => setPage("Settings")}><CircleHelp size={14} />Help</button>
        </div>
      </aside>
      {menuOpen && <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <main className="main">
        <header className="topbar">
          <div className="crumb"><button aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={19} /></button><span>Router</span><b>/</b><strong>{page}</strong></div>
          <div className="topbar-right"><span className="service-state"><i className={serviceUp ? "amber-dot" : ""} />{ready ? "Routing ready" : serviceUp ? "Setup required" : "Service offline"}</span><button className="avatar" onClick={() => setPage("Settings")} aria-label="Settings">S</button></div>
        </header>
        <div className="content">
          {page === "Overview" ? (
            <Overview ready={ready} serviceUp={serviceUp} loading={loading} onRefresh={() => void refresh()} onSetup={() => setPage("Settings")} onModels={() => setPage("Models")} />
          ) : page === "Settings" ? (
            <Settings health={health} serviceUp={serviceUp} loading={loading} onRefresh={() => void refresh()} />
          ) : (
            <PendingPage page={page} connected={connected} onConnect={() => setPage("Settings")} />
          )}
        </div>
        <footer className="footer"><span>Codex Router <b>·</b> Runs on this device</span><span>{checkedAt ? "Checked " + new Date(checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Checking local service"}</span></footer>
      </main>
    </div>
  );
}

function Overview({ ready, serviceUp, loading, onRefresh, onSetup, onModels }: {
  ready: boolean; serviceUp: boolean; loading: boolean; onRefresh: () => void; onSetup: () => void; onModels: () => void;
}) {
  return (
    <section className="page">
      <div className="page-heading">
        <div><div className="eyebrow"><i /> ROUTER OVERVIEW</div><h1>Good morning, Sohmtee <span>✦</span></h1><p>Here’s the status of your local model routing setup.</p></div>
        <button className="button secondary" disabled={loading} onClick={onRefresh}><RefreshCw size={15} className={loading ? "spin" : ""} />Refresh status</button>
      </div>
      <section className={"hero" + (ready ? " hero-ready" : "")}>
        <div className="hero-graphic" aria-hidden="true"><div className="halo h-one" /><div className="halo h-two" /><div className="hero-glow" /><div className="hero-core"><Bot size={26} /></div><i className="node n-one"><Sparkles size={11} /></i><i className="node n-two"><Radio size={11} /></i></div>
        <div className="hero-copy"><div className="hero-status"><i />{ready ? "INTEGRATION READY" : "SETUP IN PROGRESS"}</div>
          <h2>{ready ? "Your router is ready to connect" : "Let’s get your router connected"}</h2>
          <p>{ready ? "Review your enabled model choices before turning on automatic routing." : "Connect your account and verify Desktop compatibility before enabling inference traffic."}</p>
          <div className="hero-actions"><button className="button hero-button" onClick={onSetup}>{ready ? "Review setup" : "Continue setup"}<ArrowRight size={14} /></button><button className="text-button" onClick={onModels}>View all models</button></div>
        </div>
        <span className="hero-index">01 / 04</span>
      </section>

      <div className="section-head"><div><h3>At a glance</h3><p>A live view of your local routing state</p></div><span className="live-pill"><i />LIVE STATUS</span></div>
      <div className="stats">
        <Stat icon={Radio} tone={serviceUp ? "green" : "amber"} label="Router service" value={serviceUp ? "Running" : "Offline"} meta={serviceUp ? "Listening on this device" : "Start the local service"} note={serviceUp ? "Healthy" : "Needs attention"} />
        <Stat icon={Layers3} tone="blue" label="Eligible models" value="—" meta="Connect account to discover" note="No account" />
        <Stat icon={Gauge} tone="violet" label="Usage pressure" value="—" meta="Actual account windows only" note="Unavailable" />
        <Stat icon={Activity} tone="orange" label="Route decisions" value="0" meta="Decisions since setup" note="Getting started" />
      </div>

      <div className="panels">
        <section className="panel activity">
          <div className="panel-heading"><div><h3>Recent activity</h3><p>Your latest routing decisions will appear here.</p></div><button className="muted-action" disabled>View history <ArrowRight size={13} /></button></div>
          <div className="empty-activity"><span><Activity size={19} /></span><strong>Nothing routed yet</strong><p>Activity appears when a verified Codex request passes through the router.</p><button onClick={onSetup}>Check setup <ArrowRight size={13} /></button></div>
        </section>
        <section className="panel checklist">
          <div className="panel-heading"><div><h3>Setup checklist</h3><p>Four checks before routing can begin.</p></div><div className="progress"><strong>{serviceUp ? "1" : "0"}</strong><span>/ 4 complete</span></div></div>
          <CheckRow icon={ShieldCheck} title="Local service" detail={serviceUp ? "Service is responding" : "Waiting for the router service"} state={serviceUp ? "done" : "current"} />
          <CheckRow icon={Bot} title="Codex account" detail="Connect the signed-in account" state="pending" />
          <CheckRow icon={Layers3} title="Model choices" detail="Verify and enable models" state="pending" />
          <CheckRow icon={Check} title="Desktop compatibility" detail="Streaming and tool continuation" state="pending" last />
        </section>
      </div>
      <div className="trust"><span><ShieldCheck size={17} /></span><div><strong>Your safeguards stay in place</strong><p>Model choices are checked before dispatch. Codex keeps control of tools and approvals.</p></div><button onClick={onSetup}>Security details <ArrowRight size={13} /></button></div>
    </section>
  );
}

function Stat({ icon: Icon, tone, label, value, meta, note }: {
  icon: typeof Activity; tone: string; label: string; value: string; meta: string; note: string;
}) {
  return <article className="stat"><div className="stat-top"><span className={"stat-icon " + tone}><Icon size={16} /></span><span className={"stat-note " + tone}>{note}</span></div><small>{label}</small><strong>{value}</strong><p>{meta}</p></article>;
}

function CheckRow({ icon: Icon, title, detail, state, last = false }: {
  icon: typeof Activity; title: string; detail: string; state: "done" | "current" | "pending"; last?: boolean;
}) {
  return <div className={"check-row" + (last ? " last" : "")}><i className={"check-icon " + state}>{state === "done" ? <Check size={13} /> : state === "current" ? <LoaderCircle size={13} /> : <Icon size={13} />}</i><div><strong>{title}</strong><small>{detail}</small></div><span className={state}>{state === "done" ? "DONE" : state === "current" ? "IN PROGRESS" : "PENDING"}</span></div>;
}

function PendingPage({ page, connected, onConnect }: { page: Page; connected: boolean; onConnect: () => void }) {
  const Icon = pages.find((item) => item.name === page)?.icon ?? Layers3;
  const descriptions: Record<Page, string> = {
    Overview: "", Models: "See account-visible models, verify their capabilities, and choose which ones Codex Router may use.",
    "Routing policy": "Set task preferences and allowance pressure. Every route still passes the same final eligibility check.",
    Usage: "Read actual account usage windows with their refresh times. Missing data remains unavailable.",
    "Sessions & logs": "Review routing decisions and errors without storing request bodies or source text.",
    Settings: "",
  };
  return <section className="page subpage"><div className="page-heading"><div><div className="eyebrow"><i />{page.toUpperCase()}</div><h1>{page}</h1><p>{descriptions[page]}</p></div></div><div className="pending-card"><span className="pending-icon"><Icon size={22} /></span><div><small>{connected ? "WAITING FOR REGISTRY" : "WAITING FOR INTEGRATION"}</small><h2>Connect your Codex account to continue</h2><p>Live account discovery and Desktop compatibility must be verified first. No placeholder model or usage data is shown here.</p><button className="button primary" onClick={onConnect}>Open account setup <ArrowRight size={14} /></button></div></div><div className="info-note"><ShieldCheck size={16} /> This page uses the same policy gate as the inference router.</div></section>;
}

function Settings({ health, serviceUp, loading, onRefresh }: {
  health: Health; serviceUp: boolean; loading: boolean; onRefresh: () => void;
}) {
  return <section className="page subpage"><div className="page-heading"><div><div className="eyebrow"><i /> PREFERENCES</div><h1>Settings & diagnostics</h1><p>Check local health and integration status.</p></div><button className="button secondary" disabled={loading} onClick={onRefresh}><RefreshCw size={14} className={loading ? "spin" : ""} />Refresh</button></div>
    <section className="settings-card"><div className="settings-heading"><span className="stat-icon blue"><Radio size={16} /></span><div><strong>Local router service</strong><small>Runs on this Windows device</small></div><span className={"badge " + (serviceUp ? "amber-badge" : "red-badge")}><i />{serviceUp ? "SETUP REQUIRED" : "OFFLINE"}</span></div>
      <SettingRow label="Control API" value={serviceUp ? "127.0.0.1 · port 4187" : "Not responding"} />
      <SettingRow label="Inference forwarding" value={health.compatibilityVerified ? "Enabled" : "Disabled until compatibility passes"} />
      <SettingRow label="Codex account" value={health.accountState === "connected" ? "Connected" : "Not connected"} />
      <SettingRow label="User data" value="Current user · local SQLite" />
      <SettingRow label="Credentials in logs" value="Never" last />
      {health.lastError && <div className="gate-note"><AlertCircle size={15} /><span>Integration gate: <code>{health.lastError}</code></span></div>}
    </section>
    <section className="settings-card"><div className="settings-heading"><span className="stat-icon violet"><LockKeyhole size={16} /></span><div><strong>Account & credentials</strong><small>Windows protected storage</small></div></div><div className="account-pending"><LockKeyhole size={17} /><div><strong>Sign-in is not enabled yet</strong><p>The account path must pass catalog, usage, inference, and Desktop continuation checks first.</p></div><span className="badge muted-badge">NOT VERIFIED</span></div></section>
    <section className="settings-card"><div className="settings-heading"><span className="stat-icon orange"><Activity size={16} /></span><div><strong>Privacy & retention</strong><small>Redacted diagnostics are enabled</small></div></div><div className="setting-row no-border"><span>Decision metadata retention</span><strong>30 days</strong></div><p className="privacy-footnote">No prompts, source code, images, or credentials enter the decision log.</p></section>
  </section>;
}

function SettingRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={"setting-row" + (last ? " no-border" : "")}><span>{label}</span><strong>{value}</strong></div>;
}
