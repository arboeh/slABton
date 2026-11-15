import { describe, expect, it } from "vitest";
import de from "../../src/core/locales/de.json";
import en from "../../src/core/locales/en.json";
import { DICTIONARIES, LANGUAGES } from "../../src/core/i18n.js";

const TOKEN_RE = /\{(\w+)\}/g;
const tokens = (text) => [...text.matchAll(TOKEN_RE)].map((m) => m[1]).sort();

describe("locale files", () => {
  it("expose every JSON file through DICTIONARIES and LANGUAGES", () => {
    expect(DICTIONARIES.en).toBe(en);
    expect(DICTIONARIES.de).toBe(de);
    expect(LANGUAGES).toEqual(["en", "de"]);
  });

  it("de has exactly the keys of en", () => {
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it("have the unavailable reasons and the editor label in both languages", () => {
    for (const key of [
      "unavailable.missing", "unavailable.unavailable", "unavailable.unknown", "unavailable.invalid",
      "editor.allow_unavailable_actions",
    ]) {
      expect(typeof en[key], key).toBe("string");
      expect(typeof de[key], key).toBe("string");
    }
  });

  it("only hold non-empty strings", () => {
    for (const dict of [en, de]) {
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, key).toBe("string");
        expect(value.trim(), key).not.toBe("");
      }
    }
  });

  it("use the same {placeholders} in every language", () => {
    for (const key of Object.keys(en)) {
      expect(tokens(de[key]), key).toEqual(tokens(en[key]));
    }
  });
});
