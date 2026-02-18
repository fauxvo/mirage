import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/auth-guards';
import { apiUsageRepository } from '@/db/repositories/api-usage.repository';
import { successResponse } from '@/lib/api-utils';

const PERIOD_MAP: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const period = request.nextUrl.searchParams.get('period') ?? '24h';
  const periodMs = PERIOD_MAP[period] ?? PERIOD_MAP['24h'];
  const since = new Date(Date.now() - periodMs);

  const stats = await apiUsageRepository.getOverviewStats(since);

  return successResponse({
    period,
    ...stats,
  });
}
