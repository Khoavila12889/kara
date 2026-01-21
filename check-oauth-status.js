// check-oauth-status.js - Script kiểm tra trạng thái OAuth
require('dotenv').config();
const axios = require('axios');

async function checkOAuthStatus() {
    console.log('=== KIỂM TRA TRẠNG THÁI OAUTH ===\n');
    
    const clientId = process.env.VITE_YOUTUBE_CLIENT_ID;
    const authProxyUrl = process.env.VITE_AUTH_PROXY_URL;
    
    console.log('1. Kiểm tra cấu hình:');
    console.log('   - Client ID:', clientId ? clientId : 'Không có');
    console.log('   - Auth Proxy URL:', authProxyUrl ? authProxyUrl : 'Không có');
    
    if (!clientId) {
        console.log('\n✗ Thiếu Client ID trong cấu hình');
        return;
    }
    
    console.log('\n2. Kiểm tra định dạng Client ID:');
    if (clientId.includes('googleusercontent.com')) {
        console.log('   ✓ Định dạng Client ID hợp lệ');
    } else {
        console.log('   ✗ Định dạng Client ID không hợp lệ');
        return;
    }
    
    console.log('\n3. Kiểm tra trạng thái Auth Proxy Server...');
    try {
        const healthResponse = await axios.get(authProxyUrl.replace('/api/youtube/callback', '/health'));
        console.log('   ✓ Auth Proxy Server đang hoạt động');
        console.log('   Trạng thái:', healthResponse.data.status || 'unknown');
    } catch (error) {
        console.log('   ✗ Auth Proxy Server không phản hồi');
        console.log('   Lỗi:', error.message);
        return;
    }
    
    console.log('\n4. Kiểm tra OAuth Flow...');
    // Tạo URL xác thực OAuth để kiểm tra
    const redirectUri = process.env.REDIRECT_URI || 'https://hat.risingdragon.vn/youtube-auth';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                   `client_id=${clientId}&` +
                   `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                   `response_type=code&` +
                   `scope=https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email&` +
                   `access_type=offline&` +
                   `prompt=consent`;
    
    console.log('   URL xác thực OAuth:');
    console.log('   ', authUrl);
    console.log('');
    console.log('   Nếu bạn gặp lỗi "GeneralOAuthFlows", vui làm theo các bước sau:');
    console.log('   1. Truy cập Google Cloud Console');
    console.log('   2. Vào APIs & Services > OAuth consent screen');
    console.log('   3. Thêm email của bạn vào phần "Test users"');
    console.log('   4. Lưu thay đổi');
    console.log('');
    console.log('   Nếu bạn đã thêm email vào "Test users" mà vẫn gặp lỗi:');
    console.log('   - Kiểm tra xem email bạn dùng để đăng nhập có trùng với email trong "Test users" không');
    console.log('   - Có thể bạn cần đợi vài phút để thay đổi có hiệu lực');
    console.log('   - Thử xóa cache trình duyệt và thử lại');
    
    console.log('\n5. Gợi ý khắc phục lỗi "quyền truy cập bị chặn":');
    console.log('   - Đảm bảo bạn đã thêm đúng "Authorized redirect URIs" trong Google Cloud Console');
    console.log('   - Kiểm tra xem domain trong "Authorized domains" có bao gồm "hat.risingdragon.vn" không');
    console.log('   - Nếu bạn đang dùng HTTPS, đảm bảo URL chuyển hướng cũng dùng HTTPS');
    
    console.log('\n=== HOÀN TẤT KIỂM TRA ===');
}

checkOAuthStatus().catch(console.error);