import express from 'express';
import cors from 'cors';
import axios from 'axios';
import 'dotenv/config';

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL;

if (!FRONTEND_URL) {
    console.error("FATAL: FRONTEND_URL environment variable is not set.");
    process.exit(1);
}

const allowedOrigins = FRONTEND_URL.split(',').map(url => url.trim());
console.log("Allowed frontend origins:", allowedOrigins);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// A simple health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Proxy server is running.');
});

/**
 * This is the main endpoint. It receives the authorization code from the frontend,
 * exchanges it for an access token with Google, gets user info, and returns everything.
 */
app.post('/', async (req, res) => {
    const { code, code_verifier } = req.body;

    if (!code || !code_verifier) {
        return res.status(400).json({
            error: "Missing 'code' or 'code_verifier' in request body."
        });
    }

    const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REDIRECT_URI } = process.env;

    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !REDIRECT_URI) {
        console.error("Server configuration error: YouTube credentials or redirect URI are not set in .env file.");
        return res.status(500).json({ error: "Server configuration error." });
    }

    try {
        console.log("Attempting to exchange authorization code for access token");
        console.log("Redirect URI:", REDIRECT_URI);

        // 1. Exchange authorization code for access token
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: YOUTUBE_CLIENT_ID,
            client_secret: YOUTUBE_CLIENT_SECRET,
            code,
            code_verifier,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        }, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        console.log("Token exchange successful.");
        const { access_token, refresh_token, expires_in } = tokenResponse.data;

        if (!access_token) {
            throw new Error("Access token not found in Google's response.");
        }

        // 2. Use the access token to get user info
        console.log("Attempting to get user info with access token...");
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        console.log("User info retrieved successfully:", userInfoResponse.data);
        const userInfo = {
            id: userInfoResponse.data.sub,
            name: userInfoResponse.data.name,
            email: userInfoResponse.data.email,
            picture: userInfoResponse.data.picture,
        };

        // 3. Send everything back to the frontend client
        res.status(200).json({
            access_token,
            refresh_token,
            expires_in,
            user_info: userInfo,
        });

    } catch (error: any) {
        console.error("Error during YouTube auth exchange:", error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({
            error: "Failed to exchange token with Google.",
            details: error.response?.data,
        });
    }
});

// --- Server Activation ---
app.listen(PORT, () => {
    console.log(`✅ T-Karaoke Auth Proxy Server listening on port ${PORT}`);
    console.log(`⏰ Waiting for requests from: ${FRONTEND_URL}`);
});