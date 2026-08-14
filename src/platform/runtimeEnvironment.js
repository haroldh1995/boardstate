export const RUNTIME_ENVIRONMENT_VERSION = "boardstate-runtime-environment-0.1.0";

export function createMemoryKeyValueStore(seed = {}) {
  const entries = new Map(Object.entries(seed || {}).map(([key, value]) => [String(key), String(value)]));
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      const normalizedKey = String(key);
      return entries.has(normalizedKey) ? entries.get(normalizedKey) : null;
    },
    key(index) {
      return Array.from(entries.keys())[Number(index || 0)] || null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}

export function getRuntimeLocation(locationLike = resolveGlobalValue("location")) {
  const source = locationLike || {};
  return {
    origin: String(source.origin || ""),
    pathname: String(source.pathname || "/"),
    search: String(source.search || ""),
    hash: String(source.hash || ""),
  };
}

export function getRuntimeNavigator(navigatorLike = resolveGlobalValue("navigator")) {
  const source = navigatorLike || {};
  return {
    userAgent: String(source.userAgent || ""),
    platform: String(source.platform || ""),
    language: String(source.language || "en-US"),
    online: source.onLine !== false,
    maxTouchPoints: Number(source.maxTouchPoints || 0),
    vibrate: typeof source.vibrate === "function" ? source.vibrate.bind(source) : null,
  };
}

export function createRuntimeEnvironment(overrides = {}) {
  return {
    clearTimeout: overrides.clearTimeout || resolveGlobalFunction("clearTimeout") || (() => {}),
    crypto: overrides.crypto || resolveGlobalValue("crypto") || null,
    decodeBase64Bytes: overrides.decodeBase64Bytes || decodeBase64Bytes,
    encodeBase64Bytes: overrides.encodeBase64Bytes || encodeBase64Bytes,
    encodeText: overrides.encodeText || encodeText,
    fetch: overrides.fetch || resolveGlobalFunction("fetch") || null,
    indexedDB: overrides.indexedDB || resolveGlobalValue("indexedDB") || null,
    localStorage: overrides.localStorage || resolveStorage("localStorage"),
    location: getRuntimeLocation(overrides.location || resolveGlobalValue("location")),
    navigator: getRuntimeNavigator(overrides.navigator || resolveGlobalValue("navigator")),
    sessionStorage: overrides.sessionStorage || resolveStorage("sessionStorage"),
    setTimeout: overrides.setTimeout || resolveGlobalFunction("setTimeout") || ((callback) => {
      if (typeof callback === "function") callback();
      return 0;
    }),
  };
}

export const defaultRuntimeEnvironment = createRuntimeEnvironment();

function resolveStorage(name) {
  const storage = resolveGlobalValue(name);
  if (!storage) {
    return createMemoryKeyValueStore();
  }
  try {
    const testKey = `__boardstate_${name}_probe__`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return createMemoryKeyValueStore();
  }
}

function resolveGlobalValue(name) {
  if (typeof globalThis === "undefined" || !name) {
    return undefined;
  }
  try {
    return globalThis[name];
  } catch {
    return undefined;
  }
}

function resolveGlobalFunction(name) {
  const value = resolveGlobalValue(name);
  return typeof value === "function" ? value.bind(globalThis) : undefined;
}

function encodeBase64Bytes(bytes = new Uint8Array()) {
  const btoaFn = resolveGlobalValue("btoa");
  if (typeof btoaFn === "function") {
    return btoaFn(String.fromCharCode(...bytes));
  }
  const bufferCtor = resolveGlobalValue("Buffer");
  if (bufferCtor?.from) {
    return bufferCtor.from(bytes).toString("base64");
  }
  throw new Error("Base64 encoding is unavailable in this runtime.");
}

function decodeBase64Bytes(value = "") {
  try {
    const atobFn = resolveGlobalValue("atob");
    if (typeof atobFn === "function") {
      return Uint8Array.from(atobFn(value), (char) => char.charCodeAt(0));
    }
    const bufferCtor = resolveGlobalValue("Buffer");
    if (bufferCtor?.from) {
      return Uint8Array.from(bufferCtor.from(value, "base64"));
    }
  } catch {
    return new Uint8Array();
  }
  return new Uint8Array();
}

function encodeText(value = "") {
  const textEncoderCtor = resolveGlobalValue("TextEncoder");
  if (textEncoderCtor) {
    return new textEncoderCtor().encode(String(value));
  }
  return utf8Encode(String(value));
}

function utf8Encode(value = "") {
  const bytes = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    }
  }
  return Uint8Array.from(bytes);
}
