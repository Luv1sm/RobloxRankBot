const axios = require("axios");
const http = require("http");

const GROUP_ID = process.env.GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const TARGET_RANK_ID = process.env.TARGET_RANK_ID;


// Render requires a running server
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
    res.write("Roblox Rank Bot Online");
    res.end();
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Function to rank a user
async function setRank(userId) {
    try {
        await axios.patch(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
            {
                roleId: Number(TARGET_RANK_ID)
            },
            {
                headers: {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`Successfully ranked ${userId}`);

    } catch (error) {
        console.log("Ranking failed:");
        console.log(error.response?.data || error.message);
    }
}


// TEST
// Replace this with a Roblox User ID
setRank(123456789);