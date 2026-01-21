// test-youtube-auth-route.js
import axios from 'axios';

// Test the youtube-auth route
async function testYouTubeAuthRoute() {
    console.log('Testing GET /youtube-auth route...\n');
    
    try {
        // Test 1: Request without code or error
        console.log('Test 1: Request without code or error');
        try {
            const response1 = await axios.get('http://localhost:3001/youtube-auth', {
                maxRedirects: 0, // Don't follow redirects
                validateStatus: function (status) {
                    return status < 500; // Accept all statuses under 500
                }
            });
            console.log('Status:', response1.status);
            console.log('Headers:', response1.headers);
            console.log('Response preview:', response1.data.toString().substring(0, 200) + '...');
        } catch (error) {
            console.log('Error in test 1:', error.message);
        }
        
        console.log('\n---\n');
        
        // Test 2: Request with error parameter
        console.log('Test 2: Request with error parameter');
        try {
            const response2 = await axios.get('http://localhost:3001/youtube-auth?error=access_denied', {
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status < 500;
                }
            });
            console.log('Status:', response2.status);
            console.log('Headers:', response2.headers);
            console.log('Response preview:', response2.data.toString().substring(0, 200) + '...');
        } catch (error) {
            console.log('Error in test 2:', error.message);
        }
        
        console.log('\n---\n');
        
        // Test 3: Request with code parameter
        console.log('Test 3: Request with code parameter');
        try {
            const response3 = await axios.get('http://localhost:3001/youtube-auth?code=test_code_12345', {
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status < 500;
                }
            });
            console.log('Status:', response3.status);
            console.log('Headers:', response3.headers);
            console.log('Response preview:', response3.data.toString().substring(0, 200) + '...');
        } catch (error) {
            console.log('Error in test 3:', error.message);
        }
        
    } catch (error) {
        console.error('General error:', error.message);
    }
}

testYouTubeAuthRoute();