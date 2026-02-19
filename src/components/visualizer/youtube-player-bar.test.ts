import { describe, it, expect } from 'vitest';
import { extractPlaylistId } from './youtube-player-bar';

describe('extractPlaylistId', () => {
  it('extracts playlist ID from a standard YouTube playlist URL', () => {
    expect(
      extractPlaylistId('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')
    ).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  });

  it('extracts playlist ID when mixed with other query params', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=abc123&list=PLtest123&index=5')).toBe(
      'PLtest123'
    );
  });

  it('returns null for a URL with no list param', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(extractPlaylistId('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(extractPlaylistId('')).toBeNull();
  });

  it('handles http (non-https) URLs', () => {
    expect(extractPlaylistId('http://youtube.com/playlist?list=PLhttp')).toBe('PLhttp');
  });

  it('handles youtu.be short URLs with list param', () => {
    expect(extractPlaylistId('https://youtu.be/abc?list=PLshort')).toBe('PLshort');
  });
});
