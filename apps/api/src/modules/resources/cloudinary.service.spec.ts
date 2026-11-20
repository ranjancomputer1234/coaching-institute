import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { CloudinaryService } from './cloudinary.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

const configured = () =>
  new CloudinaryService(
    config({
      CLOUDINARY_CLOUD_NAME: 'demo-cloud',
      CLOUDINARY_API_KEY: '12345',
      CLOUDINARY_API_SECRET: 's3cret',
    }),
  );

describe('CloudinaryService (backup provider)', () => {
  it('reports not configured without credentials', () => {
    expect(new CloudinaryService(config({})).isConfigured()).toBe(false);
  });

  it('creates a signed direct-upload payload the browser can POST', () => {
    const upload = configured().createSignedUpload('v_abc123');
    expect(upload.uploadUrl).toBe(
      'https://api.cloudinary.com/v1_1/demo-cloud/video/upload',
    );
    expect(upload.publicId).toBe('redi/videos/v_abc123');
    expect(upload.formFields.api_key).toBe('12345');
    // Signature must be SHA-1 of the sorted params + secret (Cloudinary spec).
    const fields: Record<string, string> = { ...upload.formFields };
    const signature = fields.signature;
    delete fields.api_key;
    delete fields.signature;
    const expected = createHash('sha1')
      .update(
        Object.keys(fields)
          .sort()
          .map((key) => `${key}=${fields[key]}`)
          .join('&') + 's3cret',
      )
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('builds HLS and MP4 delivery URLs', () => {
    const service = configured();
    expect(service.playbackUrl('redi/videos/v_abc123')).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/sp_hd/redi/videos/v_abc123.m3u8',
    );
    expect(service.fallbackMp4Url('redi/videos/v_abc123')).toBe(
      'https://res.cloudinary.com/demo-cloud/video/upload/redi/videos/v_abc123.mp4',
    );
  });

  it('creates a signed authenticated raw upload for PDFs', () => {
    const upload = configured().createSignedRawUpload('f_abc');
    expect(upload.uploadUrl).toBe(
      'https://api.cloudinary.com/v1_1/demo-cloud/raw/upload',
    );
    expect(upload.publicId).toBe('redi/storage/f_abc');
    expect(upload.formFields.type).toBe('authenticated');
  });

  it('builds an authenticated raw delivery URL', () => {
    const url = configured().authenticatedFileUrl(
      'redi/storage/f_abc',
      new Date(Date.now() + 60_000),
    );
    expect(url).toContain(
      'https://res.cloudinary.com/demo-cloud/raw/authenticated/s--',
    );
    expect(url).toContain('/redi/storage/f_abc');
    expect(configured().publicIdFromStorageKey('cloudinary:redi/storage/f_abc')).toBe(
      'redi/storage/f_abc',
    );
  });
});
