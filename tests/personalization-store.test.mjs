import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  existsSync as fExists, mkdirSync as fMkdir, readFileSync as fRead, writeFileSync as fWrite,
  renameSync as fRename, unlinkSync as fUnlink, readdirSync as fReaddir, rmdirSync as fRmdir,
  statSync as fStat, statfsSync as fStatfs, copyFileSync as fCopy,
  openSync as fOpen, closeSync as fClose,
} from "node:fs";
import { createPersonalizationStore } from "../src/host/personalization/store.js";

const REAL_FS = {
  existsSync: fExists, mkdirSync: fMkdir, readFileSync: fRead, writeFileSync: fWrite,
  renameSync: fRename, unlinkSync: fUnlink, readdirSync: fReaddir, rmdirSync: fRmdir,
  statSync: fStat, statfsSync: fStatfs, copyFileSync: fCopy,
  openSync: fOpen, closeSync: fClose,
};

const NOW = 1_700_000_000_000;
const USER_ID_SHAPE = /^u_[0-9a-f]{32}$/;

function tempDir() {
  return mkdtempSync(join(tmpdir(), "dsh-skins-store-"));
}

function makeStore(dir, fsOverrides = {}, profile = "web") {
  return createPersonalizationStore({
    dataDir: dir,
    profile,
    now: () => NOW,
    fs: { ...REAL_FS, ...fsOverrides },
  });
}

function pngBytes(width = 10, height = 10, padding = 0) {
  const header = Buffer.alloc(24);
  header.write("\x89PNG\r\n\x1a\n", 0, "latin1");
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "latin1");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return Buffer.concat([header, Buffer.alloc(padding)]);
}

function gifBytes(width, height) {
  const b = Buffer.alloc(10);
  b.write("GIF89a", 0, "latin1");
  b.writeUInt16LE(width, 6);
  b.writeUInt16LE(height, 8);
  return b;
}

function webpAnimated() {
  const b = Buffer.alloc(34);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(22, 4);
  b.write("WEBP", 8, "latin1");
  b.write("VP8X", 12, "latin1");
  b.writeUInt32LE(10, 16);
  b[20] = 0x12; // animation flag
  return b;
}

function setOverride(store, skinId, key, value) {
  return store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [{ op: "set", skinId, key, value }],
  });
}

test("load-time normalization drops overrides equal to the factory default (v1.0.0 ruling)", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 1,
    revision: 41,
    skins: { meirenzhi: {
      wallpaper: "builtin:meirenzhi:yuntai", // equals the factory default → dropped
      slogan: { zh: "自定标语", en: "custom" }, // differs → kept
    }, openbmc: {
      // factory-equal locale override: fresh objects can never be `===`, the
      // compare must be structural (rehearsal finding, pre-1.0.0)
      slogan: { zh: "察于未萌 · 治于未乱", en: "Govern before the storm" },
    } },
    library: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.snapshot().mode, "normal", "normal path, not recovery"); // lazy load: snapshot triggers load + normalize
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  assert.deepEqual(state.skins.meirenzhi, { slogan: { zh: "自定标语", en: "custom" } },
    "default-equal override removed, real override kept");
  assert.equal(state.skins.openbmc, undefined,
    "factory-equal locale override dropped (structural comparison)");
  assert.equal(state.revision, 42, "the removal bumps the revision once");
  assert.equal(store.snapshot().mode, "normal", "normal path, not recovery");
});

test("Desktop load normalization removes factory 66 but retains explicitly chosen 35; Web does the reverse", () => {
  for (const [profile, factory, custom] of [["desktop", 66, 35], ["web", 35, 55]]) {
    const dir = tempDir();
    writeFileSync(join(dir, "state.json"), JSON.stringify({
      configVersion: 1, revision: 4,
      skins: { meirenzhi: { panelOpacity: factory } }, library: {},
    }));
    assert.deepEqual(makeStore(dir, {}, profile).snapshot().skins, {}, `${profile}: default-equal override is removed`);
    writeFileSync(join(dir, "state.json"), JSON.stringify({
      configVersion: 1, revision: 4,
      skins: { meirenzhi: { panelOpacity: custom } }, library: {},
    }));
    const persisted = makeStore(dir, {}, profile).snapshot();
    assert.deepEqual(persisted.skins.meirenzhi, { panelOpacity: custom }, `${profile}: custom choice survives boot`);
    assert.equal(persisted.revision, 4, `${profile}: no needless rewrite`);
  }
});

test("first install on an empty directory creates initial state", async () => {
  const store = makeStore(tempDir());
  const snapshot = store.snapshot();
  assert.equal(snapshot.mode, "normal");
  assert.equal(snapshot.revision, 0);
  assert.deepEqual(snapshot.skins, {});
  assert.deepEqual(snapshot.library, []);
});

