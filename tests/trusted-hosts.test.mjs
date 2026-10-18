import assert from "node:assert/strict";
import test from "node:test";
import { resolveTrustedHosts } from "../src/host/trusted-hosts.js";

test("resolveTrustedHosts: webRuntime shape (web 0.2.0-rc.x)", () => {
  const ctx = { get(name) { return name === "webRuntime" ? { trustedHosts: ["dsh.example:8443"] } : undefined; } };
  assert.deepEqual(resolveTrustedHosts(ctx), ["dsh.example:8443"]);
});

test("resolveTrustedHosts: webStartup shape (desktop 0.2.1-rc.x)", () => {
  const ctx = { get(name) { return name === "webStartup" ? { trustedHosts: ["dsh.example:443"] } : undefined; } };
  assert.deepEqual(resolveTrustedHosts(ctx), ["dsh.example:443"]);
});

test("resolveTrustedHosts: both present — webStartup wins", () => {
  const ctx = { get(name) { return name === "webStartup" ? { trustedHosts: ["a"] } : { trustedHosts: ["b"] } } };
  assert.deepEqual(resolveTrustedHosts(ctx), ["a"]);
});

test("resolveTrustedHosts: neither — loopback-only degradation", () => {
  assert.deepEqual(resolveTrustedHosts({ get() { return undefined; } }), []);
  assert.deepEqual(resolveTrustedHosts(undefined), []);
});

test("resolveTrustedHosts: throwing getter (cordis Local without inject) — degrade, never propagate", () => {
  // 2026-10-18 热修实录：cordis 对未 inject 服务的属性访问抛
  // 「cannot get property "webStartup" without inject」——`?.` 链不可防护；
  // ctx.get(name) 为非抛查找，且本函数须保证任何意外都降级 []、绝不向上传播。
  const ctx = { get() { throw new Error('cannot get property "webStartup" without inject'); } };
  assert.deepEqual(resolveTrustedHosts(ctx), []);
});

test("mount accepts function trustedHosts and re-evaluates per request", async () => {
  const { mountPersonalizationRoutes } = await import("../src/host/personalization-routes.js");
  const registered = [];
  const host = {
    webServer: { register(route) { registered.push(route); return () => {}; } },
  };
  let trusted = ["good.host"];
  mountPersonalizationRoutes(host, {
    store: { snapshot: () => ({ revision: 0 }) },
    trustedHosts: () => trusted,
  });
  const handler = registered.find((route) => route.path === "/dsh-skins/config").handler;
  const respond = () => ({ code: 0, writeHead(c) { this.code = c; }, end() {} });
  const request = { method: "GET", headers: { host: "good.host" }, socket: { remoteAddress: "203.0.113.7" } };
  let res = respond();
  await handler(request, res);
  assert.equal(res.code, 200);
  trusted = []; // trust withdrawn after mount — must apply on the next request
  res = respond();
  await handler(request, res);
  assert.equal(res.code, 403);
});
