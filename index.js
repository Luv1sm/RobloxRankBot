const axios = require("axios");
const http = require("http");

const GROUP_ID = Number(process.env.GROUP_ID);
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

// Get Member role ID
async function getMemberRoleId() {
    const response = await axios.get(
        `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`
    );

    const memberRole = response.data.roles.find(
        role => role.rank === 1
    );

    if (!memberRole) {
        throw new Error("Member role not found");
    }

    return memberRole.id;
}

// Get all users currently in the lowest Member role
async function getMembers(cursor = "") {
    const memberRoleId = await getMemberRoleId();

    const response = await axios.get(
        `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles/${memberRoleId}/users`,
        {
            params: {
                limit: 100,
                cursor: cursor
            }
        }
    );

    return response.data;
}

// Check a specific user's current rank value in the group
async function getUserRankInGroup(userId) {
    try {
        const response = await axios.get(
            `https://groups.roblox.com/v2/users/${userId}/groups/roles`
        );
        
        // Find the group object inside the user's groups list
        const groupData = response.data.data.find(
            g => g.group.id === GROUP_ID
        );
        
        // If they aren't even in the group, return 0
        if (!groupData) return 0;
        
        return groupData.role.rank;
    } catch (error) {
        console.error(`Error checking roles for user ${userId}:`, error.message);
        return null;
    }
}

// Rank user with X-CSRF handling
async function setRank(userId, username) {
    try {
        await axios.patch(
            `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
            { roleId: TARGET_ROLE_ID },
            {
                headers: {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ Ranked ${username}`);

    } catch (error) {
        // Handle X-CSRF error
        if (
            error.response &&
            error.response.headers["x-csrf-token"]
        ) {
            const csrf = error.response.headers["x-csrf-token"];

            await axios.patch(
                `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
                { roleId: TARGET_ROLE_ID },
                {
                    headers: {
                        "x-api-key": API_KEY,
                        "Content-Type": "application/json",
                        "x-csrf-token": csrf
                    }
                }
            );

            console.log(`✅ Ranked ${username}`);
        } else {
            console.log(`❌ Failed ranking ${username}`);
            console.log(error.response?.data || error.message);
        }
    }
}

// Check for members and rank them if they meet the criteria
async function checkMembers() {
    console.log("Checking members...");
    let cursor = "";
    let currentMembers = [];

    // Pull users currently sitting in the base Member role
    try {
        while (true) {
            const data = await getMembers(cursor);

            for (const user of data.data) {
                currentMembers.push(user);
            }

            if (!data.nextPageCursor) break;
            cursor = data.nextPageCursor;
        }
    } catch (err) {
        console.error("Error fetching group members:", err.message);
        return;
    }

    // Evaluate each user individually
    for (const user of currentMembers) {
        // Fetch their current absolute rank value
        const currentRank = await getUserRankInGroup(user.userId);

        // Rank 1 is the default Roblox member tier. 
        // If currentRank is null, the API check failed, so we skip to be safe.
        if (currentRank === 1) {
            console.log(`User ${user.username} is only a Member. Ranking up...`);
            await setRank(user.userId, user.username);
        } else if (currentRank !== null) {
            console.log(`ℹ️ Skipped ${user.username} (Has a different role, Rank: ${currentRank})`);
        }
    }

    console.log("Finished checking.");
}

// Start bot
checkMembers();

// Check every 30 seconds
setInterval(checkMembers, 30 * 1000);
