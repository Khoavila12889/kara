import { Modal, Card, Button, Badge, List, Tag, Segmented } from 'antd';
import {
  WifiOutlined,
  UnorderedListOutlined,
  InfoCircleOutlined,
  CopyOutlined,
  DesktopOutlined,
  ToolOutlined,
  ClockCircleFilled
} from '@ant-design/icons';
import { ref, set } from 'firebase/database';
import { database } from '../firebase';
import { BackgroundOption } from '../types';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (value: boolean) => void;
  backgroundOptions: BackgroundOption[];
  background: string;
  handleThemeChange: (newTheme: string, newBackground?: string) => void;
  roomData: any;
  roomId: string | null;
  apiUsage: number;
  handleResetApiUsage: () => void;
  setActiveTab: (tab: string) => void;
  search: (keyword: string) => void;
  query: string;
}

const SettingsModal = ({
  showSettings,
  setShowSettings,
  backgroundOptions,
  background,
  handleThemeChange,
  roomData,
  roomId,
  apiUsage,
  handleResetApiUsage,
  setActiveTab,
  search,
  query
}: SettingsModalProps) => {
  // Define color mapping - dễ dàng thêm/sửa mã màu ở đây
  const colorMap: Record<string, string> = {
    'bg-1': '#fcd8d8da',
    'bg-2': '#c178faa8',
    'bg-3': '#f176e78c',
    'bg-4': '#66e27a',
  };

  return (
    <Modal
      title="Cài đặt"
      open={showSettings}
      onCancel={() => setShowSettings(false)}
      footer={null}
      style={{ top: 2 }}
      className="settings-modal"
      width={400}
    >
      <div className="settings-content">
        <Card title={<> Màu nền</>} size="small">
          <div className="space-y-4">
            <div>
              <div className="grid grid-cols-4 gap-2">
                {backgroundOptions.map(bg => {
                  const bgColor = colorMap[bg.value] || '#ffffff';

                  return (
                    <div
                      key={bg.value}
                      className={`w-8 h-8 rounded cursor-pointer border-2 ${background === bg.value ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'}`}
                      style={{ backgroundColor: bgColor }}
                      onClick={() => {
                        handleThemeChange(bg.theme, bg.value);
                        setShowSettings(false);
                      }}
                      title={bg.label}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card title={<><DesktopOutlined /> Chế độ</>} size="small">
          <Segmented
            options={[{ label: 'Karaoke', value: 'karaoke', icon: <span>🎤</span> }, { label: 'Nghe nhạc', value: 'music', icon: <span>🎧</span> }]}
            value={roomData?.mode || 'karaoke'}
            onChange={(value) => {
              if (!roomId) return;
              set(ref(database, `rooms/${roomId}/mode`), value);
              if (value === 'karaoke') {
                setActiveTab('search');
                if (query.trim()) {
                  search(query.trim());
                }
              } else {
                setActiveTab('youtube-playlists');
              }
              setShowSettings(false); // Close the modal after mode selection
            }}
            block
          />
        </Card>

        <Card title={<><InfoCircleOutlined /> status</>} size="small">
          <List size="small">
            <List.Item>
              <List.Item.Meta
                avatar={<WifiOutlined />}
                title="Trạng thái"
                description={roomData ? "Đã kết nối" : "Chưa kết nối"}
              />
              <Badge
                status={roomData ? "success" : "default"}
              />
            </List.Item>
            <List.Item>
              <List.Item.Meta
                avatar={<UnorderedListOutlined />}
                title="Bài hát trong danh sách"
                description={`${roomData?.queue?.length || 0} bài`}
              />
            </List.Item>
            <List.Item>
              <List.Item.Meta
                avatar={<InfoCircleOutlined />}
                title="Mã phòng"
                description={<Tag color="blue">{roomId}</Tag>}
              />
            </List.Item>
          </List>
          <Button
            type="dashed"
            icon={<CopyOutlined />}
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            block
            className="mt-4"
          >
            Sao chép URL Remote
          </Button>
        </Card>

        <Card title={<><ToolOutlined /> Nâng cao</>} size="small">
          <List size="small">
            <List.Item>
              <List.Item.Meta
                avatar={<ClockCircleFilled />}
                title="Mức sử dụng API"
                description={<Tag color={apiUsage > 9000 ? "red" : "green"}>{apiUsage} / 10000</Tag>}
              />
            </List.Item>
          </List>
          <div className="space-y-2 mt-4">
            <Button
              block
              danger
              type="dashed"
              onClick={handleResetApiUsage}
            >
              Reset  API
            </Button>
            <Button
              block
              danger
              type="dashed"
              onClick={() => {
                Object.keys(localStorage).forEach(key => {
                  if (key.startsWith('yt_search_cache_') || key.startsWith('yt_video_details_cache')) {
                    localStorage.removeItem(key);
                  }
                });
                // Log info would be handled by parent
                // Show success modal would be handled by parent
              }}
            >
              Xóa bộ nhớ đệm
            </Button>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default SettingsModal;