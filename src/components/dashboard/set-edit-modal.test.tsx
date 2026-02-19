import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetEditModal } from './set-edit-modal';

// Mock the youtube utility — lightweight, no component dependency
vi.mock('@/lib/youtube', () => ({
  extractPlaylistId: (url: string) => {
    try {
      return new URL(url).searchParams.get('list');
    } catch {
      return null;
    }
  },
}));

const baseSet = {
  id: 'set-1',
  name: 'My Set',
  description: 'A description',
  youtubePlaylistUrl: null,
  isPublic: false,
};

describe('SetEditModal', () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('renders with pre-filled values', () => {
    render(<SetEditModal set={baseSet} onClose={onClose} onSaved={onSaved} />);

    expect(screen.getByDisplayValue('My Set')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A description')).toBeInTheDocument();
    expect(screen.getByText('Edit Set')).toBeInTheDocument();
  });

  it('shows error when name is empty and Save is clicked', () => {
    render(<SetEditModal set={{ ...baseSet, name: '' }} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows error for invalid YouTube playlist URL', () => {
    render(
      <SetEditModal
        set={{ ...baseSet, youtubePlaylistUrl: 'https://youtube.com/watch?v=abc' }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByText('Save'));

    expect(
      screen.getByText('Invalid YouTube playlist URL — must contain a list= parameter')
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a valid YouTube playlist URL and saves', async () => {
    const mockFetch = vi.mocked(global.fetch);
    const updated = {
      ...baseSet,
      youtubePlaylistUrl: 'https://youtube.com/playlist?list=PLtest',
    };
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: updated })));

    render(
      <SetEditModal
        set={{ ...baseSet, youtubePlaylistUrl: 'https://youtube.com/playlist?list=PLtest' }}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
  });

  it('calls onSaved with updated data on successful save', async () => {
    const updated = { ...baseSet, name: 'Updated' };
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: updated })));

    render(<SetEditModal set={baseSet} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(updated));
  });

  it('shows server error message on failed save', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: 'Forbidden' }))
    );

    render(<SetEditModal set={baseSet} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Forbidden')).toBeInTheDocument());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('shows network error on fetch failure', async () => {
    const mockFetch = vi.mocked(global.fetch);
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    render(<SetEditModal set={baseSet} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('closes on Escape key press', () => {
    render(<SetEditModal set={baseSet} onClose={onClose} onSaved={onSaved} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    render(<SetEditModal set={baseSet} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
