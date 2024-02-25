const express = require('express');
const redis = require('redis');
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
const client = redis.createClient({
    host: 'redis://red-cndlh0la73kc73b7f6h0:6379', // Replace with your Redis host if not running locally
    port: 6379 // Default Redis port
});

client.on('error', (err) => {
    console.error('Error connecting to Redis:', err);
});

// Connect to Redis
client.on('connect', () => {
    console.log('Connected to Redis');
});

// Middleware to cache responses
const cacheMiddleware = (req, res, next) => {
    const { url } = req;
    client.get(url, (err, data) => {
        if (err) throw err;

        if (data !== null) {
            // If data is found in cache, send it
            res.send(JSON.parse(data));
        } else {
            // If data is not in cache, proceed to the next middleware
            next();
        }
    });
};

// Example route
app.get('/data', cacheMiddleware, async (req, res) => {
    try {
        const data = await fetchData();
        // Cache the response for  30 seconds
        client.setex(req.url, 30, JSON.stringify(data));
        res.send(data);
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});