const { createClient } = require("redis");
const hash = require("object-hash");
const zlib = require("node:zlib");

// initialize the Redis client variable
let redisClient = undefined;

async function initializeRedisClient() {
    // read the Redis connection URL from the envs
    let redisURL = process.env.REDIS_URI;
    if (redisURL) {
        // create the Redis client object
        redisClient = createClient({ url: redisURL }).on("error", (e) => {
            console.error(`Failed to create the Redis client with error:`);
            console.error(e);
        });

        try {
            // connect to the Redis server
            await redisClient.connect();
            console.log(`Connected to Redis successfully!`);
        } catch (e) {
            console.error(`Connection to Redis failed with error:`);
            console.error(e);
        }
    }
}

function requestToKey(req) {
    // build a custom object to use as part of the Redis key
    const reqDataToHash = {
        query: req.query,
        body: req.body
    };

    // ${req.path}@... to make it easier to find
    // keys on a Redis client
    return `${req.path}@${hash.sha1(reqDataToHash)}`;
}

function isRedisWorking() {
    // verify whether there is an active connection
    // to a Redis server or not
    return !!redisClient?.isOpen;
}

async function writeData(key, data, options, compress) {
    if (isRedisWorking()) {
        let dataToCache = data;
        if (compress) {
            // compress the value with ZLIB to save RAM
            dataToCache = zlib.deflateSync(data).toString("base64");
        }

        try {
            await redisClient.set(key, dataToCache, options);
        } catch (e) {
            console.error(`Failed to cache data for key=${key}`, e);
        }
    }
}

async function readData(key, compressed) {
    let cachedValue = undefined;
    if (isRedisWorking()) {
        cachedValue = await redisClient.get(key);
        if (cachedValue) {
            if (compressed) {
                // decompress the cached value with ZLIB
                return zlib.inflateSync(Buffer.from(cachedValue, "base64")).toString();
            } else {
                return cachedValue;
            }
        }
    }

    return cachedValue;
}

function redisCachingMiddleware(
    options = {
        EX: 600, // 5 mins
        NX: false
    },
    compression = true
) {
    return async (req, res, next) => {
        if (isRedisWorking()) {
            const key = requestToKey(req);

            // if there is some cached data, retrieve it and return it
            const cachedValue = await readData(key);

            if (cachedValue) {
                try {
                    // if it is JSON data, then return it
                    console.log("Cache Hit");
                    return res.json(JSON.parse(cachedValue));
                } catch {
                    console.log("Cache Hit");
                    // if it is not JSON data, then return it
                    return res.send(cachedValue);
                }
            } else {
                // override how res.send behaves
                // to introduce the caching logic
                console.log("Cache Miss");
                const oldSend = res.send;

                res.send = function (data) {
                    // set the function back to avoid the 'double-send' effect
                    res.send = oldSend;

                    // cache the response only if it is successful
                    if (res.statusCode.toString().startsWith("2")) {
                        writeData(key, data, options).then();
                    }

                    return res.send(data);
                };

                // continue to the controller function
                next();
            }
        } else {
            // proceed with no caching
            next();
        }
    };
}

const flushAllData = async (req, res, next) => {
    try {
        if (isRedisWorking()) {
            // Get all keys in Redis
            redisClient.keys("*", (err, keys) => {
                if (err) {
                    console.error("Error retrieving keys from Redis:", err);
                    res.status(500).json({ message: "Internal server error." });
                } else {
                    res.status(200).json({ keys });
                }
            });
        } else {
            res.status(500).json({ message: "Unable to retrieve keys. Redis connection not available." });
        }
    } catch (error) {
        console.error("Error retrieving keys from Redis:", error);
        next(error); // Pass the error to the next middleware
    }
};

module.exports = { initializeRedisClient, redisCachingMiddleware, flushAllData };