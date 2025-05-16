import axios from 'axios';
import { useState, useEffect } from 'react';

function PCBuilder() {
  const [components, setComponents] = useState([]);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  // Загрузка компонентов (пример, замени на свой источник)
  useEffect(() => {
    async function fetchComponents() {
      // Заменить на реальный API или логику загрузки компонентов из Google Sheets
      const data = await fetch('/api/components').then(res => res.json());
      setComponents(data);
    }
    fetchComponents();
  }, []);

  async function askAI() {
    if (components.length === 0) {
      alert("Компоненты не загружены, попробуйте позже.");
      return;
    }

    const prompt = `
Вот список компонентов, доступных для сборки ПК:

${components.map(c => `- [${c.category}] ${c.name} (${c.price} тенге): ${c.description}`).join('\n')}

Предложи 3 разных сборки ПК для игр и работы: бюджетную, сбалансированную и продвинутую.
Ты должен использовать только предложенные выше компоненты, не добавляй свои. Не учитывай операционную систему.
Выведи каждую сборку в отдельном блоке, с названиями компонентов и итоговой ценой для сборки, но не для каждого компонента. 
Обязательное условие: проверяй совместимость — 
- CPU и материнка — по socket,
- ОЗУ и материнка — по ramType,
- Накопитель и материнка — по interface и supportedInterfaces,
- Видеокарта и материнка — по pcieVersion,
- Кулер и процессор — по socket,
- Материнка и корпус — по formFactor и supportedFormFactors,
- Блок питания — по суммарному потреблению компонентов и запасу мощности.
`;

    try {
      setLoading(true);
      const res = await axios.post('https://pc-builder-backend-24zh.onrender.com/api/ask-ai', { prompt });
      setAiResponse(res.data.answer || res.data);
    } catch (err) {
      console.error(err);
      alert('Ошибка при запросе к ИИ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>PC Builder</h1>
      <button onClick={askAI} disabled={loading}>
        {loading ? 'Загрузка...' : 'Спросить у ИИ'}
      </button>

      <pre style={{whiteSpace: 'pre-wrap', marginTop: 20}}>
        {aiResponse}
      </pre>
    </div>
  );
}

export default PCBuilder;
