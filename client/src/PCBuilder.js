import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function PCBuilder() {
  const [components, setComponents] = useState([]);
  const [aiResponse, setAiResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchComponents() {
      try {
        const res = await axios.get('https://pc-builder-backend-24zh.onrender.com/api/components');
        setComponents(res.data);
      } catch (err) {
        console.error('Ошибка при получении компонентов:', err);
        setError('Ошибка при загрузке компонентов.');
      }
    }
    fetchComponents();
  }, []);

  const handleAskAI = async () => {
    setLoading(true);
    setError('');
    setAiResponse('');

    try {
      const prompt = `
Вот список компонентов, доступных для сборки ПК:

${components.map(c => `- [${c.category}] ${c.name} (${c.price} тенге): ${c.description}`).join('\n')}

Предложи 3 разных сборки ПК для игр и работы: бюджетную, сбалансированную и продвинутую. Не учитывай операционную систему.
Выведи каждую сборку в отдельном блоке, с названиями компонентов и итоговой ценой для сборки, но не для каждого компонента. 
Обязательное условие, ты должен проверять компоненты на совместимость: CPU и материнка — по socket, ОЗУ и материнка — по ramType,
Накопитель и материнка — по interface и supportedInterfaces, Видеокарта и материнка — по pcieVersion, Кулер и процессор — по socket,
Материнка и корпус — по formFactor и supportedFormFactors, Блок питания — по суммарному потреблению компонентов (power) и запасу мощности`;

      const res = await axios.post('https://pc-builder-backend-24zh.onrender.com/api/ask-ai', { prompt });

      if (res.data && res.data.response) {
      setAiResponse(res.data.response);
    } else {
      setError('Пустой ответ от ИИ.');
    }
  } catch (err) {
    // Разбор ошибок из axios
    let message = 'Неизвестная ошибка';

    if (err.response && err.response.data) {
      // Ошибка с сервера
      message = err.response.data.error || JSON.stringify(err.response.data);
    } else if (err.message) {
      // Ошибка сети или другая
      message = err.message;
    }

    setError(`Ошибка при обращении к ИИ: ${message}`);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center">Сборщик ПК</h1>
      <button
        onClick={handleAskAI}
        disabled={loading}
        className={`w-full py-3 mb-4 text-white rounded-lg transition-colors duration-300
          ${loading ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
      >
        {loading ? 'Обращение к ИИ...' : 'Спросить у ИИ'}
      </button>

      {error && (
        <div className="mb-4 text-red-600 font-medium text-center">
          ❌ {error}
        </div>
      )}

      {aiResponse && (
        <div className="bg-gray-100 p-4 rounded-lg whitespace-pre-wrap text-gray-900">
          <h2 className="text-xl font-semibold mb-2">Ответ ИИ:</h2>
          <pre>{aiResponse}</pre>
        </div>
      )}
    </div>
  );
}

