import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';

type MuxUpload = {
  id: string;
  url: string;
  asset_id?: string;
  status?: string;
};
type MuxAsset = {
  id: string;
  status?: string;
  playback_ids?: { id: string; policy?: string }[];
  errors?: { type?: string; messages?: string[] };
};

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Thin Mux Video adapter (no SDK dependency — plain HTTPS + Basic auth).
 *
 * Credentials live ONLY in apps/api/.env (never in the admin app):
 *   MUX_TOKEN_ID, MUX_TOKEN_SECRET          — API access token
 *   MUX_SIGNING_KEY_ID, MUX_SIGNING_KEY_PRIVATE_KEY — signed playback (base64 PEM)
 * When unset, every call fails with VIDEO_PROVIDER_NOT_CONFIGURED so the
 * admin shows "not configured" instead of inventing an upload/stream URL.
 */
@Injectable()
export class MuxService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('MUX_TOKEN_ID') &&
      this.config.get<string>('MUX_TOKEN_SECRET'),
    );
  }

  isSigningConfigured(): boolean {
    return Boolean(
      this.config.get<string>('MUX_SIGNING_KEY_ID') &&
      this.config.get<string>('MUX_SIGNING_KEY_PRIVATE_KEY'),
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'VIDEO_PROVIDER_NOT_CONFIGURED',
        message:
          'Mux is not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET in apps/api/.env (Mux Dashboard → Settings → API Access Tokens), then restart the API.',
        fieldErrors: {},
      });
    }
  }

  private async muxFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    const tokenId = this.config.get<string>('MUX_TOKEN_ID')!;
    const tokenSecret = this.config.get<string>('MUX_TOKEN_SECRET')!;
    const response = await fetch(`https://api.mux.com${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
        ...(init.headers ?? {}),
      },
    });
    const body = (await response.json().catch(() => null)) as {
      data?: T;
      error?: { messages?: string[] };
    } | null;
    if (!response.ok || !body?.data) {
      throw new ServiceUnavailableException({
        code: 'VIDEO_PROVIDER_ERROR',
        message:
          body?.error?.messages?.join(', ') ||
          `Mux request failed (${response.status})`,
        fieldErrors: {},
      });
    }
    return body.data;
  }

  /** Step 1 of an admin upload: Mux returns a one-shot URL the browser PUTs the file to. */
  createDirectUpload(corsOrigin: string) {
    return this.muxFetch<MuxUpload>('/video/v1/uploads', {
      method: 'POST',
      body: JSON.stringify({
        cors_origin: corsOrigin,
        new_asset_settings: { playback_policy: ['signed'] },
      }),
    });
  }

  getUpload(uploadId: string) {
    return this.muxFetch<MuxUpload>(`/video/v1/uploads/${uploadId}`);
  }

  getAsset(assetId: string) {
    return this.muxFetch<MuxAsset>(`/video/v1/assets/${assetId}`);
  }

  /**
   * Short-lived signed HLS URL: https://stream.mux.com/<playbackId>.m3u8?token=<RS256 JWT>
   * The private key may be stored as raw PEM (with \n escapes) or base64-encoded PEM.
   */
  signedPlaybackUrl(playbackId: string, expiresInSeconds = 60 * 60): string {
    if (!this.isSigningConfigured()) {
      throw new ServiceUnavailableException({
        code: 'VIDEO_SIGNING_NOT_CONFIGURED',
        message:
          'Mux signed playback is not configured. Set MUX_SIGNING_KEY_ID and MUX_SIGNING_KEY_PRIVATE_KEY in apps/api/.env (Mux Dashboard → Settings → Signing Keys), then restart the API.',
        fieldErrors: {},
      });
    }
    const keyId = this.config.get<string>('MUX_SIGNING_KEY_ID')!;
    const rawKey = this.config.get<string>('MUX_SIGNING_KEY_PRIVATE_KEY')!;
    const privateKey = rawKey.includes('BEGIN')
      ? rawKey.replace(/\\n/g, '\n')
      : Buffer.from(rawKey, 'base64').toString('utf8');

    const header = base64Url(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId }),
    );
    const payload = base64Url(
      JSON.stringify({
        sub: playbackId,
        aud: 'v',
        exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      }),
    );
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const signature = base64Url(signer.sign(privateKey));
    return `https://stream.mux.com/${playbackId}.m3u8?token=${header}.${payload}.${signature}`;
  }
}
