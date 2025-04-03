import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = "https://kjcnhuyfzftnxqygjlyn.supabase.co"; // Replace with your Supabase URL
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY25odXlmemZ0bnhxeWdqbHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDMzODgsImV4cCI6MjA1NzU3OTM4OH0._PvDuxHnpE5_thdY23PVNkuXh1fzWCa-xdSxymMhK-E"; // Replace with your Supabase key
const supabase = createClient(supabaseUrl, supabaseKey);

// List of players
const players = ["UIM_Soj", "flendygim", "jund guy", "manfoxturtle", "formud", "Karl Vog", "Large Pouch"];

// Skill IDs and names mapping (OSRS hiscores order)
const skillData = [
    { id: 0, name: "attack", key: "attack_xp" },
    { id: 1, name: "defence", key: "defence_xp" },
    { id: 2, name: "strength", key: "strength_xp" },
    { id: 3, name: "hitpoints", key: "hitpoints_xp" },
    { id: 4, name: "ranged", key: "ranged_xp" },
    { id: 5, name: "prayer", key: "prayer_xp" },
    { id: 6, name: "magic", key: "magic_xp" },
    { id: 7, name: "cooking", key: "cooking_xp" },
    { id: 8, name: "woodcutting", key: "woodcutting_xp" },
    { id: 9, name: "fletching", key: "fletching_xp" },
    { id: 10, name: "fishing", key: "fishing_xp" },
    { id: 11, name: "firemaking", key: "firemaking_xp" },
    { id: 12, name: "crafting", key: "crafting_xp" },
    { id: 13, name: "smithing", key: "smithing_xp" },
    { id: 14, name: "mining", key: "mining_xp" },
    { id: 15, name: "herblore", key: "herblore_xp" },
    { id: 16, name: "agility", key: "agility_xp" },
    { id: 17, name: "thieving", key: "thieving_xp" },
    { id: 18, name: "slayer", key: "slayer_xp" },
    { id: 19, name: "farming", key: "farming_xp" },
    { id: 20, name: "runecraft", key: "runecraft_xp" },
    { id: 21, name: "hunter", key: "hunter_xp" },
    { id: 22, name: "construction", key: "construction_xp" }
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

// Render bar charts
let totalXpChartInstance = null;
let xpGainedChartInstance = null;

function renderStackedXpGainedChart(xpGainedData) {
    const ctx = document.getElementById("xpGainedChart")?.getContext("2d");
    if (!ctx) return;

    // Destroy previous chart instance if it exists
    if (xpGainedChartInstance) {
        xpGainedChartInstance.destroy();
    }

    // Prepare dataset for each skill
    const datasets = skillData.map(skill => {
        // Use a color palette that matches OSRS skills
        const color = getSkillColor(skill.name);
        return {
            label: skill.name,
            data: xpGainedData.map(playerData => playerData.xpGains[skill.key] || 0),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
        };
    });

    xpGainedChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: xpGainedData.map(data => data.player),
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'XP Gained'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            // Show detailed XP breakdown in tooltip
                            const playerData = xpGainedData[context[0].dataIndex];
                            return skillData.map(skill => {
                                const xp = playerData.xpGains[skill.key];
                                return xp > 0 ? `${skill.name}: ${xp.toLocaleString()} XP` : null;
                            }).filter(Boolean);
                        }
                    }
                }
            }
        }
    });
}

// OSRS skill colors (you can customize these)
function getSkillColor(skillName) {
    const colors = {
        attack: '#990000',
        strength: '#ff0000',
        defence: '#0066cc',
        hitpoints: '#ff9900',
        ranged: '#66cc00',
        prayer: '#ffff00',
        magic: '#800080',
        cooking: '#cc6600',
        woodcutting: '#663300',
        fletching: '#996633',
        fishing: '#3399ff',
        firemaking: '#ff6600',
        crafting: '#cc99ff',
        smithing: '#999999',
        mining: '#666666',
        herblore: '#009900',
        agility: '#0099cc',
        thieving: '#663399',
        slayer: '#000000',
        farming: '#33cc33',
        runecraft: '#ccffff',
        hunter: '#66cc99',
        construction: '#cc9966'
    };
    return colors[skillName] || '#cccccc';
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

        const xpGainedLast7DaysData = [];
        
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const hasData = await hasDataForLastHour(player);
            
            const skills = await fetchPlayerSkills(player);
            
            if (!hasData) {
                await storePlayerSkills(player, skills);
            }

            const xpGains = await calculateXpGainsLast7Days(player);
            xpGainedLast7DaysData.push({
                player,
                xpGains,
                totalXp: Object.values(skills).reduce((sum, xp) => sum + xp, 0)
            });

            if (i < players.length - 1) await delay(1000);
        }

        renderStackedXpGainedChart(xpGainedLast7DaysData);
        
    } catch (error) {
        console.error("Error in main function:", error);
        // Error handling...
    } finally {
        hideLoadingIndicator();
    }
}
// Run the script
main();