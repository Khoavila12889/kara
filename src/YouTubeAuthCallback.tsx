import {useEffect,useRef,useState} from 'react';
import {finishYouTubeOAuth} from './youtubeOAuth';
export default function YouTubeAuthCallback(){
  const callbackUrl=useRef(window.location.href);
  const [status,setStatus]=useState('Đang hoàn tất đăng nhập Google…');
  useEffect(()=>{
    let disposed=false;
    const url=new URL(callbackUrl.current),state=url.searchParams.get('state');
    // Remove the authorization code from the address bar; the promise below is deduplicated in StrictMode.
    window.history.replaceState({},'','/youtube-auth');
    finishYouTubeOAuth(callbackUrl.current).then(flow=>{
      if(disposed)return;
      setStatus('Đăng nhập thành công. Đang quay lại remote…');
      if(flow.popup&&window.opener){window.opener.postMessage({type:'youtube_auth_success',state:flow.state},window.location.origin);window.close();}
      // Mobile must return to the same room (including the private fragment key).
      if(!flow.popup||!window.opener)window.location.replace(flow.redirect);
    }).catch(e=>{
      if(disposed)return;
      const message=e instanceof Error?e.message:'Không thể đăng nhập. Vui lòng thử lại.';
      setStatus(message);
      if(window.opener)window.opener.postMessage({type:'youtube_auth_error',state,error:message},window.location.origin);
    });
    return()=>{disposed=true;};
  },[]);
  return <div style={{padding:24,textAlign:'center'}}><p role="status">{status}</p><a href="/">Về trang chính</a></div>;
}
