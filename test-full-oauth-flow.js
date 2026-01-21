// test-full-oauth-flow.js - Script kiểm tra toàn bộ luồng OAuth
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Load environment variables from both root and auth-proxy-server
dotenv.config(); // Load root .env

// Load auth-proxy-server .env if it exists
const authProxyEnvPath = path.resolve('./auth-proxy-server/.env');
if (fs.existsSync(authProxyEnvPath)) {
  const authProxyEnv = dotenv.parse(fs.readFileSync(authProxyEnvPath));
  // Merge auth proxy env vars into process.env
  for (const [key, value] of Object.entries(authProxyEnv)) {
    process.env[key] = value;
  }
}

async function testFullOAuthFlow() {
    console.log('=== KIỂM TRA TOÀN BỘ LUỒNG OAUTH ===\n');

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = process.env.REDIRECT_URI;
    const frontendUrl = process.env.FRONTEND_URL;
    const authProxyUrl = process.env.VITE_AUTH_PROXY_URL;

    console.log('1. Kiểm tra biến môi trường:');
    console.log('   - YOUTUBE_CLIENT_ID:', clientId ? '✓ Có' : '✗ Thiếu');
    console.log('   - YOUTUBE_CLIENT_SECRET:', clientSecret ? '✓ Có (đã ẩn)' : '✗ Thiếu');
    console.log('   - REDIRECT_URI:', redirectUri ? redirectUri : '✗ Thiếu');
    console.log('   - FRONTEND_URL:', frontendUrl ? frontendUrl : '✗ Thiếu');
    console.log('   - VITE_AUTH_PROXY_URL:', authProxyUrl ? authProxyUrl : '✗ Thiếu');

    if (!clientId || !clientSecret || !redirectUri || !frontendUrl || !authProxyUrl) {
        console.log('\n✗ Thiếu một hoặc nhiều biến môi trường cần thiết');
        console.log('Gợi ý: Kiểm tra cả file .env ở thư mục gốc và auth-proxy-server/.env');
        return;
    }

    console.log('\n2. Kiểm tra định dạng Client ID:');
    if (clientId && clientId.includes('googleusercontent.com')) {
        console.log('   ✓ Định dạng Client ID hợp lệ');
    } else {
        console.log('   ✗ Định dạng Client ID không hợp lệ');
        return;
    }

    console.log('\n3. Kiểm tra kết nối với Auth Proxy Server...');
    try {
        // Check the actual health endpoint which should be on localhost:3001
        const healthResponse = await axios.get('http://localhost:3001/health');
        console.log('   ✓ Auth Proxy Server đang chạy');
    } catch (error) {
        console.log('   ✗ Không thể kết nối với Auth Proxy Server');
        console.log('   URL: http://localhost:3001/health');
        console.log('   Lỗi:', error.message);
        console.log('   Gợi ý: Đảm bảo auth proxy server đang chạy trên cổng 3001');
        return;
    }

    console.log('\n4. Kiểm tra route /youtube-auth...');
    try {
        // Gửi yêu cầu giả lập để kiểm tra route
        const testResponse = await axios.get('http://localhost:3001/youtube-auth?error=test');
        console.log('   ✓ Route /youtube-auth tồn tại trên auth proxy server');
    } catch (error) {
        console.log('   ✗ Route /youtube-auth không phản hồi đúng cách');
        console.log('   Lỗi:', error.message);
    }

    console.log('\n5. Kiểm tra cấu hình OAuth trên Google...');
    try {
        // Tạo URL xác thực OAuth để kiểm tra
        const scopes = [
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ].join(' ');

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                       `client_id=${clientId}&` +
                       `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                       `response_type=code&` +
                       `scope=${encodeURIComponent(scopes)}&` +
                       `access_type=offline&` +
                       `prompt=consent`;

        console.log('   ✓ URL xác thực OAuth đã được tạo');
        console.log('   URL:', authUrl);
        console.log('');
        console.log('   GỢI Ý:');
        console.log('   - Nếu bạn gặp lỗi "GeneralOAuthFlows", hãy đảm bảo email bạn dùng để đăng nhập');
        console.log('     đã được thêm vào phần "Test users" trong Google Cloud Console');
        console.log('   - Kiểm tra lại rằng "Authorized redirect URIs" trong Google Cloud Console');
        console.log('     bao gồm đúng URL:', redirectUri);
    } catch (error) {
        console.log('   ✗ Lỗi khi tạo URL xác thực:', error.message);
    }

    console.log('\n6. Kiểm tra POST /api/youtube/callback...');
    try {
        // Use the correct URL for the callback endpoint
        const callbackUrl = 'http://localhost:3001/api/youtube/callback';
        const testPostResponse = await axios.post(callbackUrl, {
            code: 'test_code_for_validation',
            code_verifier: 'test_code_verifier_that_meets_length_requirements_12345'
        }, {
            validateStatus: function (status) {
                return status >= 200 && status < 500; // Cho phép các mã trạng thái lỗi để xử lý riêng
            }
        });

        console.log('   ✓ Endpoint POST /api/youtube/callback phản hồi');
        console.log('   Mã trạng thái:', testPostResponse.status);

        if (testPostResponse.status === 400) {
            console.log('   - Đây là phản hồi bình thường khi gửi mã xác thực giả');
        }
    } catch (error) {
        console.log('   ✗ Lỗi khi gọi POST /api/youtube/callback:', error.message);
    }

    console.log('\n=== HOÀN TẤT KIỂM TRA LUỒNG OAUTH ===');
    console.log('\nNếu bạn vẫn gặp lỗi trong quá trình đăng nhập:');
    console.log('1. Kiểm tra log của Auth Proxy Server khi bạn thực hiện đăng nhập');
    console.log('2. Đảm bảo bạn đã thêm email vào "Test users" trong Google Cloud Console');
    console.log('3. Xác nhận rằng bạn sử dụng đúng URL trong trình duyệt');
    console.log('4. Thử đăng nhập trong chế độ ẩn danh để tránh xung đột cookie');
}

testFullOAuthFlow().catch(console.error);