test("upload stores a sniffed asset and bumps the revision", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset, revision } = await store.uploadAsset(pngBytes(1920, 1080), {
    displayName: "灯笼.png",
    declaredMime: "image/png",
  });
  assert.match(asset.id, USER_ID_SHAPE);
  assert.equal(asset.mime, "image/png");
  assert.equal(asset.width, 1920);
  assert.equal(asset.displayName, "灯笼.png");
  assert.equal(revision, 1);
  assert.ok(existsSync(join(dir, "assets", `${asset.id}.png`)));
  const snapshot = store.snapshot();
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.quota.totalBytes, asset.byteLength);
});

test("upload rejects unrecognized bytes, animated WebP, mime mismatches and bad names", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(store.uploadAsset(Buffer.from("not an image"), { displayName: "x" }), (e) => e.code === "UNSUPPORTED_IMAGE");
  await assert.rejects(store.uploadAsset(webpAnimated(), { displayName: "x" }), (e) => e.code === "ANIMATION_UNSUPPORTED");
  await assert.rejects(
    store.uploadAsset(pngBytes(), { displayName: "x", declaredMime: "image/jpeg" }),
    (e) => e.code === "UNSUPPORTED_IMAGE",
  );
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: "" }), (e) => e.code === "FILENAME_INVALID");
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: null }), (e) => e.code === "FILENAME_INVALID");
  assert.equal(store.snapshot().revision, 0);
});

test("upload enforces global byte and per-format pixel caps", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.uploadAsset(pngBytes(10, 10, 21 * 1024 * 1024), { displayName: "big" }),
    (e) => e.code === "UPLOAD_TOO_LARGE",
  );
  await assert.rejects(
    store.uploadAsset(gifBytes(5000, 3000), { displayName: "gif" }), // 15MP > 12MP GIF cap
    (e) => e.code === "UPLOAD_TOO_LARGE",
  );
  await assert.rejects(
    store.uploadAsset(pngBytes(5001, 8000), { displayName: "png" }), // > 40MP
    (e) => e.code === "UPLOAD_TOO_LARGE",
  );
  // Exactly at the caps passes.
  const okGif = await store.uploadAsset(gifBytes(4000, 3000), { displayName: "gif" }); // 12MP
  assert.equal(okGif.asset.mime, "image/gif");
  const okPng = await store.uploadAsset(pngBytes(5000, 8000), { displayName: "png" }); // 40MP
  assert.equal(okPng.asset.width, 5000);
});

test("field operations set, delete and bump the revision atomically", async () => {
  const store = makeStore(tempDir());
  await setOverride(store, "meirenzhi", "slogan", { zh: "一", en: "One" });
  await setOverride(store, "meirenzhi", "panelOpacity", 55);
  let snapshot = store.snapshot();
  assert.deepEqual(snapshot.skins.meirenzhi.slogan, { zh: "一", en: "One" });
  assert.equal(snapshot.skins.meirenzhi.panelOpacity, 55);
  assert.equal(snapshot.revision, 2);

  await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [{ op: "delete", skinId: "meirenzhi", key: "panelOpacity" }],
  });
  snapshot = store.snapshot();
  assert.equal(snapshot.skins.meirenzhi.panelOpacity, undefined);
  assert.equal(snapshot.skins.meirenzhi.slogan.zh, "一");
});

test("invalid operations reject the whole batch without touching state", async () => {
  const store = makeStore(tempDir());
  await setOverride(store, "meirenzhi", "panelOpacity", 55);
  await assert.rejects(store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [
      { op: "set", skinId: "meirenzhi", key: "blur", value: 5 },
      { op: "set", skinId: "meirenzhi", key: "panelOpacity", value: 999 },
    ],
  }), (e) => e.code === "INVALID_CONFIG");
  const snapshot = store.snapshot();
  assert.equal(snapshot.skins.meirenzhi.blur, undefined);
  assert.equal(snapshot.skins.meirenzhi.panelOpacity, 55);
  assert.equal(snapshot.revision, 1);
});

test("unknown fields and unknown skins are rejected", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.applyOperations({
      baseRevision: store.snapshot().revision,
      operations: [{ op: "set", skinId: "meirenzhi", key: "nope", value: 1 }],
    }),
    (e) => e.code === "INVALID_CONFIG",
  );
  // tgcf was retired in v1.4.0: its id is now just another unknown skin on
  // the write path — stored leftovers may only be pruned, never extended.
  await assert.rejects(
    store.applyOperations({
      baseRevision: store.snapshot().revision,
      operations: [{ op: "set", skinId: "tgcf", key: "slogan", value: { zh: "一", en: "One" } }],
    }),
    (e) => e.code === "INVALID_CONFIG",
  );
});

