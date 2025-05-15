const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;
const port = process.env.SERVER_PORT || 3001;

app.use(cors({ origin: corsOrigin }));

if (!spreadsheetId || !keyFilePath) {
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env файле');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const categories = [
  'processor', 'graphicsCard', 'ram', 'storage', 'motherboard',
  'case', 'cooler', 'monitor', 'powerSupply', 'keyboard', 'mouse', 'operatingSystem'
];

const componentSchema = {
  processor: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    frequency: Number(row[3]) || 0, cores: Number(row[4]) || 0, socket: row[5] || '',
    power: Number(row[6]) || 0, integratedGraphics: row[7] || '',
    score: (Number(row[3]) || 0) * 10 + (Number(row[4]) || 0) * 5
  }),
  graphicsCard: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    memory: Number(row[3]) || 0, power: Number(row[4]) || 0,
    score: (Number(row[3]) || 0) * 10
  }),
  ram: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    frequency: Number(row[3]) || 0, capacity: Number(row[4]) || 0,
    score: (Number(row[3]) || 0) / 100 + (Number(row[4]) || 0)
  }),
  storage: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    score: 1
  }),
  motherboard: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    socket: row[3] || '', formFactor: row[4] || '',
    score: 1
  }),
  case: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    formFactor: row[3] || '', score: 1
  }),
  cooler: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    socket: row[3] || '', score: 1
  }),
  monitor: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    resolution: row[3] || '', score: 1
  }),
  powerSupply: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    wattage: Number(row[3]) || 0, score: 1
  }),
  keyboard: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    type: row[3] || '', score: 1
  }),
  mouse: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    type: row[3] || '', score: 1
  }),
  operatingSystem: row => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    version: row[3] || '', score: 1
  }),
};

app.get('/api/components', async (req, res) => {
  try {
    const client = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: client });
    const components = [];

    for (const category of categories) {
      const range = `${category}!A2:Z`;
      const response = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range });
      const rows = response.data.values || [];
      rows.forEach((row, index) => {
        if (componentSchema[category]) {
          const item = componentSchema[category](row);
          item.category = category;
          if (item.name && item.price > 0) {
            components.push(item);
          }
        }
      });
    }

    console.log('✅ Всего компонентов:', components.length);
    res.json(components);
  } catch (error) {
    console.error('Ошибка сервера:', error);
    res.status(500).send('Ошибка сервера');
  }
});

app.listen(port, () => {
  console.log(`🚀 Сервер работает на http://localhost:${port}`);
});
