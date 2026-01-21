// test-youtube-auth.js - Script kiểm tra kết nối YouTube OAuth (ES Module)
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

async function testYouTubeAuth() {
    console.log('=== KIỂM TRA KẾT NỐI YOUTUBE OAUTH ===\n');
    
    // Lấy các biến môi trường
    const clientId = process.env.VITE_YOUTUBE_CLIENT_ID;
    const apiKey = process.env.VITE_YOUTUBE_API_KEY;
    const authProxyUrl = process.env.VITE_AUTH_PROXY_URL;
    const redirectUri = process.env.REDIRECT_URI;
    
    console.log('1. Kiểm tra cấu hình môi trường:');
    console.log('   - VITE_YOUTUBE_CLIENT_ID:', clientId ? '✓ Có' : '✗ THIẾU');
    console.log('   - VITE_YOUTUBE_API_KEY:', apiKey ? '✓ Có' : '✗ THIẾU');
    console.log('   - VITE_AUTH_PROXY_URL:', authProxyUrl ? authProxyUrl : '✗ THIẾU');
    console.log('   - REDIRECT_URI:', redirectUri ? redirectUri : '✗ THIẾU');
    
    if (!clientId || !apiKey || !authProxyUrl) {
        console.log('\n✗ Thiếu cấu hình. Vui lòng kiểm tra file .env');
        return;
    }
    
    const baseUrl = authProxyUrl.replace('/api/youtube/callback', '');
    
    console.log('\n2. Kiểm tra định dạng Client ID:');
    if (clientId.includes('googleusercontent.com')) {
        console.log('   ✓ Định dạng hợp lệ');
    } else {
        console.log('   ✗ Định dạng không hợp lệ');
    }
    
    console.log('\n3. Kiểm tra định dạng API Key:');
    if (apiKey.startsWith('AIza')) {
        console.log('   ✓ Định dạng hợp lệ');
    } else {
        console.log('   ✗ Định dạng không hợp lệ');
    }
    
    console.log('\n4. Kiểm tra kết nối Backend...');
    try {
        const healthCheck = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
        console.log('   ✓ Backend hoạt động');
    } catch (error) {
        console.log('   ✗ Lỗi backend:', error.message);
        console.log('   URL:', `${baseUrl}/health`);
        return;
    }
    
    console.log('\n5. Kiểm tra YouTube API Key...');
    try {
        const testResponse = await axios.get(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=test&maxResults=1&key=${apiKey}`,
            { timeout: 5000 }
        );
        console.log('   ✓ YouTube API Key hoạt động');
    } catch (error) {
        console.log('   ✗ Lỗi YouTube API:', error.response?.data?.error?.message || error.message);
    }
    
    console.log('\n6. Kiểm tra Callback Endpoint...');
    try {
        const res = await axios.get(`${baseUrl}/api/youtube/callback?code=test123`, {
            timeout: 5000,
            validateStatus: () => true,
            maxRedirects: 0
        });
        console.log(`   Status: ${res.status}`);
        if (res.headers.location) {
            console.log(`   ✓ Redirect: ${res.headers.location.substring(0, 50)}...`);
        }
    } catch (error) {
        console.log(`   ⚠️  Status: ${error.response?.status || error.message}`);
    }
    
    console.log('\n=== HOÀN TẤT KIỂM TRA ===\n');
}

testYouTubeAuth().catch(console.error);