test("legacy skins take slogan and panelOpacity overrides and survive reload (ADR-0004)", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setOverride(store, "openbmc", "slogan", { zh: "甲", en: "Z" });
  await setOverride(store, "openbmc", "panelOpacity", 80);
  await setOverride(store, "uefi-harness", "panelOpacity", 20);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.skins.openbmc.slogan, { zh: "甲", en: "Z" });
  assert.equal(snapshot.skins.openbmc.panelOpacity, 80);
  assert.equal(snapshot.skins["uefi-harness"].panelOpacity, 20);

  // Out-of-range values are rejected by the write-path field gate.
  await assert.rejects(
    store.applyOperations({
      baseRevision: store.snapshot().revision,
      operations: [{ op: "set", skinId: "openbmc", key: "panelOpacity", value: 101 }],
    }),
    (e) => e.code === "INVALID_CONFIG",
  );
  assert.equal(store.snapshot().skins.openbmc.panelOpacity, 80, "rejected write leaves state untouched");

  // Valid overrides survive a reopen with clean normalization (no revision bump).
  const reopened = makeStore(dir);
  const re = reopened.snapshot();
  assert.deepEqual(re.skins.openbmc.slogan, { zh: "甲", en: "Z" });
  assert.equal(re.skins.openbmc.panelOpacity, 80);
  assert.equal(re.skins["uefi-harness"].panelOpacity, 20);
});

test("load normalization drops unknown keys, stale shapes, dangling refs and orphan sections", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  await setOverride(store, "meirenzhi", "slogan", { zh: "存", en: "Keep" });
  await setOverride(store, "openbmc", "wallpaper", asset.id);
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  const baseRevision = raw.revision;
  // Pre-simplization leftovers planted straight onto the disk state.
  raw.skins.meirenzhi.futureField = { any: "shape" }; // unknown key
  raw.skins.meirenzhi.accent = { light: "#111111", dark: "#222222" }; // removed field
  raw.skins.meirenzhi.scrim = { light: 18, dark: 42 }; // stale light/dark pair shape
  raw.skins.meirenzhi.wallpaper = "u_0123456789abcdef0123456789abcdef"; // dangling user ref
  raw.skins.tgcf = { slogan: { zh: "残留", en: "Leftover" } }; // removed-skin orphan section (v1.4.0)
  raw.skins.removedSkin = { wallpaper: "builtin:openbmc:art" }; // never-known orphan section
  writeFileSync(statePath, JSON.stringify(raw));

  const reopened = makeStore(dir);
  const snapshot = reopened.snapshot();
  const section = snapshot.skins.meirenzhi;
  assert.equal(section.futureField, undefined, "unknown key dropped");
  assert.equal(section.accent, undefined, "removed field dropped");
  assert.equal(section.scrim, undefined, "retired field dropped (ruling #14: translucency knob)");
  assert.equal(section.wallpaper, undefined, "dangling user ref dropped");
  assert.deepEqual(section.slogan, { zh: "存", en: "Keep" }, "valid keys survive");
  assert.equal(snapshot.skins.tgcf, undefined, "removed-skin orphan section pruned (tgcf retired in v1.4.0)");
  assert.equal(snapshot.skins.removedSkin, undefined, "orphan section removed");
  assert.equal(snapshot.skins.openbmc.wallpaper, asset.id, "live user ref survives");
  assert.equal(snapshot.revision, baseRevision + 1, "exactly one normalization commit");
  const onDisk = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(onDisk.skins.meirenzhi.slogan.zh, "存", "normalization is persisted");
  assert.equal(onDisk.skins.tgcf, undefined);
  assert.equal(onDisk.skins.removedSkin, undefined);
});

test("load normalization commits nothing when the state is already clean", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await setOverride(store, "meirenzhi", "slogan", { zh: "净", en: "Clean" });
  const statePath = join(dir, "state.json");
  const before = readFileSync(statePath, "utf8");
  const revision = store.snapshot().revision;

  const reopened = makeStore(dir);
  assert.equal(reopened.snapshot().revision, revision, "no revision bump");
  assert.equal(readFileSync(statePath, "utf8"), before, "state file byte-identical");
});

test("load normalization never writes in recovery or unsupported modes", async () => {
  // Corrupt state → recovery branch: zero writes (bytes identical).
  const dirA = tempDir();
  const seed = makeStore(dirA);
  await seed.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dirA, "state.json"), "{ broken");
  const before = readFileSync(join(dirA, "state.json"), "utf8");
  makeStore(dirA).snapshot();
  assert.equal(readFileSync(join(dirA, "state.json"), "utf8"), before, "recovery writes nothing");

  // Future configVersion → unsupported branch: zero writes.
  const dirB = tempDir();
  writeFileSync(join(dirB, "state.json"), JSON.stringify({
    configVersion: 99, revision: 3,
    skins: { meirenzhi: { accent: { light: "#1", dark: "#2" }, anythingElse: 1 } },
    library: {},
  }));
  const beforeB = readFileSync(join(dirB, "state.json"), "utf8");
  const future = makeStore(dirB);
  assert.equal(future.getMode(), "unsupported");
  assert.equal(readFileSync(join(dirB, "state.json"), "utf8"), beforeB, "unsupported writes nothing");
});

test("image overrides validate against the live library (missing assets reject)", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    setOverride(store, "meirenzhi", "wallpaper", "u_0123456789abcdef0123456789abcdef"),
    (e) => e.code === "INVALID_CONFIG",
  );
  const { asset } = await store.uploadAsset(pngBytes(40, 40), { displayName: "ok" });
  await setOverride(store, "meirenzhi", "wallpaper", asset.id);
  assert.equal(store.snapshot().skins.meirenzhi.wallpaper, asset.id);
});

