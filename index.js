const axios = require("axios");
const http = require("http");

const GROUP_ID = process.env.GROUP_ID;
const API_KEY = process.env.ROBLOX_API_KEY;
const TARGET_ROLE_ID = Number(process.env.TARGET_RANK_ID);

const PORT = process.env.PORT || 3000;


// Render server
http.createServer((req, res) => {
    res.write("Roblox Rank Bot Online");
    res.end();
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


// Users already checked
const processedUsers = new Set();


// Find Member role and get users
async function getMembers(cursor = "") {

    try {

        // Get group roles
        const rolesResponse = await axios.get(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`
        );

        const roles = rolesResponse.data.roles;


        // Find default Member role
        const memberRole = roles.find(
            role => role.rank === 1
        );


        if (!memberRole) {
            console.log("❌ Could not find Member role");
            return null;
        }


        // Get users in Member role
        const usersResponse = await axios.get(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles/${memberRole.id}/users`,
            {
                params: {
                    limit: 100,
                    cursor: cursor
                }
            }
        );


        return usersResponse.data;


    } catch (error) {

        console.log("❌ Failed getting members:");
        console.log(error.response?.data || error.message);

        return null;
    }
}



// Rank user
async function setRank(userId, username) {

    try {

        await axios.patch(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
            {
                roleId: TARGET_ROLE_ID
            },
            {
                headers: {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );


        console.log(`✅ Ranked ${username} (${userId})`);


    } catch (error) {

        console.log(`❌ Failed ranking ${username}:`);
        console.log(error.response?.data || error.message);

    }
}



// Check members
async function checkMembers() {

    console.log("🔎 Checking new members...");

    let cursor = "";


    while (true) {

        const data = await getMembers(cursor);


        if (!data)
            break;



        for (const user of data.data) {


            if (processedUsers.has(user.userId))
                continue;


            processedUsers.add(user.userId);


            await setRank(
                user.userId,
                user.username
            );


            // Prevent API rate limits
            await new Promise(resolve =>
                setTimeout(resolve, 1500)
            );

        }



        if (!data.nextPageCursor)
            break;


        cursor = data.nextPageCursor;

    }


    console.log("✅ Member check complete.");

}



// Start immediately
checkMembers();


// Check every 30 seconds
setInterval(checkMembers, 30 * 1000);
