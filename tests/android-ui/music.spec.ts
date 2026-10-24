import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // No quota, credentials, or external playback in UI tests.
  await page.addInitScript(() => {
    class Player {
      state = 2;
      element: HTMLElement;
      events: any;
      constructor(element: HTMLElement, options: any) {
        this.element = element; this.events = options.events;
        setTimeout(() => this.events.onReady(), 0);
      }
      playVideo() { this.state = 1; this.events.onStateChange({ data: 1 }); }
      pauseVideo() { this.state = 2; this.events.onStateChange({ data: 2 }); }
      stopVideo() { this.state = 0; }
      cueVideoById() { this.events.onStateChange({ data: 5 }); }
      getPlayerState() { return this.state; }
      getDuration() { return 180; }
      getCurrentTime() { return 0; }
      getVideoLoadedFraction() { return 1; }
      getIframe() { return this.element; }
      setVolume() {} unMute() {} mute() {} destroy() {}
    }
    (window as any).YT = { loaded: 1, Player, PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  });
  await page.route(/youtube\.com|ytimg\.com|googlevideo\.com/, route => route.abort());
  await page.route('https://www.googleapis.com/youtube/v3/search?**', route => route.fulfill({ json: { items: [
    { id: { videoId: 'test-song-1' }, snippet: { title: 'Một bài hát có tên rất dài &amp; giai điệu dành cho một ngày bình yên', channelTitle: 'Khoavila acoustic', thumbnails: { medium: { url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="48"/%3E' } } } },
    { id: { videoId: 'test-song-2' }, snippet: { title: 'Giai điệu tiếp theo', channelTitle: 'Khoavila', thumbnails: { medium: { url: '' } } } },
  ] } }));
});

test('responsive surfaces, QR dialog and touch sizes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/app');
  for (const size of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `test-results/welcome-${size.width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Bắt đầu nghe nhạc' }).click();
  await expect(page.getByRole('heading', { name: 'Hôm nay bạn muốn nghe gì?' })).toBeVisible();
  await page.getByLabel('Tên bài hát hoặc ca sĩ').fill('acoustic');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await expect(page.locator('.music-song')).toHaveCount(2);
  for (const size of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(size);
    await page.screenshot({ path: `test-results/music-${size.width}.png`, fullPage: true });
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('.music-app *')).filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right })));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(overflow)).toBe(true);
    const button = await page.locator('.music-button-add').first().boundingBox();
    expect(button!.width).toBeGreaterThanOrEqual(48); expect(button!.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({ path: `test-results/music-${size.width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Kết nối', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.music-qr canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/connect-390.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('search, enqueue, pause, next and remove synchronize with the room', async ({ page, request }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Bắt đầu nghe nhạc' }).click();
  await page.getByLabel('Tên bài hát hoặc ca sĩ').fill('acoustic');
  await page.getByRole('button', { name: 'Tìm', exact: true }).click();
  await page.locator('.music-button-add').first().click();
  await expect(page.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Phát nhạc', exact: true })).toBeEnabled();
  await page.locator('.music-button-add').nth(1).click();
  await page.getByRole('button', { name: /Hàng đợi/ }).click();
  await expect(page.locator('.music-song')).toHaveCount(2);
  const auth = await page.evaluate(() => {
    const id = localStorage.getItem('khoavilaAndroidRoom')!;
    return { id, token: localStorage.getItem(`karaokeRoomKey:${id}`)! };
  });
  const read = async () => (await request.get(`http://127.0.0.1:4387/api/rooms/${auth.id}`, { headers: { Authorization: `Bearer ${auth.token}` } })).json();
  expect((await read()).state.playing).toBe(false);
  await page.getByRole('button', { name: 'Chuyển bài', exact: true }).click();
  await expect(page.locator('.music-song')).toHaveCount(1);
  expect((await read()).state.currentIndex).toBe(0);
  await page.getByRole('button', { name: 'Xóa Giai điệu tiếp theo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hàng đợi đang trống' })).toBeVisible();
  expect((await read()).state.currentIndex).toBe(-1);
});

test('D-pad navigation, input caret and Back dialog', async ({ page }) => {
  await page.goto('/app');
  const start = page.getByRole('button', { name: 'Bắt đầu nghe nhạc' });
  await start.focus(); await page.keyboard.press('Enter');
  const input = page.getByLabel('Tên bài hát hoặc ca sĩ');
  await input.fill('acoustic'); await page.keyboard.press('ArrowLeft');
  await expect(input).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(input).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('backend explicitly admits Android origin and denies unrelated origins', async ({ request }) => {
  const allowed = await request.post('http://127.0.0.1:4387/api/rooms', { headers: { Origin: 'https://localhost' } });
  expect(allowed.ok()).toBe(true); expect(allowed.headers()['access-control-allow-origin']).toBe('https://localhost');
  const denied = await request.post('http://127.0.0.1:4387/api/rooms', { headers: { Origin: 'https://untrusted.example' } });
  expect(denied.status()).toBe(403);
});

test('remote queue arrives over Socket.IO, remains scrollable and survives reload', async ({ page, request }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Bắt đầu nghe nhạc' }).click();
  await expect(page.getByRole('button', { name: /Hàng đợi/ })).toBeVisible();
  const auth = await page.evaluate(() => {
    const id = localStorage.getItem('khoavilaAndroidRoom')!;
    return { id, token: localStorage.getItem(`karaokeRoomKey:${id}`)! };
  });
  const endpoint = `http://127.0.0.1:4387/api/rooms/${auth.id}`;
  const headers = { Authorization: `Bearer ${auth.token}` };
  const current = await (await request.get(endpoint, { headers })).json();
  const queue = Array.from({ length: 45 }, (_, index) => ({ id: `track${String(index).padStart(6, '0')}`, title: `Bài hát số ${index + 1} — tên dài cho kiểm thử danh sách`, channelTitle: 'Khoavila' }));
  const response = await request.put(endpoint, { headers, data: { version: current.version, state: { ...current.state, queue, currentIndex: -1, playing: false } } });
  expect(response.ok()).toBe(true);
  await expect(page.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
  await page.getByRole('button', { name: /Hàng đợi/ }).click();
  await expect(page.locator('.music-song')).toHaveCount(45);
  await page.setViewportSize({ width: 320, height: 640 });
  const last = page.locator('.music-song-select').last();
  await last.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.music-button-remove').last()).toBeFocused();
  const list = await page.locator('.music-song-list').boundingBox();
  const item = await page.locator('.music-song').last().boundingBox();
  expect(item!.y + item!.height).toBeLessThanOrEqual(list!.y + list!.height + 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const remote = await page.evaluate(async id => {
    const module = await import('/src/roomDatabase.ts');
    return module.remoteRoomUrl(id);
  }, auth.id);
  expect(new URL(remote).origin).toBe('https://music.example.com');
  expect(new URL(remote).hash).toContain('roomKey=');
  await page.reload();
  await page.getByRole('button', { name: 'Bắt đầu nghe nhạc' }).click();
  await expect(page.getByRole('button', { name: /Hàng đợi 45/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Phát nhạc', exact: true })).toBeEnabled();
});
