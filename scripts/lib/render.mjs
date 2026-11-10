// Turns the page model into the HTML fragments that fill src/index.template.html. Pure: no I/O.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>';
const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>';
const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>';

/** Replaces every {{NAME}}; throws when the template asks for a value that was not given. */
export function fillTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (m, name) => {
    if (!(name in values)) throw new Error(`template placeholder {{${name}}} has no value`);
    return values[name];
  });
}

export function renderNav(model, config) {
  const links = [['latest', '最新'], ...model.shows.map((s) => [s.key, s.name]), ['shorts', model.shorts.name], ['about', `关于${config.host.name}`], ['connect', '合作']];
  return links.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join('\n      ');
}

// The document inside the player iframe: the thumbnail and a play button; clicking loads the real YouTube player.
// Its colors are literals because an iframe document cannot read the parent page's CSS variables.
function playerSrcdoc(v) {
  const css = '*{margin:0;padding:0}html,body{height:100%;overflow:hidden;background:#0A0E0F}'
    + 'a{position:absolute;inset:0;display:block}img{width:100%;height:100%;object-fit:cover}'
    + 'b{position:absolute;left:18px;bottom:18px;width:64px;height:64px;border-radius:50%;background:#C62828;box-shadow:0 6px 20px rgba(10,14,15,.3)}'
    + 'b::after{content:"";position:absolute;left:25px;top:20px;border-style:solid;border-width:12px 0 12px 19px;border-color:transparent transparent transparent #fff}'
    + 'a:hover b{background:#A61F1F}'
    + 'i{position:absolute;right:10px;bottom:10px;padding:1px 6px;border-radius:4px;background:rgba(10,14,15,.78);color:#fff;font:12px/1.5 system-ui,sans-serif;font-style:normal}'
    + '@media (max-width:560px){b{left:12px;bottom:12px;width:52px;height:52px}b::after{left:20px;top:16px;border-width:10px 0 10px 16px}}';
  const embed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0`;
  return `<meta name="referrer" content="strict-origin-when-cross-origin"><style>${css}</style>`
    + `<a href="${esc(embed)}" aria-label="播放：${esc(v.title)}"><img src="${esc(v.thumbLarge)}" alt=""><b></b><i>${esc(v.duration)}</i></a>`;
}

export function renderLatest(v, model) {
  return `<iframe class="player" title="${esc(v.title)}" srcdoc="${esc(playerSrcdoc(v))}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  <div class="latest-text">
    <p class="kicker"><span class="tag-new">最新一期</span><span>${esc(v.showName)} · 第${v.ep}期</span></p>
    <h2 class="latest-title">${esc(v.title)}</h2>
    <p class="meta"><span class="nw">${esc(v.date)}</span> · <span class="nw">${esc(v.duration)}</span> · <span class="nw">${esc(v.views)}</span></p>${v.description ? `
    <p class="desc">${esc(v.description)}</p>` : ''}
    <div class="actions">
      <a class="btn btn-red" href="${esc(v.url)}">${PLAY}在 YouTube 观看</a>
      <a class="btn btn-ghost" href="${esc(model.subscribeUrl)}">订阅频道</a>
    </div>
  </div>`;
}

export function renderSchedule(model) {
  const cells = model.shows.filter((s) => s.airing).map((s) => `<div class="sched-item">
      <div class="when"><span>${esc(s.airing.label)}</span><strong>${esc(s.airing.value)}</strong></div>
      <div><div class="sched-show">${esc(s.name)}</div><div class="meta">${esc(s.airing.note)}</div></div>
    </div>`);
  cells.push(`<a class="sched-item" href="${esc(model.subscribeUrl)}">
      ${BELL}
      <div><div class="sched-show">订阅并打开小铃铛</div><div class="meta">新节目上线第一时间通知你</div></div>
    </a>`);
  return cells.join('\n    ');
}

function card(c) {
  return `<a class="card" href="${esc(c.url)}">
      <span class="thumb"><img src="${esc(c.thumb)}" alt="" width="640" height="360" loading="lazy"><span class="dur">${esc(c.duration)}</span></span>
      <span class="card-title">${esc(c.title)}</span>
      <span class="card-meta">第${c.ep}期 · ${esc(c.date)} · ${esc(c.views)}</span>
    </a>`;
}

// Same size and structure as a video card, so a partly filled row never shows a large empty box.
function filler(f, show, model) {
  return `<a class="card card-next" href="${esc(model.subscribeUrl)}">
      <span class="thumb next-box"><span class="next-label">下一期</span><span class="next-when">${esc(f.when)}</span><span class="next-note">${esc(f.note)}</span></span>
      <span class="card-title">订阅，开播提醒 →</span>
      <span class="card-meta">${esc(show.name)} · 第${f.ep}期</span>
    </a>`;
}

export function renderShows(model) {
  return model.shows.map((s) => `<section id="${esc(s.key)}" class="wrap shelf">
  <div class="shelf-head">
    <div>
      <p class="eyebrow">${esc(s.eyebrow)}</p>
      <h2>${esc(s.name)}</h2>${s.sub ? `
      <p class="sub">${esc(s.sub)}</p>` : ''}
    </div>${s.total ? `
    <a class="more" href="${esc(s.url)}">全部 ${s.total} 期 →</a>` : ''}
  </div>
  <div class="cards">
    ${[...s.cards.map(card), ...(s.filler ? [filler(s.filler, s, model)] : [])].join('\n    ')}
  </div>
</section>`).join('\n\n');
}

export function renderShorts(model) {
  const sh = model.shorts;
  if (!sh.cards.length) return '';
  return `<section id="shorts" class="wrap shelf">
  <div class="shelf-head">
    <div>
      <p class="eyebrow">${esc(sh.eyebrow)}</p>
      <h2>${esc(sh.name)}</h2>
    </div>
    <a class="more" href="${esc(sh.url)}">看更多 →</a>
  </div>
  <div class="cards shorts">
    ${sh.cards.map((c) => `<a class="card" href="${esc(c.url)}"><span class="thumb"><img src="${esc(c.thumb)}" alt="" width="360" height="640" loading="lazy"></span><span class="card-title">${esc(c.title)}</span><span class="card-meta">${esc(c.views)}</span></a>`).join('\n    ')}
  </div>
</section>`;
}

export function renderAbout(config, model, photo) {
  const a = config.about;
  return `<img class="host" src="${esc(photo)}" alt="${esc(config.host.name)} ${esc(config.host.alternateName || '')}" width="720" height="1080" loading="lazy">
  <div class="about-text">
    <p class="eyebrow">${esc(a.eyebrow)}</p>
    <h2>${esc(a.heading)}</h2>
    ${a.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n    ')}${a.stats?.length ? `
    <dl class="stats">
      ${a.stats.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('\n      ')}
    </dl>` : ''}
    <div><a class="btn btn-red" href="${esc(model.subscribeUrl)}">${PLAY}订阅「大道」</a></div>
  </div>`;
}

function icon(icons, name, wide) {
  const d = icons[name];
  if (!d) throw new Error(`src/icons.json has no icon "${name}"`);
  return `<svg${wide ? ' class="wide"' : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="${esc(d)}" fill="currentColor"></path></svg>`;
}

export function renderConnect(config, icons) {
  const c = config.collab;
  const tiles = config.platforms.map((p) => {
    const inner = `<span class="tile-icon">${icon(icons, p.icon, p.wide)}</span><span class="tile-text"><span class="tile-name">${esc(p.name)}${p.url ? ' ↗' : ''}</span><span class="tile-handle">${esc(p.handle)}</span></span>`;
    return p.url ? `<li><a class="tile" href="${esc(p.url)}">${inner}</a></li>` : `<li><div class="tile">${inner}</div></li>`;
  });
  return `<div class="collab">
      <p class="eyebrow">${esc(c.eyebrow)}</p>
      <h2>${esc(c.heading)}</h2>
      <p class="sub">${esc(c.text)}</p>
      <a class="mail" href="mailto:${esc(config.email)}">${MAIL}${esc(config.email)}</a>
    </div>
    <div class="follow">
      <p class="eyebrow">在其他平台关注${esc(config.host.name)}</p>
      <ul class="tiles">
        ${tiles.join('\n        ')}
      </ul>
    </div>`;
}

export function seoHead(config, { siteUrl = '', assetBase = '' } = {}) {
  const id = (frag) => `${siteUrl}/#${frag}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': id('org'), name: config.siteName, ...(siteUrl && { url: `${siteUrl}/` }), sameAs: config.platforms.filter((p) => p.url).map((p) => p.url) },
      { '@type': 'Person', '@id': id('host'), name: config.host.name, alternateName: config.host.alternateName, worksFor: { '@id': id('org') }, sameAs: [`https://www.youtube.com/${config.channel.handle}`] },
    ],
  };
  const meta = (attr, key, val) => `<meta ${attr}="${key}" content="${esc(val)}">`;
  return [
    `<title>${esc(config.siteName)}</title>`,
    meta('name', 'description', config.description),
    siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}/">` : '<meta name="robots" content="noindex, nofollow">',
    '<link rel="icon" type="image/png" href="/favicon.png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', config.siteName),
    meta('property', 'og:locale', 'zh_CN'),
    meta('property', 'og:title', config.siteName),
    meta('property', 'og:description', config.description),
    ...(siteUrl ? [meta('property', 'og:url', `${siteUrl}/`)] : []),
    meta('property', 'og:image', `${assetBase}/og.jpg`),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('name', 'twitter:card', 'summary_large_image'),
    `<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`,
  ].join('\n');
}
