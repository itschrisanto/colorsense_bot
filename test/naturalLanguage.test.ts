import { describe, expect, it } from "vitest";
import { detectIntent, extractHexCodes } from "../src/commands/naturalLanguage.js";

describe("extractHexCodes", () => {
  it("finds and normalizes hex codes that have a leading #", () => {
    expect(extractHexCodes("try #1f5313 and #F4A261")).toEqual(["#1F5313", "#F4A261"]);
  });

  it("ignores invalid-length tokens", () => {
    expect(extractHexCodes("not a color: #12345 or #gggggg")).toEqual([]);
  });

  it("ignores bare hex-like text with no leading #, to avoid false positives on ordinary words", () => {
    // "facade" and "deface" are valid hex digits but are plainly English words.
    expect(extractHexCodes("that's a nice facade")).toEqual([]);
    expect(extractHexCodes("don't deface the sign")).toEqual([]);
    expect(extractHexCodes("f4a261")).toEqual([]);
  });
});

describe("detectIntent", () => {
  it("detects a photo-extraction nudge", () => {
    expect(detectIntent("can you extract colors from this photo")).toEqual({ type: "photoNudge" });
  });

  it("detects a contrast/accessibility question with no colors given", () => {
    expect(detectIntent("is this accessible enough, check the contrast")).toEqual({ type: "contrast" });
  });

  it("detects a contrast request and carries the two hexes when given", () => {
    expect(detectIntent("check the contrast of #264653 and #F4A261")).toEqual({
      type: "contrast",
      hexes: ["#264653", "#F4A261"],
    });
  });

  it("falls back to the active palette's first two colors for contrast when none are in the message", () => {
    expect(detectIntent("check the contrast", ["#264653", "#F4A261", "#2A9D8F"])).toEqual({
      type: "contrast",
      hexes: ["#264653", "#F4A261"],
    });
  });

  it("detects a lauma mention and nudges toward the slash command", () => {
    expect(detectIntent("can I talk to lauma")).toEqual({ type: "laumaNudge" });
    expect(detectIntent("chat with Lauma")).toEqual({ type: "laumaNudge" });
  });

  it("detects an svg-recolor mention from svg/vector words alone", () => {
    expect(detectIntent("can you recolor my svg")).toEqual({ type: "svgRecolor" });
    expect(detectIntent("does this work with vector files")).toEqual({ type: "svgRecolor" });
  });

  it("detects an svg-recolor mention from recolor + logo/icon", () => {
    expect(detectIntent("recolor my logo with this palette")).toEqual({ type: "svgRecolor" });
    expect(detectIntent("can you re-color this icon")).toEqual({ type: "svgRecolor" });
  });

  it("does not treat 'logo' or 'recolor' alone as an svg-recolor mention", () => {
    expect(detectIntent("I need a new logo")).not.toEqual({ type: "svgRecolor" });
    expect(detectIntent("recolor this palette for me")).not.toEqual({ type: "svgRecolor" });
  });

  it("detects a trending request", () => {
    expect(detectIntent("what's trending right now")).toEqual({ type: "trending" });
  });

  it("detects a search request and strips filler words", () => {
    const intent = detectIntent("search for sunset palettes please");
    expect(intent).toEqual({ type: "search", query: "sunset" });
  });

  it("detects a harmony request from a keyword plus one hex", () => {
    expect(detectIntent("build me a color scheme with #1F5313")).toEqual({ type: "harmony", hex: "#1F5313" });
  });

  it("detects a health/score request from a keyword plus multiple hexes", () => {
    const intent = detectIntent("score this palette #264653 #F4A261 #2A9D8F");
    expect(intent).toEqual({ type: "health", hexes: ["#264653", "#F4A261", "#2A9D8F"] });
  });

  it("falls back to harmony for a single bare hex with no keyword", () => {
    expect(detectIntent("#1F5313")).toEqual({ type: "harmony", hex: "#1F5313" });
  });

  it("falls back to health for multiple bare hexes with no keyword", () => {
    const intent = detectIntent("#264653 #F4A261");
    expect(intent).toEqual({ type: "health", hexes: ["#264653", "#F4A261"] });
  });

  it("returns unknown for unrelated chit-chat", () => {
    expect(detectIntent("good morning!")).toEqual({ type: "unknown" });
  });

  it("falls back to the active palette for a health request with no hexes in the message", () => {
    const intent = detectIntent("Can you score that palette?", ["#264653", "#F4A261"]);
    expect(intent).toEqual({ type: "health", hexes: ["#264653", "#F4A261"] });
  });

  it("returns unknown for a health request with no hexes and no active palette", () => {
    expect(detectIntent("Can you score that palette?")).toEqual({ type: "unknown" });
  });

  it("falls back to the active palette's first color for a harmony request with no hex", () => {
    const intent = detectIntent("build a scheme from that", ["#1F5313", "#E9C46A"]);
    expect(intent).toEqual({ type: "harmony", hex: "#1F5313" });
  });

  it("prefers hexes actually in the message over the active palette", () => {
    const intent = detectIntent("score #000000 #FFFFFF", ["#264653", "#F4A261"]);
    expect(intent).toEqual({ type: "health", hexes: ["#000000", "#FFFFFF"] });
  });
});
