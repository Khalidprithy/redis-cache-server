# Node.js Redis Server

This repository contains a Node.js server that utilizes Redis for caching and data storage. It features a middleware for caching responses, functions to interact with Redis, and endpoints for managing Redis data.

## Features

- **Redis Caching Middleware**: Automatically caches responses from your API endpoints, reducing load times and improving performance.
- **Redis Data Management**: Functions to write and read data from Redis, with optional compression for efficient storage.
- **Redis Server Information**: Endpoint to fetch detailed information about the Redis server, including memory usage.
- **Key Management**: Endpoints to flush all keys from Redis and to retrieve all keys.

## Installation


### Prerequisites

- Node.js (v14.0.0 or higher)
- Redis server (v5.0 or higher)
- npm (v6.0.0 or higher)

### Steps

1. **Clone the Repository**

```
https://github.com/Khalidprithy/redis-cache-server.git
```


2. **Install Dependencies**


Use the `npm install` command to install dependencies.

```
npm install
```

3. **Configure Environment Variables**

   Create a `.env` file in the root of the project and add your Redis URI:


   Replace `REDIS_URI` with the address of your Redis server.

4. **Start the Server**

```
npm start
```

The server will start on the default port (5000) or the port specified in the `.env` file.

## Usage

### Caching Middleware

To use the caching middleware, simply apply it to any route you wish to cache. For example:


### Redis Data Management

- **Writing Data**: Use the `writeData` function to store data in Redis.
- **Reading Data**: Use the `readData` function to retrieve data from Redis.

### Redis Server Information

Access the `/redis/info` endpoint to fetch detailed information about the Redis server.

### Key Management

- **Flush All Keys**: Send a request to the `/redis/flush-all-keys` endpoint to delete all keys from Redis.
- **Get All Keys**: Send a request to the `/redis/all-keys` endpoint to retrieve all keys stored in Redis.

## Contributing

Contributions are welcome! Please read the [contributing guidelines](CONTRIBUTING.md) before getting started.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

