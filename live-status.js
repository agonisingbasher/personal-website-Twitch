/* Le status e seguidores do canal. Sem chave, sem backend: um servico publico
   devolve texto puro. Nada aqui afirma algo que nao conseguiu validar. */
const LIVE_CHANNEL = "agonisingbasher";
const LIVE_BASE = "https://decapi.me/twitch/";
const LIVE_CACHE_KEY = "agonisingbasher-twitch-live";
// URL fixa do preview da Twitch, montada a partir de uma constante nossa: o texto remoto
// nunca entra aqui, entao o --ag-live-shot nao tem superficie de injecao.
const LIVE_SHOT_URL = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${LIVE_CHANNEL}-640x360.jpg`;
const UPTIME_EVERY = 5 * 60 * 1000;
const COUNT_EVERY = 30 * 60 * 1000;
const MIN_GAP = 60 * 1000;
const REQUEST_TIMEOUT = 8000;
const MAX_FAILURES = 2;

const liveStateAttr = document.documentElement;
const badgeValue = document.getElementById("live-value");
const liveTitle = document.getElementById("live-title");
const liveGame = document.getElementById("live-game");
const liveViewers = document.getElementById("live-viewers");
const goalSection = document.getElementById("meta");
const goalCurrent = document.getElementById("goal-current");
const goalTarget = document.getElementById("goal-target");
const goalFill = document.getElementById("goal-fill");
const goalPercent = document.getElementById("goal-percent");
const goalCaption = document.getElementById("goal-caption");
const goalRemaining = document.getElementById("goal-remaining");

if (goalSection && badgeValue) {
  const goal = Number(goalSection.dataset.goal);
  let failures = 0;
  let inFlight = null;
  let lastSuccess = 0;
  let lastUptimeAt = 0;
  let lastCountAt = 0;
  let lastCount = null;

  const readCache = () => {
    try {
      return JSON.parse(sessionStorage.getItem(LIVE_CACHE_KEY)) || null;
    } catch (error) {
      return null;
    }
  };

  const writeCache = (patch) => {
    const next = Object.assign({}, readCache(), patch, { at: Date.now() });
    try {
      sessionStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(next));
    } catch (error) {
      /* sessao cheia ou bloqueada: o polling segue, so perde o throttle */
    }
    return next;
  };

  // Nomes de unidade em ingles, independentemente do idioma do canal.
  const toShortDuration = (raw) => {
    const patterns = [
      [/(\d+)\s*days?/i, "d"],
      [/(\d+)\s*hours?/i, "h"],
      [/(\d+)\s*minutes?/i, "m"],
      [/(\d+)\s*seconds?/i, "s"],
    ];
    const parts = patterns
      .map(([re, suffix]) => {
        const found = re.exec(raw);
        return found && Number(found[1]) > 0 ? `${Number(found[1])}${suffix}` : null;
      })
      .filter(Boolean);
    return parts.length ? parts.join(" ") : raw.replace(/\s+/g, " ").trim();
  };

  const setState = (state) => {
    liveStateAttr.dataset.liveState = state;
  };

  // O rotulo vive no dicionario (translations.goalRemaining); aqui so troca o token.
  const applyRemaining = (remaining) => {
    goalRemaining.dataset.remaining = String(remaining);
    const language = document.documentElement.lang === "en" ? "en" : "pt-BR";
    const template = translations[language].goalRemaining;
    goalRemaining.textContent = template.replace("{remaining}", String(remaining));
  };

  const renderCount = (count) => {
    const target = Number(goalTarget.textContent.replace(/\D/g, "")) || goal;
    const safe = Math.max(0, Math.min(count, target));
    // O separador decimal acompanha o idioma: 98,1% em PT, 98.1% em EN.
    const decimal = document.documentElement.lang === "en" ? "." : ",";
    goalCurrent.textContent = String(count);
    lastCount = count;
    if (goalCaption) goalCaption.textContent = `${count} / ${target}`;
    goalFill.style.setProperty("--ag-goal-progress", String(target ? safe / target : 0));
    goalPercent.textContent = `${target ? ((safe / target) * 100).toFixed(1).replace(".", decimal) : `0${decimal}0`}%`;
    applyRemaining(Math.max(0, target - count));
  };

  const clearLiveMeta = () => {
    liveTitle.textContent = "";
    liveGame.textContent = "";
    liveViewers.textContent = "";
    // A duracao e o segundo texto do badge e o chip so se esconde quando esta vazio:
    // sem limpar, o offline mostraria o ultimo uptime ao lado de OFFLINE.
    badgeValue.textContent = "";
    document.documentElement.style.removeProperty("--ag-live-shot");
  };

  // A arte de fundo so existe enquanto ha stream: offline, o preview da Twitch redireciona
  // para o placeholder deles, entao nao montamos o url em nenhum outro estado.
  const showLiveShot = () => {
    document.documentElement.style.setProperty("--ag-live-shot", `url("${LIVE_SHOT_URL}")`);
  };

  // O titulo do stream e texto remoto: nunca vira HTML.
  const setText = (node, value) => {
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120);
    node.textContent = clean;
  };

  const fetchText = async (endpoint) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(`${LIVE_BASE}${endpoint}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.text()).trim();
    } finally {
      clearTimeout(timer);
    }
  };

  const runCycle = async (force) => {
    const now = Date.now();
    const cache = readCache();
    if (!force && cache && now - cache.at < MIN_GAP && cache.state) {
      applyCache(cache);
      return;
    }
    if (inFlight) return inFlight;

    inFlight = (async () => {
      try {
        const uptime = await fetchText(`uptime/${LIVE_CHANNEL}`);
        const isOffline = /\bis\s+offline\b/i.test(uptime);
        const isUnknown = !uptime || /^user not found/i.test(uptime);
        lastSuccess = Date.now();
        lastUptimeAt = lastSuccess;
        failures = 0;

        if (isUnknown) {
          setState("unknown");
          clearLiveMeta();
          writeCache({ state: "unknown", viewers: null });
          return;
        }

        if (isOffline) {
          setState("offline");
          clearLiveMeta();
          writeCache({ state: "offline", duration: "", title: "", game: "", viewers: null });
          return;
        }

        setState("live");
        const duration = toShortDuration(uptime);
        badgeValue.textContent = duration;
        showLiveShot();
        const [title, game, viewersRaw] = await Promise.all([
          fetchText(`title/${LIVE_CHANNEL}`).catch(() => ""),
          fetchText(`game/${LIVE_CHANNEL}`).catch(() => ""),
          fetchText(`viewercount/${LIVE_CHANNEL}`).catch(() => ""),
        ]);
        // viewercount so devolve numero durante a live; fora dela vem prosa, e prosa nao se pinta.
        const viewers = /^\d+$/.test(viewersRaw) && Number(viewersRaw) <= 500000 ? Number(viewersRaw) : null;
        if (title) setText(liveTitle, title);
        if (game) setText(liveGame, game);
        if (viewers !== null) liveViewers.textContent = String(viewers);
        writeCache({ state: "live", duration, title, game, viewers });
      } catch (error) {
        failures += 1;
        if (failures >= MAX_FAILURES) setState("unknown");
      } finally {
        inFlight = null;
      }
    })();

    return inFlight;
  };

  const runCount = async (force) => {
    const now = Date.now();
    if (!force && lastCountAt && now - lastCountAt < COUNT_EVERY) return;
    try {
      const raw = await fetchText(`followcount/${LIVE_CHANNEL}`);
      if (!/^\d+$/.test(raw)) return; // ex.: "User not found: xyz"
      const count = Number(raw);
      if (count < 1000 || count > 100000) return; // mudou de formato: nao pinte prose
      lastCountAt = Date.now();
      renderCount(count);
      writeCache({ count, countAt: lastCountAt });
    } catch (error) {
      /* mantem o ultimo valor valido exibido */
    }
  };

  const applyCache = (cache) => {
    if (cache.state) setState(cache.state);
    if (cache.state === "live") {
      if (cache.duration) badgeValue.textContent = cache.duration;
      if (cache.title) setText(liveTitle, cache.title);
      if (cache.game) setText(liveGame, cache.game);
      if (cache.viewers !== null && cache.viewers !== undefined) liveViewers.textContent = String(cache.viewers);
      showLiveShot();
    } else {
      clearLiveMeta();
    }
    if (cache.count) renderCount(cache.count);
  };

  // O numero do chip vem do markup (nao da rede), entao vale tambem no file://.
  const markupRemaining = Number(goalCurrent.textContent.replace(/\D/g, ""));
  applyRemaining(goal && Number.isFinite(markupRemaining) ? Math.max(0, goal - markupRemaining) : 0);

  // Ao trocar idioma o motor religa o template cru ({remaining}); refazemos na hora.
  document.addEventListener("site-language-change", () => {
    if (lastCount !== null) renderCount(lastCount);
    else applyRemaining(Number(goalRemaining.dataset.remaining) || 0);
  });

  // file:// bloqueia cross-origin: deixa o fallback estatico do HTML, que ja e honesto.
  if (window.location.protocol === "file:") setState("offline");
  else {
    // Recarregar a pagina nao pode virar request novo: o throttle mora no sessionStorage.
    const cached = readCache();
    const freshState = cached && cached.state && Date.now() - cached.at < MIN_GAP;
    if (freshState) {
      applyCache(cached);
      lastSuccess = cached.at;
      lastUptimeAt = cached.at;
    } else {
      runCycle(true);
    }
    if (cached && cached.count && Date.now() - (cached.countAt || 0) < COUNT_EVERY) {
      lastCountAt = cached.countAt;
      renderCount(cached.count);
    } else {
      runCount(false);
    }
    setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastUptimeAt >= UPTIME_EVERY) runCycle(false);
      if (Date.now() - lastCountAt >= COUNT_EVERY) runCount(false);
    }, 30 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && Date.now() - lastSuccess >= MIN_GAP) runCycle(false);
    });
  }
}
