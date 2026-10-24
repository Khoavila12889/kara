import {useState,useEffect,useCallback,useRef} from 'react';
import {Modal} from 'antd';
import {beginYouTubeOAuth} from './youtubeOAuth';
interface UserInfo {id:string;name:string;email:string;picture?:string;}
export const useYouTubeAuth=()=>{
  const [isAuthenticated,setIsAuthenticated]=useState(false),[userInfo,setUserInfo]=useState<UserInfo|null>(null),[isLoading,setIsLoading]=useState(false);
  const popupRef=useRef<Window|null>(null),stateRef=useRef('');
  const checkAuthStatus=useCallback(()=>{
    try{
      const token=localStorage.getItem('youtube_access_token'),raw=localStorage.getItem('youtube_user_info'),expires=Number(localStorage.getItem('youtube_token_expires_at'));
      if(token&&raw&&expires>Date.now()){setUserInfo(JSON.parse(raw));setIsAuthenticated(true);return true;}
    }catch{}
    setIsAuthenticated(false);setUserInfo(null);return false;
  },[]);
  useEffect(()=>{
    checkAuthStatus();
    const storage=(event:StorageEvent)=>{if(['youtube_oauth_result','youtube_access_token','youtube_token_expires_at'].includes(event.key||'')){if(checkAuthStatus())setIsLoading(false);}};
    const message=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==popupRef.current||event.data?.state!==stateRef.current)return;
      if(event.data.type==='youtube_auth_success'){checkAuthStatus();setIsLoading(false);}
      else if(event.data.type==='youtube_auth_error'){setIsLoading(false);Modal.error({title:'Đăng nhập thất bại',content:event.data.error||'Vui lòng thử lại.'});}
    };
    window.addEventListener('storage',storage);window.addEventListener('message',message);
    const timer=setInterval(()=>{if(popupRef.current?.closed){popupRef.current=null;setIsLoading(false);checkAuthStatus();}},1000);
    return()=>{window.removeEventListener('storage',storage);window.removeEventListener('message',message);clearInterval(timer);};
  },[checkAuthStatus]);
  const login=useCallback(async()=>{
    if(isLoading)return;
    setIsLoading(true);
    const mobile=/iPhone|iPad|Android|Opera Mini/i.test(navigator.userAgent);
    // Open synchronously while the click still has browser user activation.
    const popup=mobile?null:window.open('about:blank','youtube-oauth','width=600,height=700');popupRef.current=popup;
    try{
      if(!mobile&&!popup)throw new Error('Popup bị chặn. Vui lòng cho phép popup rồi thử lại.');
      const flow=await beginYouTubeOAuth(!mobile);stateRef.current=flow.state;
      if(popup)popup.location.replace(flow.url);else window.location.assign(flow.url);
    }catch(e){popup?.close();setIsLoading(false);Modal.error({title:'Đăng nhập thất bại',content:e instanceof Error?e.message:'Vui lòng thử lại.'});}
  },[isLoading]);
  const logout=useCallback(()=>Modal.confirm({title:'Đăng xuất',content:'Bạn có chắc muốn đăng xuất khỏi YouTube?',onOk:()=>{
    for(const key of ['youtube_access_token','youtube_user_info','youtube_refresh_token','youtube_token_expires_at'])localStorage.removeItem(key);
    setIsAuthenticated(false);setUserInfo(null);
  }}),[]);
  const getAccessToken=useCallback(()=>checkAuthStatus()?localStorage.getItem('youtube_access_token')||'':'',[checkAuthStatus]);
  return {isAuthenticated,userInfo,isLoading,login,logout,getAccessToken,checkAuthStatus};
};