test("deleting a referenced asset clears overrides and reports affected skins", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  await setOverride(store, "meirenzhi", "wallpaper", asset.id);
  await setOverride(store, "meirenzhi", "slogan", { zh: "二", en: "Two" });
  const references = store.snapshot().references[asset.id];
  assert.deepEqual(references, [{ skinId: "meirenzhi", key: "wallpaper" }]);

  const result = await store.deleteAsset(asset.id);
  assert.deepEqual(result.affectedSkins, [{ skinId: "meirenzhi", key: "wallpaper" }]);
  const snapshot = store.snapshot();
  assert.equal(snapshot.skins.meirenzhi.wallpaper, undefined);
  assert.deepEqual(snapshot.skins.meirenzhi.slogan, { zh: "二", en: "Two" }); // untouched
  assert.deepEqual(snapshot.library, []);
  assert.equal(existsSync(join(dir, "assets", `${asset.id}.png`)), false);
  await assert.rejects(store.deleteAsset(asset.id), (e) => e.code === "ASSET_NOT_FOUND");
  await assert.rejects(store.deleteAsset("not-an-id"), (e) => e.code === "INVALID_ASSET_ID");
});

test("corrupt state with assets boots into recovery and keeps every blob", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "{ this is not json");
  // A stray file whose bytes fail sniffing — recovery must register (not
  // delete) it while the valid asset becomes a library candidate.
  writeFileSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png"), Buffer.from("junk-bytes"));

  const recovered = makeStore(dir);
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.mode, "recovery");
  assert.equal(snapshot.recovery.configLost, true);
  assert.equal(snapshot.recovery.candidateLibrary[asset.id] !== undefined, true);
  assert.deepEqual(snapshot.recovery.quarantine, ["u_ffffffffffffffffffffffffffffffff.png"]);
  // No destructive GC: everything is still on disk.
  assert.equal(readdirSync(join(dir, "assets")).length, 2);
  // Mutations are refused until recovery is confirmed.
  await assert.rejects(setOverride(recovered, "meirenzhi", "panelOpacity", 1), (e) => e.code === "STORE_RECOVERY_REQUIRED");
});

test("missing state with assets boots into recovery, not first install", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await store.uploadAsset(pngBytes(), { displayName: "w" });
  const { unlinkSync } = await import("node:fs");
  unlinkSync(join(dir, "state.json"));
  const reopened = makeStore(dir);
  assert.equal(reopened.getMode(), "recovery");
});

test("confirmRecovery rebuilds the library, quarantines strays physically and archives the corrupt file", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "broken");
  writeFileSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png"), Buffer.from("junk-bytes"));

  const recovered = makeStore(dir);
  const { revision } = await recovered.confirmRecovery();
  assert.ok(revision >= 1);
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.mode, "normal");
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.library[0].id, asset.id);
  // The stray blob was moved (not deleted) into quarantine/.
  assert.equal(existsSync(join(dir, "quarantine", "u_ffffffffffffffffffffffffffffffff.png")), true);
  assert.equal(readdirSync(join(dir, "assets")).length, 1);
  // A corrupt-state backup was archived.
  const backups = readdirSync(dir).filter((name) => name.startsWith("state.json.corrupt."));
  assert.equal(backups.length, 1);
  // The store is writable again.
  await setOverride(recovered, "meirenzhi", "panelOpacity", 3);
  assert.equal(recovered.snapshot().skins.meirenzhi.panelOpacity, 3);
});

test("future configVersion boots read-only with zero writes and zero GC", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await store.uploadAsset(pngBytes(), { displayName: "w" });
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.configVersion = 99;
  writeFileSync(statePath, JSON.stringify(raw));
  writeFileSync(join(dir, "assets", "u_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png"), pngBytes(5, 5));

  const old = makeStore(dir);
  const snapshot = old.snapshot();
  assert.equal(snapshot.mode, "unsupported");
  assert.equal(snapshot.library.length, 1);
  // Old version still sees the newer skin section it doesn't understand.
  await assert.rejects(setOverride(old, "meirenzhi", "panelOpacity", 1), (e) => e.code === "STORE_READONLY");
  await assert.rejects(old.uploadAsset(pngBytes(), { displayName: "x" }), (e) => e.code === "STORE_READONLY");
  await assert.rejects(old.confirmRecovery(), (e) => e.code === "STORE_NOT_RECOVERING");
  // Zero writes / zero GC: both blobs survive untouched.
  assert.equal(readdirSync(join(dir, "assets")).length, 2);
  assert.equal(JSON.parse(readFileSync(statePath, "utf8")).configVersion, 99);
});

test("GC removes stray blobs on the next commit but never library members", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "assets", "u_abababababababababababababababab.png"), pngBytes(3, 3));
  await setOverride(store, "meirenzhi", "panelOpacity", 1); // triggers post-commit GC
  const names = readdirSync(join(dir, "assets"));
  assert.deepEqual(names, [`${asset.id}.png`]);
});

