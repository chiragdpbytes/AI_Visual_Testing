import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { saveSetup, getSetups, markSynced, deleteSetup } from "./setupStore";
import { ComparisonSetup } from "../types";

const setup = (id: string, createdAt: string): ComparisonSetup => ({
  id,
  name: `Setup ${id}`,
  figmaImageBase64: "data:image/png;base64,AAAA",
  devUrl: "http://localhost:5173",
  environmentLabel: "local",
  viewportWidth: 1280,
  createdAt,
});

describe("setupStore", () => {
  it("saves and lists setups newest-first", async () => {
    await saveSetup(setup("a", "2026-07-01T00:00:00Z"));
    await saveSetup(setup("b", "2026-07-02T00:00:00Z"));
    const all = await getSetups();
    expect(all.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("upserts on same id and records lastSyncedAt", async () => {
    await saveSetup(setup("a", "2026-07-01T00:00:00Z"));
    await markSynced("a", "2026-07-03T12:00:00Z");
    const all = await getSetups();
    expect(all.find((s) => s.id === "a")?.lastSyncedAt).toBe("2026-07-03T12:00:00Z");
  });

  it("deletes a setup", async () => {
    await deleteSetup("a");
    await deleteSetup("b");
    expect(await getSetups()).toHaveLength(0);
  });
});
