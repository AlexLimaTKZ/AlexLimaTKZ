#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const USER = process.env.GITHUB_USER || 'AlexLimaTKZ';
const TOKEN = process.env.GITHUB_TOKEN;
const YEAR = new Date().getUTCFullYear();

if (!TOKEN) throw new Error('GITHUB_TOKEN não informado.');

const query = `
query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){
    login name location followers{totalCount}
    repositories(first:100,ownerAffiliations:OWNER,privacy:PUBLIC,isFork:false,orderBy:{field:UPDATED_AT,direction:DESC}){
      totalCount
      nodes{name description url updatedAt stargazerCount forkCount primaryLanguage{name color}}
    }
    contributionsCollection(from:$from,to:$to){
      totalCommitContributions totalPullRequestContributions totalPullRequestReviewContributions
      contributionCalendar{totalContributions weeks{contributionDays{contributionCount date weekday}}}
    }
  }
}`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'alex-profile-generator',
  },
  body: JSON.stringify({
    query,
    variables: {
      login: USER,
      from: `${YEAR}-01-01T00:00:00Z`,
      to: new Date().toISOString(),
    },
  }),
});

if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
const payload = await response.json();
if (payload.errors?.length) throw new Error(payload.errors.map((e) => e.message).join('; '));
const user = payload.data?.user;
if (!user) throw new Error(`Usuário ${USER} não encontrado.`);

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');

const short = (value = '', max = 70) => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
};

const wrap = (value = '', max = 31) => {
  const words = String(value || 'Projeto em evolução contínua.').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
      if (lines.length === 2) break;
    } else current = next;
  }
  if (current && lines.length < 3) lines.push(current);
  return lines;
};

const repos = user.repositories.nodes.filter((repo) => repo.name.toLowerCase() !== USER.toLowerCase());
const stars = repos.reduce((sum, repo) => sum + repo.stargazerCount, 0);
const forks = repos.reduce((sum, repo) => sum + repo.forkCount, 0);

const langMap = new Map();
for (const repo of repos) {
  if (!repo.primaryLanguage) continue;
  const key = repo.primaryLanguage.name;
  const item = langMap.get(key) || { name: key, color: repo.primaryLanguage.color || '#8b5cf6', count: 0 };
  item.count += 1;
  langMap.set(key, item);
}
const languages = [...langMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);
const langTotal = languages.reduce((sum, item) => sum + item.count, 0) || 1;
for (const item of languages) item.percentage = Math.round(item.count / langTotal * 100);

const preferred = ['alexlima-portfolio', 'Site-TKZ', 'gerador-orcamentos', 'AURACS', 'Minimal-Api'];
const projects = [
  ...preferred.map((name) => repos.find((repo) => repo.name.toLowerCase() === name.toLowerCase())).filter(Boolean),
  ...[...repos].sort((a, b) => (b.stargazerCount - a.stargazerCount) || (new Date(b.updatedAt) - new Date(a.updatedAt))),
].filter((repo, index, array) => array.findIndex((item) => item.name === repo.name) === index).slice(0, 3);

const c = user.contributionsCollection;
const techs = ['NEXT.JS', 'TYPESCRIPT', 'REACT', 'NODE.JS', 'POSTGRESQL', 'PRISMA', 'SUPABASE', 'C# / .NET'];
const accents = ['#7c3aed', '#22d3ee', '#a855f7', '#38bdf8'];

let pillX = 42;
const pills = techs.map((tech, index) => {
  const width = Math.max(86, tech.length * 7.3 + 28);
  const x = pillX;
  pillX += width + 8;
  return `<g><rect x="${x}" y="276" width="${width}" height="32" rx="16" class="chip" stroke="${accents[index % 4]}"/><text x="${x + width / 2}" y="297" text-anchor="middle" class="chipText" fill="${accents[index % 4]}">${esc(tech)}</text></g>`;
}).join('');

const statItems = [
  [user.repositories.totalCount, 'REPOSITÓRIOS', '#22d3ee'],
  [c.contributionCalendar.totalContributions, `CONTRIBUIÇÕES ${YEAR}`, '#a855f7'],
  [user.followers.totalCount, 'SEGUIDORES', '#38bdf8'],
  [stars, 'ESTRELAS', '#facc15'],
];
const stats = statItems.map(([value, label, color], index) => {
  const x = 48 + index * 201;
  return `<g><rect x="${x}" y="346" width="185" height="105" rx="18" class="panel"/><circle cx="${x + 25}" cy="374" r="5" fill="${color}" class="pulse"/><text x="${x + 20}" y="416" class="stat">${value}</text><text x="${x + 20}" y="438" class="label" fill="${color}">${esc(label)}</text></g>`;
}).join('');

