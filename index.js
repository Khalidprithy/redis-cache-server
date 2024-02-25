const express = require('express');
const { createClient } = require('redis');

const app = express();
const port = 5000;

const fetchData = async (time) => {
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
            res.locals.cacheHit = true;
            res.locals.cachedData = JSON.parse(data);
        } else {
            // If data is not in cache, mark cache hit as false
            res.locals.cacheHit = false;
        }
        next();
    } catch (err) {
        console.error('Error fetching data from Redis:', err);
        next(err); // Pass the error to the error handling middleware
    }
};

// Route handler function
const fetchDataAndCache = async (req, res, delay) => {
    try {
        const data = await fetchData(delay);
        // Cache the response for 30 seconds
        await client.set(req.url, JSON.stringify(data), 'EX', 30);
        res.send({ message: data, cacheStatus: 'miss' });
    } catch (error) {
        res.status(500).send('Error fetching data');
    }
};

// Example routes
app.get('/data-1', cacheMiddleware, async (req, res) => {
    if (res.locals.cacheHit) {
        res.send({ message: res.locals.cachedData, cacheStatus: 'hit' });
    } else {
        await fetchDataAndCache(req, res, 1000);
    }
});

app.get('/data-5', cacheMiddleware, async (req, res) => {
    if (res.locals.cacheHit) {
        res.send({ message: res.locals.cachedData, cacheStatus: 'hit' });
    } else {
        await fetchDataAndCache(req, res, 5000);
    }
});

app.get('/data-10', cacheMiddleware, async (req, res) => {
    if (res.locals.cacheHit) {
        res.send({ message: res.locals.cachedData, cacheStatus: 'hit' });
    } else {
        await fetchDataAndCache(req, res, 10000);
    }
});


app.get('/recipe/:fooditem', (req, res) => {
    try {
        const foodItem = req.params.fooditem;

        // Check the redis store for the data first
        client.get(foodItem, async (err, recipe) => {
            if (recipe) {
                return res.status(200).send({
                    error: false,
                    message: `Recipe for ${foodItem} from the cache`,
                    data: JSON.parse(recipe)
                })
            } else { // When the data is not found in the cache then we can make request to the server

                const recipe = await axios.get(`http://www.recipepuppy.com/api/?q=${foodItem}`);

                // save the record in the cache for subsequent request
                client.setex(foodItem, 1440, JSON.stringify(recipe.data.results));

                // return the result to the client
                return res.status(200).send({
                    error: false,
                    message: `Recipe for ${foodItem} from the server`,
                    data: recipe.data.results
                });
            }
        })
    } catch (error) {
        console.log(error)
    }
});

// Start the server
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    try {
        await client.connect();
        console.log('Connected to Redis');
    } catch (err) {
        console.error('Error connecting to Redis:', err);
    }
});
