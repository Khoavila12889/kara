type Flow = {state:string; verifier:string; redirect:string; createdAt:number; popup:boolean};
const prefix='youtube_oauth_flow:';
const random = (length:number) => Array.from(crypto.getRandomValues(new Uint8Array(length)),b=>('0'+b.toString(16)).slice(-2)).join('');
function safeRedirect(value:string) {const url=new URL(value,window.location.origin);if(url.origin!==window.location.origin)throw new Error('Đường dẫn trở về không hợp lệ.');return url.toString();}
export async function beginYouTubeOAuth(popup:boolean) {
  const clientId=(import.meta as any).env.VITE_YOUTUBE_CLIENT_ID;
  if(!clientId)throw new Error('Chưa cấu hình Google Client ID.');
  const returnTo=new URL(window.location.href);returnTo.searchParams.set('tab','youtube-playlists');
  const flow:Flow={state:random(24),verifier:random(48),redirect:safeRedirect(returnTo.toString()),createdAt:Date.now(),popup};
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(flow.verifier));
  const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  localStorage.setItem(prefix+flow.state,JSON.stringify(flow));
  for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(key?.startsWith(prefix)){try{if(Date.now()-JSON.parse(localStorage.getItem(key)!).createdAt>600000)localStorage.removeItem(key);}catch{localStorage.removeItem(key);}}}
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:window.location.origin+'/youtube-auth',response_type:'code',scope:'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent',state:flow.state}).toString();
  return {url:url.toString(),state:flow.state};
}
export function saveYouTubeAuth(data:any) {
  if(typeof data.access_token!=='string'||!data.access_token||!data.user_info?.id||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw new Error('Phản hồi đăng nhập không hợp lệ.');
  localStorage.setItem('youtube_access_token',data.access_token);
  localStorage.setItem('youtube_user_info',JSON.stringify(data.user_info));
  localStorage.setItem('youtube_token_expires_at',String(Date.now()+data.expires_in*1000));
  if(data.refresh_token)localStorage.setItem('youtube_refresh_token',data.refresh_token);
}
const callbacks=new Map<string,Promise<Flow>>();
export function finishYouTubeOAuth(callbackUrl:string):Promise<Flow> {
  const url=new URL(callbackUrl),state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'';
  const key=state+':'+code;
  const existing=callbacks.get(key);if(existing)return existing;
  const pending=(async()=>{
    const raw=localStorage.getItem(prefix+state);
    if(!state||!raw)throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập Google lại từ remote.');
    const flow:Flow=JSON.parse(raw);
    if(flow.state!==state||Date.now()-flow.createdAt>600000)throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng thử lại.');
    flow.redirect=safeRedirect(flow.redirect);
    try{
      if(url.searchParams.get('error'))throw new Error('Bạn chưa cấp quyền truy cập YouTube.');
      if(!code)throw new Error('Google chưa trả mã xác thực.');
      const response=await fetch('/api/youtube/callback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:flow.verifier}),signal:AbortSignal.timeout(25000)});
      const data=await response.json().catch(()=>({error:'Máy chủ đăng nhập trả phản hồi không hợp lệ.'}));
      if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Không thể hoàn tất đăng nhập Google.');
      saveYouTubeAuth(data);
      localStorage.setItem('youtube_oauth_result',JSON.stringify({state,ok:true,time:Date.now()}));
      return flow;
    }finally{localStorage.removeItem(prefix+state);}
  })();
  callbacks.set(key,pending);return pending;
}