let barX = 61;
const bar = languages.map((lang, index) => {
  const width = index === languages.length - 1 ? 778 - (barX - 61) : Math.max(4, 778 * lang.percentage / 100);
  const block = `<rect x="${barX}" y="523" width="${width}" height="12" rx="6" fill="${esc(lang.color)}"/>`;
  barX += width;
  return block;
}).join('');

const legend = languages.map((lang, index) => {
  const col = index % 4;
  const row = Math.floor(index / 4);
  const x = 67 + col * 202;
  const y = 572 + row * 33;
  return `<g><circle cx="${x}" cy="${y - 4}" r="5" fill="${esc(lang.color)}"/><text x="${x + 14}" y="${y}" class="legend">${esc(short(lang.name, 17))}</text><text x="${x + 160}" y="${y}" text-anchor="end" class="muted">${lang.percentage}%</text></g>`;
}).join('');

const levels = ['#11152a', '#25205a', '#5030a8', '#7c3aed', '#22d3ee'];
const weeks = c.contributionCalendar.weeks.slice(-52);
let calendar = '';
weeks.forEach((week, weekIndex) => {
  week.contributionDays.forEach((day) => {
    const n = day.contributionCount;
    const level = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
    calendar += `<rect x="${108 + weekIndex * 13}" y="${713 + day.weekday * 13}" width="10" height="10" rx="2.5" fill="${levels[level]}"><title>${esc(day.date)}: ${n} contribuições</title></rect>`;
  });
});

const cards = projects.map((project, index) => {
  const x = 48 + index * 268;
  const y = 892;
  const accent = accents[index % 4];
  const description = wrap(project.description).map((line, i) => `<text x="${x + 21}" y="${y + 83 + i * 19}" class="desc">${esc(line)}</text>`).join('');
  return `<g class="float" style="animation-delay:${index * .35}s"><rect x="${x}" y="${y}" width="250" height="215" rx="22" class="panel" stroke="${accent}" stroke-opacity=".4"/><rect x="${x}" y="${y}" width="5" height="215" rx="2.5" fill="${accent}"/><text x="${x + 20}" y="${y + 38}" class="index" fill="${accent}">0${index + 1}</text><text x="${x + 57}" y="${y + 38}" class="project">${esc(short(project.name, 20))}</text>${description}<line x1="${x + 20}" y1="${y + 157}" x2="${x + 230}" y2="${y + 157}" stroke="#252944"/><circle cx="${x + 25}" cy="${y + 185}" r="5" fill="${esc(project.primaryLanguage?.color || accent)}"/><text x="${x + 37}" y="${y + 189}" class="meta">${esc(project.primaryLanguage?.name || 'Projeto')}</text><text x="${x + 230}" y="${y + 189}" text-anchor="end" class="meta">★ ${project.stargazerCount}  ⑂ ${project.forkCount}</text></g>`;
}).join('');

