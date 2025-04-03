import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = "https://kjcnhuyfzftnxqygjlyn.supabase.co"; // Replace with your Supabase URL
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY25odXlmemZ0bnhxeWdqbHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDMzODgsImV4cCI6MjA1NzU3OTM4OH0._PvDuxHnpE5_thdY23PVNkuXh1fzWCa-xdSxymMhK-E"; // Replace with your Supabase key
const supabase = createClient(supabaseUrl, supabaseKey);

// List of players
const players = ["UIM_Soj", "flendygim", "jund guy", "manfoxturtle", "formud", "Karl Vog", "Large Pouch"];

// Skill IDs and names mapping (OSRS hiscores order)
const skillData = [
    { id: 1, name: "attack", key: "attack_xp" },
    { id: 2, name: "defence", key: "defence_xp" },
    { id: 3, name: "strength", key: "strength_xp" },
    { id: 4, name: "hitpoints", key: "hitpoints_xp" },
    { id: 5, name: "ranged", key: "ranged_xp" },
    { id: 6, name: "prayer", key: "prayer_xp" },
    { id: 7, name: "magic", key: "magic_xp" },
    { id: 8, name: "cooking", key: "cooking_xp" },
    { id: 9, name: "woodcutting", key: "woodcutting_xp" },
    { id: 10, name: "fletching", key: "fletching_xp" },
    { id: 11, name: "fishing", key: "fishing_xp" },
    { id: 12, name: "firemaking", key: "firemaking_xp" },
    { id: 13, name: "crafting", key: "crafting_xp" },
    { id: 14, name: "smithing", key: "smithing_xp" },
    { id: 15, name: "mining", key: "mining_xp" },
    { id: 16, name: "herblore", key: "herblore_xp" },
    { id: 17, name: "agility", key: "agility_xp" },
    { id: 18, name: "thieving", key: "thieving_xp" },
    { id: 19, name: "slayer", key: "slayer_xp" },
    { id: 20, name: "farming", key: "farming_xp" },
    { id: 21, name: "runecraft", key: "runecraft_xp" },
    { id: 22, name: "hunter", key: "hunter_xp" },
    { id: 23, name: "construction", key: "construction_xp" }
];

