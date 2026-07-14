const axios = require("axios");
const http = require("http");

const GROUP_ID = process.env.GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const TARGET_RANK_ID = Number(process.env.TARGET_RANK_ID);

const PORT = process.env.PORT || 3000;


// Render web server
http.createServer((req, res) => {
    res.write("Roblox Rank Bot Online");
    res.end();
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Get all members with a specific rank
async function getMembers(cursor = "") {
    try {
        const response = await axios.get(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles/1/users?limit=100&cursor=${cursor}`
        );

        return response.data;

    } catch (error) {
        console.log("Failed getting members:");
        console.log(error.response?.data || error.message);
        return null;
    }
}


// Rank user
async function setRank(userId) {
    try {
        await axios.patch(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
            {
                roleId: TARGET_RANK_ID
            },
            {
                headers: {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`Ranked ${userId}`);

    } catch (error) {
        console.log(`Failed ranking ${userId}:`);
        console.log(error.response?.data || error.message);
    }
}


// Check for new members
async function checkMembers() {

    console.log("Checking new members...");

    let cursor = "";

    while (true) {

        const data = await getMembers(cursor);

        if (!data) break;


        for (const user of data.data) {

            console.log(`New member found: ${user.username}`);

            await setRank(user.userId);

            // avoid API spam
            await new Promise(resolve => setTimeout(resolve, 1000));
        }


        if (!data.nextPageCursor) break;

        cursor = data.nextPageCursor;
    }
}


// Run every 5 minutes
setInterval(checkMembers, 5 * 60 * 1000);


// Run once on startup
checkMembers();
