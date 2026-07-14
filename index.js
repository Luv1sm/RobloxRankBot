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

// Helper to format Axios errors clearly instead of printing native function/object dumps
function parseAxiosError(error) {
    if (error.response) {
        return `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }
    return error.message;
}

// Get Member role ID
async function getMemberRoleId() {
    try {
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
    } catch (error) {
        throw new Error(`Failed to fetch Member Role ID: ${parseAxiosError(error)}`);
    }
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
        
        const groupData = response.data.data.find(
            g => g.group.id === GROUP_ID
        );
        
        if (!groupData) return 0;
        
        return groupData.role.rank;
    } catch (error) {
        console.error(`❌ Error checking roles for user ${userId}:`, parseAxiosError(error));
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
        // Handle X-CSRF token validation
        if (error.response && error.response.headers["x-csrf-token"]) {
            const csrf = error.response.headers["x-csrf-token"];

            try {
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
                console.log(`✅ Ranked ${username} (with token)`);
            } catch (retryError) {
                console.log(`❌ Failed ranking ${username}:`, parseAxiosError(retryError));
            }
        } else {
            console.log(`❌ Failed ranking ${username}:`, parseAxiosError(error));
        }
    }
}

// Check for members and rank them if they meet the criteria
async function checkMembers() {
    let cursor = "";
    let currentMembers = [];

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
        console.error("❌ Error fetching group members:", parseAxiosError(err));
        return;
    }

    let usersRankedCount = 0;

    // Evaluate each user individually
    for (const user of currentMembers) {
        const currentRank = await getUserRankInGroup(user.userId);

        // Only rank up users who are strictly rank level 1 ("Member")
        if (currentRank === 1) {
            await setRank(user.userId, user.username);
            usersRankedCount++;
        }
    }

    // Single clear summary log block per interval cycle
    if (usersRankedCount > 0) {
        console.log(`📋 Cycle finished: Checked ${currentMembers.length} accounts, successfully updated ${usersRankedCount} users.`);
    }
}

// Start bot
console.log("Roblox Rank Bot Initialized.");
checkMembers();

// Check every 60 seconds (1 minute)
setInterval(checkMembers, 60 * 1000);
