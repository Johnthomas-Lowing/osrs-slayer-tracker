// Check if running in Node.js or the browser
const isNode = typeof process !== 'undefined' && process.versions?.node;

let createClient;
if (isNode) {
  // Running in Node.js: use require
  const { createClient: supabaseCreateClient } = require('@supabase/supabase-js');
  createClient = supabaseCreateClient;
} else {
  // Running in the browser: use import
  import('https://esm.sh/@supabase/supabase-js').then((module) => {
    createClient = module.createClient;
    initializeSupabase();
  }).catch((err) => {
    console.error('Failed to load Supabase client:', err);
  });
}

// Initialize Supabase
function initializeSupabase() {
  const supabaseUrl = "https://kjcnhuyfzftnxqygjlyn.supabase.co";
  const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqY25odXlmemZ0bnhxeWdqbHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDIwMDMzODgsImV4cCI6MjA1NzU3OTM4OH0._PvDuxHnpE5_thdY23PVNkuXh1fzWCa-xdSxymMhK-E"; // Replace with your Supabase key
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Your Supabase logic here
  console.log('Supabase client initialized:', supabase);
}

// If running in Node.js, initialize Supabase immediately
if (isNode) {
  initializeSupabase();
}
// List of players
const players = ["UIM_Soj", "flendygim", "jund guy", "manfoxturtle", "formud", "Karl Vog", "Large Pouch"];

