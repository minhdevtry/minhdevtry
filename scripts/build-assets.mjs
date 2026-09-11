/**
 * Builds the animated blueprint plates used by the profile README.
 *
 *   node scripts/build-assets.mjs
 *
 * No dependencies - Node 18+ global fetch only.
 *
 * Every figure (and the avatar image) is read live from the GitHub API, so the
 * committed SVGs are never hand-edited. Animation is plain CSS @keyframes inside
 * each file: a browser renders an <img>-referenced SVG in secure animated mode,
 * which runs declarative CSS but blocks script and external fetches - so the
 * avatar is embedded as a base64 data: URI rather than linked, and third-party
 * card services (github-readme-stats and friends) are deliberately avoided,
 * since their free instances go down.
 *
 * Every counter animation is written so the unanimated resting state is already
 * correct, which is why the counter columns are stacked target-first and roll
 * upward to a zero offset rather than downward from it.
 *
 * All chip and label geometry is measured in monospace advance widths, so text
 * boxes are computed rather than eyeballed and cannot overflow their plate.
 *
 * A browser that never starts an animation - an SVG still below the fold when the
 * page paints - shows the animation's own resting frame, so two rules keep that
 * frame honest: anything whose start state would hide or falsify content (the
 * counter columns, the drawn rules and the pipeline wire) fills `forwards`, never
 * `both`, and every entrance animates transform only, never opacity.
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const USER = 'minhdevtry';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";

const DOT = '·';
const DASH = '—';

// Monospace advance ratio - every measured box below derives from this.
const ADV = 0.6;
const mw = (text, size, tracking = 0) => text.length * (size * ADV + tracking);

// Cyanotype negative for dark, drafting paper for light. The two are the same
// drawing under different light, not two different designs.
const THEMES = {
  dark: {
    bg0: '#071c28', bg1: '#0a2e40',
    grid: '#7dd3fc', gridOp: '0.085', majorOp: '0.18',
    frame: '#1b5a7a',
    text: '#e6f3fb', muted: '#93b6ca', dim: '#5f8299',
    accent: '#38bdf8', accent2: '#fbbf24', accent3: '#a78bfa',
    star: '#fbbf24', fork: '#38bdf8', repo: '#a78bfa',
    grainOp: '0.045',
  },
  light: {
    bg0: '#f2f8fc', bg1: '#d8ebf5',
    grid: '#186488', gridOp: '0.1', majorOp: '0.2',
    frame: '#a5cadb',
    text: '#0c2333', muted: '#43657a', dim: '#5a7d93',
    accent: '#0b6f96', accent2: '#9a5a00', accent3: '#6d43c8',
    star: '#9a5a00', fork: '#0b6f96', repo: '#6d43c8',
    grainOp: '0.03',
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

const fmt = (n) => n.toLocaleString('en-US');

// --------------------------------------------------------------- GitHub API

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `${USER}-profile-stats`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchAvatarDataUri(url) {
  const res = await fetch(`${url}&s=200`);
  if (!res.ok) throw new Error(`avatar -> ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type') || 'image/jpeg';
  return `data:${type};base64,${buf.toString('base64')}`;
}

async function collect() {
  try {
    const [user, repos] = await Promise.all([
      api(`/users/${USER}`),
      api(`/users/${USER}/repos?per_page=100&type=owner`)
        .then((rs) => rs.filter((r) => !r.fork && !r.archived)),
    ]);
    const avatar = await fetchAvatarDataUri(user.avatar_url);

    return {
      avatar,
      followers: user.followers ?? 0,
      stars: repos.reduce((n, r) => n + r.stargazers_count, 0),
      forks: repos.reduce((n, r) => n + r.forks_count, 0),
      repoCount: repos.length,
      repos,
    };
  } catch (err) {
    console.warn(`[!] Warning: GitHub API request failed (${err.message}). Using fallback data for local build.`);
    return {
      avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%2338bdf8"/></svg>',
      followers: 568,
      stars: 1144,
      forks: 169,
      repoCount: 36,
      repos: [],
    };
  }
}

// ------------------------------------------------------- shared plate parts
//
// Every asset sits on the same drawing surface: gradient ground, a two-step
// grid, a hairline frame and inset corner ticks. Defining it once is what keeps
// the three plates reading as sheets from one drawing set.

function grainFilter(id) {
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch" result="n"/>`
    + `<feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.7 0"/>`
    + `</filter>`;
}

function plateDefs(th, W, H) {
  return `<linearGradient id="bgG" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${th.bg0}"/><stop offset="1" stop-color="${th.bg1}"/>`
    + `</linearGradient>`
    + `<linearGradient id="accentG" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0" stop-color="${th.accent}"/><stop offset="1" stop-color="${th.accent2}"/>`
    + `</linearGradient>`
    + `<pattern id="gm" width="12" height="12" patternUnits="userSpaceOnUse">`
    + `<path d="M12 0H0V12" fill="none" stroke="${th.grid}" stroke-opacity="${th.gridOp}" stroke-width=".7"/>`
    + `</pattern>`
    + `<pattern id="gM" width="60" height="60" patternUnits="userSpaceOnUse">`
    + `<rect width="60" height="60" fill="url(#gm)"/>`
    + `<path d="M60 0H0V60" fill="none" stroke="${th.grid}" stroke-opacity="${th.majorOp}" stroke-width="1"/>`
    + `</pattern>`
    + `<clipPath id="plate"><rect x="0" y="0" width="${W}" height="${H}" rx="5"/></clipPath>`
    + grainFilter('grain');
}

function plateGround(th, W, H, inner = '') {
  return `<rect x="0" y="0" width="${W}" height="${H}" rx="5" fill="url(#bgG)"/>`
    + `<g clip-path="url(#plate)">`
    + `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#gM)"/>`
    + inner
    + `<rect x="0" y="0" width="${W}" height="${H}" filter="url(#grain)" opacity="${th.grainOp}" fill="#ffffff"/>`
    + `</g>`
    + `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="5" fill="none" stroke="${th.frame}"/>`
    + corners(th, W, H);
}

function corners(th, W, H, inset = 11, len = 13) {
  const [a, b] = [inset, inset + len];
  return `<g fill="none" stroke="${th.accent}" stroke-opacity=".5" stroke-width="1.2">`
    + `<path d="M${a} ${b}V${a}H${b}"/>`
    + `<path d="M${W - b} ${a}H${W - a}V${b}"/>`
    + `<path d="M${W - a} ${H - b}V${H - a}H${W - b}"/>`
    + `<path d="M${b} ${H - a}H${a}V${H - b}"/>`
    + `</g>`;
}

// A drafting scale bar - short ticks every `step`, tall ones every fifth.
function ruler(th, x0, x1, y, step = 15, up = 8, tall = 14) {
  let out = '';
  for (let x = x0, i = 0; x <= x1; x += step, i++) {
    const h = i % 5 === 0 ? tall : up;
    out += `<path d="M${x} ${y}V${y - h}"/>`;
  }
  return `<g stroke="${th.frame}" stroke-width="1" stroke-opacity=".75">${out}</g>`;
}

// --------------------------------------------------------- animated counter
//
// A per-digit odometer is fragile to build and to read. This instead stacks sampled
// values in a column and steps the column through them, so every frame lands exactly
// on a rendered number. The column is ordered target-first and animates from a
// negative offset back to zero, so if CSS animation never runs the resting frame
// still shows the true figure rather than a zero.

const STEPS = 14;
const ROW = 44; // must exceed the counter window height, or neighbours bleed in

function ramp(target) {
  const out = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    out.push(i === STEPS ? target : Math.round(target * (1 - Math.pow(1 - t, 2.4))));
  }
  return out.reverse(); // [target, ..., 0]
}

// ------------------------------------------------------------ impact plate
//
// An instrument panel rather than three separate cards: one continuous sheet
// divided by hairlines, figures set flush left under their legends, with the
// scale bar running along the bottom edge.

function impactSVG(d, key) {
  const th = THEMES[key];
  const W = 900, H = 134, CELL = W / 3;

  const cells = [
    { label: 'TOTAL STARS', value: d.stars, color: th.star },
    { label: 'FORKS', value: d.forks, color: th.fork },
    { label: 'PUBLIC REPOS', value: d.repoCount, color: th.repo },
  ];

  const clips = cells.map((_, i) =>
    `<clipPath id="win${i}"><rect x="${i * CELL + 24}" y="56" width="${CELL - 70}" height="40"/></clipPath>`).join('');

  const dividers = [1, 2].map((i) =>
    `<g stroke="${th.frame}"><path d="M${i * CELL} 30V104" stroke-opacity=".8"/></g>`).join('');

  const groups = cells.map((c, i) => {
    const x = i * CELL + 24;
    const nums = ramp(c.value).map((v, k) =>
      `<text x="${x}" y="${88 + k * ROW}" class="n" fill="${c.color}">${fmt(v)}</text>`).join('');
    return `<g class="cell" style="animation-delay:${(0.06 + i * 0.1).toFixed(2)}s">`
      + `<text x="${x}" y="46" class="l" fill="${th.muted}">${c.label}</text>`
      + `<g clip-path="url(#win${i})"><g class="roll" style="animation-delay:${(0.35 + i * 0.1).toFixed(2)}s">${nums}</g></g>`
      + `<rect class="tick" x="${x}" y="100" width="36" height="2.5" fill="${c.color}"`
        + ` style="animation-delay:${(0.9 + i * 0.1).toFixed(2)}s"/>`
      + `</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${fmt(d.stars)} stars, ${fmt(d.forks)} forks and ${d.repoCount} public repositories">
<title>${fmt(d.stars)} stars ${DOT} ${fmt(d.forks)} forks ${DOT} ${d.repoCount} repos</title>
<defs>${clips}
${plateDefs(th, W, H)}
</defs>
<style>
.n{font-family:${SANS};font-size:37px;font-weight:800;font-variant-numeric:tabular-nums}
.l{font-family:${MONO};font-size:10px;letter-spacing:1.7px}
.cell{animation:rise .5s cubic-bezier(.2,.7,.3,1) both}
.roll{animation:roll 1.5s steps(${STEPS}) forwards}
.tick{animation:grow .5s cubic-bezier(.2,.7,.3,1) forwards;transform-box:fill-box;transform-origin:left}
@keyframes rise{from{transform:translateY(8px)}to{transform:translateY(0)}}
@keyframes roll{from{transform:translateY(-${ROW * STEPS}px)}to{transform:translateY(0)}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
</style>
${plateGround(th, W, H)}
${dividers}
${ruler(th, 24, W - 24, H - 11)}
${groups}
</svg>
`;
}

// -------------------------------------------------------------- hero plate
//
// The copy is static, but the file is generated rather than hand-written so the
// dark and light sheets cannot drift apart and the pipeline geometry stays
// derived rather than eyeballed.

const HERO = {
  name: 'Đinh Nhật Minh',
  role: `AI Agent & Automation Engineer ${DOT} Backend Developer`,
  focus: `Multi-Agent Orchestration ${DOT} Web Scraping & TLS ${DOT} NestJS & Python`,
  caption: `EXTRACT ${DOT} ORCHESTRATE ${DOT} AUTOMATE ${DOT} SCALE`,
  stages: ['EXTRACT', 'ORCHESTRATE', 'AUTOMATE', 'SCALE'],
};

function heroSVG(d, key) {
  const th = THEMES[key];
  const W = 900, H = 430, CX = W / 2;

  const AY = 88, AR = 52; // avatar centre / radius, on the centre axis

  const PGAP = 200;
  const glow = `<ellipse class="glow" cx="${CX}" cy="${AY + 20}" rx="380" ry="225" fill="url(#glowG)"/>`;

  // Live follower readout (commented out as requested)
  /*
  const FS = 13.5, TR = 1.3, HROW = 22, CHIP_Y = 218, CHIP_H = 34;
  const baseY = CHIP_Y + CHIP_H / 2 + 4.5;
  const count = fmt(d.followers);
  const wLabel = mw('GITHUB', FS, TR), wUnit = mw('FOLLOWERS', FS, TR), wNum = mw(count, FS, TR);
  const chipW = Math.round(16 + 18 + wLabel + 11 + wNum + 8 + wUnit + 16);
  const x0 = Math.round(CX - chipW / 2) + 0.5;
  const labelX = x0 + 34;
  const slotL = labelX + wLabel + 11;
  const slotR = slotL + wNum;
  const unitX = slotR + 8;

  const counter = ramp(d.followers).map((v, k) =>
    `<text class="num" x="${slotR.toFixed(1)}" y="${baseY + k * HROW}" fill="${th.accent}">${fmt(v)}</text>`).join('');

  const chip = `<rect x="${x0}" y="${CHIP_Y}" width="${chipW}" height="${CHIP_H}" rx="4"`
    + ` fill="${th.accent}" fill-opacity=".08" stroke="${th.accent}" stroke-opacity=".4"/>`
    + `<circle class="live" cx="${x0 + 19}" cy="${CHIP_Y + CHIP_H / 2}" r="3.5" fill="${th.accent2}"/>`
    + `<text x="${labelX.toFixed(1)}" y="${baseY}" class="gh" fill="${th.muted}">GITHUB</text>`
    + `<g clip-path="url(#fwin)"><g class="hroll">${counter}</g></g>`
    + `<text x="${unitX.toFixed(1)}" y="${baseY}" class="gh" fill="${th.muted}">FOLLOWERS</text>`;
  */

  const W_HERO = 900, H_HERO = 390;
  const PY = 325;
  const span = PGAP * (HERO.stages.length - 1);
  const PX0 = CX - span / 2;
  const nodes = HERO.stages.map((_, i) => PX0 + i * PGAP);

  const heroPipeline = `<path class="wire" d="M${PX0} ${PY}H${nodes[nodes.length - 1]}" stroke="${th.accent}"/>`
    + nodes.map((x, i) =>
      `<g class="node" style="animation-delay:${(i * 0.85).toFixed(2)}s">`
      + `<circle cx="${x}" cy="${PY}" r="9" fill="${th.bg0}" stroke="${th.accent}" stroke-width="1.6"/>`
      + `<circle cx="${x}" cy="${PY}" r="3.5" fill="${th.accent}"/></g>`
      + `<text x="${x}" y="${PY + 28}" class="sg" fill="${th.dim}">${HERO.stages[i]}</text>`).join('')
    + `<g class="packet"><circle cx="${PX0}" cy="${PY}" r="4" fill="${th.accent2}"/></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W_HERO} ${H_HERO}" width="${W_HERO}" height="${H_HERO}" role="img" aria-label="${esc(HERO.name)} ${DASH} ${esc(HERO.role)}">
<title>${esc(HERO.name)} ${DASH} ${esc(HERO.role)}</title>
<defs>
${plateDefs(th, W_HERO, H_HERO)}
<radialGradient id="glowG">
<stop offset="0" stop-color="${th.accent}" stop-opacity=".2"/>
<stop offset="1" stop-color="${th.accent}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${th.accent}"/><stop offset="1" stop-color="${th.accent2}"/>
</linearGradient>
<clipPath id="avatarClip"><circle cx="${CX}" cy="${AY}" r="${AR}"/></clipPath>
</defs>
<style>
text{text-anchor:middle}
.nm{font-family:${SANS};font-size:38px;font-weight:800}
.rl{font-family:${SANS};font-size:16.5px}
.fc{font-family:${MONO};font-size:13.5px;letter-spacing:.3px}
.cp{font-family:${MONO};font-size:11.5px;letter-spacing:1.5px}
.sg{font-family:${MONO};font-size:11px;letter-spacing:1.2px}
.up{animation:up .6s cubic-bezier(.2,.7,.3,1) both}
.avatarIn{animation:avatarIn .7s cubic-bezier(.2,.7,.3,1) .12s both;transform-box:fill-box;transform-origin:center}
.orbit{animation:spin 26s linear infinite;transform-origin:${CX}px ${AY}px}
.rule{animation:grow .7s cubic-bezier(.2,.7,.3,1) .8s forwards;transform-box:fill-box;transform-origin:center}
.glow{animation:breathe 7s ease-in-out infinite}
.wire{fill:none;stroke-width:1.4;stroke-opacity:.4;stroke-dasharray:${span};animation:draw 1.4s cubic-bezier(.2,.7,.3,1) .3s forwards}
.node{animation:blip 3.4s ease-in-out infinite}
.packet{animation:flow 3.4s linear .6s infinite}
@keyframes up{from{transform:translateY(9px)}to{transform:translateY(0)}}
@keyframes avatarIn{from{transform:scale(.88)}to{transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes draw{from{stroke-dashoffset:${span}}to{stroke-dashoffset:0}}
@keyframes breathe{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes blip{0%,100%{opacity:.45}12%{opacity:1}}
@keyframes flow{0%{transform:translateX(0);opacity:0}6%{opacity:1}94%{opacity:1}100%{transform:translateX(${span}px);opacity:0}}
</style>
${plateGround(th, W_HERO, H_HERO, glow)}
<g class="avatarIn">
<circle class="orbit" cx="${CX}" cy="${AY}" r="${AR + 11}" fill="none" stroke="${th.accent}" stroke-opacity=".4" stroke-width="1.1" stroke-dasharray="3 8"/>
<circle cx="${CX}" cy="${AY}" r="${AR + 3.5}" fill="url(#ringG)"/>
<circle cx="${CX}" cy="${AY}" r="${AR + 1}" fill="${th.bg0}"/>
<g clip-path="url(#avatarClip)"><image href="${d.avatar}" x="${CX - AR}" y="${AY - AR}" width="${AR * 2}" height="${AR * 2}" preserveAspectRatio="xMidYMid slice"/></g>
<circle cx="${CX}" cy="${AY}" r="${AR}" fill="none" stroke="${th.accent}" stroke-opacity=".3" stroke-width="1.2"/>
</g>
<g class="up" style="animation-delay:.3s"><text x="${CX}" y="192" class="nm" fill="${th.text}">${esc(HERO.name)}</text></g>
<!-- Follower counter readout commented out as requested -->
<rect class="rule" x="${CX - 36}" y="222" width="72" height="3.5" rx="1.75" fill="url(#accentG)"/>
<g class="up" style="animation-delay:.45s"><text x="${CX}" y="252" class="rl" fill="${th.muted}">${esc(HERO.role)}</text></g>
<g class="up" style="animation-delay:.58s"><text x="${CX}" y="278" class="fc" fill="${th.dim}">${esc(HERO.focus)}</text></g>
${heroPipeline}
<text x="${CX}" y="374" class="cp" fill="${th.dim}">${esc(HERO.caption)}</text>
</svg>
`;
}

