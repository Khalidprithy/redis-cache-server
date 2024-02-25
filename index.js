const express = require('express');
const { createClient } = require('redis');

const app = express();
const port = 5000;

const fetchData = (time) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ message: `Data from external API with ${time} ms delay` });
        }, time); // Simulate a delay
    });
};

// Create a Redis client
const client = createClient({
    url: 'redis://red-cndlh0la73kc73b7f6h0:6379' // Use the URL format
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
            res.send({ message: JSON.parse(data), cacheStatus: 'hit' });
        } else {
            // If data is not in cache, proceed to the next middleware
            res.locals.cacheMiss = true;
            next();
        }
    } catch (err) {
        console.error('Error fetching data from Redis:', err);
        next(err); // Pass the error to the error handling middleware
    }
};

// Example route
app.get('/data-1', cacheMiddleware, async (req, res) => {
    try {
        const data = await fetchData(1000);
        // Cache the response for 30 seconds
        await client.set(req.url, JSON.stringify(data), 'EX', 30);
        if (res.locals.cacheMiss) {
            res.send({ message: data, cacheStatus: 'miss' });
        } else {
            res.send({ message: data, cacheStatus: 'hit' });
        }
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
});

// Example route
app.get('/data-5', cacheMiddleware, async (req, res) => {
    try {
        const data = await fetchData(5000);
        // Cache the response for 30 seconds
        await client.set(req.url, JSON.stringify(data), 'EX', 30);
        if (res.locals.cacheMiss) {
            res.send({ message: data, cacheStatus: 'miss' });
        } else {
            res.send({ message: data, cacheStatus: 'hit' });
        }
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
});

// Example route
app.get('/data-10', cacheMiddleware, async (req, res) => {
    try {
        const data = await fetchData(10000);
        // Cache the response for 30 seconds
        await client.set(req.url, JSON.stringify(data), 'EX', 30);
        if (res.locals.cacheMiss) {
            res.send({ message: data, cacheStatus: 'miss' });
        } else {
            res.send({ message: data, cacheStatus: 'hit' });
        }
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
});



// Start the server
app.listen(port, async () => {
    console.log(`Server is running`);
    try {
        await client.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Error connecting to Redis:', err);
    }
});
