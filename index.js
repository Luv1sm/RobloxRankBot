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


// Get all group roles
async function getRoles() {

    const response = await axios.get(
        `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles`
    );

    return response.data.roles;
}



// Get all members in a role
async function getRoleUsers(roleId, cursor = "") {

    const response = await axios.get(
        `https://groups.roblox.com/v1/groups/${GROUP_ID}/roles/${roleId}/users`,
        {
            params: {
                limit: 100,
                cursor: cursor
            }
        }
    );

    return response.data;
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


        console.log(`✅ Ranked ${username}`);


    } catch (error) {


        // X-CSRF handling
        if (error.response?.headers["x-csrf-token"]) {

            const csrf = error.response.headers["x-csrf-token"];


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



// Check members
async function checkMembers() {

    console.log("Checking for unranked members...");


    const roles = await getRoles();


    // Find Member role
    const memberRole = roles.find(
        role => role.rank === 1
    );


    if (!memberRole) {
        console.log("Member role not found");
        return;
    }


    let cursor = "";


    while (true) {


        const data = await getRoleUsers(
            memberRole.id,
            cursor
        );



        for (const user of data.data) {


            console.log(
                `Found Member: ${user.username}`
            );


            await setRank(
                user.userId,
                user.username
            );


            // Prevent rate limits
            await new Promise(resolve =>
                setTimeout(resolve, 1500)
            );

        }



        if (!data.nextPageCursor)
            break;


        cursor = data.nextPageCursor;

    }


    console.log("Finished checking.");

}



// Start
checkMembers();


// Every 30 seconds
setInterval(checkMembers, 30 * 1000);
