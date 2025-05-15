import React, { useState, useEffect } from "react";

const MAX_OPTIONS_PER_CATEGORY = 10; // максимум компонентов в категории для перебора
const MAX_CONFIGURATIONS = 30; // максимум собираемых конфигураций

function PCBuilder() {
  const [components, setComponents] = useState({});
  const [budget, setBudget] = useState("");
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загружаем компоненты с сервера
  useEffect(() => {
    fetch("/api/components")
      .then((res) => res.json())
      .then((data) => {
        // Ограничиваем варианты по каждой категории
        const limited = {};
        for (const category in data) {
          // Сортируем по цене и берем первые MAX_OPTIONS_PER_CATEGORY
          limited[category] = data[category]
            .sort((a, b) => a.price - b.price)
            .slice(0, MAX_OPTIONS_PER_CATEGORY);
        }
        setComponents(limited);
        setLoading(false);
      });
  }, []);

  // Проверка совместимости — пример для процессора и материнской платы по сокету
  function isCompatible(cpu, motherboard) {
    if (!cpu || !motherboard) return true;
    return cpu.socket === motherboard.socket;
  }

  // Можно расширить проверки и добавить другие категории

  // Рекурсивный перебор конфигураций с ограничением количества
  function buildConfigs(categories, index = 0, currentConfig = {}, results = []) {
    if (results.length >= MAX_CONFIGURATIONS) return results;
    if (index === categories.length) {
      // Проверка совместимости примитивная, расширить можно
      if (
        isCompatible(currentConfig.cpu, currentConfig.motherboard) &&
        // добавьте другие проверки
        (budget === "" || getTotalPrice(currentConfig) <= Number(budget))
      ) {
        results.push({ ...currentConfig });
      }
      return results;
    }

    const category = categories[index];
    const items = components[category] || [];
    for (let item of items) {
      currentConfig[category] = item;
      buildConfigs(categories, index + 1, currentConfig, results);
      if (results.length >= MAX_CONFIGURATIONS) break;
    }
    return results;
  }

  function getTotalPrice(config) {
    return Object.values(config).reduce((sum, item) => sum + (item?.price || 0), 0);
  }

  // Запуск подборки при изменении бюджета или компонентов
  useEffect(() => {
    if (loading) return;
    const categories = Object.keys(components);
    if (categories.length === 0) {
      setConfigs([]);
      return;
    }
    const newConfigs = buildConfigs(categories);
    setConfigs(newConfigs);
  }, [components, budget, loading]);

  if (loading) return <div>Загрузка компонентов...</div>;

  return (
    <div>
      <h1>Подбор компьютера</h1>
      <input
        type="number"
        placeholder="Введите бюджет"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
      />
      <div>
        Найдено конфигураций: {configs.length}
        {configs.length === MAX_CONFIGURATIONS ? " (показаны первые)" : ""}
      </div>
      <ul>
        {configs.map((config, i) => (
          <li key={i}>
            <div>Конфигурация #{i + 1} — Цена: {getTotalPrice(config)} тг</div>
            <ul>
              {Object.entries(config).map(([cat, item]) => (
                <li key={cat}>
                  <b>{cat}</b>: {item.name} — {item.price} тг
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PCBuilder;
