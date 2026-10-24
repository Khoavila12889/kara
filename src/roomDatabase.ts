import { io } from 'socket.io-client';
import { apiOrigin, publicOrigin } from './platform';

export const database = Object.freeze({backend:'sqlite'});
export type DatabaseReference = {id:string;field?:string};
type State = {id:string;state:any;version:number};
const keys = new Map<string,string>();
const watches = new Map<string,Set<{next:(snapshot:any)=>void;error:(error:Error)=>void;version:number;active:boolean}>>();
const socket = io(apiOrigin || undefined, {path:'/api/rooms/socket.io',autoConnect:false});
export function rememberRoomToken(id:string, token:string) {
  if (!/^[A-Z0-9]{6}$/.test(id) || !/^[A-Za-z0-9_-]{32,100}$/.test(token)) throw new Error('Mã truy cập phòng không hợp lệ.');
  keys.set(id,token);localStorage.setItem('karaokeRoomKey:'+id,token);
}
export function roomToken(id:string):string {
  const token=keys.get(id)||localStorage.getItem('karaokeRoomKey:'+id);
  if(!token) throw new Error('Thiếu mã truy cập phòng. Hãy quét lại QR trên TV.');
  return token;
}
const params=new URLSearchParams(window.location.search);
const roomKey=new URLSearchParams(window.location.hash.slice(1)).get('roomKey') || params.get('roomKey');
if(params.get('roomId')&&roomKey) rememberRoomToken(params.get('roomId')!,roomKey);
async function request(path:string, options:RequestInit={}) {
  const response=await fetch(apiOrigin+'/api/rooms'+path,{...options,cache:'no-store',signal:AbortSignal.timeout(10000)});
  const body=await response.json().catch(()=>({error:'Backend phòng không trả dữ liệu hợp lệ.'}));
  if(!response.ok) {const err=Object.assign(new Error(body.error||'Không thể kết nối phòng.'),{status:response.status});throw err;}
  return body;
}
let pendingCreation: Promise<string> | undefined;
export function createRoom():Promise<string> {
  if(pendingCreation) return pendingCreation;
  pendingCreation=createNewRoom().finally(()=>{pendingCreation=undefined;});return pendingCreation;
}
async function createNewRoom():Promise<string> {
  const result=await request('',{method:'POST'});
  rememberRoomToken(result.id,result.token);return result.id;
}
export function remoteRoomUrl(id:string) {
  const url=new URL('/remote',publicOrigin);
  url.searchParams.set('roomId',id);url.hash=new URLSearchParams({roomKey:roomToken(id)}).toString();return url.toString();
}
export function ref(_db:unknown,path:string):DatabaseReference {
  const match=/^rooms\/([A-Z0-9]{6})(?:\/(playing|mode))?$/.exec(path);
  if(!match) throw new Error('Đường dẫn phòng không hợp lệ.');
  return {id:match[1],field:match[2]};
}
function snapshot(value:any) {return {val:()=>structuredClone(value),exists:()=>value!==null};}
function publish(result:State) {
  for(const watch of watches.get(result.id)||[]) if(watch.active&&result.version>watch.version) {
    watch.version=result.version;watch.next(snapshot(result.state));
  }
}
function join(id:string) {
  let token:string;try{token=roomToken(id);}catch(e){for(const w of watches.get(id)||[])w.error(e as Error);return;}
  socket.timeout(10000).emit('room:join',{id,token},(err:Error|null,result:any)=>{
    const current=watches.get(id);if(!current?.size)return;
    if(err||!result?.ok) {for(const w of current)w.error(new Error(result?.error||'Không thể kết nối phòng.'));return;}
    publish(result);
  });
}
socket.on('room:state',publish);
socket.on('connect',()=>{for(const id of watches.keys())join(id);});
socket.on('connect_error',()=>{for(const list of watches.values())for(const w of list)w.error(new Error('Mất kết nối máy chủ phòng. Đang thử kết nối lại.'));});
export function onValue(reference:DatabaseReference,next:(snapshot:any)=>void,error:(error:Error)=>void=()=>{}) {
  const watch={next:(s:any)=>next(reference.field?snapshot(s.val()?.[reference.field]??null):s),error,version:0,active:true};
  let list=watches.get(reference.id);if(!list){list=new Set();watches.set(reference.id,list);}list.add(watch);
  if(socket.connected)join(reference.id);else socket.connect();
  return ()=>{watch.active=false;list!.delete(watch);if(!list!.size){watches.delete(reference.id);socket.emit('room:leave',reference.id);}if(!watches.size)socket.disconnect();};
}
export async function runTransaction(reference:DatabaseReference, updater:(state:any)=>any) {
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+roomToken(reference.id)};
  for(let attempt=0;attempt<100;attempt++) {
    const current:State=await request('/'+reference.id,{headers});
    const state=structuredClone(current.state);
    const next=updater(reference.field?state[reference.field]:state);
    if(next===undefined) return {committed:false,snapshot:snapshot(current.state)};
    if(next===null) throw new Error('Không hỗ trợ xóa phòng trong thao tác cập nhật.');
    const value=reference.field?{...state,[reference.field]:next}:next;
    try {
      const result=await request('/'+reference.id,{method:'PUT',headers,body:JSON.stringify({version:current.version,state:value})});
      publish(result);return {committed:true,snapshot:snapshot(result.state)};
    } catch(e) {
      if((e as any).status!==409)throw e;
      await new Promise(resolve=>setTimeout(resolve,10+Math.random()*Math.min(200,attempt*15+20)));
    }
  }
  throw new Error('Phòng đang có quá nhiều thao tác. Vui lòng thử lại.');
}
export async function set(reference:DatabaseReference,value:any) {return runTransaction(reference,()=>value);}
export async function update(reference:DatabaseReference,changes:any) {return runTransaction(reference,current=>({...current,...changes}));}
