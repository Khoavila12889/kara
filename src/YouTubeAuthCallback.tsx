import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from './logger';
import { database } from './firebase'; // Import Firebase
import { ref, update } from 'firebase/database'; // Import Firebase functions
import { YouTubeAuthData } from './types';

const YouTubeAuthCallback = () => {
  const [status, setStatus] = useState('Đang xử lý đăng nhập...');
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      // BUG FIX: Read from localStorage, not sessionStorage
      const redirectUrl = localStorage.getItem('redirect_url_after_login') || '/';

      if (error) {
        const errorMessage = errorDescription ? `${error}: ${errorDescription}` : error;
        setStatus(`Lỗi xác thực: ${errorMessage}. Tự động quay lại...`);
        logger.error('OAuth Callback Error:', errorMessage);

        if (window.opener) {
            window.opener.postMessage({ type: 'youtube_auth_error', error: errorMessage }, window.location.origin);
            window.close();
        } else {
            setTimeout(() => { window.location.href = redirectUrl; }, 3000);
        }
        return;
      }

      if (code) {
        const codeVerifier = localStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
            const errorMsg = 'Lỗi bảo mật: Không tìm thấy mã xác thực PKCE. Vui lòng thử lại.';
            setStatus(errorMsg);
            logger.error(errorMsg);
             if (window.opener) {
                window.opener.postMessage({ type: 'youtube_auth_error', error: errorMsg }, window.location.origin);
                window.close();
            } else {
                 setTimeout(() => { window.location.href = redirectUrl; }, 3000);
            }
            return;
        }

        try {
          const proxyUrl = '/api/auth'; // Use a relative path for the proxy
          setStatus('Đang trao đổi mã xác thực lấy token...');
          logger.info('Sending request to proxy:', {
            proxyUrl,
            code: code.substring(0, 10) + '...',
            hasCodeVerifier: !!codeVerifier
          });

          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ code: code, code_verifier: codeVerifier }),
          });

          logger.info('Proxy response status:', response.status);

          if (!response.ok) {
            let errorDetails = 'Không có thông tin chi tiết.';
            try {
              const errorData = await response.json();
              logger.error('Proxy error response:', errorData);
              errorDetails = `Lỗi từ server: ${JSON.stringify(errorData.details || errorData)}`;
            } catch (e) {
              logger.error('Could not parse error response:', e);
              errorDetails = `Không thể phân tích phản hồi lỗi từ server. Status: ${response.statusText}`;
            }
            throw new Error(`Proxy server trả về lỗi ${response.status}. ${errorDetails}`);
          }

          const data = await response.json();
          logger.info('Proxy response data:', data);

          const { access_token, user_info, refresh_token, expires_in } = data;
          if (!access_token || !user_info) {
            throw new Error("Phản hồi từ proxy không hợp lệ, thiếu access_token hoặc user_info.");
          }

          // This is the primary flow for popup-based login on desktop
          if (window.opener) {
            setStatus('Đăng nhập thành công! Đang gửi thông tin về cửa sổ chính...');
            window.opener.postMessage({
                type: 'youtube_auth_success',
                ...data
            }, window.location.origin);
            window.close();
            return;
          }

          // --- QR Code / Mobile Flow ---
          // The redirectUrl contains the original URL from the TV/Desktop device
          // We need to parse it to get the roomId
          const url = new URL(redirectUrl);
          const roomId = url.searchParams.get('room');

          if (roomId) {
            setStatus('Đang cập nhật trạng thái đăng nhập cho thiết bị của bạn...');
            
            const expires_at = Date.now() + (expires_in * 1000);

            const authPayload: YouTubeAuthData = {
              access_token,
              refresh_token,
              expires_at,
              user_info,
            };

            const roomRef = ref(database, `rooms/${roomId}`);
            await update(roomRef, { youtubeAuth: authPayload });

            setStatus('Xác thực thành công! Bạn có thể đóng cửa sổ này.');
            // Try to close the window, may not work on all mobile browsers
            setTimeout(() => window.close(), 1000);
          } else {
            // Fallback for non-popup, non-QR-code flow (e.g. direct mobile login for the remote itself)
            // This flow is less common for this app's design
             localStorage.setItem('youtube_access_token', access_token);
             localStorage.setItem('youtube_user_info', JSON.stringify(user_info));
             if (refresh_token) localStorage.setItem('youtube_refresh_token', refresh_token);
             if (expires_in) localStorage.setItem('youtube_token_expires_at', (Date.now() + (expires_in * 1000)).toString());

            setStatus('Đăng nhập thành công! Đang chuyển hướng...');
            window.location.href = redirectUrl; // Redirect back to the remote page
          }

        } catch (err: any) {
          const errorMsg = `Xử lý callback thất bại: ${err.message}`;
          setStatus(errorMsg);
          logger.error('Callback Processing Error:', err);

          if (window.opener) {
                window.opener.postMessage({ type: 'youtube_auth_error', error: err.message }, window.location.origin);
                window.close();
            } else {
                setTimeout(() => {
                  logger.info('Redirecting after error timeout');
                  window.location.href = redirectUrl;
                }, 5000);
            }
        } finally {
            // Clean up the PKCE verifier
            localStorage.removeItem('pkce_code_verifier');
             // Do NOT clean up redirect_url_after_login here as it might be needed by error redirects
        }
      } else {
         setStatus('Không tìm thấy mã xác thực trong URL. Vui lòng thử lại.');
         logger.warn('No authorization code found in URL parameters:', Object.fromEntries(params.entries()));
      }
    };

    handleCallback();
  }, [location]);

  return <div style={{ padding: '20px', textAlign: 'center' }}>
    <p>{status}</p>
    <p style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
      Nếu gặp lỗi, vui lòng kiểm tra Console (F12) để xem thông tin chi tiết.
    </p>
  </div>;
};

export default YouTubeAuthCallback;
