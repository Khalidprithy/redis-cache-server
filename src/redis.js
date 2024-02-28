const { createClient } = require("redis");
const hash = require("object-hash");
const zlib = require("node:zlib");

// Initialize the Redis client variable
let redisClient = undefined;

// Function to initialize the Redis client
async function initializeRedisClient() {
    let redisURL = process.env.REDIS_URI;
    if (redisURL) {
        redisClient = createClient({ url: redisURL });
        redisClient.on("error", (e) => {
            console.error(`Failed to create the Redis client with error:`, e);
        });

        try {
            await redisClient.connect();
            console.log(`Connected to Redis successfully!`);
        } catch (e) {
            console.error(`Connection to Redis failed with error:`, e);
        }
    }
}

// Function to generate a unique key for caching based on the request
function requestToKey(req) {
    const reqDataToHash = {
        url: req.originalUrl,
        body: req.body
    };
    return `${req.path}@${hash.sha1(reqDataToHash)}`;
}

// Function to check if Redis is working (connected)
function isRedisWorking() {
    return !!redisClient?.isOpen;
}

// Function to write data to Redis with optional compression
async function writeData(key, data, options, compress) {
    if (!isRedisWorking()) return;

    let dataToCache = data;
    if (compress) {
        dataToCache = zlib.deflateSync(data).toString("base64");
    }

    try {
        await redisClient.set(key, dataToCache, options);
    } catch (e) {
        console.error(`Failed to cache data for key=${key}`, e);
    }
}

// Function to read data from Redis with optional decompression
async function readData(key, compressed) {
    if (!isRedisWorking()) return;

    const cachedValue = await redisClient.get(key);
    if (cachedValue) {
        return compressed ? zlib.inflateSync(Buffer.from(cachedValue, "base64")).toString() : cachedValue;
    }
}

// Middleware for caching responses in Redis
function redisCachingMiddleware(compression = true) {
    return async (req, res, next) => {
        if (!isRedisWorking()) {
            next();
            return;
        }

        const options = { EX: req.headers.ex || 600, NX: false };
        const key = requestToKey(req);
        let cachedValue;

        try {
            cachedValue = await readData(key, compression);
        } catch (error) {
            console.error(`Error reading data from Redis: ${error.message}`);
            next(); // Proceed without caching if there's an error
            return;
        }

        if (cachedValue) {
            console.log("Cache Hit");
            try {
                // Attempt to parse the cached value as JSON
                const parsedData = JSON.parse(cachedValue);
                return res.json(parsedData);
            } catch (error) {
                // If parsing fails, send the raw cached value
                console.log("Cache Hit (raw data)");
                return res.send(cachedValue);
            }
        } else {
            console.log("Cache Miss");
            const oldSend = res.send;
            res.send = async function (data) {
                res.send = oldSend;
                if (res.statusCode.toString().startsWith("2")) {
                    try {
                        await writeData(key, data, options, compression);
                    } catch (error) {
                        console.error(`Error writing data to Redis: ${error.message}`);
                    }
                }
                return res.send(data);
            };
            next();
        }
    };
}

// Function to flush all keys from Redis
const flushAllKeys = async (req, res, next) => {
    try {
        if (!isRedisWorking()) {
            res.status(500).json({ message: "Unable to retrieve keys. Redis connection not available." });
            return;
        }

        const keys = await redisClient.keys("*");
        if (keys.length > 0) {
            await Promise.all(keys.map(key => redisClient.del(key)));
            res.status(200).json({ status: true, message: "All keys deleted successfully" });
        } else {
            res.status(200).json({ status: false, message: "No keys found on Redis" });
        }
    } catch (error) {
        console.error("Error retrieving keys from Redis:", error);
        next(error);
    }
};

// Function to get all keys from Redis
const getAllKeys = async (req, res, next) => {
    try {
        if (!isRedisWorking()) {
            res.status(500).json({ message: "Unable to retrieve keys. Redis connection not available." });
            return;
        }

        const keys = await redisClient.keys("*");
        if (keys.length > 0) {
            res.status(200).json({ status: true, message: "All keys fetched successfully", data: keys });
        } else {
            res.status(200).json({ status: false, message: "No keys found on Redis" });
        }
    } catch (error) {
        console.error("Error retrieving keys from Redis:", error);
        next(error);
    }
};

// Function to parse Redis info into a more readable format
function parseRedisInfo(info) {
    const lines = info.split('\r\n');
    const parsedInfo = {};

    lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
            parsedInfo[key] = value;
        }
    });

    // Calculate memory usage percentage
    if (parsedInfo.used_memory && parsedInfo.total_system_memory) {
        parsedInfo.memory_usage_percentage = (parsedInfo.used_memory / parsedInfo.total_system_memory) * 100;
    }

    return parsedInfo;
}

// Function to get Redis server info
const getRedisServerInfo = async (req, res, next) => {
    try {
        const info = await redisClient.info();
        const parsedInfo = parseRedisInfo(info);
        res.status(200).json({ status: false, message: "Redis server info fetched", data: parsedInfo });

    } catch (error) {
        console.error("Error retrieving Redis info:", error);
        next(error);
    }
}

module.exports = { initializeRedisClient, redisCachingMiddleware, flushAllKeys, getRedisServerInfo, getAllKeys };
