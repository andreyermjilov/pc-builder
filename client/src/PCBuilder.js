import React, { useEffect, useState } from 'react';

const API_BASE_URL = 'https://pc-builder-backend-24zh.onrender.com';
const PCBuilder = () => {
  const [components, setComponents] = useState(null);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/components`);
        if (!response.ok) throw new Error('Ошибка сети');
        const data = await response.json();
        setComponents(data);
      } catch (error) {
        console.error('Ошибка при загрузке компонентов:', error);
      }
    };

    fetchComponents();
  }, []);

  if (!components) return <div>Загрузка...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Конфигурации</h1>
      {Object.entries(components).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-xl font-semibold mt-4">{category}</h2>
          <ul className="list-disc list-inside">
            {items.map((item, index) => (
              <li key={index}>{item.name} — {item.price}₸</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default PCBuilder;