const svg = `<!-- Gerado automaticamente por generate-profile.mjs -->
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1280" viewBox="0 0 900 1280" role="img" aria-labelledby="title desc">
<title id="title">Perfil GitHub de Alex Lima TKZ</title><desc id="desc">Painel animado com tecnologias, métricas, atividade e projetos.</desc>
<style>
text{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}.eyebrow{font-size:11px;font-weight:800;letter-spacing:5px;fill:#67e8f9}.name{font-size:65px;font-weight:950;letter-spacing:4px;fill:#f8fafc}.role{font-size:15px;font-weight:800;letter-spacing:4px;fill:#c4b5fd}.bio{font-size:13px;font-weight:500;fill:#9ca3bf}.muted,.meta{font-size:9px;font-weight:750;fill:#747a98}.section{font-size:11px;font-weight:900;letter-spacing:4px;fill:#67e8f9}.chip{fill:#0d1022;stroke-opacity:.45}.chipText{font-size:9px;font-weight:900;letter-spacing:1px}.panel{fill:#0b0e1d;stroke:#272b48}.stat{font-size:29px;font-weight:950;fill:#f8fafc}.label{font-size:8px;font-weight:900;letter-spacing:1.3px}.legend{font-size:11px;font-weight:750;fill:#d6d8e8}.index{font-size:10px;font-weight:950;letter-spacing:2px}.project{font-size:15px;font-weight:900;fill:#f3f4f6}.desc{font-size:10.5px;font-weight:500;fill:#9ca3bf}.orbA{animation:a 9s ease-in-out infinite}.orbB{animation:b 11s ease-in-out infinite}.scan{animation:scan 5.8s linear infinite}.pulse{animation:pulse 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}.float{animation:float 6s ease-in-out infinite}@keyframes a{50%{transform:translate(28px,-12px) scale(1.08)}}@keyframes b{50%{transform:translate(-34px,18px)}}@keyframes scan{to{transform:translateX(1200px)}}@keyframes pulse{50%{transform:scale(1.6)}}@keyframes float{50%{transform:translateY(-5px)}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs><radialGradient id="ga"><stop stop-color="#7c3aed" stop-opacity=".58"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient><radialGradient id="gb"><stop stop-color="#22d3ee" stop-opacity=".43"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient><linearGradient id="sg"><stop stop-color="#22d3ee" stop-opacity="0"/><stop offset=".5" stop-color="#c4b5fd" stop-opacity=".38"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient><pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#8b5cf6" stroke-opacity=".055"/></pattern></defs>
<rect width="900" height="1280" rx="30" fill="#060713"/><rect x="1" y="1" width="898" height="1278" rx="29" fill="url(#grid)" stroke="#3c2b71" stroke-opacity=".5"/><ellipse class="orbA" cx="250" cy="130" rx="250" ry="150" fill="url(#ga)"/><ellipse class="orbB" cx="680" cy="150" rx="235" ry="140" fill="url(#gb)"/><rect class="scan" x="-320" y="125" width="320" height="42" fill="url(#sg)"/>
<text x="450" y="62" text-anchor="middle" class="eyebrow">SOFTWARE • PRODUTO • LIDERANÇA</text><text x="450" y="145" text-anchor="middle" class="name">ALEX // TKZ</text><text x="450" y="184" text-anchor="middle" class="role">FULL-STACK DEVELOPER  |  TECH LEAD</text><text x="450" y="217" text-anchor="middle" class="bio">Construindo sistemas úteis, experiências claras e equipes que entregam.</text><text x="450" y="243" text-anchor="middle" class="muted">TERESINA • BRASIL  /  github.com/${esc(user.login)}</text>
${pills}<line x1="48" y1="329" x2="852" y2="329" stroke="#282b47"/>${stats}
<line x1="48" y1="485" x2="852" y2="485" stroke="#282b47"/><text x="61" y="510" class="section">STACK ANALYTICS</text><text x="839" y="510" text-anchor="end" class="muted">LINGUAGEM PRINCIPAL POR REPOSITÓRIO PÚBLICO</text><rect x="61" y="523" width="778" height="12" rx="6" fill="#15182e"/>${bar}${legend}
<line x1="48" y1="652" x2="852" y2="652" stroke="#282b47"/><text x="61" y="680" class="section">ACTIVITY PULSE</text><text x="839" y="680" text-anchor="end" class="muted">${c.totalCommitContributions} COMMITS • ${c.totalPullRequestContributions} PRs • ${c.totalPullRequestReviewContributions} REVIEWS EM ${YEAR}</text>${calendar}<text x="61" y="834" class="muted">MENOS</text>${levels.map((color, i) => `<rect x="108" y="${823 + i * 0}" width="0" height="0" fill="${color}"/>`).join('')}<text x="839" y="834" text-anchor="end" class="muted">${c.contributionCalendar.totalContributions} CONTRIBUIÇÕES</text>
<line x1="48" y1="854" x2="852" y2="854" stroke="#282b47"/><text x="61" y="880" class="section">FEATURED BUILDS</text><text x="839" y="880" text-anchor="end" class="muted">PROJETOS PÚBLICOS SELECIONADOS</text>${cards}
<rect x="48" y="1142" width="804" height="78" rx="19" class="panel"/><text x="71" y="1172" class="section">CURRENT MISSION</text><text x="71" y="1198" class="bio">Criar produtos com IA sem abrir mão de arquitetura, testes, segurança e responsabilidade técnica.</text><circle cx="819" cy="1181" r="9" fill="#22d3ee" fill-opacity=".16" stroke="#22d3ee"/><circle cx="819" cy="1181" r="3" fill="#22d3ee" class="pulse"/><text x="450" y="1250" text-anchor="middle" class="muted">ALEX LIMA TKZ • BUILD WITH CLARITY • LEAD WITH RESPONSIBILITY</text>
</svg>`;

const outDir = path.resolve('.github/assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'profile.svg'), svg, 'utf8');
console.log(`Perfil atualizado para @${USER}. Stars: ${stars}; Forks: ${forks}.`);
