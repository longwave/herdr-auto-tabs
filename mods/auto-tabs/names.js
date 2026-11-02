// Names each tab after what's in it: a Claude Code tab after the title Claude
// sets, a terminal tab after its running program, or its folder at the prompt.
// Leaves a tab alone once you rename it yourself.

import { spaces, panes, shared, setShared, run, home } from "herdr";

// Names the new-tab menu gives agent tabs; we may replace these.
// shortcut: only Claude Code's default name, add others if more agents set titles.
const DEFAULTS = new Set(["Claude Code"]);
const KEY = "tab-titles.set"; // tab id -> the name we gave it

function nameFor(p) {
  if (p.app === "claude-code") {
    // Claude prefixes a spinner or ✳ while working.
    const title = (p.title ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
    // On Windows the title is briefly the program's path (C:\...\pwsh.exe) before Claude sets one.
    return /^[a-z]:[\\/]|\.exe$/i.test(title) ? null : title;
  }
  if (!p.program?.shell) return p.program?.name;
  if (!p.cwd) return null;
  return isHome(p.cwd) ? "~" : p.cwd.split(/[\\/]/).filter(Boolean).pop();
}

// shortcut: assumes /home/<user> or /root homes, or this computer's home(); read $HOME if remote machines differ.
function isHome(cwd) {
  if (cwd === cwd.match(/^\/home\/[^/]+|^\/root/)?.[0]) return true;
  // Windows paths may differ from home() in separators, case or a trailing slash.
  const norm = s => s.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  try { return norm(cwd) === norm(home()); } catch { return false; }
}

export function syncNames() {
  const saved = shared(KEY) ?? {};
  const ours = { ...saved };
  const tabs = new Map(spaces().flatMap(s => s.tabs).map(t => [t.id, t]));
  // One pane per tab: its Claude pane if it has one, else its first terminal.
  const pick = new Map();
  for (const p of panes()) {
    if (!p.terminal) continue;
    const cur = pick.get(p.tab);
    if (!cur || (p.app === "claude-code" && cur.app !== "claude-code")) pick.set(p.tab, p);
  }
  for (const [id, p] of pick) {
    const tab = tabs.get(id);
    const name = nameFor(p);
    if (!tab || !name || tab.name === name) continue;
    if (tab.named && !DEFAULTS.has(tab.name) && ours[tab.id] !== tab.name) continue;
    run("tab.rename", { id: tab.id, name });
    ours[tab.id] = name;
  }
  for (const id of Object.keys(ours)) if (!tabs.has(id)) delete ours[id];
  if (JSON.stringify(ours) !== JSON.stringify(saved)) setShared(KEY, ours);
}
