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
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const categories = [
  'processor', 'graphicsCard', 'ram', 'storage',
  'motherboard', 'case', 'cooler', 'monitor',
  'powerSupply', 'keyboard', 'mouse', 'operatingSystem',
];

// Кэш на 60 секунд
let cachedComponents = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000;

const componentSchema = {
  processor: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    socket: row[3] || '', power: +row[4] || 0,
    frequency: +row[5] || 0, cores: +row[6] || 0,
  }),
  graphicsCard: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    power: +row[3] || 0, memory: +row[4] || 0,
    pcieVersion: row[5] || '',
  }),
  ram: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    ramType: row[3] || '', frequency: +row[4] || 0, 
    capacity: +row[5] || 0,
  }),
  storage: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    interface: row[3] || '',
  }),
  motherboard: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    socket: row[3] || '', formFactor: row[4] || '',
    ramType: row[5] || '', supportedInterfaces: row[6] || '', pcieVersion: row[7] || '',
  }),
  case: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    supportedFormFactors: row[3] || '',
  }),
  cooler: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    socket: row[3] || '',
  }),
  monitor: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    resolution: row[3] || '',
  }),
  powerSupply: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    wattage: +row[3] || 0,
  }),
  keyboard: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    type: row[3] || '',
  }),
  mouse: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    type: row[3] || '',
  }),
  operatingSystem: row => ({
    name: row[0] || '', price: +row[1] || 0, description: row[2] || '',
    version: row[3] || '',
  }),
};

app.get('/api/components', async (req, res) => {
  const now = Date.now();
  if (cachedComponents && now - lastFetchTime < CACHE_TTL) {
    console.log('📦 Отдаём кэшированные данные');
    return res.json(cachedComponents);
  }

  try {
    const authClient = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    const components = [];
    const erroredSheets = [];

    for (const category of categories) {
      const range = `${category}!A2:Z`;
      console.log(`📄 Чтение вкладки: ${category}`);

      try {
        const response = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range });
        const rows = response.data.values || [];

        if (!rows.length) {
          console.warn(`⚠️ Вкладка ${category} пуста.`);
          continue;
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const parser = componentSchema[category];
            if (!parser) continue;

            const component = parser(row);
            component.category = category;

            if (component.name && component.price > 0) {
              components.push(component);
            } else {
              console.warn(`⛔ Пропущен компонент (пустое имя или цена) в ${category} строка ${i + 2}`);
            }
          } catch (parseErr) {
            console.error(`❌ Ошибка разбора строки ${i + 2} в ${category}:`, parseErr.message);
          }
        }
      } catch (err) {
        console.error(`❌ Ошибка чтения вкладки ${category}:`, err.message);
        erroredSheets.push(category);
      }
    }

    console.log(`✅ Всего компонентов: ${components.length}`);
    if (erroredSheets.length) {
      console.warn(`⚠️ Ошибки во вкладках: ${erroredSheets.join(', ')}`);
    }

    // Кэшируем
    cachedComponents = components;
    lastFetchTime = Date.now();

    res.json(components);
  } catch (err) {
    console.error('❌ Внутренняя ошибка сервера:', err.message);
    res.status(500).json({ error: 'Ошибка при получении компонентов' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер работает на http://localhost:${port}`);
});