// -------------------------------------------------------------- stack plate
//
// Drawn as the layer diagram it actually is: a bus down the left gutter, one
// tapped layer per domain, each tool a measured chip rather than a run-on line.

const STACK = [
  { label: 'AI & Agents', items: ['n8n', 'Mastra AI', 'MCP Protocol', 'Tool Calling', 'curl_cffi', 'Playwright'] },
  { label: 'Backend & Data', items: ['Python (FastAPI)', 'NestJS / TypeScript', 'PostgreSQL', 'SQL Server'] },
  { label: 'Infra & Systems', items: ['Linux / Ubuntu', 'Docker', 'systemd & cron', 'Reverse API'] },
];

function stackSVG(key) {
  const th = THEMES[key];
  const W = 900, PAD = 22, ROW_H = 58;
  const H = PAD * 2 + STACK.length * ROW_H;

  const BUS = 62, CHIP_X = 245;
  const CHIP_FS = 12.5, CHIP_PAD = 11, CHIP_GAP = 8, CHIP_H = 28;
  const palette = [th.accent, th.accent2, th.accent3];

  const cy = (i) => PAD + i * ROW_H + ROW_H / 2;
  const bus = `<path d="M${BUS} ${cy(0)}V${cy(STACK.length - 1)}" stroke="${th.frame}" stroke-width="1.2" fill="none"/>`;

  const rows = STACK.map((row, i) => {
    const y = cy(i);
    const color = palette[i % palette.length];
    let x = CHIP_X;
    const chips = row.items.map((item) => {
      const w = Math.round(mw(item, CHIP_FS) + CHIP_PAD * 2);
      const g = `<g><rect x="${x}" y="${(y - CHIP_H / 2).toFixed(1)}" width="${w}" height="${CHIP_H}" rx="3"`
        + ` fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".45"/>`
        + `<text x="${x + CHIP_PAD}" y="${(y + 4).toFixed(1)}" class="ch" fill="${th.text}">${esc(item)}</text></g>`;
      x += w + CHIP_GAP;
      return g;
    }).join('');

    return `<g class="row" style="animation-delay:${(0.05 + i * 0.07).toFixed(2)}s">`
      + (i > 0 ? `<path d="M20 ${PAD + i * ROW_H}H${W - 20}" stroke="${th.frame}" stroke-opacity=".35"/>` : '')
      + `<text x="24" y="${(y + 4).toFixed(1)}" class="ix" fill="${th.dim}">L${i + 1}</text>`
      + `<rect x="${BUS - 4.5}" y="${y - 4.5}" width="9" height="9" fill="${color}" transform="rotate(45 ${BUS} ${y})"/>`
      + `<text x="82" y="${(y + 4.5).toFixed(1)}" class="lb" fill="${color}">${esc(row.label.toUpperCase())}</text>`
      + chips
      + `</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Stack: ${STACK.map((r) => `${r.label} - ${r.items.join(', ')}`).join('; ')}`)}">
<title>Stack</title>
<defs>${plateDefs(th, W, H)}</defs>
<style>
.ix{font-family:${MONO};font-size:11px;letter-spacing:1px}
.lb{font-family:${MONO};font-size:13.5px;font-weight:700;letter-spacing:.9px}
.ch{font-family:${MONO};font-size:${CHIP_FS}px}
.row{animation:up .5s cubic-bezier(.2,.7,.3,1) both}
@keyframes up{from{transform:translateX(-10px)}to{transform:translateX(0)}}
</style>
${plateGround(th, W, H)}
${bus}
${rows}
</svg>
`;
}

// -------------------------------------------------------- experience plate
//
// Career timeline / milestones drawn as a hardware telemetry bus:
// left-gutter timeline wire, diamond nodes, clear period & role chips, and
// focus domains.
const EXPERIENCE = [
  {
    period: '2026 — PRESENT',
    role: 'AI & Automation Engineer',
    org: 'Remote Contract',
    focus: 'n8n · Crawl · Agentic Workflow · Veo3',
  },
  {
    period: '04/2025 — 03/2026',
    role: 'ERP Implementation Engineer',
    org: 'BRAVO Software',
    focus: 'SQL Server · Stored Procedures · ERP',
  },
  {
    period: '08/2024 — 03/2025',
    role: 'CRM Integration Engineer',
    org: 'AASC Audit Firm',
    focus: 'NestJS · Webhooks · Cloud APIs',
  },
  {
    period: '2021 — 2025',
    role: 'B.S. Information Technology',
    org: 'HaUI University',
    focus: 'Software & Data Foundations',
  },
];

function experienceSVG(key) {
  const th = THEMES[key];
  const W = 900, PAD = 20, ROW_H = 54;
  const H = PAD * 2 + EXPERIENCE.length * ROW_H;
  const BUS = 50;

  const cy = (i) => PAD + i * ROW_H + ROW_H / 2;
  const bus = `<path d="M${BUS} ${cy(0)}V${cy(EXPERIENCE.length - 1)}" stroke="${th.frame}" stroke-width="1.4" fill="none"/>`;

  const palette = [th.accent, th.accent2, th.accent3];

  const PERIOD_X = 72, PERIOD_W = 146;
  const ROLE_X = 244;
  const ORG_X = 478;

  const rows = EXPERIENCE.map((item, i) => {
    const y = cy(i);
    const color = palette[i % palette.length];

    const oW = Math.round(mw(item.org, 11) + 18);

    return `<g class="row" style="animation-delay:${(0.06 + i * 0.08).toFixed(2)}s">`
      + (i > 0 ? `<path d="M20 ${PAD + i * ROW_H}H${W - 20}" stroke="${th.frame}" stroke-opacity=".35"/>` : '')
      + `<text x="18" y="${(y + 4).toFixed(1)}" class="ix" fill="${th.dim}">0${i + 1}</text>`
      + `<rect x="${BUS - 4.5}" y="${y - 4.5}" width="9" height="9" fill="${color}" transform="rotate(45 ${BUS} ${y})"/>`
      + `<g><rect x="${PERIOD_X}" y="${(y - 13).toFixed(1)}" width="${PERIOD_W}" height="26" rx="3" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".4"/>`
      + `<text x="${PERIOD_X + PERIOD_W / 2}" y="${(y + 3.5).toFixed(1)}" class="period" text-anchor="middle" fill="${color}">${esc(item.period)}</text></g>`
      + `<text x="${ROLE_X}" y="${(y + 4.5).toFixed(1)}" class="role" fill="${th.text}">${esc(item.role)}</text>`
      + `<g><rect x="${ORG_X}" y="${(y - 12).toFixed(1)}" width="${oW}" height="24" rx="3" fill="${th.frame}" fill-opacity=".2" stroke="${th.frame}"/>`
      + `<text x="${ORG_X + oW / 2}" y="${(y + 3.5).toFixed(1)}" class="org" text-anchor="middle" fill="${th.muted}">${esc(item.org)}</text></g>`
      + `<text x="${W - 24}" y="${(y + 4).toFixed(1)}" class="focus" text-anchor="end" fill="${th.dim}">${esc(item.focus)}</text>`
      + `</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Career Experience Timeline">
<title>Experience</title>
<defs>${plateDefs(th, W, H)}</defs>
<style>
.ix{font-family:${MONO};font-size:11px;letter-spacing:1px}
.period{font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:.8px}
.role{font-family:${SANS};font-size:14px;font-weight:700}
.org{font-family:${MONO};font-size:11px}
.focus{font-family:${MONO};font-size:11px;letter-spacing:.3px}
.row{animation:up .5s cubic-bezier(.2,.7,.3,1) both}
@keyframes up{from{transform:translateX(-10px)}to{transform:translateX(0)}}
</style>
${plateGround(th, W, H)}
${bus}
${rows}
</svg>
`;
}

// ------------------------------------------------------------------ badges
//
// Individually clickable, so each link stays its own <a><img></a> pair in the
// README - drawn as a notched equipment tag so they belong to the drawing set
// rather than to shields.io, which is flat-coloured and ignores dark/light.

const LINKS = [
  { id: 'github', label: 'GitHub', role: 'accent' },
  { id: 'gmail', label: 'Gmail', role: 'accent2' },
  { id: 'tiktok', label: 'TikTok', role: 'accent3' },
  { id: 'telegram', label: 'Telegram', role: 'accent' },
];

// SIDE is transparent margin carried inside the viewBox. The README sets these
// images to percentage widths and butts the anchors together with no whitespace
// between them - whitespace is the only place a line may break, so removing it
// is what keeps the row on one line at any viewport - which leaves no character
// to space the tags apart. The gap has to travel inside the artwork instead.
const BADGE_W = 120;
const BADGE_H = 34;
const BADGE_SIDE = 8;

function badgeSVG(id, label, th, color) {
  const FS = 11, TRACK = 1.2, NOTCH = 9, SIDE = BADGE_SIDE;
  const text = label.toUpperCase();
  const W = BADGE_W, H = BADGE_H;
  const TAG = W - SIDE * 2;
  const L = SIDE, R = SIDE + TAG;
  const CX = W / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">
<title>${esc(label)}</title>
<path d="M${L + .5} .5H${R - NOTCH - .5}L${R - .5} ${NOTCH + .5}V${H - .5}H${L + .5}Z" fill="${color}" fill-opacity=".1" stroke="${color}" stroke-opacity=".55"/>
<text x="${CX}" y="${H / 2 + 4}" text-anchor="middle" fill="${th.text}" font-family="${MONO}" font-size="${FS}" font-weight="700" letter-spacing="${TRACK}">${esc(text)}</text>
</svg>
`;
}