test("fault injection: a failed blob create leaves no library entry and no state change", async () => {
  const dir = tempDir();
  let blobCreates = 0;
  const store = makeStore(dir, {
    openSync: (file, flags) => {
      // Fail only the first exclusive blob create, never the state writer
      // (which never opens files with "wx").
      if (flags === "wx" && String(file).replaceAll("\\", "/").includes("/assets/")) {
        blobCreates += 1;
        if (blobCreates === 1) throw new Error("simulated crash before commit");
      }
      return fOpen(file, flags);
    },
  });
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: "w" }), /simulated crash/);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.library, []);
  assert.equal(snapshot.revision, 0);
  // The next upload still works.
  const result = await store.uploadAsset(pngBytes(), { displayName: "w2" });
  assert.equal(result.revision, 1);
});

test("fault injection: a failed state commit after a successful blob write reclaims the blob", async () => {
  const dir = tempDir();
  let stateWrites = 0;
  const store = makeStore(dir, {
    writeFileSync: (file, data) => {
      if (String(file).includes("state.json")) {
        stateWrites += 1;
        // Allow the initial first-install state write; fail the upload's
        // state commit (the second one).
        if (stateWrites > 1) throw new Error("simulated state commit crash");
      }
      return fWrite(file, data);
    },
  });
  await assert.rejects(store.uploadAsset(pngBytes(), { displayName: "w" }), /simulated state commit crash/);
  const snapshot = store.snapshot();
  assert.deepEqual(snapshot.library, []);
  assert.equal(readdirSync(join(dir, "assets")).length, 0, "orphan blob reclaimed");
});

test("stale baseRevision rejects without changing revision or overrides", async () => {
  const store = makeStore(tempDir());
  const before = store.snapshot();
  await assert.rejects(store.applyOperations({
    baseRevision: before.revision + 5,
    operations: [{ op: "set", skinId: "meirenzhi", key: "panelOpacity", value: 55 }],
  }), (error) => error.code === "REVISION_CONFLICT");
  const after = store.snapshot();
  assert.equal(after.revision, before.revision);
  assert.deepEqual(after.skins, before.skins);
});

test("matching baseRevision commits and increments revision once", async () => {
  const store = makeStore(tempDir());
  const baseRevision = store.snapshot().revision;
  const result = await store.applyOperations({
    baseRevision,
    operations: [{ op: "set", skinId: "meirenzhi", key: "panelOpacity", value: 55 }],
  });
  assert.equal(result.revision, baseRevision + 1);
  assert.equal(store.snapshot().revision, baseRevision + 1);
  assert.equal(store.snapshot().skins.meirenzhi.panelOpacity, 55);
});

test("missing and invalid baseRevision values reject as revision conflicts", async () => {
  const store = makeStore(tempDir());
  for (const baseRevision of [undefined, -1, 7.5]) {
    await assert.rejects(store.applyOperations({
      baseRevision,
      operations: [{ op: "set", skinId: "meirenzhi", key: "panelOpacity", value: 55 }],
    }), (error) => error.code === "REVISION_CONFLICT");
  }
  assert.equal(store.snapshot().revision, 0);
  assert.deepEqual(store.snapshot().skins, {});
});

test("missing baseRevision outranks invalid empty operations", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.applyOperations({ operations: [] }),
    (error) => error.code === "REVISION_CONFLICT",
  );
});

test("recovery mode outranks missing baseRevision and invalid operations", async () => {
  const dir = tempDir();
  const seed = makeStore(dir);
  await seed.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "broken");
  const recovered = makeStore(dir);
  await assert.rejects(
    recovered.applyOperations({ operations: [] }),
    (error) => error.code === "STORE_RECOVERY_REQUIRED",
  );
});

test("unsupported mode outranks missing baseRevision and invalid operations", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 5, skins: {}, library: {},
  }));
  const unsupported = makeStore(dir);
  await assert.rejects(
    unsupported.applyOperations({ operations: [] }),
    (error) => error.code === "STORE_READONLY",
  );
});

test("revision conflicts perform no state-file writes or renames", async () => {
  const dir = tempDir();
  let writes = 0;
  let renames = 0;
  const store = makeStore(dir, {
    writeFileSync: (...args) => {
      writes += 1;
      return fWrite(...args);
    },
    renameSync: (...args) => {
      renames += 1;
      return fRename(...args);
    },
  });
  await setOverride(store, "meirenzhi", "panelOpacity", 55);
  writes = 0;
  renames = 0;
  const before = store.snapshot();
  await assert.rejects(store.applyOperations({
    baseRevision: before.revision - 1,
    operations: [{ op: "set", skinId: "meirenzhi", key: "blur", value: 5 }],
  }), (error) => error.code === "REVISION_CONFLICT");
  assert.equal(writes, 0);
  assert.equal(renames, 0);
  assert.equal(store.snapshot().revision, before.revision);
  assert.deepEqual(store.snapshot().skins, before.skins);
});

