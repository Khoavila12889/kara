import React from 'react';
import {Button} from 'antd';
import {CustomerServiceOutlined,SettingOutlined} from '@ant-design/icons';
interface RemoteHeaderProps {setShowSettings:(show:boolean)=>void;roomId?:string|null;mode?:string;}
const RemoteHeader:React.FC<RemoteHeaderProps>=React.memo(({setShowSettings,roomId,mode})=>(
 <header className="remote-header">
  <div className="remote-brand"><span className="remote-brand-mark"><CustomerServiceOutlined/></span><div><h1>Khoavila</h1><p>{roomId?`Phòng ${roomId}`:'Điều khiển âm nhạc'}<span className="remote-mode">{mode==='music'?'Music':'Karaoke'}</span></p></div></div>
  <Button type="text" aria-label="Settings" title="Cài đặt phòng" icon={<SettingOutlined/>} onClick={()=>setShowSettings(true)}/>
 </header>
));
export default RemoteHeader;