// Fetch Slayer XP from OSRS Hiscores API
async function fetchSlayerXp(player) {
    try {
        const response = await fetch(
            `https://api.allorigins.win/raw?url=${encodeURIComponent(
                `https://services.runescape.com/m=hiscore_oldschool/index_lite.json?player=${player}`
            )}`
        );
        if (!response.ok) throw new Error("Failed to fetch data");

        const hiscores = await response.json();
        const slayerSkill = hiscores.skills.find(skill => skill.id === 19);
        return slayerSkill ? slayerSkill.xp : 0;
    } catch (error) {
        console.error(`Error fetching XP for ${player}:`, error);
        return 0;
    }
}


// Check if data already exists in the last hour
async function hasDataForLastHour(player) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // Subtract 1 hour from current time

    console.log(`Checking data for ${player} in the last hour (since ${oneHourAgo.toISOString()})`);

    try {
        const { data, error } = await supabase
            .from("player_xp")
            .select("id")
            .eq("player_name", player)
            .gte("timestamp", oneHourAgo.toISOString()) // Check for entries in the last hour
            .lte("timestamp", now.toISOString());

        if (error) {
            console.error(`Supabase query error for ${player}:`, error);
            throw error;
        }

        console.log(`Data for ${player} in the last hour:`, data);
        return data.length > 0;
    } catch (error) {
        console.error(`Error checking data for ${player}:`, error);
        return false; // Assume no data exists if there's an error
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

// Store Slayer XP in the database
async function storeXp(player, slayerXp) {
    try {
        const { error } = await supabase
            .from("player_xp")
            .insert([{ player_name: player, slayer_xp: slayerXp }]);

        if (error) throw error;
        console.log(`Stored XP for ${player}: ${slayerXp}`);
    } catch (error) {
        console.error(`Error storing XP for ${player}:`, error);
    }
}

// Render bar charts
let totalXpChartInstance = null;
let xpGainedChartInstance = null;

function renderBarCharts(totalXpData, xpGainedLast7DaysData) {
    console.log("Rendering charts...");
    console.log("Total XP Data:", totalXpData);
    console.log("XP Gained Last 7 Days Data:", xpGainedLast7DaysData);

    const ctx1 = document.getElementById("totalXpChart").getContext("2d");
    const ctx2 = document.getElementById("xpGainedChart").getContext("2d");

    if (!ctx1 || !ctx2) {
        console.error("Canvas elements not found!");
        return;
    }

    // Destroy existing chart instances if they exist
    if (totalXpChartInstance) {
        totalXpChartInstance.destroy();
    }
    if (xpGainedChartInstance) {
        xpGainedChartInstance.destroy();
    }

    // Sort data in descending order
    totalXpData.sort((a, b) => b.xp - a.xp);
    xpGainedLast7DaysData.sort((a, b) => b.xp - a.xp);

    // Total XP Chart
    totalXpChartInstance = new Chart(ctx1, {
        type: "bar",
        data: {
            labels: totalXpData.map(data => data.player),
            datasets: [{
                label: "Total Slayer XP",
                data: totalXpData.map(data => data.xp),
                backgroundColor: "rgba(54, 162, 235, 0.5)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1,
            }],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Total Slayer XP",
                    },
                },
            },
        },
    });

    // XP Gained Last 7 Days Chart
    xpGainedChartInstance = new Chart(ctx2, {
        type: "bar",
        data: {
            labels: xpGainedLast7DaysData.map(data => data.player),
            datasets: [{
                label: "Slayer XP Gained (Last 7 Days)",
                data: xpGainedLast7DaysData.map(data => data.xp),
                backgroundColor: "rgba(255, 99, 132, 0.5)",
                borderColor: "rgba(255, 99, 132, 1)",
                borderWidth: 1,
            }],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Slayer XP Gained",
                    },
                },
            },
        },
    });
}

// Function to calculate XP gains over the last 7 days
async function calculateXpGainsLast7Days(player) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7); // Get the date 7 days ago

    try {
        // Fetch XP data for the last 7 days
        const { data, error } = await supabase
            .from("player_xp")
            .select("slayer_xp, timestamp")
            .eq("player_name", player)
            .gte("timestamp", sevenDaysAgo.toISOString()) // Data from the last 7 days
            .order("timestamp", { ascending: true }); // Sort by timestamp ascending

        if (error) {
            console.error(`Supabase query error for ${player}:`, error);
            throw error;
        }

        // If there's no data or only one entry, return 0
        if (data.length < 2) {
            console.log(`Not enough data to calculate XP gains for ${player}`);
            return 0;
        }

        // Calculate the difference between the earliest and latest XP values
        const earliestXp = data[0].slayer_xp;
        const latestXp = data[data.length - 1].slayer_xp;
        const xpGained = latestXp - earliestXp;

        console.log(`XP gained for ${player} in the last 7 days:`, xpGained);
        return xpGained;
    } catch (error) {
        console.error(`Error calculating XP gains for ${player}:`, error);
        return 0;
    }
}

// Utility function to introduce a delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    await deleteOldData();

    const totalXpData = [];
    const xpGainedLast7DaysData = [];
    console.log("Starting Slayer XP update...");

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        console.log(`Processing player: ${player}`);

        // Check if data already exists within the last hour
        const hasData = await hasDataForLastHour(player);
        let slayerXp;

        if (hasData) {
            console.log(`Data already exists for ${player} within the last hour. Skipping...`);
            slayerXp = await fetchSlayerXp(player); // Fetch XP for totalXpData
        } else {
            // Fetch Slayer XP
            slayerXp = await fetchSlayerXp(player);
            console.log(`Fetched Slayer XP for ${player}: ${slayerXp}`);

            // Store XP in the database
            await storeXp(player, slayerXp);
        }

        // Use the fetched XP for totalXpData
        totalXpData.push({ player, xp: slayerXp });

        // Calculate XP gains over the last 7 days
        const xpGainedLast7Days = await calculateXpGainsLast7Days(player);
        xpGainedLast7DaysData.push({ player, xp: xpGainedLast7Days });

        // Add a delay of 1 second between requests
        if (i < players.length - 1) {
            await delay(1000);
        }
    }

    console.log("Slayer XP update complete!");
    renderBarCharts(totalXpData, xpGainedLast7DaysData);
}
// Run the script
main();