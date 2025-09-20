const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Set your proxy URL here
const PROXY_URL = 'https://www.roproxy.com';

// Helper function to fetch data from Roblox API via proxy
async function fetchRobloxData(endpoint) {
  try {
    const response = await axios.get(`${PROXY_URL}${endpoint}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching data from Roblox API:', error);
    throw new Error('Failed to fetch data');
  }
}

// Endpoint to get user-generated T-shirts
app.get('/user-assets', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const data = await fetchRobloxData(`/v1/search/items/details?Category=3&CreatorName=${encodeURIComponent(username)}`);
    const tshirts = data.data.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      creator: item.creator.name,
    }));
    res.json(tshirts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch T-shirts' });
  }
});

// Endpoint to get gamepasses across all games created by the user
app.get('/user-gamepasses', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const gamesResponse = await fetchRobloxData(`/v2/users/${userId}/games?accessFilter=Public&limit=50`);
    const gamepasses = [];

    for (const game of gamesResponse.data) {
      const gamepassResponse = await fetchRobloxData(`/v1/games/${game.universeId}/game-passes?limit=100`);
      gamepasses.push(...gamepassResponse.data.gamePasses.map(gp => ({
        id: gp.id,
        name: gp.name,
        price: gp.priceInRobux,
        game: game.name,
      })));
    }

    res.json(gamepasses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch gamepasses' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
