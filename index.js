const express = require('express');
const { createClient } = require('redis');

const app = express();
const port = 5000;

const fetchData = () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ message: 'Data from external API' });
        }, 1000); // Simulate a delay
    });
};

// Create a Redis client
const client = createClient({
    url: 'rediss://red-cndlh0la73kc73b7f6h0:B1WJDzO3pCYkzbqIzSza9hKhBYyNZ0js@oregon-redis.render.com:6379' // Use the URL format
});

client.on('error', (err) => {
    console.error('Redis Client Error', err);
});

// Middleware to cache responses
const cacheMiddleware = async (req, res, next) => {
    try {
        const data = await client.get(req.url);
        if (data !== null) {
            // If data is found in cache, send it
            res.send(JSON.parse(data));
        } else {
            // If data is not in cache, proceed to the next middleware
            next();
        }
    } catch (err) {
        console.error('Error fetching data from Redis:', err);
        next(err); // Pass the error to the error handling middleware
    }
};

// Example route
app.get('/data', cacheMiddleware, async (req, res) => {
    try {
        const data = await fetchData();
        // Cache the response for   30 seconds
        await client.set(req.url, JSON.stringify(data), 'EX', 30);
        res.send(data);
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
});

// Start the server
app.listen(port, async () => {
    console.log(`Server running at http://localhost:${port}`);
    try {
        await client.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Error connecting to Redis:', err);
    }
});
