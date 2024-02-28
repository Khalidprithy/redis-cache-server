const axios = require('axios');

// Function to fetch data from a third-party API
const fetchDummyData = async (req, res, next) => {
    try {
        const { originalUrl, query } = req;
        const url = `https://dummyjson.com${originalUrl}?${new URLSearchParams(query).toString()}`;
        const { data } = await axios.get(url);
        return res.json({ status: true, message: 'Response from dummy json', data });
    } catch (error) {
        console.error("Error fetching data:", error.message);
        next(error)
    }
};


module.exports = { fetchDummyData }