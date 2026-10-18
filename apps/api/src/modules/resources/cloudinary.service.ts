import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';

type CloudinaryResource = {
  public_id: string;
  format?: string;
  duration?: number;
  bytes?: number;
};

/**
 * Cloudinary adapter — the BACKUP video provider (Mux stays primary for
 * signed playback / best UX). Used automatically when Mux is not configured
 * or its upload-slot request fails, or forced with VIDEO_PROVIDER=cloudinary.
 *
 * Credentials live ONLY in apps/api/.env (never in the admin app):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * Get them from cloudinary.com → Dashboard (top of the home page) or
 * Settings → API Keys. The browser uploads directly to Cloudinary with a
 * short-lived server signature — the API secret never leaves the server.
 *
 * Note: backup playback is an unlisted Cloudinary delivery URL (random
 * public_id), not signed/DRM like Mux. Keep Mux primary for paid content.
 */
@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('CLOUDINARY_CLOUD_NAME') &&
      this.config.get<string>('CLOUDINARY_API_KEY') &&
      this.config.get<string>('CLOUDINARY_API_SECRET'),
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'VIDEO_BACKUP_NOT_CONFIGURED',
        message:
          'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in apps/api/.env (cloudinary.com → Dashboard), then restart the API.',
        fieldErrors: {},
      });
    }
  }

  private cloudName(): string {
    return this.config.get<string>('CLOUDINARY_CLOUD_NAME')!;
  }

  /** Cloudinary signature: SHA-1 of sorted "k=v&k=v" params + API secret. */
  sign(params: Record<string, string>): string {
    const secret = this.config.get<string>('CLOUDINARY_API_SECRET')!;
    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1')
      .update(toSign + secret)
      .digest('hex');
  }

  /**
   * Step 1 of a backup upload: everything the browser needs to POST the file
   * straight to Cloudinary. `publicId` embeds the resource id + random suffix
   * so the delivery URL is unguessable enough for a backup path.
   */
  createSignedUpload(publicId: string) {
    this.assertConfigured();
    const folder =
      this.config.get<string>('CLOUDINARY_FOLDER') ?? 'redi/videos';
    const fullPublicId = `${folder}/${publicId}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    // sp_hd asks Cloudinary to also prepare an adaptive (HLS) streaming copy.
    const params: Record<string, string> = {
      eager: 'sp_hd',
      eager_async: 'true',
      public_id: fullPublicId,
      timestamp,
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName()}/video/upload`,
      publicId: fullPublicId,
      formFields: {
        ...params,
        api_key: this.config.get<string>('CLOUDINARY_API_KEY')!,
        signature: this.sign(params),
      },
    };
  }

  /** Poll target: 200 once Cloudinary has ingested the video, 404 while not. */
  async getResource(publicId: string): Promise<CloudinaryResource | null> {
    this.assertConfigured();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')!;
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')!;
    const encoded = publicId
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('%2F');
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName()}/resources/video/upload/${encoded}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ServiceUnavailableException({
        code: 'VIDEO_PROVIDER_ERROR',
        message: `Cloudinary request failed (${response.status})`,
        fieldErrors: {},
      });
    }
    return (await response.json()) as CloudinaryResource;
  }

  /** Adaptive HLS delivery URL (sp_hd streaming profile). */
  playbackUrl(publicId: string): string {
    return `https://res.cloudinary.com/${this.cloudName()}/video/upload/sp_hd/${publicId}.m3u8`;
  }

  /** Progressive MP4 fallback if HLS is not enabled on the Cloudinary account. */
  fallbackMp4Url(publicId: string): string {
    return `https://res.cloudinary.com/${this.cloudName()}/video/upload/${publicId}.mp4`;
  }
}