test("interleaved mutations from the same base conflict before retry", async () => {
  const store = makeStore(tempDir());
  const base = store.snapshot().revision;
  const requests = [
    {
      baseRevision: base,
      operations: [{ op: "set", skinId: "meirenzhi", key: "slogan", value: { zh: "一", en: "One" } }],
    },
    {
      baseRevision: base,
      operations: [{ op: "set", skinId: "openbmc", key: "wallpaper", value: "builtin:openbmc:art" }],
    },
  ];
  const first = store.applyOperations(requests[0]);
  const second = store.applyOperations(requests[1]);
  const settled = await Promise.allSettled([first, second]);
  const fulfilled = settled.filter((result) => result.status === "fulfilled");
  const rejected = settled.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "REVISION_CONFLICT");

  let snapshot = store.snapshot();
  assert.equal(snapshot.revision, base + 1);
  const rejectedIndex = settled.findIndex((result) => result.status === "rejected");
  if (rejectedIndex === 0) assert.equal(snapshot.skins.meirenzhi?.slogan, undefined);
  else assert.equal(snapshot.skins.openbmc?.wallpaper, undefined);

  await store.applyOperations({
    ...requests[rejectedIndex],
    baseRevision: snapshot.revision,
  });
  snapshot = store.snapshot();
  assert.deepEqual(snapshot.skins.meirenzhi.slogan, { zh: "一", en: "One" });
  assert.equal(snapshot.skins.openbmc.wallpaper, "builtin:openbmc:art");
  assert.equal(snapshot.revision, base + 2);
});

// ---- review-round regressions (data safety, concurrency, crash windows) ----

test("R1: a semantically corrupt library boots into recovery and keeps every blob", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  const statePath = join(dir, "state.json");
  const raw = JSON.parse(readFileSync(statePath, "utf8"));
  raw.library.bogus = {}; // id-shape violation must not pass as normal
  writeFileSync(statePath, JSON.stringify(raw));

  const reopened = makeStore(dir);
  const snapshot = reopened.snapshot();
  assert.equal(snapshot.mode, "recovery");
  // The real blob survived: the unvalidated state never fed the GC.
  assert.equal(readdirSync(join(dir, "assets")).length, 1);
  assert.equal(snapshot.recovery.candidateLibrary[asset.id] !== undefined, true);
  assert.ok(snapshot.recovery.quarantine.length >= 0);
});

test("R1: unsupported configVersion boots without creating any directory", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 1, skins: {}, library: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.getMode(), "unsupported");
  assert.equal(existsSync(join(dir, "assets")), false, "assets/ must not be created");
  assert.equal(existsSync(join(dir, "staging")), false, "staging/ must not be created");
});

test("R2: a failing recovery commit moves nothing and can be retried", async () => {
  const dir = tempDir();
  const seed = makeStore(dir);
  const { asset } = await seed.uploadAsset(pngBytes(), { displayName: "w" });
  writeFileSync(join(dir, "state.json"), "broken");
  writeFileSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png"), Buffer.from("junk"));

  let failCommits = false;
  let stateWrites = 0;
  const store = makeStore(dir, {
    writeFileSync: (file, data) => {
      if (String(file).includes("state.json")) {
        stateWrites += 1;
        if (failCommits && stateWrites >= 1) throw new Error("simulated recovery commit crash");
      }
      return fWrite(file, data);
    },
  });
  assert.equal(store.snapshot().mode, "recovery");
  failCommits = true;
  await assert.rejects(store.confirmRecovery(), /simulated recovery commit crash/);
  // Nothing moved: the junk file is still in assets/ and the corrupt state
  // file is still in place (only a backup COPY may exist).
  assert.equal(existsSync(join(dir, "assets", "u_ffffffffffffffffffffffffffffffff.png")), true);
  assert.equal(existsSync(join(dir, "state.json")), true);
  assert.equal(existsSync(join(dir, "quarantine")), false, "no quarantine dir before commit");

  // Retry after the fault clears: recovery completes deterministically.
  failCommits = false;
  const store2 = makeStore(dir);
  await store2.confirmRecovery();
  const snapshot = store2.snapshot();
  assert.equal(snapshot.mode, "normal");
  assert.equal(snapshot.library.length, 1);
  assert.equal(snapshot.library[0].id, asset.id);
  assert.equal(existsSync(join(dir, "quarantine", "u_ffffffffffffffffffffffffffffffff.png")), true);
});
test("Y5: recovery quarantines files whose extension contradicts the magic bytes", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  void asset;
  // PNG bytes under a .jpg name: sniff says png, name says jpg.
  const png = pngBytes();
  const id = "u_11111111111111111111111111111111";
  writeFileSync(join(dir, "state.json"), "broken");
  writeFileSync(join(dir, "assets", `${id}.jpg`), png);
  const recovered = makeStore(dir);
  const snapshot = recovered.snapshot();
  assert.equal(snapshot.mode, "recovery");
  assert.deepEqual(snapshot.recovery.quarantine, [`${id}.jpg`]);
  await recovered.confirmRecovery();
  assert.equal(existsSync(join(dir, "quarantine", `${id}.jpg`)), true);
  assert.equal(reopenedLibraryHasOnlyValid(recovered), true);
  function reopenedLibraryHasOnlyValid(s) {
    return s.snapshot().library.every((meta) => meta.extension === "png");
  }
});

