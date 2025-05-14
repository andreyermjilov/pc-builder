    const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || '*';

const spreadsheetId = process.env.SPREADSHEET_ID;
const keyFilePath = process.env.KEY_FILE_PATH;

if (!spreadsheetId || !keyFilePath) {
  console.error('SPREADSHEET_ID и KEY_FILE_PATH должны быть установлены в .env файле');
  process.exit(1);
}

app.use(cors({ origin: corsOrigin }));

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, keyFilePath),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Категории
const categories = [
  'processor', 'graphicsCard', 'ram', 'storage',
  'motherboard', 'case', 'cooler', 'monitor',
  'powerSupply', 'keyboard', 'mouse', 'operatingSystem',
];

// ======================= ЗАГРУЗКА КОМПОНЕНТОВ =======================
app.get('/api/components', async (req, res) => {
  console.log('📄 Чтение компонентов из Google Sheets');
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const allComponents = [];

    for (const category of categories) {
      const range = `${category}!A2:G`;
      console.log(`📄 Чтение вкладки: ${category}`);
      const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const rows = data.values || [];

      const items = rows.map((row) => ({
        name: row[0] || '',
        price: Number(row[1]) || 0,
        description: row[2] || '',
        performance: Number(row[3]) || 0,
        category,
        socket: row[4] || '',
        power: Number(row[5]) || 0,
        integratedGraphics: row[6]?.toLowerCase().includes('true') || false,
        formFactor: row[5] || '',
        wattage: Number(row[5]) || 0,
      })).filter(item => item.name && item.price > 0);

      allComponents.push(...items);
    }

    console.log(`✅ Всего компонентов: ${allComponents.length}`);
    res.json(allComponents);
  } catch (error) {
    console.error('❌ Ошибка загрузки компонентов:', error.message);
    res.status(500).json({ error: 'Ошибка загрузки компонентов' });
  }
});

// ======================= ГЕНЕРАЦИЯ ШАБЛОНОВ =======================
app.get('/api/templates', async (req, res) => {
  console.log('📄 Генерация шаблонов из таблицы');

  try {
    const client = await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth: client });

    const buildList = {};

    for (const category of categories) {
      const range = `${category}!A2:G`;
      const { data } = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range });
      const rows = data.values || [];

      const items = rows.map((row) => ({
        name: row[0] || '',
        price: Number(row[1]) || 0,
        description: row[2] || '',
        performance: Number(row[3]) || 0,
        category,
        socket: row[4] || '',
        power: Number(row[5]) || 0,
        integratedGraphics: row[6]?.toLowerCase().includes('true') || false,
        formFactor: row[5] || '',
        wattage: Number(row[5]) || 0,
      })).filter(item => item.name && item.price > 0);

      buildList[category] = items;
    }

    const buildTemplate = (name, targetBudget) => {
      const template = { name, description: '', components: [] };
      const config = {};

      const cpuList = buildList.processor.sort((a, b) => a.price - b.price);
      const mbList = buildList.motherboard;
      const ramList = buildList.ram;
      const storageList = buildList.storage;
      const caseList = buildList.case;
      const coolerList = buildList.cooler;
      const monitorList = buildList.monitor;
      const psuList = buildList.powerSupply;
      const keyboardList = buildList.keyboard;
      const mouseList = buildList.mouse;
      const gpuList = buildList.graphicsCard.sort((a, b) => a.price - b.price);

      const cpu = cpuList[0];
      config.processor = cpu;
      config.motherboard = mbList.find(mb => mb.socket === cpu.socket);
      config.ram = ramList[0];
      config.storage = storageList[0];

      config.case = caseList.find(c => {
        if (!c.formFactor || !config.motherboard?.formFactor) return false;
        return c.formFactor.toLowerCase().includes(config.motherboard.formFactor.toLowerCase());
      }) || caseList[0];

      config.cooler = coolerList.find(cooler => {
        if (!cooler.socket) return false;
        return cooler.socket.split(',').map(s => s.trim()).includes(cpu.socket);
      }) || coolerList[0];

      config.monitor = monitorList[0];
      config.keyboard = keyboardList[0];
      config.mouse = mouseList[0];

      if (!cpu.integratedGraphics) {
        config.graphicsCard = gpuList[0];
      }

      const requiredPower = (cpu.power || 0) + (config.graphicsCard?.power || 0) + 100;
      config.powerSupply = psuList.find(psu => psu.wattage >= requiredPower) || psuList[0];

      template.components = Object.values(config).filter(Boolean);
      return template;
    };

    const templates = [
      buildTemplate('Офисный ПК', 200000),
      buildTemplate('Бюджетный игровой', 300000),
      buildTemplate('Оптимальный гейминг', 400000),
    ];

    console.log(`✅ Сформировано шаблонов: ${templates.length}`);
    res.json(templates);
  } catch (err) {
    console.error('❌ Ошибка генерации шаблонов:', err.message);
    res.status(500).json({ error: 'Ошибка генерации шаблонов' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Сервер работает на http://localhost:${port}`);
});
