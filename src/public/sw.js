// src/infra/version.ts
var is_dev = true;
var version = `1.4.4${is_dev ? "dev" : ""}`;
var static_resource_cache_name = "static-resource-cache";
function is_later_version(v1, v2) {
  const [maj_1_str, min_1_str, patch_1_str] = v1.split(".");
  const [maj_2_str, min_2_str, patch_2_str] = v2.split(".");
  const maj_1 = parseInt(maj_1_str);
  const min_1 = parseInt(min_1_str);
  const patch_1 = parseInt(patch_1_str);
  const maj_2 = parseInt(maj_2_str);
  const min_2 = parseInt(min_2_str);
  const patch_2 = parseInt(patch_2_str);
  if (maj_1 > maj_2) {
    return true;
  } else if (maj_1 < maj_2) {
    return false;
  }
  if (min_1 > min_2) {
    return true;
  } else if (min_1 < min_2) {
    return false;
  }
  return patch_1 > patch_2;
}
var version_default = version;

// src/sw/fetch/static_resource_cache.worker.ts
async function check_latest_with_cache(delete_legacy) {
  let is_latest = true;
  const cache_keys = await caches.keys();
  for (const key of cache_keys) {
    if (!key.startsWith(static_resource_cache_name)) continue;
    const cache_version = key.split(`${static_resource_cache_name}-v`)[1];
    if (is_later_version(cache_version, version_default)) {
      is_latest = true;
      break;
    }
    if (is_later_version(version_default, cache_version)) {
      is_latest = false;
      if (delete_legacy) {
        await caches.delete(key);
        console.log(`The static resource cache(${key}) is deleted.`);
      }
    }
  }
  return is_latest;
}
function handle_fetch_for_static_resource(event) {
  try {
    if (true) return false;
  } catch {
  }
  if (event.request.method !== "GET") return false;
  const url = new URL(event.request.url);
  const included_path_prefix_list = ["/"];
  let is_included = false;
  if (url.hostname !== location.hostname) return false;
  if (url.href === location.href) return false;
  for (const path of included_path_prefix_list) {
    if (url.pathname.startsWith(path)) {
      is_included = true;
      break;
    }
  }
  if (!is_included) return false;
  const f = async () => {
    const latest_cache_key = `${static_resource_cache_name}-v${version_default}`;
    const static_resource_cache = await caches.open(latest_cache_key);
    const cached = await static_resource_cache.match(event.request);
    if (cached) {
      if (url.pathname !== "/")
        return cached;
      else {
        if (await check_latest_with_cache(true)) {
          return cached;
        }
      }
    }
    const response = await fetch(event.request);
    if (response.status === 200) {
      await static_resource_cache.put(event.request, response.clone());
    }
    return response;
  };
  event.respondWith(f());
  return true;
}

// src/sw/main.worker.ts
var sw = self;
sw.addEventListener("fetch", (event) => {
  if (handle_fetch_for_static_resource(event)) return;
});
sw.addEventListener("install", (event) => sw.skipWaiting());
sw.addEventListener("activate", (event) => event.waitUntil(sw.clients.claim()));
