import { useEffect, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import Activity01Icon from "@hugeicons/core-free-icons/Activity01Icon";
import AlertCircleIcon from "@hugeicons/core-free-icons/AlertCircleIcon";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon";
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon";
import CheckmarkCircle01Icon from "@hugeicons/core-free-icons/CheckmarkCircle01Icon";
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

const pages: Array<{ name: Page; icon: IconSvgElement; section: "ROUTER" | "SYSTEM" }> = [
  { name: "Overview", icon: DashboardSquare01Icon, section: "ROUTER" },
  { name: "Models", icon: Layers01Icon, section: "ROUTER" },
  { name: "Routing policy", icon: SlidersHorizontalIcon, section: "ROUTER" },
  { name: "Usage", icon: Activity01Icon, section: "ROUTER" },
  { name: "Sessions & logs", icon: SquareTerminalIcon, section: "SYSTEM" },
  { name: "Settings", icon: Radio01Icon, section: "SYSTEM" },
];

const offline: Health = {
  state: "stopped", compatibilityVerified: false, accountState: "disconnected", lastError: "service_unavailable",
};

function UiIcon({ icon, size = 18, strokeWidth = 1.8, className = "" }: {
  icon: IconSvgElement; size?: number; strokeWidth?: number; className?: string;
}) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

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
    const syncPage = () => { setPage(pageFromHash()); setMenuOpen(false); };
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const ready = health.compatibilityVerified && health.state === "ready";
  const serviceUp = health.state === "degraded" || health.state === "ready";
  const serviceLabel = ready ? "Dispatch available" : serviceUp ? "Setup required" : "Service offline";

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMenuOpen(false);
    const nextHash = `#${pageSlug(nextPage)}`;
    if (window.location.hash !== nextHash) window.location.hash = nextHash;
  }

  return (
    <div className="min-h-screen bg-router-canvas font-sans text-router-ink antialiased">
      <a href="#main-content" className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-router-ink px-4 py-3 text-sm font-semibold text-white focus:translate-y-0">Skip to content</a>
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[232px] flex-col border-r border-white/10 bg-router-rail px-3 pb-4 pt-5 text-white transition-transform duration-200 max-[820px]:-translate-x-full ${menuOpen ? "max-[820px]:translate-x-0" : ""}`}>
        <div className="flex h-11 items-center gap-3 px-2">
          <div className="grid size-9 place-items-center rounded-lg bg-white/10 text-orange-300"><UiIcon icon={CommandIcon} size={19} /></div>
          <div className="min-w-0 flex-1"><strong className="block text-[15px] font-semibold tracking-[-.03em]">Codex Router</strong><span className="mt-0.5 block font-mono text-[9px] tracking-[.16em] text-router-rail-muted">WINDOWS · LOCAL</span></div>
          <button type="button" className="grid size-8 place-items-center rounded-md text-router-rail-muted hover:bg-white/10 hover:text-white min-[821px]:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><UiIcon icon={Cancel01Icon} size={18} /></button>
        </div>

        <div className="mx-1 mb-7 mt-8 flex min-h-[62px] items-center gap-3 rounded-lg border border-white/10 bg-white/[.055] px-3">
          <span className={`size-2 rounded-full ${ready ? "bg-emerald-400" : serviceUp ? "bg-amber-400" : "bg-slate-500"}`} />
          <span className="min-w-0 flex-1"><strong className="block truncate text-xs font-medium text-slate-100">Local installation</strong><small className="mt-1 block text-[10px] text-router-rail-muted">{serviceLabel}</small></span>
          <UiIcon icon={ArrowDown01Icon} size={15} className="text-slate-500" />
        </div>

        <nav className="grid gap-6" aria-label="Main navigation">
          {(["ROUTER", "SYSTEM"] as const).map((section) => <section key={section} className="grid gap-1">
            <h2 className="mb-1 px-3 font-mono text-[9px] font-medium tracking-[.16em] text-slate-500">{section}</h2>
            {pages.filter((item) => item.section === section).map(({ name, icon }) => <a key={name} href={`#${pageSlug(name)}`} aria-current={page === name ? "page" : undefined} className={`group flex min-h-10 items-center gap-3 rounded-md px-3 text-[12px] font-medium transition-colors ${page === name ? "bg-white/10 text-white shadow-[inset_2px_0_0_#f18b72]" : "text-slate-300 hover:bg-white/[.06] hover:text-white"}`}>
              <UiIcon icon={icon} size={17} className={page === name ? "text-orange-300" : "text-slate-400 group-hover:text-slate-200"} /><span>{name}</span>{page === name && <span className="ml-auto size-1.5 rounded-full bg-orange-300" />}
            </a>)}
          </section>)}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-start gap-2.5 px-2 py-2 text-orange-200"><UiIcon icon={LockKeyholeIcon} size={15} className="mt-0.5 shrink-0" /><p className="m-0 text-[10px] leading-[1.55] text-slate-300"><strong className="font-medium text-slate-100">Local by default</strong><br />Request content stays out of decision logs.</p></div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 px-2 pt-3 font-mono text-[9px] text-slate-500"><span>v0.1.0 · PREVIEW</span><button type="button" onClick={() => navigate("Settings")} className="text-slate-300 hover:text-white">Diagnostics</button></div>
        </div>
      </aside>

      {menuOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/45 min-[821px]:hidden" onClick={() => setMenuOpen(false)} />}

      <main id="main-content" tabIndex={-1} className="ml-[232px] flex min-h-screen min-w-0 flex-col max-[820px]:ml-0">
        <header className="sticky top-0 z-20 flex h-[58px] shrink-0 items-center justify-between border-b border-router-line bg-white/90 px-8 backdrop-blur-sm max-[650px]:px-4">
          <div className="flex items-center gap-2.5 text-[11px] text-router-muted"><button type="button" aria-label="Open navigation" aria-expanded={menuOpen} className="mr-1 hidden size-8 place-items-center rounded-md border border-router-line text-router-muted hover:bg-router-canvas max-[820px]:grid" onClick={() => setMenuOpen(true)}><UiIcon icon={Menu01Icon} size={18} /></button><span>Codex Router</span><span className="text-slate-300">/</span><strong className="font-semibold text-router-ink">{page}</strong></div>
          <div className="flex items-center gap-4"><span role="status" aria-live="polite" className="flex items-center gap-2 text-[11px] font-medium text-router-muted"><i className={`size-1.5 rounded-full ${ready ? "bg-router-good" : serviceUp ? "bg-amber-500" : "bg-slate-400"}`} />{serviceLabel}</span><span className="rounded border border-router-line bg-router-canvas px-2 py-1 font-mono text-[9px] tracking-wide text-router-muted max-[480px]:hidden">LOCAL</span></div>
        </header>

        <div className="mx-auto w-full max-w-[1500px] flex-1 px-8 pb-8 pt-7 max-[1024px]:px-6 max-[650px]:px-4 max-[650px]:pt-5">
          {page === "Overview" ? <Overview ready={ready} serviceUp={serviceUp} loading={loading} onRefresh={() => void refresh()} onNavigate={navigate} checkedAt={checkedAt} /> : page === "Settings" ? <Settings health={health} serviceUp={serviceUp} loading={loading} onRefresh={() => void refresh()} /> : <WorkspacePage page={page} onNavigate={navigate} />}
        </div>

        <footer className="flex min-h-10 items-center justify-between gap-3 border-t border-router-line bg-white px-8 text-[10px] text-router-muted max-[650px]:px-4"><span className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded bg-router-canvas font-mono text-[8px] font-semibold text-router-accent">CR</span>Local routing control plane</span><span>{checkedAt ? `Health checked ${formatTime(checkedAt)}` : "Checking service health…"}</span></footer>
      </main>
    </div>
  );
}

