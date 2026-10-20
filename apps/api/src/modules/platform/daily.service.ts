import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type DailyRoom = {
  id: string;
  name: string;
  url: string;
  created_at?: string;
};

/**
 * Daily.co live-room adapter (plain HTTPS — no SDK).
 *
 * Env (apps/api/.env only):
 *   LIVE_PROVIDER_BASE_URL=https://api.daily.co/v1
 *   DAILY_API_KEY=...   (Developers → Create API key)
 */
@Injectable()
export class DailyService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('DAILY_API_KEY')?.trim());
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('LIVE_PROVIDER_BASE_URL')?.replace(/\/$/, '') ||
      'https://api.daily.co/v1'
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'LIVE_PROVIDER_NOT_CONFIGURED',
        message:
          'Daily is not configured. Set DAILY_API_KEY and LIVE_PROVIDER_BASE_URL=https://api.daily.co/v1 in apps/api/.env (Daily dashboard → Developers), then restart the API.',
        fieldErrors: {},
      });
    }
  }

  async createRoom(input: {
    name?: string;
    startsAt: Date;
    endsAt: Date;
    capacity?: number | null;
  }): Promise<DailyRoom> {
    this.assertConfigured();
    const apiKey = this.config.get<string>('DAILY_API_KEY')!;
    // Room usable from 15 min before start until end + 30 min grace.
    const nbf = Math.floor(input.startsAt.getTime() / 1000) - 15 * 60;
    const exp = Math.floor(input.endsAt.getTime() / 1000) + 30 * 60;
    const body: Record<string, unknown> = {
      privacy: 'public',
      properties: {
        nbf,
        exp,
        enable_chat: true,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
        ...(input.capacity
          ? { max_participants: Math.min(input.capacity, 200) }
          : {}),
      },
    };
    if (input.name) {
      body.name = input.name
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .slice(0, 80);
    }

    const response = await fetch(`${this.baseUrl()}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as
      | DailyRoom
      | { error?: string; info?: string }
      | null;

    if (!response.ok || !json || !('url' in json) || !json.url) {
      const message =
        (json && 'info' in json && json.info) ||
        (json && 'error' in json && json.error) ||
        `Daily room create failed (${response.status})`;
      throw new ServiceUnavailableException({
        code: 'LIVE_PROVIDER_ERROR',
        message: String(message),
        fieldErrors: {},
      });
    }

    return {
      id: json.id || json.name,
      name: json.name,
      url: json.url,
      created_at: json.created_at,
    };
  }
}
