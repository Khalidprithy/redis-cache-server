const express = require("express");
const { createClient } = require("redis");
const axios = require("axios");

const app = express();
const port = 5000;

const fetchDummyData = async productId => {
    try {
        const { data } = await axios.get(`https://dummyjson.com/products/${productId}`);
        console.log("Data from public api", data);
        return data;
    } catch (error) {
        console.error("Error fetching data:", error.message);
        throw new Error("Failed to fetch data from external API");
    }
};

// Create a Redis client
const client = createClient({
    url: "redis://red-cndlh0la73kc73b7f6h0:6379", // Use the URL format
    retry_strategy: options => {
        console.error("Redis connection failed. Retrying...");
        if (options.error && options.error.code === "ECONNREFUSED") {
            // End reconnecting on a specific error and flush all commands with a individual error
            return new Error("The server refused the connection");
        }
        if (options.total_retry_time > 1000 * 60 * 5) {
            // End reconnecting after a specific timeout and flush all commands with a individual error
            return new Error("Retry time exhausted");
        }
        if (options.attempt > 10) {
            // End reconnecting with built in error
            return undefined;
        }
        // reconnect after
        return Math.min(options.attempt * 100, 3000);
    }
});

client.on("error", err => {
    console.error("Redis Client Error", err);
    // Handle errors here, maybe exit the process or attempt reconnection
});

// Middleware to cache responses
const cacheMiddleware = async (req, res, next) => {
    try {
        const productId = req.params.id;
        const data = await client.get(productId);
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
        console.error("Error fetching data from Redis:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// Route handler function
const fetchDataAndCache = async (req, res, productId, expireTime) => {
    try {
        const data = await fetchDummyData(productId);
        await client.set(productId, JSON.stringify(data));
        await client.expire(productId, expireTime); // Set expiration time from query
        res.json({ message: data, cacheStatus: "miss" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Example routes
app.get("/product/:id", cacheMiddleware, async (req, res) => {
    const productId = req.params.id;
    const expireTime = req.headers.expire || 10; // Default to 10 if not provided

    if (res.locals.cacheHit) {
        res.json({ message: res.locals.cachedData, cacheStatus: "hit" });
    } else {
        await fetchDataAndCache(req, res, productId, expireTime);
    }
});

// Define the API endpoint for flushing all data
app.delete("/delete-all", (req, res) => {
    client.flushAll();
    res.send("All data has been deleted.");
});

// Start the server
app.listen(port, async () => {
    console.log(`Server is running on port ${port}`);
    try {
        await client.connect();
        console.log("Connected to Redis");

        // Monitor keys expiration
        setInterval(() => {
            client.keys("*", (err, keys) => {
                if (err) {
                    console.error("Error getting keys from Redis:", err);
                    return;
                }
                keys.forEach(key => {
                    client.ttl(key, (ttlErr, ttl) => {
                        if (ttlErr) {
                            console.error(`Error getting TTL for key ${key}:, ttlErr`);
                            return;
                        }
                        console.log(`Key: ${key}, TTL: ${ttl}`);
                    });
                });
            });
        }, 10000); // Check every 10 seconds
    } catch (err) {
        console.error("Error connecting to Redis:", err);
        process.exit(1); // Exit the process if unable to connect to Redis
    }
});


// const express = require('express');
// const { createClient } = require('redis');
// const axios = require('axios');

// const app = express();
// const port = 5000;

// const fetchData = async (time) => {
//     return new Promise((resolve) => {
//         setTimeout(() => {
//             resolve({ message: `Data from external API with ${time} ms delay` });
//         }, time); // Simulate a delay
//     });
// };

// // Create a Redis client
// const client = createClient({
//     url: 'redis://red-cndlh0la73kc73b7f6h0:6379' // Use the URL format
// });

// client.on('error', (err) => {
//     console.error('Redis Client Error', err);
// });

// // Middleware to cache responses
// const cacheMiddleware = async (req, res, next) => {
//     try {
//         const data = await client.get(req.url);
//         if (data !== null) {
//             // If data is found in cache, send it
//             res.locals.cacheHit = true;
//             res.locals.cachedData = JSON.parse(data);
//         } else {
//             // If data is not in cache, mark cache hit as false
//             res.locals.cacheHit = false;
//         }
//         next();
//     } catch (err) {
//         console.error('Error fetching data from Redis:', err);
//         next(err); // Pass the error to the error handling middleware
//     }
// };

// // Route handler function
// const fetchDataAndCache = async (req, res, delay) => {
//     try {
//         const data = await fetchData(delay);
//         // Cache the response for 30 seconds
//         await client.set(req.url, JSON.stringify(data), 'EX', 30);
//         res.send({ message: data, cacheStatus: 'miss' });
//     } catch (error) {
//         res.status(500).send('Error fetching data');
//     }
// };

// // Example routes
// app.get('/data-1', cacheMiddleware, async (req, res) => {
//     if (res.locals.cacheHit) {
//         res.send({ message: res.locals.cachedData, cacheStatus: 'hit' });
//     } else {
//         await fetchDataAndCache(req, res, 1000);
//     }
// });

// app.get('/data-5', cacheMiddleware, async (req, res) => {
//     if (res.locals.cacheHit) {
//         res.send({ message: res.locals.cachedData, cacheStatus: 'hit' });
//     } else {
//         await fetchDataAndCache(req, res, 5000);
//     }
// });

// app.get('/data-10', cacheMiddleware, async (req, res) => {
//     if (res.locals.cacheHit) {
//         res.send({ message: res.locals.cachedData, cacheStatus: 'hit' });
//     } else {
//         await fetchDataAndCache(req, res, 10000);
//     }
// });

// app.get('/products/:product', async (req, res) => {
//     const product = req.params.product;
//     try {
//         // Check the redis store for the data first
//         client.get(product, async (err, recipe) => {
//             if (recipe) {
//                 return res.status(200).send({
//                     error: false,
//                     message: `Recipe for ${product} from the cache`,
//                     data: JSON.parse(recipe)
//                 });
//             } else {
//                 const { data } = await axios.get(`https://dummyjson.com/products/${product}`);
//                 await client.setex(product, 10, JSON.stringify(data));
//                 return res.status(200).send({
//                     error: false,
//                     message: `Product for ${product} from the server`,
//                     data: data
//                 });
//             }
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).send('Error fetching product data');
//     }
// });

// // Start the server
// app.listen(port, async () => {
//     console.log(`Server is running on port ${port}`);
//     try {
//         await client.connect();
//         console.log('Connected to Redis');
//     } catch (err) {
//         console.error('Error connecting to Redis:', err);
//     }
// });
