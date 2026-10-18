import { generateKeyPairSync } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MuxService } from './mux.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

function config(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('MuxService', () => {
  it('reports not configured without token credentials', () => {
    const mux = new MuxService(config({}));
    expect(mux.isConfigured()).toBe(false);
    expect(() => mux.signedPlaybackUrl('playback-1')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('builds a signed stream.mux.com HLS URL with an RS256 token', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const mux = new MuxService(
      config({
        MUX_TOKEN_ID: 'token-id',
        MUX_TOKEN_SECRET: 'token-secret',
        MUX_SIGNING_KEY_ID: 'key-id',
        // Stored the way .env holds it: base64 PEM on a single line.
        MUX_SIGNING_KEY_PRIVATE_KEY: Buffer.from(pem).toString('base64'),
      }),
    );
    expect(mux.isConfigured()).toBe(true);
    const url = mux.signedPlaybackUrl('playback-1', 60);
    expect(
      url.startsWith('https://stream.mux.com/playback-1.m3u8?token='),
    ).toBe(true);
    const token = url.split('token=')[1];
    expect(token.split('.')).toHaveLength(3);
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { sub: string; aud: string };
    expect(payload).toMatchObject({ sub: 'playback-1', aud: 'v' });
  });
});
