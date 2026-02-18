export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface CreateSessionResponse {
  sessionId: string;
  adminToken: string;
  url: string;
}

export interface SessionResponse {
  id: string;
  config: Record<string, unknown>;
  textureUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