test("N2: a future-version state with a CHANGED shape boots unsupported with zero writes", () => {
  const dir = tempDir();
  // Future versions may rename/restructure the skeleton — that is exactly
  // what a configVersion bump licenses. It must never read as "corrupt".
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 3, skinsFuture: {}, libraryV2: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.getMode(), "unsupported");
  assert.equal(existsSync(join(dir, "assets")), false, "no directories may be created");
  assert.equal(existsSync(join(dir, "staging")), false);
  assert.equal(existsSync(join(dir, "quarantine")), false);
});

test("N3: shape-changed future states serve a usable read-only snapshot", () => {
  const dir = tempDir();
  writeFileSync(join(dir, "state.json"), JSON.stringify({
    configVersion: 99, revision: 3, skinsFuture: {}, libraryV2: {},
  }));
  const store = makeStore(dir);
  assert.equal(store.getMode(), "unsupported");
  const snapshot = store.snapshot();
  assert.equal(snapshot.mode, "unsupported");
  assert.equal(snapshot.configVersion, 99);
  assert.equal(snapshot.revision, 3);
  assert.deepEqual(snapshot.library, []);
  assert.deepEqual(snapshot.quota, { count: 0, totalBytes: 0 });
  // The read-only asset route degrades to 404 semantics, never a TypeError.
  assert.equal(store.serveAsset("/dsh-skins/assets/u_0123456789abcdef0123456789abcdef.png"), null);
});

// ---- ADR-0015: gallery ops join the revisioned write dialect ----------------

const MISSING_ID = `u_${"0".repeat(32)}`;

test("A15: deleteAsset op participates in the baseRevision precondition", async () => {
  const store = makeStore(tempDir());
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  await assert.rejects(
    store.applyOperations({
      baseRevision: 0, // stale: the upload already bumped it to 1
      operations: [{ op: "deleteAsset", assetId: asset.id }],
    }),
    (e) => e.code === "REVISION_CONFLICT",
  );
  assert.equal(store.snapshot().library.length, 1, "a stale delete deletes nothing");
});

test("A15: deleteAsset op on a missing target rejects the whole batch with a named issue", async () => {
  const store = makeStore(tempDir());
  await store.uploadAsset(pngBytes(), { displayName: "w" });
  const revision = store.snapshot().revision;
  await assert.rejects(
    store.applyOperations({
      baseRevision: revision,
      operations: [
        { op: "set", skinId: "meirenzhi", key: "slogan", value: { zh: "甲", en: "A" } },
        { op: "deleteAsset", assetId: MISSING_ID },
      ],
    }),
    (e) => {
      assert.equal(e.code, "INVALID_CONFIG");
      assert.deepEqual(e.params.issues, [{ opIndex: 1, assetId: MISSING_ID, code: "ASSET_NOT_FOUND" }]);
      assert.equal(e.params.code, "ASSET_NOT_FOUND", "params.code retained for old readers");
      return true;
    },
  );
  const snap = store.snapshot();
  assert.equal(snap.revision, revision, "zero commits");
  assert.equal(snap.library.length, 1, "the live asset survives");
  assert.equal(snap.skins.meirenzhi, undefined, "the sibling field op rolled back with the batch");
});

test("A15: deleteAsset op with a malformed assetId gets an INVALID_ASSET_ID issue", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.applyOperations({
      baseRevision: 0,
      operations: [{ op: "deleteAsset", assetId: "not-an-id" }],
    }),
    (e) => {
      assert.equal(e.code, "INVALID_CONFIG");
      assert.deepEqual(e.params.issues, [{ opIndex: 0, assetId: "not-an-id", code: "INVALID_ASSET_ID" }]);
      return true;
    },
  );
});

test("A15: clearLibrary op commits once, clears references and blobs, and is idempotent", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const first = await store.uploadAsset(pngBytes(), { displayName: "a" });
  await store.uploadAsset(pngBytes(), { displayName: "b" });
  await setOverride(store, "openbmc", "wallpaper", first.asset.id);
  const before = store.snapshot().revision;

  const result = await store.applyOperations({
    baseRevision: before,
    operations: [{ op: "clearLibrary" }],
  });
  assert.equal(result.revision, before + 1, "one commit, one bump");
  assert.deepEqual(result.affectedSkins, [{ skinId: "openbmc", key: "wallpaper" }]);
  const snap = store.snapshot();
  assert.equal(snap.library.length, 0);
  assert.equal(snap.skins.openbmc, undefined, "the referencing field fell back (no husk)");
  assert.equal(readdirSync(join(dir, "assets")).filter((f) => !f.startsWith(".")).length, 0, "blobs deleted");

  const again = await store.applyOperations({
    baseRevision: snap.revision,
    operations: [{ op: "clearLibrary" }],
  });
  assert.equal(again.revision, snap.revision, "empty library → no bump");
  assert.deepEqual(again.affectedSkins, []);
});

