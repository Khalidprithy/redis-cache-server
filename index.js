require('dotenv').config();
const express = require('express');

const { initializeRedisClient, getRedisServerInfo, redisCachingMiddleware, getAllKeys, flushAllKeys } = require('./src/redis');
const { fetchDummyData } = require('./src/dummyJson');

const app = express();
const port = process.env.PORT || 5000;


// Start the server
async function startServer() {
    try {
        // Redis connection
        await initializeRedisClient();

        // API endpoint to get Redis health information
        app.get('/redis/info', getRedisServerInfo);
        app.get('/redis/all-keys', getAllKeys);
        app.delete('/redis/flush-all-keys', flushAllKeys);
        // Example API route that fetches data from an external API and caches the response
        app.get('/*', redisCachingMiddleware(), fetchDummyData);

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.message);
            res.status(500).send('Something went wrong');
        });

        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
    }
}

// Call the startServer function to initialize Redis and start the server
startServer();
