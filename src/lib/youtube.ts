/**
 * Extract the playlist ID from a YouTube URL.
 * Returns null if the URL is invalid or has no `list` query parameter.
 */
export function extractPlaylistId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('list');
  } catch {
    return null;
  }
}
