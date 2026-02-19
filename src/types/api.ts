export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface SetResponse {
  id: string;
  isOwner: boolean;
  name: string;
  description: string | null;
  youtubePlaylistUrl: string | null;
  isPublic: boolean;
  cues: CueResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface CueResponse {
  id: string;
  position: number;
  name: string;
  config: Record<string, unknown>;
  textureUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetListItem {
  id: string;
  name: string;
  description: string | null;
  youtubePlaylistUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}
