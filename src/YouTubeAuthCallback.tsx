import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { logger } from './logger';

const YouTubeAuthCallback = () => {
  const [status, setStatus] = useState('Đang xử lý đăng nhập...');
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      const redirectUrl = sessionStorage.getItem('redirect_url_after_login') || '/';

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
        const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
        if (!codeVerifier) {
            // This error is critical and shouldn't happen in a normal flow
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
          // The URL for your deployed standalone proxy server
          // This should be added to your .env file
          const proxyUrl = (import.meta as any).env.VITE_AUTH_PROXY_URL;
          if (!proxyUrl) {
            throw new Error("Cấu hình phía client bị thiếu: VITE_AUTH_PROXY_URL chưa được thiết lập.");
          }

          setStatus('Đang trao đổi mã xác thực lấy token...');

          // Log the request for debugging
          logger.info('Sending request to proxy:', {
            proxyUrl,
            code: code.substring(0, 10) + '...', // Only log first 10 chars for security
            hasCodeVerifier: !!codeVerifier
          });

          // Call the standalone proxy server
          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              code: code,
              code_verifier: codeVerifier,
            }),
          });

          logger.info('Proxy response status:', response.status);

          if (!response.ok) {
            // Try to get detailed error from proxy's JSON response
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

          // Store data and notify parent/redirect
          localStorage.setItem('youtube_access_token', access_token);
          localStorage.setItem('youtube_user_info', JSON.stringify(user_info));
          // Store additional token info if available
          if (refresh_token) {
            localStorage.setItem('youtube_refresh_token', refresh_token);
          }
          if (expires_in) {
            localStorage.setItem('youtube_token_expires_at', (Date.now() + (expires_in * 1000)).toString());
          }

          setStatus('Đăng nhập thành công! Đang chuyển hướng...');

          if (window.opener) {
            window.opener.postMessage({
                type: 'youtube_auth_success',
                access_token: access_token,
                user_info: user_info,
                refresh_token: refresh_token,
                expires_in: expires_in
            }, window.location.origin);
            window.close();
          } else {
            // Mobile redirect
             window.location.href = redirectUrl;
          }

        } catch (err: any) {
          const errorMsg = `Xử lý callback thất bại: ${err.message}`;
          setStatus(errorMsg);
          logger.error('Callback Processing Error:', err);

          // Log more details for debugging
          logger.error('Full error object:', err);
          if (err.stack) {
            logger.error('Error stack:', err.stack);
          }

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
            // Clean up session storage
            sessionStorage.removeItem('pkce_code_verifier');
            sessionStorage.removeItem('redirect_url_after_login');
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
