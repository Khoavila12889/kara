import type { Express, Request, Response } from 'express';
import type { Server as HTTPServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomStore, RoomError } from './room-store';

export function installRooms(app: Express, server: HTTPServer, path: string, origins: string[]) {
  const store = new RoomStore(path);
  const io = new Server(server, {path:'/api/rooms/socket.io', maxHttpBufferSize:1024,
    cors:{origin:origins}, allowRequest:(req,cb) => cb(null,!req.headers.origin || origins.includes(req.headers.origin))});
  const buckets = new Map<string,{n:number;until:number}>();
  app.use('/api/rooms', (req,res,next) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    if (req.headers.origin && !origins.includes(req.headers.origin)) return void res.status(403).json({error:'Origin không được phép.'});
    next();
  });
  const token = (req: Request) => (req.headers.authorization || '').replace(/^Bearer /,'');
  const error = (res: Response, err: unknown) => res.status(err instanceof RoomError ? err.status : 500).json({error:err instanceof RoomError ? err.message : 'Lỗi lưu dữ liệu phòng.'});
  app.get('/api/rooms/health', (_req,res) => { try {store.db.prepare('SELECT 1').get();res.json({ok:true,storage:'sqlite'});} catch(e) {error(res,e);} });
  app.post('/api/rooms', (req,res) => {
    const now=Date.now(), key=req.ip || 'unknown';
    for (const [k,v] of buckets) if(v.until<now) buckets.delete(k);
    const b=buckets.get(key) || {n:0,until:now+600000};
    if (++b.n>100) return void res.status(429).json({error:'Tạo phòng quá nhanh. Vui lòng thử lại sau.'});
    buckets.set(key,b);
    try {res.status(201).json(store.create());} catch(e){error(res,e);}
  });
  app.get('/api/rooms/:id', (req,res) => {try {res.json(store.read(req.params.id,token(req)));} catch(e){error(res,e);}});
  app.put('/api/rooms/:id', (req,res) => {
    try {const result=store.write(req.params.id,token(req),req.body.version,req.body.state);io.to(result.id).emit('room:state',result);res.json(result);} catch(e){error(res,e);}
  });
  io.on('connection', socket => {
    let joins=0;
    socket.on('room:join', async (input, ack) => {
      if (typeof ack !== 'function') return;
      try {
        if (++joins>100) throw new RoomError(429,'Quá nhiều yêu cầu kết nối.');
        const result=store.read(input?.id,input?.token);
        for(const room of socket.rooms) if(room!==socket.id) await socket.leave(room);
        await socket.join(result.id);
        ack({ok:true,...store.read(result.id,input.token)});
      } catch(e) {ack({ok:false,error:e instanceof RoomError?e.message:'Không thể kết nối phòng.'});}
    });
    socket.on('room:leave', (id: string) => {if(typeof id==='string') void socket.leave(id);});
  });
  return {store,io};
}
