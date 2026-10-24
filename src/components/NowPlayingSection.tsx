import {Button} from 'antd';
import {PlayCircleFilled,PauseCircleFilled,StepBackwardFilled,StepForwardFilled,CustomerServiceOutlined} from '@ant-design/icons';
import {ExtendedSong} from '../types';
interface Props {currentSong:ExtendedSong|undefined;roomData:any;handlePlayerControl:(action:'toggle'|'next'|'prev')=>void;}
export default function NowPlayingSection({currentSong,roomData,handlePlayerControl}:Props){
 const playing=!!currentSong&&roomData?.playing;
 return <section className="remote-player now-playing-section now-playing-fixed" aria-label="Điều khiển phát nhạc">
  <div className="remote-player-info">
   <p className="remote-player-status"><span className={playing?'status-dot is-playing':'status-dot'}/>{currentSong?(playing?'Đang phát':'Đã tạm dừng'):'Âm nhạc của bạn'}<span className="remote-player-label">{roomData?.mode==='music'?'MUSIC':'KARAOKE'}</span></p>
   <h2 className="remote-song-title" title={currentSong?.title}>{currentSong?.title||'Hôm nay, bạn muốn nghe gì?'}</h2>
   {!currentSong&&<p className="remote-player-hint">Tìm một bài hát để bắt đầu cuộc vui.</p>}
  </div>
  <div className="remote-player-controls">
   <Button type="text" shape="circle" aria-label="Previous Song" title="Bài trước" disabled={!roomData?.queue?.length} onClick={()=>handlePlayerControl('prev')} icon={<StepBackwardFilled/>}/>
   <Button type="text" shape="circle" className="remote-play-button" aria-label={roomData?.playing?'Pause':'Play'} title={playing?'Tạm dừng':'Phát nhạc'} disabled={!roomData?.queue?.length} onClick={()=>handlePlayerControl('toggle')} icon={roomData?.playing?<PauseCircleFilled/>:<PlayCircleFilled/>}/>
   <Button type="text" shape="circle" aria-label="Next Song" title="Bài tiếp theo" disabled={!roomData?.queue?.length} onClick={()=>handlePlayerControl('next')} icon={<StepForwardFilled/>}/>
  </div>
 </section>;
}
