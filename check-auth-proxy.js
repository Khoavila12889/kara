const axios = require('axios');

async function checkAuthProxyStatus() {
    try {
        // Kiểm tra xem auth proxy server có đang chạy không
        const response = await axios.get('http://localhost:3001/health');
        console.log('✓ Auth Proxy Server đang chạy');
        console.log('Thông tin:', response.data);
    } catch (error) {
        console.log('✗ Auth Proxy Server không phản hồi');
        console.log('Lỗi:', error.message);
        console.log('\nHướng dẫn:');
        console.log('1. Đảm bảo bạn đã cài đặt dependencies trong thư mục auth-proxy-server');
        console.log('2. Chạy lệnh: cd auth-proxy-server && npm install');
        console.log('3. Chạy lệnh: cd auth-proxy-server && npm start (hoặc node src/index.ts)');
    }
}

checkAuthProxyStatus();