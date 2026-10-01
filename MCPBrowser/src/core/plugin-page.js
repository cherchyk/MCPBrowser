/**
 * Plugin page resolution backed by the browser fetch registry.
 */

import { domainPages, isPageUsable } from './browser.js';

const pluginPageAffinities = new WeakMap();

async function inspectPluginPage(page, plugin) {
  const validation = await isPageUsable(page);
  if (!validation.valid) return null;

  let urls;
  try {
    urls = [
      page.url(),
      ...(typeof page.frames === 'function' ? page.frames().map((frame) => frame.url()) : []),
    ];
  } catch {
    return null;
  }

  let confidence = -1;
  for (const url of new Set(urls)) {
    if (!plugin.manifest.urlPatterns.some((pattern) => url.includes(pattern))) continue;
    try {
      const detection = plugin.matchesPage(url, '');
      if (detection?.matched) {
        confidence = Math.max(confidence, detection.confidence ?? 0.5);
      }
    } catch {
      // A plugin matcher must not make another matching page unusable.
    }
  }
  if (confidence < 0) return null;

  let visible = false;
  try {
    visible = await page.evaluate(() => document.visibilityState === 'visible');
  } catch {
    // A live page can still reject evaluation while navigating.
  }

  let stableId = '';
  try {
    stableId = page.target()?._targetId ?? '';
  } catch {
    // URL remains the deterministic fallback key.
  }

  return { page, confidence, visible, url: urls[0], stableId };
}

function rankPluginPages(candidates) {
  return candidates.sort(
    (left, right) =>
      Number(right.visible) - Number(left.visible) ||
      right.confidence - left.confidence ||
      left.url.localeCompare(right.url) ||
      left.stableId.localeCompare(right.stableId),
  );
}

async function inspectPluginPages(pages, plugin) {
  const candidates = await Promise.all(
    [...new Set(pages)].map((page) => inspectPluginPage(page, plugin)),
  );
  return rankPluginPages(candidates.filter(Boolean));
}

/**
 * Resolve a plugin page from the fetch registry, retaining affinity between actions.
 * @param {object} browser
 * @param {object} plugin
 * @returns {Promise<object|null>}
 */
export async function resolvePluginPage(browser, plugin) {
  const affinity = pluginPageAffinities.get(plugin);
  const trackedPages = [];
  const stalePages = new Set();

  for (const page of new Set(domainPages.values())) {
    const validation = await isPageUsable(page);
    if (validation.valid) trackedPages.push(page);
    else stalePages.add(page);
  }
  if (stalePages.size > 0) {
    for (const [hostname, page] of domainPages) {
      if (stalePages.has(page)) domainPages.delete(hostname);
    }
  }

  const trackedCandidates = await inspectPluginPages(trackedPages, plugin);
  if (trackedCandidates.length > 0) {
    const selected =
      trackedCandidates.find((candidate) => candidate.page === affinity) ?? trackedCandidates[0];
    pluginPageAffinities.set(plugin, selected.page);
    return selected.page;
  }

  if (affinity) {
    const affinityCandidate = await inspectPluginPage(affinity, plugin);
    if (affinityCandidate) return affinityCandidate.page;
    pluginPageAffinities.delete(plugin);
  }

  const fallbackCandidates = await inspectPluginPages(await browser.pages(), plugin);
  const selected = fallbackCandidates[0]?.page ?? null;
  if (selected) pluginPageAffinities.set(plugin, selected);
  return selected;
}
