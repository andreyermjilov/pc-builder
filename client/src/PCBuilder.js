import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './PCBuilder.css'; // Подключим стили отдельно

function PCBuilder() {
  const [components, setComponents] = useState([]);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const res = await axios.get('https://pc-builder-backend-24zh.onrender.com/api/components');
        setComponents(res.data);
      } catch (err) {
        console.error('Ошибка при получении компонентов:', err);
        setError('Ошибка при загрузке компонентов.');
      }
    };
    fetchComponents();
  }, []);

  const handleAskAI = async () => {
    setLoading(true);
    setError('');
    setAiResponse('');

    try {
      const prompt = `
Вот список компонентов, доступных для сборки ПК:

${components.map(c => `- [${c.category}] ${c.name} (${c.price} руб): ${c.description}`).join('\n')}

Предложи 3 разных сборки ПК для игр и работы: бюджетную, сбалансированную и продвинутую. Не учитывай операционную систему.
Выведи каждую сборку в отдельном блоке, с названиями компонентов и итоговой ценой.
`;

      const res = await axios.post('https://pc-builder-backend-24zh.onrender.com/api/ask-ai', { prompt });

      if (res.data && res.data.response) {
        setAiResponse(res.data.response);
      } else {
        setError('Пустой ответ от ИИ.');
      }
    } catch (err) {
      console.error('Ошибка при запросе к ИИ:', err);
      setError(err.response?.data?.error || 'Ошибка при получении ответа от ИИ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Сборщик ПК</h1>
      <button onClick={handleAskAI} disabled={loading}>
        {loading ? 'Обращение к ИИ...' : 'Спросить у ИИ'}
      </button>

      {error && <div className="error">❌ {error}</div>}

      {aiResponse && (
        <div className="ai-response">
          <h2>Ответ ИИ:</h2>
          <pre>{aiResponse}</pre>
        </div>
      )}
    </div>
  );
}

export default PCBuilder;
