import { useState, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { logger } from './logger';

// --- PKCE Helper Functions ---
// 1. Generate a random string for the code verifier
const generateRandomString = (length: number): string => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// 2. SHA256 hash function
const sha256 = async (plain: string): Promise<ArrayBuffer> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

// 3. Base64 URL encode function
const base64urlencode = (str: ArrayBuffer): string => {
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(str))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// --- Main Auth Hook ---
interface UserInfo {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export const useYouTubeAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkAuthStatus = useCallback(() => {
    const token = localStorage.getItem('youtube_access_token');
    const user = localStorage.getItem('youtube_user_info');
    const expiresAt = localStorage.getItem('youtube_token_expires_at');

    // Check if token has expired
    if (expiresAt && Date.now() > parseInt(expiresAt, 10)) {
      // Token has expired, clear it
      localStorage.removeItem('youtube_access_token');
      localStorage.removeItem('youtube_user_info');
      localStorage.removeItem('youtube_refresh_token');
      localStorage.removeItem('youtube_token_expires_at');
      setIsAuthenticated(false);
      setUserInfo(null);
      return false;
    }

    if (token && user) {
      setIsAuthenticated(true);
      setUserInfo(JSON.parse(user));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async () => {
    setIsLoading(true);

    try {
      // PKCE code generation
      const codeVerifier = generateRandomString(128);
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      const hashed = await sha256(codeVerifier);
      const codeChallenge = base64urlencode(hashed);

      const clientId = (import.meta as any).env.VITE_YOUTUBE_CLIENT_ID;
      const redirectUri = `${window.location.origin}/youtube-auth`;
      const scope = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
      
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&code_challenge=${codeChallenge}` +
        `&code_challenge_method=S256` +
        `&access_type=offline` +
        `&prompt=consent`;
      
      // Trên mobile, dùng redirect thay vì popup
      const isMobile = /iPhone|iPad|Android|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Lưu state trước khi redirect
        // const state = generateRandomString(32); // Removed as it's not used in callback for verification yet
        localStorage.setItem('pkce_code_verifier', codeVerifier); // Sử dụng localStorage thay vì sessionStorage để tồn tại sau redirect

        localStorage.setItem('redirect_url_after_login', window.location.href);
        // Redirect trực tiếp (trang sẽ handle redirect back)
        window.location.href = authUrl;
      } else {
        // Desktop: dùng popup
        const authPopup = window.open(authUrl, '_blank', 'width=600,height=700');

        if (!authPopup) {
          Modal.error({
            title: 'Lỗi',
            content: 'Popup bị chặn. Vui lòng cho phép popup trong trình duyệt.'
          });
          setIsLoading(false);
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;

          setIsLoading(false);

          if (event.data.type === 'youtube_auth_success') {
            const { access_token, user_info, refresh_token, expires_in } = event.data;
            localStorage.setItem('youtube_access_token', access_token);
            localStorage.setItem('youtube_user_info', JSON.stringify(user_info));
            if (refresh_token) {
              localStorage.setItem('youtube_refresh_token', refresh_token);
            }
            if (expires_in) {
              localStorage.setItem('youtube_token_expires_at', (Date.now() + (expires_in * 1000)).toString());
            }
            setIsAuthenticated(true);
            setUserInfo(user_info);
            // Xóa các item đã dùng
            localStorage.removeItem('pkce_code_verifier');
            localStorage.removeItem('redirect_url_after_login');
            Modal.success({
              title: 'Đăng nhập thành công',
              content: 'Đã kết nối với tài khoản YouTube.'
            });
          } else if (event.data.type === 'youtube_auth_error') {
            Modal.error({
              title: 'Đăng nhập thất bại',
              content: `Lỗi: ${event.data.error}`
            });
          }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
      }
    } catch (error) {
      logger.error('Login error:', error);
      Modal.error({ title: 'Lỗi', content: 'Đã xảy ra lỗi trong quá trình đăng nhập.' });
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    Modal.confirm({
      title: 'Đăng xuất',
      content: 'Bạn có chắc muốn đăng xuất khỏi YouTube?',
      onOk: () => {
        localStorage.removeItem('youtube_access_token');
        localStorage.removeItem('youtube_user_info');
        localStorage.removeItem('youtube_refresh_token');
        localStorage.removeItem('youtube_token_expires_at');
        setIsAuthenticated(false);
        setUserInfo(null);
      }
    });
  }, []);

  const getAccessToken = useCallback(() => {
    return localStorage.getItem('youtube_access_token') || '';
  }, []);

  return {
    isAuthenticated,
    userInfo,
    isLoading,
    login,
    logout,
    getAccessToken,
    checkAuthStatus
  };
};