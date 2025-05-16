const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Проверка переменных окружения
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;
const port = process.env.SERVER_PORT || 3001;

if (!spreadsheetId || !keyFilePath || !process.env.OPENROUTER_API_KEY) {
  console.error('❌ Убедись, что .env содержит SPREADSHEET_ID, KEY_FILE_PATH и OPENROUTER_API_KEY');
  process.exit(1);
}

app.use(cors({ origin: corsOrigin }));

// Авторизация Google Sheets API
const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Категории компонентов
const categories = [
  'processor', 'graphicsCard', 'ram', 'storage',
  'motherboard', 'case', 'cooler', 'monitor',
  'powerSupply', 'keyboard', 'mouse', 'operatingSystem',
];

// Парсинг чисел
const parseNumber = val => {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// Схемы обработки компонентов
const componentSchema = {
  processor: row => {
    const item = {
      name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
      socket: row[3] || '', power: parseNumber(row[4]),
      frequency: parseNumber(row[5]), cores: parseNumber(row[6])
    };
    item.score = item.frequency * 10 + item.cores;
    return item;
  },
  graphicsCard: row => {
    const item = {
      name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
      power: parseNumber(row[3]), memory: parseNumber(row[4]), pcieVersion: row[5] || ''
    };
    item.score = item.memory * 10;
    return item;
  },
  ram: row => {
    const item = {
      name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
      ramType: row[3] || '', frequency: parseNumber(row[4]), capacity: parseNumber(row[5])
    };
    item.score = item.frequency / 100 + item.capacity;
    return item;
  },
  storage: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    interface: row[3] || '', score: 1
  }),
  motherboard: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    socket: row[3] || '', formFactor: row[4] || '', ramType: row[5] || '',
    supportedInterfaces: row[6] || '', pcieVersion: row[7] || '', score: 1
  }),
  case: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    supportedFormFactors: row[3] || '', score: 1
  }),
  cooler: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    socket: row[3] || '', score: 1
  }),
  monitor: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    resolution: row[3] || '', score: 1
  }),
  powerSupply: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    wattage: parseNumber(row[3]), score: 1
  }),
  keyboard: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    type: row[3] || '', score: 1
  }),
  mouse: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    type: row[3] || '', score: 1
  }),
  operatingSystem: row => ({
    name: row[0] || '', price: parseNumber(row[1]), description: row[2] || '',
    version: row[3] || '', score: 1
  }),
};

// Кеш
let cachedComponents = null;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 минута

// API: /components
app.get('/api/components', async (req, res) => {
  const now = Date.now();
  if (cachedComponents && now - lastFetchTime < CACHE_TTL) {
    return res.json(cachedComponents);
  }

  try {
    const authClient = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: authClient });

    const components = [];

    for (const category of categories) {
      const range = `${category}!A2:Z`;
      const response = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range });
      const rows = response.data.values || [];
      const parser = componentSchema[category];

      for (const row of rows) {
        try {
          const component = parser(row);
          component.category = category;
          if (component.name && component.price > 0) components.push(component);
        } catch (e) {
          console.warn(`Ошибка парсинга ${category}:`, e.message);
        }
      }
    }

    cachedComponents = components;
    lastFetchTime = now;
    res.json(components);
  } catch (err) {
    console.error('❌ Ошибка при получении компонентов:', err);
    res.status(500).json({ error: 'Ошибка сервера при получении компонентов' });
  }
});

// API: /ask-ai
app.post('/api/ask-ai', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt не указан' });

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'openai/gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `
Ты — ассистент по сборке ПК. Тебе приходит список компонентов и запрос на 3 сборки: бюджетная, сбалансированная и продвинутая.
Обязательно проверяй компоненты на совместимость по следующим правилам:
- Процессор и материнская плата должны совпадать по socket.
- Оперативная память и материнская плата должны совпадать по ramType.
- Накопитель должен поддерживаться материнской платой по interface и supportedInterfaces.
- Видеокарта должна быть совместима с материнской платой по pcieVersion.
- Кулер должен подходить процессору по socket.
- Материнская плата должна подходить корпусу по formFactor и supportedFormFactors.
- Блок питания должен обеспечивать суммарное потребление всех компонентов с запасом мощности (примерно +20%).

Используй только те компоненты, которые переданы в запросе.
Не добавляй компоненты, которых нет в списке.
Не упоминай операционную систему.
Выведи каждую сборку отдельным блоком с названиями компонентов и итоговой ценой.
Если компоненты несовместимы — укажи это явно в ответе.
            `.trim()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ response: response.data.choices[0].message.content });
  } catch (err) {
    console.error('❌ Ошибка при запросе к OpenRouter:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Ошибка при обращении к ИИ' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен: http://localhost:${port}`);
});
