import React, { useEffect, useState } from 'react';
import axios from 'axios';

function PCBuilder() {
  const [components, setComponents] = useState([]);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const res = await axios.get('https://pc-builder-backend-24zh.onrender.com/api/components');
        setComponents(res.data);
      } catch (err) {
        console.error('Ошибка при получении компонентов:', err);
      }
    };
    fetchComponents();
  }, []);

  const handleAskAI = async () => {
    setLoading(true);
    try {
      const prompt = `
Вот список компонентов, доступных для сборки ПК:

${components.map(c => `- [${c.category}] ${c.name} (${c.price} руб): ${c.description}`).join('\n')}

Предложи 3 разных сборки ПК для игр и работы: бюджетную, сбалансированную и продвинутую. Не учитывай операционную систему.
Выведи каждую сборку в отдельном блоке, с названиями компонентов и итоговой ценой.
`;

      const res = await axios.post('https://pc-builder-backend-24zh.onrender.com/api/ask-ai', { prompt });
      setAiResponse(res.data.response);
    } catch (err) {
      console.error('Ошибка при запросе к ИИ:', err);
      setAiResponse('Ошибка при получении ответа от ИИ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Сборщик ПК</h1>
      <button onClick={handleAskAI} disabled={loading}>
        {loading ? 'Обращение к ИИ...' : 'Спросить у ИИ'}
      </button>

      {aiResponse && (
        <div style={{ whiteSpace: 'pre-wrap', marginTop: '20px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
          <h2>Ответ ИИ:</h2>
          <div>{aiResponse}</div>
        </div>
      )}
    </div>
  );
}

export default PCBuilder;