// Fetch all skills from OSRS Hiscores API
async function fetchPlayerSkills(player, retries = 3, delayMs = 1000) {
    try {
        const response = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(
                `https://services.runescape.com/m=hiscore_oldschool/index_lite.json?player=${player}`
            )}`
        );
        if (!response.ok) throw new Error("Failed to fetch data");

        const hiscores = await response.json();
        const skills = {};
        
        skillData.forEach(skill => {
            const skillInfo = hiscores.skills.find(s => s.id === skill.id);
            skills[skill.key] = skillInfo ? skillInfo.xp : 0;
        });

        // If all skills are 0 and we have retries left
        if (Object.values(skills).every(xp => xp === 0) && retries > 0) {
            console.log(`Retrying fetch for ${player}, attempts left: ${retries}`);
            await delay(delayMs);
            return fetchPlayerSkills(player, retries - 1, delayMs);
        }

        return skills;
    } catch (error) {
        console.error(`Error fetching skills for ${player}:`, error);
        if (retries > 0) {
            console.log(`Retrying fetch for ${player}, attempts left: ${retries}`);
            await delay(delayMs);
            return fetchPlayerSkills(player, retries - 1, delayMs);
        }
        // Return object with all skills as 0 if failed
        return skillData.reduce((acc, skill) => {
            acc[skill.key] = 0;
            return acc;
        }, {});
    }
}


// Check if data already exists in the last hour
async function hasDataForLastHour(player) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
        const { data, error } = await supabase
            .from("player_xp")
            .select("id")
            .eq("player_name", player)
            .gte("timestamp", oneHourAgo.toISOString())
            .limit(1); // Only fetch one record

        if (error) throw error;
        return data.length > 0;
    } catch (error) {
        console.error(`Error checking data for ${player}:`, error);
        return false;
    }
}

// Function to delete data older than 1 week
async function deleteOldData() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7); // Get the date 1 week ago

    console.log(`Checking for data older than ${oneWeekAgo.toISOString()}...`);

    try {
        // First, fetch the data that will be deleted
        const { data: oldData, error: fetchError } = await supabase
            .from("player_xp")
            .select("id, player_name, timestamp")
            .lt("timestamp", oneWeekAgo.toISOString()); // Find entries older than 1 week

        if (fetchError) {
            console.error("Supabase fetch error:", fetchError);
            throw fetchError;
        }

        // If no old data is found, log and exit
        if (oldData.length === 0) {
            console.log("No old data found to delete.");
            return;
        }

        // Log the data that will be deleted
        console.log(`Deleting ${oldData.length} records older than ${oneWeekAgo.toISOString()}:`);
        oldData.forEach(record => {
            console.log(`- Player: ${record.player_name}, Timestamp: ${record.timestamp}`);
        });

        // Perform the deletion
        const { error: deleteError } = await supabase
            .from("player_xp")
            .delete()
            .lt("timestamp", oneWeekAgo.toISOString()); // Delete entries older than 1 week

        if (deleteError) {
            console.error("Supabase delete error:", deleteError);
            throw deleteError;
        }

        console.log("Old data deleted successfully!");
    } catch (error) {
        console.error("Error deleting old data:", error);
    }
}

// Store all skills in the database
async function storePlayerSkills(player, skills) {
    try {
        const dataToInsert = {
            player_name: player,
            ...skills
        };

        const { error } = await supabase
            .from("player_xp")
            .insert([dataToInsert]);

        if (error) throw error;
        console.log(`Stored skills for ${player}:`, skills);
    } catch (error) {
        console.error(`Error storing skills for ${player}:`, error);
    }
}
const totalXpCtx = document.getElementById("totalXpChart")?.getContext("2d");
const xpGainedCtx = document.getElementById("xpGainedChart")?.getContext("2d");
function renderCharts(totalXpData, xpGainedData) {
    
    if (!totalXpCtx || !xpGainedCtx) return;

    // Destroy previous instances
    if (totalXpChartInstance) totalXpChartInstance.destroy();
    if (xpGainedChartInstance) xpGainedChartInstance.destroy();

    // 1. Bottom Graph - Total XP (Simple Bar Chart)
    totalXpChartInstance = new Chart(totalXpCtx, {
        type: "bar",
        data: {
            labels: totalXpData.map(data => data.player),
            datasets: [{
                label: "Total XP",
                data: totalXpData.map(data => data.totalXp),
                backgroundColor: "#5b9bd533", // Semi-transparent blue
                borderColor: "#41719c",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Total XP' }
                }
            },
            plugins: {
                legend: { display: true } // Keep legend for total XP
            }
        }
    });

    // 2. Top Graph - XP Gained (Stacked by Skill)
    xpGainedChartInstance = new Chart(xpGainedCtx, {
        type: "bar",
        data: {
            labels: xpGainedData.map(data => data.player),
            datasets: skillData.map(skill => ({
                label: skill.name,
                data: xpGainedData.map(p => p.xpGains[skill.key] || 0),
                backgroundColor: getOsrsPastelColor(skill.name),
                borderColor: getOsrsBorderColor(skill.name),
                borderWidth: 1
            }))
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: true },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: 'XP Gained (Last 7 Days)' }
                }
            },
            plugins: {
                legend: { display: false }, // Remove the legend
                tooltip: {
                    callbacks: {
                        title: (items) => `${items[0].label}: ${items.reduce((sum, item) => sum + item.raw, 0).toLocaleString()} XP`,
                        afterBody: (context) => {
                            const playerData = xpGainedData[context[0].dataIndex];
                            return skillData
                                .map(skill => {
                                    const xp = playerData.xpGains[skill.key];
                                    return xp > 0 ? 
                                        `• ${skill.name}: ${xp.toLocaleString()} XP` : 
                                        null;
                                })
                                .filter(Boolean);
                        }
                    }
                }
            }
        }
    });
}

// OSRS-inspired pastel colors
function getOsrsPastelColor(skillName) {
    const colors = {
        attack: '#e6b8b8',     // Soft red
        strength: '#f4cccc',   // Lighter red
        defence: '#b8d3e6',   // Soft blue
        hitpoints: '#ffe599',  // Pale yellow
        ranged: '#d9ead3',     // Mint green
        prayer: '#fff2cc',     // Pale gold
        magic: '#d5a6bd',      // Soft purple
        cooking: '#f9cb9c',    // Peach
        woodcutting: '#d9d2e9', // Lavender
        fletching: '#cfe2f3',  // Light blue
        fishing: '#a2c4c9',    // Seafoam
        firemaking: '#f4b183',  // Salmon
        crafting: '#d5a6bd',    // Soft purple
        smithing: '#d9d9d9',    // Light gray
        mining: '#b7b7b7',      // Medium gray
        herblore: '#b6d7a8',    // Sage green
        agility: '#a4c2f4',     // Sky blue
        thieving: '#c27ba0',    // Soft magenta
        slayer: '#999999',      // Dark gray
        farming: '#93c47d',     // Green
        runecraft: '#b4a7d6',   // Periwinkle
        hunter: '#a2c4c9',      // Seafoam (same as fishing)
        construction: '#d5a6bd' // Soft purple (same as crafting)
    };
    return colors[skillName.toLowerCase()] || '#cccccc';
}

// Slightly darker borders for contrast
function getOsrsBorderColor(skillName) {
    const colors = {
        attack: '#cc7a7a',
        strength: '#e6b8b8',
        defence: '#8ab8e6',
        hitpoints: '#ffd966',
        ranged: '#b6d7a8',
        prayer: '#ffe599',
        magic: '#c27ba0',
        cooking: '#f9b77d',
        woodcutting: '#b4a7d6',
        fletching: '#9fc5e8',
        fishing: '#76a5af',
        firemaking: '#e69138',
        crafting: '#c27ba0',
        smithing: '#b7b7b7',
        mining: '#999999',
        herblore: '#93c47d',
        agility: '#6d9eeb',
        thieving: '#a64d79',
        slayer: '#666666',
        farming: '#6aa84f',
        runecraft: '#8e7cc3',
        hunter: '#76a5af',
        construction: '#c27ba0'
    };
    return colors[skillName.toLowerCase()] || '#999999';
}

async function calculateXpGainsLast7Days(player) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    try {
        const { data, error } = await supabase
            .from("player_xp")
            .select("*")
            .eq("player_name", player)
            .gte("timestamp", sevenDaysAgo.toISOString())
            .order("timestamp", { ascending: true });

        if (error) throw error;

        if (data.length < 2) return {};

        const xpGains = {};
        const earliest = data[0];
        const latest = data[data.length - 1];

        skillData.forEach(skill => {
            xpGains[skill.key] = Math.max(0, latest[skill.key] - earliest[skill.key]);
        });

        return xpGains;
    } catch (error) {
        console.error(`Error calculating XP gains for ${player}:`, error);
        return {};
    }
}

// Utility function to introduce a delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to show the loading indicator
function showLoadingIndicator() {
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
        loadingIndicator.style.display = "block";
    }
}

// Function to hide the loading indicator
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById("loading-indicator");
    if (loadingIndicator) {
        loadingIndicator.style.display = "none";
    }
}

async function main() {
    try {
        showLoadingIndicator();
        await deleteOldData();

        const totalXpData = [];
        const xpGainedLast7DaysData = [];
        
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const hasData = await hasDataForLastHour(player);
            
            // Fetch skills only once per player
            const skills = await fetchPlayerSkills(player);
            
            if (!hasData) {
                await storePlayerSkills(player, skills);
            }

            // Calculate gains using the already-fetched skills
            // (No need to fetch again from API)
            const xpGains = await calculateXpGainsLast7Days(player);
            const totalXp = Object.values(skills).reduce((sum, xp) => sum + (xp || 0), 0);
            
            totalXpData.push({ player, totalXp });
            xpGainedLast7DaysData.push({ player, xpGains });

            if (i < players.length - 1) await delay(1000);
        }

        renderCharts(totalXpData, xpGainedLast7DaysData);
        
    } catch (error) {
        console.error("Error in main function:", error);
        const loadingIndicator = document.getElementById("loading-indicator");
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    } finally {
        hideLoadingIndicator();
    }
}
// Run the script
main();