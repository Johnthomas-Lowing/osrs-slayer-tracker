const players = ["UIM_Soj", "flendygim", "jund guy", "manfoxturtle", "formud", "Karl Vog"];
async function fetchSlayerLevels(player) {
    try {
        const response = await fetch(`http://localhost:3000/hiscores?player=${encodeURIComponent(player)}`);
        const data = await response.json();

        if (!data.data) {
            console.error(`Error fetching data for ${player}:`, data.error);
            return { player, level: 0, xp: 0, percentage: 0 }; // Return default values for errors
        }

        const hiscores = JSON.parse(data.data);
        const slayerSkill = hiscores.skills.find(skill => skill.id === 19);
        const slayerLevel = slayerSkill ? slayerSkill.level : 0;
        const slayerXp = slayerSkill ? slayerSkill.xp : 0;
        const percentage = (slayerXp / 200000000) * 100; // Example calculation for percentage

        return { player, level: slayerLevel, xp: slayerXp, percentage };
    } catch (error) {
        console.error(`Error fetching data for ${player}`, error);
        return { player, level: 0, xp: 0, percentage: 0 }; // Return default values for errors
    }
}

async function renderChart() {
    const chart = document.getElementById("chart");
    chart.innerHTML = ""; // Clear previous content

    // Fetch data for all players
    const playerData = await Promise.all(players.map(fetchSlayerLevels));

    // Sort players by XP (descending)
    playerData.sort((a, b) => b.xp - a.xp);

    // Render bars for each player
    playerData.forEach(({ player, level, xp, percentage }, index) => {
        const bar = document.createElement("div");
        bar.className = "bar";

        const barLabel = document.createElement("div");
        barLabel.className = "bar-label";
        barLabel.textContent = `${player}`; // Player name
        if (barLabel.textContent == "flendygim"){
            barLabel.textContent = "flendygim :(";
        }

        const barDetails = document.createElement("div");
        barDetails.className = "bar-details";
        barDetails.textContent = `${(xp / 1000000).toFixed(2)}M (${level})  `; // Simplified details

        const barFill = document.createElement("div");
        barFill.className = "bar-fill";
        barFill.style.width = `${percentage}%`;

        bar.appendChild(barLabel);
        bar.appendChild(barDetails);
        bar.appendChild(barFill);
        chart.appendChild(bar);
    });
}

// Render the chart initially and refresh every 5 minutes
renderChart();
setInterval(renderChart, 5 * 60 * 1000);