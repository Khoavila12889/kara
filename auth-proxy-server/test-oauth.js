// test-oauth.js - Script để kiểm tra OAuth2 credentials
require('dotenv').config();

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

console.log('=== KIỂM TRA OAUTH2 CREDENTIALS ===');
console.log('YOUTUBE_CLIENT_ID:', CLIENT_ID ? '✓ Có' : '✗ Thiếu');
console.log('YOUTUBE_CLIENT_SECRET:', CLIENT_SECRET ? '✓ Có' : '✗ Thiếu');
console.log('REDIRECT_URI:', REDIRECT_URI || '✗ Thiếu');

if (CLIENT_ID && CLIENT_SECRET) {
    console.log('\n✓ Credentials đã được cấu hình');
    console.log('Chiều dài Client ID:', CLIENT_ID.length, 'ký tự');
    console.log('Client ID (5 ký tự đầu):', CLIENT_ID.substring(0, 5) + '...');
    console.log('Client Secret (5 ký tự đầu):', CLIENT_SECRET.substring(0, 5) + '...');
} else {
    console.log('\n✗ Vui lòng kiểm tra lại file .env');
}

// Kiểm tra định dạng cơ bản
if (CLIENT_ID && !CLIENT_ID.includes('.apps.googleusercontent.com')) {
    console.log('\n⚠ Cảnh báo: Client ID có thể sai định dạng (thiếu .apps.googleusercontent.com)');
}