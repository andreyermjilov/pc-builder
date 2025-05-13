const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { google } = require('googleapis');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 3001;

const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;

if (!spreadsheetId || !keyFilePath) {
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env файле');
  process.exit(1);
}

// ✅ Используем абсолютный путь к ключу
const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));

// Чтение одной вкладки из таблицы
async function readSheet(sheetName) {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const range = `${sheetName}!A2:D`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.warn(`Нет данных во вкладке: ${sheetName}`);
      return [];
    }

    return rows.map(row => ({
      name: row[0] || '',
      price: row[1] ? Number(row[1]) : 0,
      description: row[2] || '',
      performance: row[3] ? Number(row[3]) : 0,
      category: sheetName,
    }));
  } catch (error) {
    console.error(`Ошибка при чтении вкладки ${sheetName}:`, error.message);
    return [];
  }
}

// Объединённый маршрут для чтения всех вкладок
app.get('/api/components', async (req, res) => {
  const sheetNames = [
    'processor', 'graphicsCard', 'ram', 'storage',
    'motherboard', 'case', 'cooler', 'monitor',
    'powerSupply', 'keyboard', 'mouse', 'operatingSystem'
  ];

  const allComponents = [];

  for (const sheetName of sheetNames) {
    console.log(`Чтение вкладки: ${sheetName}`);
    const items = await readSheet(sheetName);
    if (items.length === 0) {
      console.warn(`Нет данных для: ${sheetName}`);
    }
    allComponents.push(...items);
  }

  console.log(`Всего компонентов с сервера для отправки: ${allComponents.length}`);
  res.json(allComponents);
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
