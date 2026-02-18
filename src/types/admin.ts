export interface AdminUser {
  id: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdById: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  keyPrefix: string;
  rawKey: string;
}
