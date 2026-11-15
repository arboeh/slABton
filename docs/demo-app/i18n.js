// UI strings of the docs demo. Add a language by adding one entry to STRINGS
// (and optionally to window.SLABTON_EXAMPLE_LABELS in examples.js).
(function () {
  const STRINGS = {
    en: {
      configuration: "Configuration", example: "Example", yamlLabel: "Card configuration in YAML",
      copy: "Copy YAML", copied: "Copied", selectCopy: "Select and copy", card: "Card", calls: "Service calls",
      dark: "Dark", light: "Light", notAMap: "The configuration must be a YAML map.",
      hint: "Demo data only, no Home Assistant needed. Drag, tap, double tap and hold work as in a dashboard.",
    },
    de: {
      configuration: "Konfiguration", example: "Beispiel", yamlLabel: "Kartenkonfiguration in YAML",
      copy: "YAML kopieren", copied: "Kopiert", selectCopy: "Markieren und kopieren", card: "Karte", calls: "Service-Aufrufe",
      dark: "Dunkel", light: "Hell", notAMap: "Die Konfiguration muss ein YAML-Objekt sein.",
      hint: "Nur Demo-Daten, Home Assistant ist nicht nötig. Ziehen, Tippen, Doppeltippen und Halten funktionieren wie im Dashboard.",
    },
  };
  const DEFAULT_LANGUAGE = "en";

  function pickLanguage() {
    const wanted = new URLSearchParams(location.search).get("lang") || navigator.language || DEFAULT_LANGUAGE;
    const short = wanted.toLowerCase().split("-")[0];
    return STRINGS[short] ? short : DEFAULT_LANGUAGE;
  }

  const language = pickLanguage();
  const strings = { ...STRINGS[DEFAULT_LANGUAGE], ...STRINGS[language] };
  document.documentElement.lang = language;
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = strings[el.dataset.i18n];
  for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", strings[el.dataset.i18nAria]);
  window.SLABTON_I18N = { language, t: (key) => strings[key] };
})();
