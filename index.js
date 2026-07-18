const axios = require("axios");
const express = require("express");

// =========================
// CONFIG
// =========================

const GROUP_ID = Number(process.env.GROUP_ID);
const API_KEY = process.env.ROBLOX_API_KEY;
const TARGET_ROLE_ID = Number(process.env.TARGET_RANK_ID);

const BASE_MEMBER_ROLE_ID = 12884901889;

const PORT = process.env.PORT || 3000;

let checking = false;


// =========================
// RENDER HEALTH SERVER
// =========================

const app = express();

app.get("/", (req, res) => {
    res.status(200).send("Roblox Rank Bot Online");
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});


// =========================
// AXIOS ERROR HANDLER
// =========================

function parseAxiosError(error) {
    if (error.response) {
        return `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`;
    }

    return error.message;
}


// =========================
// AXIOS RETRY FUNCTION
// =========================

async function requestWithRetry(config, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await axios(config);
        } catch (error) {

            if (attempt === retries) {
                throw error;
            }

            console.log(
                `⚠️ Request failed (${attempt}/${retries}), retrying...`
            );

            await new Promise(resolve =>
                setTimeout(resolve, 2000)
            );
        }
    }
}


// =========================
// GET GROUP MEMBERS
// =========================

async function getMembers(pageToken = "") {

    const response = await requestWithRetry({
        method: "GET",
        url: `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships`,
        headers: {
            "x-api-key": API_KEY
        },
        params: {
            maxPageSize: 100,
            pageToken
        }
    });

    return response.data;
}


// =========================
// GET USER ROLE
// =========================

async function getUserMembershipAndRank(userId) {

    try {

        const response = await requestWithRetry({
            method: "GET",
            url: `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships`,
            headers: {
                "x-api-key": API_KEY
            },
            params: {
                filter: `user == 'users/${userId}'`
            }
        });


        const memberships =
            response.data.groupMemberships || [];


        if (memberships.length === 0) {
            return null;
        }


        const membership = memberships[0];


        return {
            membershipId:
                membership.path.split("/").pop(),

            roleId:
                Number(
                    membership.role.split("/").pop()
                )
        };


    } catch(error) {

        console.log(
            `❌ Role check failed for ${userId}:`,
            parseAxiosError(error)
        );

        return null;
    }
}


// =========================
// RANK USER
// =========================

async function setRank(membershipId, username) {

    try {

        await requestWithRetry({
            method: "PATCH",
            url:
            `https://apis.roblox.com/cloud/v2/groups/${GROUP_ID}/memberships/${membershipId}`,

            headers: {
                "x-api-key": API_KEY,
                "Content-Type": "application/json"
            },

            data: {
                role:
                `groups/${GROUP_ID}/roles/${TARGET_ROLE_ID}`
            }
        });


        console.log(
            `✅ Ranked ${username}`
        );


    } catch(error) {

        console.log(
            `❌ Failed ranking ${username}:`,
            parseAxiosError(error)
        );
    }
}


// =========================
// MAIN CHECK LOOP
// =========================

async function checkMembers() {

    if (checking) {
        console.log(
            "⏳ Previous scan still running..."
        );
        return;
    }


    checking = true;


    console.log(
        "🔎 Checking group members..."
    );


    let pageToken = "";
    let members = [];


    try {


        while(true) {


            const data =
                await getMembers(pageToken);


            const memberships =
                data.groupMemberships || [];


            for(const membership of memberships) {


                const roleId =
                    Number(
                        membership.role.split("/").pop()
                    );


                if(roleId === BASE_MEMBER_ROLE_ID) {

                    members.push({

                        userId:
                        membership.user
                        .split("/")
                        .pop(),

                        membershipId:
                        membership.path
                        .split("/")
                        .pop()
                    });
                }
            }


            if(!data.nextPageToken)
                break;


            pageToken =
            data.nextPageToken;

        }


        let ranked = 0;


        for(const member of members) {


            const status =
                await getUserMembershipAndRank(
                    member.userId
                );


            if(
                status &&
                status.roleId === BASE_MEMBER_ROLE_ID
            ) {


                await setRank(
                    member.membershipId,
                    member.userId
                );


                ranked++;

            }

        }


        console.log(
            `📋 Scan complete. Checked ${members.length}, ranked ${ranked}.`
        );


    } catch(error) {


        console.log(
            "❌ Scan error:",
            error.message
        );


    } finally {

        checking = false;

    }

}


// =========================
// START BOT
// =========================

console.log(
    "🤖 Roblox Rank Bot Started"
);


checkMembers();


// Run every 30 seconds

setInterval(
    checkMembers,
    30000
);


// =========================
// SAFE SHUTDOWN
// =========================

process.on("SIGTERM", () => {

    console.log(
        "🛑 Shutting down..."
    );

    process.exit(0);

});
