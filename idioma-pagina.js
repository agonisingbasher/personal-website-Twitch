(function () {
  const navigationTranslations = {
    "pt-BR": { skipContent: "Pular para o conteúdo", languageLabel: "Idioma" },
    en: { skipContent: "Skip to content", languageLabel: "Language" },
    es: { skipContent: "Saltar al contenido", languageLabel: "Idioma" },
    fr: { skipContent: "Aller au contenu", languageLabel: "Langue" }
  };
  const LANGUAGES = ["pt-BR", "en", "es", "fr"];
  const languageStorageKey = "agonisingbasher-twitch-language";
  const languageButtons = document.querySelectorAll("[data-lang-option]");
  const metaDescription = document.querySelector('meta[name="description"]');

  function normalizeLanguage(value) {
    if (value === "pt") return "pt-BR";
    return LANGUAGES.includes(value) ? value : null;
  }

  function readStoredLanguage() {
    try {
      return normalizeLanguage(localStorage.getItem(languageStorageKey));
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
      return null;
    }
  }

  /* Sem ?lang= na URL e sem escolha gravada, o navegador decide: quem abre de Buenos
     Aires ve espanhol, quem abre de Paris ve frances. Um pt de qualquer pais continua
     em pt-BR, que e a unica variante portuguesa que temos. */
  function detectLanguage() {
    const preferred = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const tag of preferred) {
      if (!tag) continue;
      const base = String(tag).toLowerCase().split("-")[0];
      if (base === "pt") return "pt-BR";
      const match = LANGUAGES.find((code) => code.toLowerCase() === base);
      if (match) return match;
    }
    return "pt-BR";
  }

  const requestedLanguage = normalizeLanguage(new URLSearchParams(window.location.search).get("lang"));
  let currentLanguage = requestedLanguage || readStoredLanguage() || detectLanguage();

  const defaults = {
    title: document.title,
    description: metaDescription ? metaDescription.content : "",
    text: new Map(),
    html: new Map(),
    aria: new Map(),
    alt: new Map()
  };
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    defaults.text.set(element, element.textContent);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    defaults.html.set(element, element.innerHTML);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    defaults.aria.set(element, element.getAttribute("aria-label"));
  });
  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    defaults.alt.set(element, element.getAttribute("alt"));
  });

  function restoreDefaults() {
    document.title = defaults.title;
    if (metaDescription) metaDescription.content = defaults.description;
    defaults.text.forEach((value, element) => {
      element.textContent = value;
    });
    defaults.html.forEach((value, element) => {
      element.innerHTML = value;
    });
    defaults.aria.forEach((value, element) => {
      element.setAttribute("aria-label", value);
    });
    defaults.alt.forEach((value, element) => {
      element.setAttribute("alt", value);
    });
  }

  function applyTranslations(content) {
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const value = content[element.dataset.i18n];
      if (value !== undefined) element.textContent = value;
    });
    document.querySelectorAll("[data-i18n-html]").forEach((element) => {
      const value = content[element.dataset.i18nHtml];
      if (value !== undefined) element.innerHTML = value;
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
      const value = content[element.dataset.i18nAriaLabel];
      if (value !== undefined) element.setAttribute("aria-label", value);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      const value = content[element.dataset.i18nAlt];
      if (value !== undefined) element.alt = value;
    });
  }

  function setLanguage(language) {
    currentLanguage = normalizeLanguage(language) || "pt-BR";
    try {
      localStorage.setItem(languageStorageKey, currentLanguage);
    } catch (error) {
      if (error.name !== "SecurityError") throw error;
    }

    const content = window.pageTranslations && window.pageTranslations[currentLanguage];
    restoreDefaults();
    document.documentElement.lang = currentLanguage === "pt-BR" ? "pt-BR" : currentLanguage;

    if (content) {
      if (content.pageTitle) document.title = content.pageTitle;
      if (metaDescription && content.pageDescription) metaDescription.content = content.pageDescription;
      applyTranslations(content);
    }

    applyTranslations(navigationTranslations[currentLanguage]);

    /* O rotulo dos quatro botoes e fixo (PT/EN/ES/FR): o que muda e o estado pressionado. */
    languageButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(normalizeLanguage(button.dataset.langOption) === currentLanguage));
    });

    document.querySelectorAll(".lang-link").forEach((link) => {
      const url = new URL(link.href, window.location.href);
      url.searchParams.set("lang", currentLanguage);
      link.href = url.href;
    });

    const pageUrl = new URL(window.location.href);
    pageUrl.searchParams.set("lang", currentLanguage);
    history.replaceState(null, "", pageUrl);

    document.dispatchEvent(new CustomEvent("languagechange", { detail: { language: currentLanguage } }));
  }

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.langOption));
  });
  setLanguage(currentLanguage);
})();
