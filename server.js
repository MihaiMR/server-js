const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const PROXY_URL = 'https://www.roproxy.com';

// Helper to fetch Roblox data with headers and retries
async function fetchRobloxData(endpoint, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(`${PROXY_URL}${endpoint}`, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        },
        timeout: 10000 // 10 seconds
      });
      return response.data;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${endpoint}: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000)); // wait 1 second before retry
    }
  }
}

// Fetch all T-shirts (with safe error handling)
app.get('/user-assets', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'Username is required' });

  try {
    const endpoint = `/v1/catalog/items/details?Category=3&CreatorName=${encodeURIComponent(username)}`;
    const data = await fetchRobloxData(endpoint);

    if (!data || !data.data) {
      console.warn(`No T-shirt data returned for username: ${username}`);
      return res.json([]); // return empty array instead of crashing
    }

    const tshirts = data.data.map(item => ({
      id: item.id,
      name: item.name || "Unknown",
      price: item.price || 0,
      creator: item.creator?.name || "Unknown"
    }));

    console.log(`Fetched ${tshirts.length} T-shirts for ${username}`);
    res.json(tshirts);
  } catch (error) {
    console.error("Failed to fetch T-shirts:", error.message);
    res.status(500).json({ error: 'Failed to fetch T-shirts' });
  }
});

// Fetch all gamepasses across all games (with safe error handling)
app.get('/user-gamepasses', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'User ID is required' });

  try {
    let allGames = [];
    let cursor = "";

    // Step 1: fetch all games (paginated)
    do {
      const url = `/v2/users/${userId}/games?accessFilter=Public&limit=50&cursor=${cursor}`;
      const gameData = await fetchRobloxData(url);
      if (!gameData || !gameData.data) break; // safe check
      allGames.push(...gameData.data);
      cursor = gameData.nextPageCursor || "";
    } while (cursor);

    const gamepasses = [];

    // Step 2: fetch all gamepasses per universe (paginated)
    for (const game of allGames) {
      if (!game.universeId) continue; // safe check

      let gpCursor = "";
      do {
        const gpUrl = `/v1/games/${game.universeId}/game-passes?limit=100&cursor=${gpCursor}`;
        const gpData = await fetchRobloxData(gpUrl);
        if (gpData?.data?.gamePasses) {
          gamepasses.push(...gpData.data.gamePasses.map(gp => ({
            id: gp.id,
            name: gp.name || "Unknown",
            price: gp.priceInRobux || 0,
            gameName: game.name || "Unknown"
          })));
        }
        gpCursor = gpData?.nextPageCursor || "";
      } while (gpCursor);
    }

    console.log(`Fetched ${gamepasses.length} gamepasses for user ${userId}`);
    res.json(gamepasses);
  } catch (error) {
    console.error("Failed to fetch gamepasses:", error.message);
    res.status(500).json({ error: 'Failed to fetch gamepasses' });
  }
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
