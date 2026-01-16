import React from 'react';
import { Spin, Alert, Button } from 'antd';
import { ExtendedSong } from '../types';

interface SearchTabProps {
  searchResults: ExtendedSong[];
  searchLoading: boolean;
  searchError: string | null;
  nextPageToken: string | null;
  loadMore: () => void;
  SongListItem: React.ComponentType<{ song: ExtendedSong }>;
}

const SearchTab: React.FC<SearchTabProps> = React.memo(({
  searchResults,
  searchLoading,
  searchError,
  nextPageToken,
  loadMore,
  SongListItem
}) => (
  <Spin spinning={searchLoading} tip="Đang tìm...">
    {searchError && <Alert message={searchError} type="error" showIcon />}
    <div className="space-y-2 max-h-[calc(100vh-220px)] pr-2 tabs-content-scrollable">
      {searchResults.map(song => (
        <SongListItem key={song.id} song={song} />
      ))}
    </div>
    {nextPageToken && (
      <Button
        onClick={loadMore}
        loading={searchLoading}
        className="mt-4 w-full"
      >
        Tải thêm
      </Button>
    )}
  </Spin>
));

export default SearchTab;