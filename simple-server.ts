import express from 'express';
import cors from 'cors';
import axios from 'axios';
import 'dotenv/config';

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Enhanced CORS configuration to support multiple origins and better security
const corsOptions = {
    origin: Array.isArray(FRONTEND_URL) ? FRONTEND_URL : FRONTEND_URL.split(',').map(url => url.trim()),
    optionsSuccessStatus: 200, // For legacy browser support
    credentials: true, // Allow cookies and credentials
};

// --- Middleware ---
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// --- Routes ---

// A simple health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('Proxy server is running.');
});

/**
 * The main endpoint to handle the OAuth callback.
 * It receives the authorization code from the frontend, exchanges it for an
 * access token with Google, and returns the token and user info.
 */
app.post('/api/youtube/callback', async (req, res) => {
    const { code, code_verifier } = req.body;

    // Validate required fields
    if (!code) {
        return res.status(400).json({ 
            error: "Missing 'code' in request body." 
        });
    }
    
    if (!code_verifier) {
        return res.status(400).json({ 
            error: "Missing 'code_verifier' in request body." 
        });
    }

    // Validate code and code_verifier format
    if (typeof code !== 'string' || code.length < 10) {
        return res.status(400).json({ 
            error: "Invalid 'code' format." 
        });
    }
    
    if (typeof code_verifier !== 'string' || code_verifier.length < 43 || code_verifier.length > 128) {
        return res.status(400).json({ 
            error: "Invalid 'code_verifier' format. Must be between 43 and 128 characters." 
        });
    }

    const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REDIRECT_URI } = process.env;

    if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !REDIRECT_URI) {
        console.error("Server configuration error: YouTube credentials or redirect URI are not set in .env file.");
        return res.status(500).json({ 
            error: "Server configuration error: Missing required environment variables." 
        });
    }

    try {
        // 1. Exchange authorization code for access token
        const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: YOUTUBE_CLIENT_ID,
            client_secret: YOUTUBE_CLIENT_SECRET,
            code,
            code_verifier,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        }, {
            timeout: 10000, // 10 second timeout
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        const { access_token, refresh_token, expires_in } = tokenResponse.data;
        
        if (!access_token) {
            throw new Error("Access token not found in Google's response.");
        }

        // 2. Use the access token to get user info
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            timeout: 10000, // 10 second timeout
        });

        const userInfo = {
            id: userInfoResponse.data.sub,
            name: userInfoResponse.data.name,
            email: userInfoResponse.data.email,
            picture: userInfoResponse.data.picture,
        };

        // 3. Send the access token and user info back to the client
        res.status(200).json({
            access_token,
            refresh_token, // Include refresh token if provided
            expires_in,    // Include expiration time
            user_info: userInfo,
        });

    } catch (error: any) {
        console.error("Error during YouTube auth exchange:", error.response ? error.response.data : error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ 
                error: "Request timeout while contacting Google OAuth service." 
            });
        }
        
        if (error.response) {
            // Return more specific error information
            res.status(error.response.status).json({
                error: "Failed to exchange token with Google.",
                status: error.response.status,
                details: error.response.data?.error_description || error.response.data
            });
        } else {
            res.status(500).json({ 
                error: "Internal Server Error during OAuth exchange.",
                details: error.message 
            });
        }
    }
});

// Health check and info endpoints
app.get('/', (req, res) => {
    res.status(200).json({
        message: "T-Karaoke Auth Proxy Server",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString()
    });
});

// Endpoint to get server configuration (without sensitive data)
app.get('/api/config', (req, res) => {
    const { PORT: port, FRONTEND_URL: frontendUrl } = process.env;
    res.status(200).json({
        port,
        frontendUrl,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// --- Server Activation ---
const server = app.listen(PORT, () => {
    console.log(`T-Karaoke Auth Proxy Server listening on port ${PORT}`);
    console.log(`Frontend URL configured: ${FRONTEND_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});