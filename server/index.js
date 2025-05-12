const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config(); // Загружаем переменные окружения

const app = express();

// Используем переменные окружения
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;
const port = process.env.SERVER_PORT || 3001;

app.use(cors({ origin: corsOrigin }));

if (!spreadsheetId || !keyFilePath) {
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env файле');
  process.exit(1);
}

// Настройка Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

const categories = [
  'processor',
  'graphicsCard',
  'ram',
  'storage',
  'motherboard',
  'case',
  'cooler',
  'monitor',
  'powerSupply',
  'keyboard',
  'mouse',
  'operatingSystem',
];

// Схема для парсинга компонентов, чтобы избежать длинных if-else
const componentSchema = {
  processor: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, socket: row[4] || '', power: Number(row[5]) || 0,
  }),
  graphicsCard: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, power: Number(row[4]) || 0,
  }),
  ram: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0,
  }),
  storage: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0,
  }),
  motherboard: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, socket: row[4] || '', formFactor: row[5] || '',
  }),
  case: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, formFactor: row[4] || '',
  }),
  cooler: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, socket: row[4] || '', // Сокеты могут быть через запятую
  }),
  monitor: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, resolution: row[4] || '',
  }),
  powerSupply: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, wattage: Number(row[4]) || 0,
  }),
  keyboard: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, type: row[4] || '',
  }),
  mouse: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, type: row[4] || '',
  }),
  operatingSystem: (row) => ({
    name: row[0] || '', price: Number(row[1]) || 0, description: row[2] || '',
    performance: Number(row[3]) || 0, version: row[4] || '',
  }),
};

app.get('/api/components', async (req, res) => {
  try {
    const components = [];
    const erroredSheets = [];

    for (const category of categories) {
      const range = `${category}!A2:F`; // Предполагаем до 6 столбцов (A-F)
      console.log(`Чтение вкладки: ${category}`);
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        const rows = response.data.values || [];
        console.log(`Данные из вкладки ${category}:`, rows.length > 0 ? `${rows.length} строк` : 'пусто');

        if (!rows.length) {
          console.warn(`Вкладка ${category} пуста или не содержит данных.`);
          // Можно не добавлять в erroredSheets, если пустая вкладка - это нормально
          continue;
        }

        rows.forEach((row, index) => {
          let component = {};
          try {
            if (componentSchema[category]) {
              component = componentSchema[category](row);
              component.category = category; // Добавляем категорию к объекту
            } else {
              console.warn(`Неизвестная категория: ${category}`);
              return; // Пропускаем неизвестные категории
            }

            if (component.name && component.price > 0) {
              components.push(component);
            } else {
              console.warn(`Пропущен компонент в ${category} (строка ${index + 2} в таблице, данные: ${JSON.stringify(row)}): невалидное имя или цена.`);
            }
          } catch (err) {
            console.error(`Ошибка обработки строки в ${category} (строка ${index + 2} в таблице, данные: ${JSON.stringify(row)}):`, err.message);
          }
        });
      } catch (err) {
        console.error(`Ошибка при чтении вкладки ${category}:`, err.message);
        erroredSheets.push(category);
      }
    }

    if (erroredSheets.length > 0) {
        console.warn('Проблемы при чтении следующих вкладок:', erroredSheets.join(', '));
        // Решаем, отправлять ли частичные данные или ошибку
        // В данном случае, если есть хоть какие-то компоненты, отправляем их.
    }

    console.log('Всего компонентов с сервера для отправки:', components.length);
    if (components.length === 0) {
      console.warn('Нет компонентов для отправки клиенту.');
      const errorMessage = erroredSheets.length > 0
        ? `Ошибка при чтении данных из Google Sheets для вкладок: ${erroredSheets.join(', ')}. Проверьте доступ и наличие данных.`
        : 'Нет доступных компонентов. Проверьте данные в Google Sheets.';
      res.status(500).json({ error: errorMessage });
    } else {
      res.json(components);
    }
  } catch (error) {
    console.error('Ошибка сервера:', error);
    res.status(500).send('Внутренняя ошибка сервера');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${port} и разрешает запросы с ${corsOrigin}`);
});