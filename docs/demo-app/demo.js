// Docs demo: YAML editor on the left, live slabton-card on the right.
(function () {
  const EXAMPLES = window.SLABTON_EXAMPLES;
  const i18n = window.SLABTON_I18N;
  const EXAMPLE_LABELS = window.SLABTON_EXAMPLE_LABELS?.[i18n.language] ?? {};
  const { hass } = window.SLABTON_MOCK;
  const DEBOUNCE_MS = 300;
  const LOG_LIMIT = 6;

  const select = document.getElementById("example");
  const editor = document.getElementById("yaml");
  const stage = document.getElementById("stage");
  const errorBox = document.getElementById("error");
  const logList = document.getElementById("log");
  const themeButton = document.getElementById("theme");
  const copyButton = document.getElementById("copy");

  let card = null;
  let timer = 0;

  function setError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function parseConfig(text) {
    const parsed = window.jsyaml.load(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(i18n.t("notAMap"));
    }
    return { type: "custom:slabton-card", ...parsed };
  }

  function render() {
    let config;
    try {
      config = parseConfig(editor.value);
    } catch (error) {
      setError(error.message);
      return;
    }
    const next = document.createElement("slabton-card");
    try {
      next.setConfig(config);
    } catch (error) {
      setError(error.message);
      return;
    }
    setError("");
    next.hass = hass;
    next.addEventListener("hass-more-info", (event) => log(`more-info: ${event.detail.entityId}`));
    card?.remove();
    stage.appendChild(next);
    card = next;
  }

  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(render, DEBOUNCE_MS);
  }

  function log(message) {
    const item = document.createElement("li");
    item.textContent = message;
    logList.prepend(item);
    while (logList.children.length > LOG_LIMIT) logList.lastChild.remove();
  }

  function formatCall({ domain, service, data, target }) {
    const args = { ...(target ?? {}), ...(data ?? {}) };
    const text = Object.keys(args).length ? ` ${JSON.stringify(args)}` : "";
    return `${domain}.${service}${text}`;
  }

  function loadExample(id) {
    const example = EXAMPLES.find((item) => item.id === id) ?? EXAMPLES[0];
    editor.value = example.yaml;
    history.replaceState(null, "", `#${example.id}`);
    render();
  }

  function applyTheme(dark) {
    document.body.classList.toggle("dark", dark);
    themeButton.setAttribute("aria-pressed", String(dark));
    themeButton.textContent = i18n.t(dark ? "light" : "dark");
  }

  function initialTheme() {
    const param = new URLSearchParams(location.search).get("theme");
    if (param) return param === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(editor.value);
      copyButton.textContent = i18n.t("copied");
    } catch {
      editor.select();
      copyButton.textContent = i18n.t("selectCopy");
    }
    setTimeout(() => { copyButton.textContent = i18n.t("copy"); }, 1500);
  }

  for (const example of EXAMPLES) {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = EXAMPLE_LABELS[example.id] ?? example.label;
    select.appendChild(option);
  }

  select.addEventListener("change", () => loadExample(select.value));
  editor.addEventListener("input", scheduleRender);
  themeButton.addEventListener("click", () => applyTheme(!document.body.classList.contains("dark")));
  copyButton.addEventListener("click", copyConfig);
  document.addEventListener("mock-service-call", (event) => log(formatCall(event.detail)));
  document.addEventListener("mock-hass-changed", () => { if (card) card.hass = hass; });

  applyTheme(initialTheme());
  const start = location.hash.slice(1);
  select.value = EXAMPLES.some((item) => item.id === start) ? start : EXAMPLES[0].id;
  loadExample(select.value);
})();
