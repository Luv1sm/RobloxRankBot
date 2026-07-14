const axios = require("axios");
const http = require("http");

const GROUP_ID = Number(process.env.GROUP_ID);
const API_KEY = process.env.ROBLOX_API_KEY;
const TARGET_ROLE_ID = Number(process.env.TARGET_RANK_ID);

// Verified Base Member Role ID
const BASE_MEMBER_ROLE_ID = 12884901889; 

const PORT = process.env.PORT || 3000;

// Render server
http.createServer((req, res) => {
    res.write("Roblox Rank Bot Online");
    res.end();
}).listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Helper to format Axios errors clearly
function parseAxiosError(error) {
    if (error.response) {
        return `API Error ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }
    return error.message;
}

// Get all users currently in the group memberships
async function getMembers(pageToken = "") {
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships`,
            {
                headers: { "x-api-key": API_KEY },
                params: {
                    maxPageSize: 100,
                    pageToken: pageToken
                }
            }
        );
        return response.data;
    } catch (error) {
        throw new Error(`Failed to fetch group memberships: ${parseAxiosError(error)}`);
    }
}

// Check a specific user's current rank via verified Open Cloud Request
async function getUserMembershipAndRank(targetUserId) {
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships`,
            {
                headers: { "x-api-key": API_KEY },
                params: {
                    filter: `user == 'users/${targetUserId}'`
                }
            }
        );
        
        const memberships = response.data.groupMemberships || [];
        if (memberships.length === 0) return null;
        
        const membership = memberships[0];
        const membershipId = membership.path.split("/").pop();
        const roleId = membership.role.split("/").pop();
        
        return {
            membershipId,
            roleId: Number(roleId)
        };
    } catch (error) {
        console.error(`❌ Error checking roles for user ${targetUserId}:`, parseAxiosError(error));
        return null;
    }
}

// Rank user via Open Cloud
async function setRank(membershipId, username) {
    try {
        await axios.patch(
            `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${membershipId}`,
            {
                role: `groups/${GROUP_ID}/roles/${TARGET_ROLE_ID}`
            },
            {
                headers: {
                    "x-api-key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log(`✅ Ranked ${username}`);
    } catch (error) {
        console.log(`❌ Failed ranking ${username}:`, parseAxiosError(error));
    }
}

// Check for members and rank them if they meet the criteria
async function checkMembers() {
    let pageToken = "";
    let currentMembers = [];

    try {
        while (true) {
            const data = await getMembers(pageToken);
            const memberships = data.groupMemberships || [];
            
            for (const membership of memberships) {
                const roleId = Number(membership.role.split("/").pop());
                
                // Only queue up users if they match your literal Member ID (12884901889)
                if (roleId === BASE_MEMBER_ROLE_ID) {
                    const userId = membership.user.split("/").pop();
                    currentMembers.push({
                        userId: userId,
                        membershipId: membership.path.split("/").pop()
                    });
                }
            }

            if (!data.nextPageToken) break;
            pageToken = data.nextPageToken;
        }
    } catch (err) {
        console.error("❌ Error fetching group members:", parseAxiosError(err));
        return;
    }

    let usersRankedCount = 0;

    for (const member of currentMembers) {
        const status = await getUserMembershipAndRank(member.userId);

        if (status && status.roleId === BASE_MEMBER_ROLE_ID) {
            await setRank(member.membershipId, member.userId);
            usersRankedCount++;
        }
    }

    if (usersRankedCount > 0) {
        console.log(`📋 Cycle finished: Checked ${currentMembers.length} accounts, successfully updated ${usersRankedCount} users.`);
    }
}

// Start bot
console.log("Roblox Rank Bot Initialized using Open Cloud APIs.");
checkMembers();

// Check every 60 seconds (1 minute)
setInterval(checkMembers, 60 * 1000);
