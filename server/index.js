const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.SERVER_PORT || 3001;
const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;

if (!spreadsheetId || !keyFilePath) {
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

const categories = [
  'processor', 'graphicsCard', 'ram', 'storage',
  'motherboard', 'case', 'cooler', 'monitor',
  'powerSupply', 'keyboard', 'mouse', 'operatingSystem'
];

// Универсальная обработка строк с вычислением score
const calculateScore = (category, row) => {
  const num = (i) => Number(row[i]) || 0;
  switch (category) {
    case 'processor':
      return num(6) * 10 + num(7) * 5;
    case 'graphicsCard':
      return num(5) * 10;
    case 'ram':
      return num(5) / 100 + num(6);
    default:
      return 1;
  }
};

app.get('/api/components', async (req, res) => {
  try {
    const components = [];

    for (const category of categories) {
      const range = `${category}!A2:Z`;
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = response.data.values || [];

      rows.forEach((row, index) => {
        if (!row[0] || !row[1]) return;
        const component = {
          name: row[0],
          price: Number(row[1]) || 0,
          description: row[2] || '',
          category,
          socket: row[4] || '',
          power: Number(row[5]) || 0,
          formFactor: row[6] || '',
          resolution: row[7] || '',
          wattage: Number(row[8]) || 0,
          type: row[9] || '',
          version: row[10] || '',
          frequency: Number(row[11]) || 0,
          cores: Number(row[12]) || 0,
          memory: Number(row[13]) || 0,
          capacity: Number(row[14]) || 0,
          integratedGraphics: row[15]?.toLowerCase() === 'yes',
        };
        component.score = calculateScore(category, row);

        if (component.name && component.price > 0) {
          components.push(component);
        }
      });
    }

    res.json(components);
  } catch (err) {
    console.error('Ошибка API:', err.message);
    res.status(500).json({ error: 'Ошибка сервера при загрузке компонентов.' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${port}`);
});
