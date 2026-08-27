import { describe, expect, it } from "vitest";
import { setActivePalette, getActivePalette } from "../src/lib/activePalette.js";

describe("activePalette", () => {
  it("returns undefined for a chat with no stored palette", () => {
    expect(getActivePalette(999001)).toBeUndefined();
  });

  it("stores and retrieves a palette for a chat", () => {
    setActivePalette(999002, ["#264653", "#F4A261"]);
    expect(getActivePalette(999002)).toEqual(["#264653", "#F4A261"]);
  });

  it("keeps separate chats independent", () => {
    setActivePalette(999003, ["#111111"]);
    setActivePalette(999004, ["#222222"]);
    expect(getActivePalette(999003)).toEqual(["#111111"]);
    expect(getActivePalette(999004)).toEqual(["#222222"]);
  });

  it("overwrites a previous palette for the same chat", () => {
    setActivePalette(999005, ["#AAAAAA"]);
    setActivePalette(999005, ["#BBBBBB"]);
    expect(getActivePalette(999005)).toEqual(["#BBBBBB"]);
  });
});