test("A15: clearLibrary mixed with a failing deleteAsset rejects atomically (acceptance ③)", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  await store.uploadAsset(pngBytes(), { displayName: "w" });
  const before = store.snapshot().revision;
  await assert.rejects(
    store.applyOperations({
      baseRevision: before,
      operations: [{ op: "clearLibrary" }, { op: "deleteAsset", assetId: MISSING_ID }],
    }),
    (e) => e.code === "INVALID_CONFIG" && e.params.issues.length === 1,
  );
  assert.equal(store.snapshot().revision, before, "zero commits");
  assert.equal(store.snapshot().library.length, 1, "nothing deleted");
  assert.equal(readdirSync(join(dir, "assets")).filter((f) => !f.startsWith(".")).length, 1, "blob survives");
});

test("A15: in-batch ordering — set X then deleteAsset X ends with the field reset", async () => {
  const store = makeStore(tempDir());
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  const result = await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [
      { op: "set", skinId: "openbmc", key: "wallpaper", value: asset.id },
      { op: "deleteAsset", assetId: asset.id },
    ],
  });
  const snap = store.snapshot();
  assert.equal(snap.skins.openbmc, undefined, "set applied, then swept by the reference clearing");
  assert.deepEqual(result.affectedSkins, [{ skinId: "openbmc", key: "wallpaper" }]);
  assert.equal(snap.library.length, 0);
});

test("A15: reverse order — deleteAsset X then set wallpaper=X fails closed (terminal invariant)", async () => {
  const store = makeStore(tempDir());
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  const revision = store.snapshot().revision;
  await assert.rejects(
    store.applyOperations({
      baseRevision: revision,
      operations: [
        { op: "deleteAsset", assetId: asset.id },
        { op: "set", skinId: "openbmc", key: "wallpaper", value: asset.id },
      ],
    }),
    (e) => {
      assert.equal(e.code, "INVALID_CONFIG");
      assert.deepEqual(e.params.issues, [{ skinId: "openbmc", key: "wallpaper", code: "MISSING_ASSET" }]);
      return true;
    },
  );
  const snap = store.snapshot();
  assert.equal(snap.revision, revision, "zero commits");
  assert.equal(snap.library.length, 1, "nothing deleted, nothing dangled — the whole batch rolled back");
});

test("A15: duplicate deleteAsset ops in one batch are idempotent no-ops", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  const result = await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [
      { op: "deleteAsset", assetId: asset.id },
      { op: "deleteAsset", assetId: asset.id },
    ],
  });
  assert.equal(result.revision, 2, "one commit, one bump");
  assert.equal(store.snapshot().library.length, 0);
  assert.equal(readdirSync(join(dir, "assets")).filter((f) => !f.startsWith(".")).length, 0, "blob unlinked exactly once");
});

test("A15: deleteAsset op reports affectedSkins and unlinks the blob", async () => {
  const dir = tempDir();
  const store = makeStore(dir);
  const { asset } = await store.uploadAsset(pngBytes(), { displayName: "w" });
  await setOverride(store, "meirenzhi", "wallpaper", asset.id);
  const result = await store.applyOperations({
    baseRevision: store.snapshot().revision,
    operations: [{ op: "deleteAsset", assetId: asset.id }],
  });
  const snap = store.snapshot();
  assert.deepEqual(result.affectedSkins, [{ skinId: "meirenzhi", key: "wallpaper" }]);
  assert.equal(snap.library.length, 0);
  assert.equal(snap.skins.meirenzhi, undefined);
  assert.equal(readdirSync(join(dir, "assets")).filter((f) => !f.startsWith(".")).length, 0);
});

test("A15: field validation failures keep params.code and add params.issues", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.applyOperations({
      baseRevision: 0,
      operations: [{ op: "set", skinId: "meirenzhi", key: "panelOpacity", value: 999 }],
    }),
    (e) => {
      assert.equal(e.code, "INVALID_CONFIG");
      assert.equal(e.params.code, "BAD_VALUE", "old readers still see the first code");
      assert.deepEqual(e.params.issues, [
        { opIndex: 0, skinId: "meirenzhi", key: "panelOpacity", code: "BAD_VALUE" },
      ]);
      return true;
    },
  );
});

test("A15: unknown ops are rejected with an INVALID_OP issue (vocabulary whitelist)", async () => {
  const store = makeStore(tempDir());
  await assert.rejects(
    store.applyOperations({
      baseRevision: 0,
      operations: [{ op: "nuke" }],
    }),
    (e) => {
      assert.equal(e.code, "INVALID_CONFIG");
      assert.deepEqual(e.params.issues, [{ opIndex: 0, code: "INVALID_OP" }]);
      return true;
    },
  );
});

test("A15: pure field batches keep the {revision} response shape", async () => {
  const store = makeStore(tempDir());
  const result = await setOverride(store, "meirenzhi", "slogan", { zh: "甲", en: "A" });
  assert.deepEqual(Object.keys(result), ["revision"]);
});