function pageSlug(page: Page) { return page.toLowerCase().replace(/&/g, "and").replace(/\s+/g, "-"); }
function pageFromHash(): Page { const slug = window.location.hash.slice(1); return pages.find(({ name }) => pageSlug(name) === slug)?.name ?? "Overview"; }
function formatTime(value: string) { return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

function PageHeading({ page, eyebrow, description, action }: { page: string; eyebrow: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-4 max-[560px]:items-start"><div><div className="mb-2 flex items-center gap-2 font-mono text-[9px] font-medium tracking-[.13em] text-router-muted"><span className="text-router-accent">{eyebrow}</span><span className="text-slate-300">/</span><span>WORKSPACE</span></div><h1 className="m-0 text-[27px] font-semibold leading-tight tracking-[-.04em] text-router-ink max-[650px]:text-[23px]">{page}</h1><p className="mb-0 mt-1.5 text-[12px] leading-relaxed text-router-muted">{description}</p></div>{action}</div>;
}

function Overview({ ready, serviceUp, loading, onRefresh, onNavigate, checkedAt }: {
  ready: boolean; serviceUp: boolean; loading: boolean; onRefresh: () => void; onNavigate: (page: Page) => void; checkedAt: string | null;
}) {
  const gates = [
    { title: "Local router service", detail: serviceUp ? "Health endpoint is responding" : "Waiting for the local process", state: serviceUp ? "done" : "current" },
    { title: "Account and usage source", detail: "Account-consistent data is not verified", state: "pending" },
    { title: "Inference and continuation", detail: "Streaming path has not passed diagnostics", state: "pending" },
    { title: "Codex Desktop handoff", detail: "Safe switch boundary is not verified", state: "pending" },
  ] as const;

  return <section>
    <PageHeading page="Overview" eyebrow="01" description="Routing readiness, model eligibility, and the checks that control dispatch." action={<button type="button" disabled={loading} onClick={onRefresh} className="inline-flex h-9 items-center gap-2 rounded-md border border-router-line bg-white px-3 text-[11px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-router-canvas disabled:cursor-wait disabled:opacity-60"><UiIcon icon={RefreshIcon} size={14} className={loading ? "loading-spin" : ""} />Recheck</button>} />

    <div className="grid grid-cols-12 gap-4 max-[1100px]:grid-cols-6 max-[720px]:grid-cols-1">
      <section aria-labelledby="dispatch-title" className="col-span-3 flex min-h-[218px] flex-col rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a] max-[1100px]:col-span-3 max-[720px]:col-span-1">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[12px] font-semibold"><span className="grid size-7 place-items-center rounded-md bg-router-accent-soft text-router-accent"><UiIcon icon={LockKeyholeIcon} size={15} /></span>Dispatch state</div><StatusPill label={ready ? "Ready" : "Locked"} state={ready ? "good" : "warn"} /></div>
        <div className="mt-6"><h2 id="dispatch-title" className="m-0 text-[21px] font-semibold tracking-[-.035em]">{ready ? "Dispatch available" : "Fail-closed"}</h2><p className="mb-0 mt-2 text-[11px] leading-[1.6] text-router-muted">{ready ? "Compatibility checks passed. Confirm model eligibility before sending requests." : "Requests are not forwarded until the account path and compatibility checks are verified."}</p></div>
        <button type="button" onClick={() => onNavigate("Settings")} className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-router-ink px-3 text-[11px] font-medium text-white transition-colors hover:bg-slate-700">{ready ? "Review diagnostics" : "Resolve setup checks"}<UiIcon icon={ArrowRight01Icon} size={14} /></button>
      </section>

      <section aria-labelledby="compatibility-title" className="col-span-4 min-h-[218px] rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a] max-[1100px]:col-span-3 max-[720px]:col-span-1">
        <div className="mb-2 flex items-start justify-between gap-3"><div><p className="m-0 font-mono text-[9px] font-medium tracking-[.12em] text-router-muted">INTEGRATION GATE</p><h2 id="compatibility-title" className="mb-0 mt-1 text-[13px] font-semibold">Compatibility checklist</h2></div><span className="rounded bg-router-canvas px-2 py-1 font-mono text-[9px] text-router-muted">{gates.filter((gate) => gate.state === "done").length} / {gates.length}</span></div>
        <div className="divide-y divide-router-line">{gates.map((gate, index) => <div key={gate.title} className="flex min-h-[39px] items-center gap-2.5 py-1.5"><span className={`grid size-[19px] shrink-0 place-items-center rounded-full ${gate.state === "done" ? "bg-router-good-soft text-router-good" : gate.state === "current" ? "bg-router-warn-soft text-router-warn" : "bg-router-canvas text-router-soft"}`}>{gate.state === "done" ? <UiIcon icon={Tick01Icon} size={12} /> : gate.state === "current" ? <UiIcon icon={AlertCircleIcon} size={13} /> : <span className="font-mono text-[8px]">{index + 1}</span>}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[10px] font-medium text-router-ink">{gate.title}</strong><small className="mt-0.5 block truncate text-[9px] text-router-muted">{gate.detail}</small></span><span className={`font-mono text-[8px] ${gate.state === "done" ? "text-router-good" : gate.state === "current" ? "text-router-warn" : "text-router-soft"}`}>{gate.state === "done" ? "PASS" : gate.state === "current" ? "CHECK" : "WAIT"}</span></div>)}</div>
      </section>

      <section aria-labelledby="eligibility-title" className="col-span-5 min-h-[218px] rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a] max-[1100px]:col-span-6 max-[720px]:col-span-1">
        <div className="mb-3 flex items-start justify-between"><div><p className="m-0 font-mono text-[9px] font-medium tracking-[.12em] text-router-muted">MODEL REGISTRY</p><h2 id="eligibility-title" className="mb-0 mt-1 text-[13px] font-semibold">Eligibility</h2></div><button type="button" onClick={() => onNavigate("Models")} className="inline-flex items-center gap-1 text-[10px] font-medium text-router-accent hover:text-red-700">Open registry<UiIcon icon={ArrowRight01Icon} size={13} /></button></div>
        <div className="grid grid-cols-[1.4fr_1fr_1fr] border-y border-router-line bg-slate-50/80 px-2.5 py-2 font-mono text-[8px] tracking-wide text-router-muted"><span>MODEL</span><span>ACCOUNT</span><span>ELIGIBILITY</span></div>
        <div className="grid min-h-[112px] place-items-center px-2 text-center"><div><span className="mx-auto grid size-8 place-items-center rounded-full bg-router-canvas text-router-muted"><UiIcon icon={Layers01Icon} size={16} /></span><p className="mb-0 mt-2 text-[10px] font-medium text-router-ink">No verified model catalog</p><p className="mb-0 mt-1 max-w-[260px] text-[9px] leading-relaxed text-router-muted">Account-visible models will appear after discovery is validated.</p></div></div>
      </section>

      <section aria-labelledby="usage-title" className="col-span-7 min-h-[190px] rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a] max-[1100px]:col-span-6 max-[720px]:col-span-1">
        <div className="mb-3 flex items-center justify-between gap-4"><div><p className="m-0 font-mono text-[9px] font-medium tracking-[.12em] text-router-muted">ACCOUNT SIGNAL</p><h2 id="usage-title" className="mb-0 mt-1 text-[13px] font-semibold">Usage freshness</h2></div><button type="button" onClick={() => onNavigate("Usage")} className="inline-flex items-center gap-1 text-[10px] font-medium text-router-accent hover:text-red-700">View usage<UiIcon icon={ArrowRight01Icon} size={13} /></button></div>
        <div className="flex min-h-[102px] items-center gap-3 rounded-md border border-dashed border-router-line bg-slate-50/70 px-4"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-white text-router-muted shadow-sm"><UiIcon icon={Activity01Icon} size={16} /></span><div><strong className="block text-[10px] font-medium">Quota data unavailable</strong><p className="mb-0 mt-1 text-[9px] leading-relaxed text-router-muted">No trusted account usage snapshot. Conservation preferences stay inactive until usage is fresh.</p></div><span className="ml-auto rounded border border-router-line bg-white px-2 py-1 font-mono text-[8px] text-router-muted max-[500px]:hidden">UNAVAILABLE</span></div>
      </section>

      <section aria-labelledby="policy-title" className="col-span-5 min-h-[190px] rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a] max-[1100px]:col-span-6 max-[720px]:col-span-1">
        <div className="mb-2 flex items-start justify-between"><div><p className="m-0 font-mono text-[9px] font-medium tracking-[.12em] text-router-muted">AUTHORIZATION</p><h2 id="policy-title" className="mb-0 mt-1 text-[13px] font-semibold">Policy gates</h2></div><button type="button" onClick={() => onNavigate("Routing policy")} className="inline-flex items-center gap-1 text-[10px] font-medium text-router-accent hover:text-red-700">Configure<UiIcon icon={ArrowRight01Icon} size={13} /></button></div>
        <div className="divide-y divide-router-line">{[{ title: "Final eligibility check", detail: "Must run immediately before dispatch" }, { title: "Disabled model protection", detail: "Recommendations cannot authorize models" }, { title: "Safe fallback required", detail: "No eligible fallback means no route" }].map((item) => <div key={item.title} className="flex min-h-[38px] items-center gap-2.5"><span className="grid size-5 place-items-center rounded-full bg-router-accent-soft text-router-accent"><UiIcon icon={Shield01Icon} size={12} /></span><span className="min-w-0 flex-1"><strong className="block text-[10px] font-medium">{item.title}</strong><small className="mt-0.5 block text-[9px] text-router-muted">{item.detail}</small></span><span className="font-mono text-[8px] text-router-soft">REQUIRED</span></div>)}</div>
      </section>

      <section aria-labelledby="activity-title" className="col-span-12 rounded-lg border border-router-line bg-router-panel shadow-[0_1px_2px_#16243a0a] max-[720px]:col-span-1">
        <div className="flex min-h-[54px] items-center justify-between gap-3 border-b border-router-line px-4"><div><p className="m-0 font-mono text-[9px] font-medium tracking-[.12em] text-router-muted">LOCAL JOURNAL</p><h2 id="activity-title" className="mb-0 mt-0.5 text-[12px] font-semibold">Recent routing activity</h2></div><span className="rounded border border-router-line bg-router-canvas px-2 py-1 font-mono text-[8px] text-router-muted">{checkedAt ? "LIVE" : "WAITING"}</span></div>
        <div className="grid min-h-[102px] place-items-center p-4 text-center"><div><span className="mx-auto grid size-8 place-items-center rounded-full bg-router-canvas text-router-muted"><UiIcon icon={SquareTerminalIcon} size={16} /></span><p className="mb-0 mt-2 text-[10px] font-medium">No routed requests yet</p><p className="mb-0 mt-1 text-[9px] text-router-muted">Decision metadata will appear here after a verified request passes through the router.</p></div></div>
      </section>
    </div>
  </section>;
}

function StatusPill({ label, state }: { label: string; state: "good" | "warn" | "neutral" }) {
  const palette = state === "good" ? "border-emerald-200 bg-router-good-soft text-router-good" : state === "warn" ? "border-orange-200 bg-router-warn-soft text-router-warn" : "border-router-line bg-router-canvas text-router-muted";
  const dot = state === "good" ? "bg-router-good" : state === "warn" ? "bg-amber-500" : "bg-slate-400";
  return <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[9px] font-medium ${palette}`}><i className={`size-1.5 rounded-full ${dot}`} />{label}</span>;
}

function WorkspacePage({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const detail: Record<Page, { eyebrow: string; description: string; icon: IconSvgElement; title: string; body: string }> = {
    Overview: { eyebrow: "01", description: "", icon: DashboardSquare01Icon, title: "Overview", body: "" },
    Models: { eyebrow: "02", description: "Account-visible models, capability evidence, and dispatch eligibility.", icon: Layers01Icon, title: "Model catalog is not connected", body: "The registry stays empty until account-consistent discovery and capability checks are implemented." },
    "Routing policy": { eyebrow: "03", description: "Task requirements are evaluated before allowance preferences.", icon: SlidersHorizontalIcon, title: "Policy controls are not connected", body: "Model pins, fallbacks, and routing preferences will be editable after the authorization path is in place." },
    Usage: { eyebrow: "04", description: "Account usage windows with source timestamps and freshness state.", icon: Activity01Icon, title: "No trusted usage snapshot", body: "Quota windows will be displayed only when account-specific usage can be verified. Missing or stale data will not guide routing." },
    "Sessions & logs": { eyebrow: "05", description: "Redacted route decisions, session state, and operational errors.", icon: SquareTerminalIcon, title: "No routing records", body: "Sessions and decision metadata will appear once the verified request path is active. Request bodies are not stored here." },
    Settings: { eyebrow: "06", description: "", icon: Radio01Icon, title: "Settings", body: "" },
  };
  const current = detail[page];
  return <section>
    <PageHeading page={page} eyebrow={current.eyebrow} description={current.description} />
    {page === "Models" ? <ModelRegistryEmpty /> : page === "Usage" ? <UsageEmpty /> : <section className="rounded-lg border border-router-line bg-router-panel p-5 shadow-[0_1px_2px_#16243a0a]">
      <div className="flex min-h-[190px] flex-col items-center justify-center text-center"><span className="grid size-12 place-items-center rounded-xl bg-router-canvas text-router-accent"><UiIcon icon={current.icon} size={22} /></span><h2 className="mb-0 mt-4 text-[15px] font-semibold">{current.title}</h2><p className="mb-0 mt-2 max-w-lg text-[11px] leading-relaxed text-router-muted">{current.body}</p>{page === "Sessions & logs" && <button type="button" onClick={() => onNavigate("Settings")} className="mt-4 inline-flex h-8 items-center gap-2 rounded-md border border-router-line px-3 text-[10px] font-medium hover:bg-router-canvas">Review diagnostics<UiIcon icon={ArrowRight01Icon} size={13} /></button>}</div>
    </section>}
  </section>;
}

function ModelRegistryEmpty() {
  return <div className="grid grid-cols-12 gap-4 max-[900px]:grid-cols-1"><section className="col-span-9 overflow-hidden rounded-lg border border-router-line bg-router-panel shadow-[0_1px_2px_#16243a0a] max-[900px]:col-span-1"><div className="flex min-h-[58px] items-center justify-between gap-3 border-b border-router-line px-4"><div><p className="m-0 font-mono text-[9px] tracking-[.12em] text-router-muted">CATALOG</p><h2 className="mb-0 mt-0.5 text-[12px] font-semibold">Available models</h2></div><span className="rounded bg-router-canvas px-2 py-1 font-mono text-[9px] text-router-muted">— MODELS</span></div><div className="grid grid-cols-[1.6fr_1fr_1fr_1.2fr] bg-slate-50 px-4 py-2.5 font-mono text-[8px] tracking-wide text-router-muted max-[550px]:grid-cols-[1.6fr_1fr_1fr]"><span>MODEL</span><span>PROVIDER</span><span>CAPABILITIES</span><span className="max-[550px]:hidden">ELIGIBILITY</span></div><div className="grid min-h-[180px] place-items-center border-t border-router-line p-5 text-center"><div><UiIcon icon={Layers01Icon} size={22} className="mx-auto text-slate-400" /><p className="mb-0 mt-2 text-[11px] font-medium">Model discovery is not verified</p><p className="mb-0 mt-1 text-[10px] text-router-muted">No sample or placeholder models are shown.</p></div></div></section><aside className="col-span-3 rounded-lg border border-router-line bg-router-panel p-4 max-[900px]:col-span-1"><p className="m-0 font-mono text-[9px] tracking-[.12em] text-router-muted">DISPATCH GATE</p><h2 className="mb-0 mt-2 text-[14px] font-semibold">Fail-closed</h2><p className="mb-0 mt-2 text-[10px] leading-relaxed text-router-muted">A model must be discovered, capability-verified, and enabled before it can receive a request.</p></aside></div>;
}

function UsageEmpty() {
  return <section className="rounded-lg border border-router-line bg-router-panel p-5 shadow-[0_1px_2px_#16243a0a]"><div className="grid min-h-[180px] place-items-center text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-xl bg-router-canvas text-router-muted"><UiIcon icon={Activity01Icon} size={21} /></span><h2 className="mb-0 mt-3 text-[13px] font-semibold">Usage data unavailable</h2><p className="mb-0 mt-1.5 max-w-md text-[10px] leading-relaxed text-router-muted">Quota information needs a verified account source and a recent timestamp. Until then, the router won’t use it to conserve allowance.</p></div></div></section>;
}

function Settings({ health, serviceUp, loading, onRefresh }: { health: Health; serviceUp: boolean; loading: boolean; onRefresh: () => void }) {
  return <section className="mx-auto max-w-4xl">
    <PageHeading page="Settings & diagnostics" eyebrow="06" description="Local service state, account path, and compatibility checks." action={<button type="button" disabled={loading} onClick={onRefresh} className="inline-flex h-9 items-center gap-2 rounded-md border border-router-line bg-white px-3 text-[11px] font-medium shadow-sm hover:bg-router-canvas disabled:opacity-60"><UiIcon icon={RefreshIcon} size={14} className={loading ? "loading-spin" : ""} />Recheck</button>} />
    <div className="grid gap-4"><section className="rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a]"><div className="mb-3 flex items-start justify-between"><div><p className="m-0 font-mono text-[9px] tracking-[.12em] text-router-muted">PROCESS</p><h2 className="mb-0 mt-1 text-[13px] font-semibold">Router service</h2></div><StatusPill label={serviceUp ? "SETUP REQUIRED" : "OFFLINE"} state={serviceUp ? "warn" : "neutral"} /></div><SettingRow label="Control API" value={serviceUp ? "127.0.0.1 · port 4187" : "No response · port 4187"} /><SettingRow label="Inference forwarding" value={health.compatibilityVerified ? "Enabled" : "Disabled until compatibility passes"} /><SettingRow label="Codex account" value={health.accountState === "connected" ? "Connected" : "Not connected"} /><SettingRow label="Data store" value="Local · current Windows user" /><SettingRow label="Request content in logs" value="Never" last />{health.lastError && <div className="mt-3 flex items-center gap-2 rounded-md border border-orange-200 bg-router-warn-soft px-3 py-2 text-[10px] text-router-warn"><UiIcon icon={AlertCircleIcon} size={15} /><span>Last health result <code className="font-mono">{health.lastError}</code>. Start the router, then recheck.</span></div>}</section>
      <section className="rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a]"><p className="m-0 font-mono text-[9px] tracking-[.12em] text-router-muted">ACCOUNT</p><h2 className="mb-3 mt-1 text-[13px] font-semibold">Credentials & discovery</h2><div className="flex items-center gap-3 rounded-md border border-dashed border-router-line bg-slate-50 px-3 py-3"><UiIcon icon={LockKeyholeIcon} size={17} className="shrink-0 text-router-muted" /><div><strong className="block text-[10px] font-medium">Sign-in is not enabled</strong><span className="mt-1 block text-[9px] text-router-muted">Credential storage and account-specific discovery follow the compatibility spike.</span></div></div></section>
      <section className="rounded-lg border border-router-line bg-router-panel p-4 shadow-[0_1px_2px_#16243a0a]"><p className="m-0 font-mono text-[9px] tracking-[.12em] text-router-muted">RETENTION</p><h2 className="mb-2 mt-1 text-[13px] font-semibold">Privacy</h2><SettingRow label="Decision metadata retention" value="30 days" last /><p className="mb-0 mt-3 text-[10px] text-router-muted">Prompts, source code, images, and credentials do not enter the decision log.</p></section></div>
  </section>;
}

function SettingRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={`flex min-h-9 items-center justify-between gap-4 border-t border-router-line px-1 text-[10px] ${last ? "border-b" : ""}`}><span className="text-router-muted">{label}</span><strong className="text-right font-medium text-router-ink">{value}</strong></div>;
}
