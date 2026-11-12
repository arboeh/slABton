import { describe, expect, it } from "vitest";
import { DICTIONARIES, hasTranslation, resolveLanguage, resolveLocale, t, tPlural } from "../../src/core/i18n.js";

describe("resolveLanguage", () => {
  it("uses the base of hass.locale.language", () => {
    expect(resolveLanguage({ locale: { language: "de-DE" } })).toBe("de");
    expect(resolveLanguage({ locale: { language: "EN-gb" } })).toBe("en");
  });

  it("falls back to hass.language, then English", () => {
    expect(resolveLanguage({ language: "de" })).toBe("de");
    expect(resolveLanguage({ locale: { language: "fr" } })).toBe("en");
    expect(resolveLanguage({ locale: { language: "fr" }, language: "de" })).toBe("de");
    expect(resolveLanguage(undefined)).toBe("en");
    expect(resolveLanguage({ locale: { language: 42 } })).toBe("en");
  });
});

describe("resolveLocale", () => {
  it("returns a usable Intl tag and never throws", () => {
    expect(resolveLocale({ locale: { language: "de-DE" } })).toBe("de-DE");
    expect(resolveLocale({ locale: { language: "pt_BR" } })).toBe("pt-BR");
    expect(resolveLocale({ locale: { language: "not a tag!" } })).toBe("en");
    expect(resolveLocale(undefined)).toBe("en");
  });
});

describe("t", () => {
  it("translates and falls back to English, then to the key", () => {
    expect(t("de", "timer.paused")).toBe("Pausiert");
    expect(t("en", "timer.paused")).toBe("Paused");
    expect(t("xx", "timer.paused")).toBe("Paused");
    expect(t("de", "no.such.key")).toBe("no.such.key");
  });

  it("replaces known params only and leaves other tokens", () => {
    expect(t("en", "unit.day.other", { count: 3 })).toBe("3 days");
    expect(t("en", "editor.bar_text")).toContain("{remaining}");
    expect(t("en", "aria.timer", { state: "Running" })).toBe("Running, {remaining}");
  });

  it("does not read inherited properties", () => {
    expect(t("en", "aria.timer", { state: "a", remaining: "b" })).toBe("a, b");
    expect(t("en", "constructor")).toBe("constructor");
    expect(t("en", "unit.day.other", { count: 1, __proto__: { x: 1 } })).toBe("1 days");
  });
});

describe("tPlural", () => {
  it("picks the plural form of the language", () => {
    expect(tPlural("en", "unit.day", 1)).toBe("1 day");
    expect(tPlural("en", "unit.day", 3)).toBe("3 days");
    expect(tPlural("de", "unit.day", 1)).toBe("1 Tag");
    expect(tPlural("de", "unit.day", 3)).toBe("3 Tage");
    expect(tPlural("de", "unit.second", 0)).toBe("0 Sekunden");
  });
});

describe("dictionaries", () => {
  it("have the same keys in every language", () => {
    expect(Object.keys(DICTIONARIES.de).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
  });

  it("report known and unknown keys", () => {
    expect(hasTranslation("de", "editor.mode")).toBe(true);
    expect(hasTranslation("de", "editor.nope")).toBe(false);
  });
});
