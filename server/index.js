import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // или свой ключ
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Жёсткий системный prompt для проверки совместимости и правил сборки
const SYSTEM_PROMPT = `
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
`;

app.post('/api/ask-ai', async (req, res) => {
  try {
    const userPrompt = req.body.prompt;
    if (!userPrompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Формируем запрос к OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-4o-mini', // можно поменять на нужную модель
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const answer = response.data.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error('Error in /api/ask-ai:', error.response?.data || error.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
