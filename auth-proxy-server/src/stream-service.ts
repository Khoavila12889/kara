import type { Express, Request, Response } from 'express';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

/**
 * Resolves a YouTube audio stream with yt-dlp and proxies it through this
 * server. googlevideo URLs are bound to the resolving IP, so the phone cannot
 * fetch them directly.
 */
type CacheEntry = { url: string; expires: number };

const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
const RESOLVE_TIMEOUT_MS = 25_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip) ?? { count: 0, resetAt: now + 60_000 };
  if (bucket.resetAt < now) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  buckets.set(ip, bucket);
  if (buckets.size > 5_000) {
    for (const [key, value] of buckets) if (value.resetAt < now) buckets.delete(key);
  }
  return bucket.count > 60;
}

function runYtDlp(videoId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_PATH || 'yt-dlp';
    const args = [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '-g',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      // Windows cannot spawn .cmd shims without a shell; videoId is validated above.
      shell: process.platform === 'win32',
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Hết thời gian lấy luồng audio.'));
    }, RESOLVE_TIMEOUT_MS);

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        const reason = stderr.split('\n').map(line => line.trim()).filter(Boolean).pop();
        return reject(new Error(reason || 'Không lấy được luồng audio.'));
      }
      const url = stdout.split('\n').map(line => line.trim()).find(line => line.startsWith('http'));
      if (!url) return reject(new Error('Không lấy được luồng audio.'));
      resolve(url);
    });
  });
}

async function resolveAudio(videoId: string): Promise<string> {
  const cached = cache.get(videoId);
  if (cached && cached.expires > Date.now()) return cached.url;

  const running = inflight.get(videoId);
  if (running) return running;

  const task = runYtDlp(videoId)
    .then(url => {
      cache.set(videoId, { url, expires: Date.now() + CACHE_TTL_MS });
      return url;
    })
    .finally(() => { inflight.delete(videoId); });

  inflight.set(videoId, task);
  return task;
}

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'last-modified',
  'etag',
];

export function installStream(app: Express) {
  app.get('/api/stream/:id', async (req: Request, res: Response) => {
    const videoId = String(req.params.id);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return void res.status(400).json({ error: 'Mã video không hợp lệ.' });
    }
    if (rateLimited(req.ip || 'unknown')) {
      return void res.status(429).json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' });
    }

    let upstream: globalThis.Response;
    try {
      const url = await resolveAudio(videoId);
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Referer: 'https://www.youtube.com/',
      };
      const range = req.headers.range;
      if (typeof range === 'string') headers.Range = range;
      upstream = await fetch(url, { headers });
    } catch (error) {
      return void res.status(502).json({ error: (error as Error).message || 'Không tải được luồng audio.' });
    }

    if (!upstream.ok && upstream.status !== 206) {
      return void res.status(502).json({ error: 'Nguồn audio từ chối yêu cầu.' });
    }

    res.status(upstream.status);
    for (const name of PASSTHROUGH_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('Cache-Control', 'no-store');

    if (!upstream.body) {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(upstream.body as any);
    req.on('close', () => { stream.destroy(); });
    stream.on('error', () => { res.destroy(); });
    stream.pipe(res);
  });
}
