import React from 'react';
import { Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

interface RemoteHeaderProps {
  setShowSettings: (show: boolean) => void;
}

const RemoteHeader: React.FC<RemoteHeaderProps> = React.memo(({ setShowSettings }) => (
  <header className="remote-header flex justify-between items-center p-2">
    <h1 className="text-xl text-[#9710F6] font-bold">Remote</h1>
    <Button
      type="text"
      aria-label="Settings"
      icon={<SettingOutlined className="text-xl" />}
      className="text-gray-500 hover:text-white"
      onClick={() => setShowSettings(true)}
    />
  </header>
));

export default RemoteHeader;