import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname)));

app.get("/hiscores", async (req, res) => {
    const player = req.query.player;
    if (!player) return res.status(400).json({ error: "Player name required" });

    try {
        const response = await fetch(`https://services.runescape.com/m=hiscore_oldschool/index_lite.json?player=${encodeURIComponent(player)}`);
        if (!response.ok) throw new Error("Failed to fetch data");

        const text = await response.text();
        res.json({ data: text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));