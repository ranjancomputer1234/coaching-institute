import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';

type CloudinaryResource = {
  public_id: string;
  format?: string;
  duration?: number;
  bytes?: number;
};

/**
 * Cloudinary adapter — BACKUP video provider (Mux stays primary) and the
 * object-storage backend for protected PDFs / raw files.
 *
 * Credentials live ONLY in apps/api/.env (never in the admin app):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 * Optional for time-limited delivery tokens:
 *   CLOUDINARY_AUTH_TOKEN_KEY (from Cloudinary Settings → Security)
 *
 * The browser uploads directly to Cloudinary with a short-lived server
 * signature — the API secret never leaves the server.
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
          'File upload is not configured yet. Paste a public https image link. To turn on Choose File, set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the API.',
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
  /** Signed slot for a banner image. The browser POSTs the file to Cloudinary. */
  createSignedImageUpload() {
    this.assertConfigured();
    const folder = 'redi/banners';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const publicId = `banner_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const params: Record<string, string> = {
      folder,
      public_id: publicId,
      timestamp,
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName()}/image/upload`,
      formFields: {
        ...params,
        api_key: this.config.get<string>('CLOUDINARY_API_KEY')!,
        signature: this.sign(params),
      },
    };
  }

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

  /**
   * Signed slot for a protected PDF/notes/audio file (raw upload, authenticated type).
   * Browser POSTs multipart form directly to Cloudinary.
   */
  createSignedRawUpload(publicIdSuffix: string) {
    this.assertConfigured();
    const folder =
      this.config.get<string>('CLOUDINARY_FILES_FOLDER') ?? 'redi/storage';
    const fullPublicId = `${folder}/${publicIdSuffix}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const params: Record<string, string> = {
      public_id: fullPublicId,
      timestamp,
      type: 'authenticated',
    };
    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName()}/raw/upload`,
      publicId: fullPublicId,
      formFields: {
        ...params,
        api_key: this.config.get<string>('CLOUDINARY_API_KEY')!,
        signature: this.sign(params),
      },
    };
  }

  /**
   * Short-lived delivery URL for an authenticated raw asset.
   * Always uses a delivery signature. When CLOUDINARY_AUTH_TOKEN_KEY is set,
   * also attaches a time-limited `__cld_token` so the URL stops working after expiresAt.
   */
  authenticatedFileUrl(publicId: string, expiresAt: Date): string {
    this.assertConfigured();
    const secret = this.config.get<string>('CLOUDINARY_API_SECRET')!;
    const toSign = publicId;
    const signature = createHash('sha1')
      .update(toSign + secret)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .slice(0, 8);
    const encodedId = publicId
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    let url = `https://res.cloudinary.com/${this.cloudName()}/raw/authenticated/s--${signature}--/${encodedId}`;

    const tokenKey = this.config.get<string>('CLOUDINARY_AUTH_TOKEN_KEY')?.trim();
    if (tokenKey) {
      const token = this.buildAuthToken(publicId, expiresAt, tokenKey);
      url += `?__cld_token=${encodeURIComponent(token)}`;
    }
    return url;
  }

  /** Cloudinary auth token (HMAC-SHA256) for time-limited access. */
  private buildAuthToken(
    publicId: string,
    expiresAt: Date,
    hexKey: string,
  ): string {
    const start = Math.floor(Date.now() / 1000) - 30;
    const expiration = Math.floor(expiresAt.getTime() / 1000);
    const acl = `/${publicId}`;
    const toSign = `st=${start}~exp=${expiration}~acl=${acl}`;
    const keyBuf = Buffer.from(hexKey, 'hex');
    const digest = createHmac('sha256', keyBuf).update(toSign).digest('hex');
    return `${toSign}~hmac=${digest}`;
  }

  /** Strip `cloudinary:` prefix from a mediaAsset.storageKey. */
  publicIdFromStorageKey(storageKey: string): string | null {
    const key = storageKey.trim();
    if (key.startsWith('cloudinary:')) {
      return key.slice('cloudinary:'.length) || null;
    }
    return null;
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

  /**
   * URL a player can actually open. Many Cloudinary plans never finish the
   * sp_hd HLS copy, so a broken .m3u8 is replaced with the progressive MP4.
   */
  async playableDelivery(publicId: string): Promise<{
    hls: boolean;
    url: string;
    fallbackUrl: string | null;
  }> {
    const mp4 = this.fallbackMp4Url(publicId);
    const hls = this.playbackUrl(publicId);
    const cached = this.playable.get(publicId);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
      return cached.hls
        ? { hls: true, url: hls, fallbackUrl: mp4 }
        : { hls: false, url: mp4, fallbackUrl: null };
    }
    const hlsOk = await this.reachable(hls);
    this.playable.set(publicId, { at: Date.now(), hls: hlsOk });
    return hlsOk
      ? { hls: true, url: hls, fallbackUrl: mp4 }
      : { hls: false, url: mp4, fallbackUrl: null };
  }

  private readonly playable = new Map<string, { at: number; hls: boolean }>();

  private async reachable(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
