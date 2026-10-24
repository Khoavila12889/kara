import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

export type RoomState = { queue: any[]; currentIndex: number; playing: boolean; [key: string]: any };
export const initialState = (): RoomState => ({queue: [], currentIndex: -1, playing: false, mode: 'karaoke'});
export class RoomError extends Error { constructor(public status: number, message: string) { super(message); } }
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
export function validateState(value: any): RoomState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RoomError(400, 'Trạng thái phòng không hợp lệ.');
  const allowed = ['queue','currentIndex','playing','mode','playRequestTimestamp','currentPlaylistId','musicSource','youtubeAuth'];
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new RoomError(400, 'Trường dữ liệu không được hỗ trợ.');
  const s = {...initialState(), ...value};
  if (!Array.isArray(s.queue) || s.queue.length > 1000 || s.queue.some((song: any) => !song || typeof song.id !== 'string' || !song.id || song.id.length > 128 || typeof song.title !== 'string' || song.title.length > 1000)) throw new RoomError(400, 'Danh sách bài hát không hợp lệ hoặc vượt 1000 bài.');
  if (!Number.isInteger(s.currentIndex) || s.currentIndex < -1 || s.currentIndex >= s.queue.length || typeof s.playing !== 'boolean' || !['karaoke','music'].includes(s.mode)) throw new RoomError(400, 'Trạng thái phát không hợp lệ.');
  if (s.playRequestTimestamp !== undefined && (!Number.isSafeInteger(s.playRequestTimestamp) || s.playRequestTimestamp < 0)) throw new RoomError(400, 'Thời gian phát không hợp lệ.');
  if (s.currentPlaylistId !== undefined && s.currentPlaylistId !== null && (typeof s.currentPlaylistId !== 'string' || s.currentPlaylistId.length > 200)) throw new RoomError(400, 'Playlist không hợp lệ.');
  if (JSON.stringify(s).length > 512000) throw new RoomError(413, 'Dữ liệu phòng quá lớn.');
  return s;
}
export class RoomStore {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true, mode:0o700});
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);');
    if (path !== ':memory:') chmodSync(path, 0o600);
  }
  create() {
    if ((this.db.prepare('SELECT count(*) AS n FROM rooms').get() as any).n >= 10000) throw new RoomError(429, 'Đã đạt giới hạn phòng.');
    const token = randomBytes(32).toString('base64url');
    let id: string;
    do { id = randomBytes(4).toString('hex').slice(0,6).toUpperCase(); } while (this.db.prepare('SELECT id FROM rooms WHERE id=?').get(id));
    const state = initialState(), now = Date.now();
    this.db.prepare('INSERT INTO rooms(id,token_hash,state,created_at,updated_at) VALUES(?,?,?,?,?)').run(id,hash(token),JSON.stringify(state),now,now);
    return {id, token, state, version:1};
  }
  read(id: string, token: string) {
    if (!/^[A-Z0-9]{6}$/.test(id) || typeof token !== 'string' || token.length < 32 || token.length > 100) throw new RoomError(403, 'Mã truy cập phòng không hợp lệ. Hãy quét lại QR trên TV.');
    const row = this.db.prepare('SELECT state,version FROM rooms WHERE id=? AND token_hash=?').get(id,hash(token)) as any;
    if (!row) throw new RoomError(403, 'Phòng không tồn tại hoặc mã truy cập không đúng. Hãy quét lại QR.');
    return {id, state:JSON.parse(row.state) as RoomState, version:row.version as number};
  }
  write(id: string, token: string, version: number, state: any) {
    this.read(id,token);
    if (!Number.isSafeInteger(version) || version < 1) throw new RoomError(400, 'Thiếu phiên bản phòng.');
    const clean = validateState(state);
    const result = this.db.prepare('UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE id=? AND token_hash=? AND version=?').run(JSON.stringify(clean),Date.now(),id,hash(token),version);
    if (!result.changes) throw new RoomError(409, 'Phòng vừa thay đổi; hãy đọc phiên bản mới.');
    return {id, state:clean, version:version+1};
  }
  close() { this.db.close(); }
}
