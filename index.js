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


// Stores existing members so they are ignored
const knownMembers = new Set();

let initialized = false;



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



// Get all users in Member role
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



// Rank user with X-CSRF handling
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


        console.log(`✅ Ranked ${username}`);


    } catch (error) {


        // Handle X-CSRF error
        if (
            error.response &&
            error.response.headers["x-csrf-token"]
        ) {

            const csrf =
                error.response.headers["x-csrf-token"];


            await axios.patch(
                `https://groups.roblox.com/v1/groups/${GROUP_ID}/users/${userId}`,
                {
                    roleId: TARGET_ROLE_ID
                },
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
            console.log(
                error.response?.data || error.message
            );

        }
    }
}



// Check for new members
async function checkMembers() {

    console.log("Checking members...");

    let cursor = "";


    let currentMembers = [];


    while (true) {

        const data = await getMembers(cursor);


        for (const user of data.data) {
            currentMembers.push(user);
        }


        if (!data.nextPageCursor)
            break;


        cursor = data.nextPageCursor;
    }



    // First startup: save existing users
    if (!initialized) {

        for (const user of currentMembers) {
            knownMembers.add(user.userId);
        }

        initialized = true;

        console.log(
            `Loaded ${knownMembers.size} existing members`
        );

        return;
    }



    // Only rank NEW members
    for (const user of currentMembers) {


        if (!knownMembers.has(user.userId)) {


            console.log(
                `New member detected: ${user.username}`
            );


            await setRank(
                user.userId,
                user.username
            );


            knownMembers.add(user.userId);


        }

    }


    console.log("Finished checking.");

}



// Start bot
checkMembers();


// Check every 30 seconds
setInterval(checkMembers, 30 * 1000);