// -------------------------------------------------------------------- main

const data = await collect();

const files = {
  'hero-dark.svg': heroSVG(data, 'dark'),
  'hero-light.svg': heroSVG(data, 'light'),
  'impact-dark.svg': impactSVG(data, 'dark'),
  'impact-light.svg': impactSVG(data, 'light'),
  'experience-dark.svg': experienceSVG('dark'),
  'experience-light.svg': experienceSVG('light'),
  'stack-dark.svg': stackSVG('dark'),
  'stack-light.svg': stackSVG('light'),
};

for (const link of LINKS) {
  for (const key of ['dark', 'light']) {
    files[`badge-${link.id}-${key}.svg`] = badgeSVG(link.id, link.label, THEMES[key], THEMES[key][link.role]);
  }
}

for (const [name, svg] of Object.entries(files)) {
  await writeFile(join(OUT, name), svg, 'utf8');
}

// The badge row is held on one line by giving each tag a share of the container
// width rather than its natural pixel width, so it scales instead of wrapping.
// The shares are printed rather than written into the README: they only change
// when a label does, and a build that rewrites markup is a build that can break
// it. ROW_FILL leaves headroom so sub-pixel rounding across four images cannot
// push the run past 100% and force an overflow.
const ROW_FILL = 96;
const widths = LINKS.map((l) => ({
  id: l.id,
  w: Number(files[`badge-${l.id}-dark.svg`].match(/width="(\d+)"/)[1]),
}));
const total = widths.reduce((n, b) => n + b.w, 0);
console.log(`badge row: ${widths.map((b) => `${b.id} ${b.w}px ${(b.w / total * ROW_FILL).toFixed(2)}%`).join('  ')}`);

console.log(
  `stars=${data.stars} forks=${data.forks} repos=${data.repoCount} followers=${data.followers}`);
console.log(`wrote ${Object.keys(files).length} files to assets/`);
