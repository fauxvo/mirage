export interface AdminUser {
  id: number;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdById: number | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyCreateResult {
  id: number;
  name: string;
  keyPrefix: string;
  rawKey: string;
}
