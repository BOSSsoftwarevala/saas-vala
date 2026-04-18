/**
 * Build Consistency Check
 * Compares dist hash vs running hash, reload on mismatch
 */

let currentBuildHash: string | null = null;

/**
 * Generate a simple hash of the current build
 */
export async function generateBuildHash(): Promise<string> {
  if (currentBuildHash) {
    return currentBuildHash;
  }

  try {
    // Get all script tags
    const scripts = Array.from(document.querySelectorAll('script[src]')) as HTMLScriptElement[];
    const scriptSources = scripts.map(s => s.src).sort().join('|');

    // Get all CSS links
    const links = Array.from(document.querySelectorAll('link[href]')) as HTMLLinkElement[];
    const linkSources = links.map(l => l.href).sort().join('|');

    // Get meta tags
    const metas = Array.from(document.querySelectorAll('meta[name], meta[property]'));
    const metaContent = metas.map(m => m.getAttribute('name') + m.getAttribute('content')).sort().join('|');

    // Combine all sources
    const combined = scriptSources + linkSources + metaContent;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    currentBuildHash = Math.abs(hash).toString(36);
    return currentBuildHash;
  } catch {
    return Date.now().toString(36); // Fallback to timestamp
  }
}

/**
 * Get stored build hash from localStorage
 */
export function getStoredBuildHash(): string | null {
  try {
    return localStorage.getItem('saasvala_build_hash');
  } catch {
    return null;
  }
}

/**
 * Store current build hash
 */
export function storeBuildHash(hash: string): void {
  try {
    localStorage.setItem('saasvala_build_hash', hash);
  } catch {
    console.warn('Failed to store build hash');
  }
}

/**
 * Check if build has changed
 */
export async function hasBuildChanged(): Promise<boolean> {
  const currentHash = await generateBuildHash();
  const storedHash = getStoredBuildHash();

  if (!storedHash) {
    storeBuildHash(currentHash);
    return false;
  }

  return currentHash !== storedHash;
}

/**
 * Reload page if build has changed
 */
export async function reloadIfBuildChanged(): Promise<void> {
  if (await hasBuildChanged()) {
    const currentHash = await generateBuildHash();
    storeBuildHash(currentHash);
    window.location.reload();
  }
}

/**
 * Initialize build consistency check
 */
export function initBuildConsistencyCheck(checkIntervalMs: number = 60000): () => void {
  // Initial check
  reloadIfBuildChanged();

  // Set up periodic check
  const interval = setInterval(() => {
    reloadIfBuildChanged();
  }, checkIntervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
}

/**
 * Force build hash update (call after build/deploy)
 */
export function forceBuildHashUpdate(): void {
  generateBuildHash().then(hash => {
    storeBuildHash(hash);
  });
}
