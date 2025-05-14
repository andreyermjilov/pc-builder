import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './PCBuilder.css';

const PCBuilder = () => {
  const [components, setComponents] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [budget, setBudget] = useState('');
  const [configurations, setConfigurations] = useState([]);
  const [filterClicked, setFilterClicked] = useState(false);

  const categories = ['processor', 'graphicsCard', 'ram', 'storage', 'motherboard', 'cooler', 'case', 'powerSupply', 'monitor', 'keyboard'];
  const activeCategories = selectedCategories.length > 0 ? selectedCategories : categories.filter(cat => !['monitor', 'keyboard'].includes(cat));

  const selectedComponents = useMemo(() => {
    const result = {};
    activeCategories.forEach(category => {
      result[category] = components.filter(c => c.category === category);
    });
    return result;
  }, [components, selectedCategories]);

  const calculateComponentScore = (component) => {
    if (component.category === 'processor') return (Number(component.frequency) || 0) * 10 + (Number(component.cores) || 0) * 5;
    if (component.category === 'graphicsCard') return (Number(component.memory) || 0) * 10;
    if (component.category === 'ram') return (Number(component.frequency) || 0) / 100 + (Number(component.capacity) || 0);
    return 1;
  };

  const calculateConfigScore = (config) => {
    let score = 0;
    if (config.processor) score += (Number(config.processor.frequency) || 0) * 10 + (Number(config.processor.cores) || 0) * 5;
    if (config.graphicsCard) score += (Number(config.graphicsCard.memory) || 0) * 10;
    if (config.ram) score += (Number(config.ram.frequency) || 0) / 100 + (Number(config.ram.capacity) || 0);
    return score;
  };

  const checkCompatibility = (category, component, currentConfig) => {
    const reasons = [];
    if (category === 'motherboard' && currentConfig.processor) {
      if (component.socket !== currentConfig.processor.socket) {
        reasons.push(`Motherboard ${component.name} (socket: ${component.socket}) incompatible with Processor ${currentConfig.processor.name} (socket: ${currentConfig.processor.socket})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'ram' && currentConfig.motherboard) {
      if (!component.ramType || !currentConfig.motherboard.ramType || component.ramType !== currentConfig.motherboard.ramType) {
        reasons.push(`RAM ${component.name} (type: ${component.ramType || 'unknown'}) incompatible with Motherboard ${currentConfig.motherboard.name} (type: ${currentConfig.motherboard.ramType || 'unknown'})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'storage' && currentConfig.motherboard) {
      if (!component.interface || !currentConfig.motherboard.supportedInterfaces) {
        reasons.push(`Storage ${component.name} missing interface or Motherboard ${currentConfig.motherboard.name} missing supported interfaces`);
        return { isCompatible: false, reasons };
      }
      const supported = currentConfig.motherboard.supportedInterfaces.split(',').map(s => s.trim());
      if (!supported.includes(component.interface)) {
        reasons.push(`Storage ${component.name} (interface: ${component.interface}) incompatible with Motherboard ${currentConfig.motherboard.name} (supported: ${supported.join(', ')})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'graphicsCard' && currentConfig.motherboard && component.pcieVersion && currentConfig.motherboard.pcieVersion) {
      if (parseFloat(component.pcieVersion) > parseFloat(currentConfig.motherboard.pcieVersion)) {
        reasons.push(`Graphics Card ${component.name} (PCIe: ${component.pcieVersion}) requires newer PCIe version than Motherboard ${currentConfig.motherboard.name} (PCIe: ${currentConfig.motherboard.pcieVersion})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'cooler' && currentConfig.processor) {
      const coolerSockets = String(component.socket).split(',').map(s => s.trim());
      if (!coolerSockets.includes(currentConfig.processor.socket)) {
        reasons.push(`Cooler ${component.name} (sockets: ${component.socket}) incompatible with Processor ${currentConfig.processor.name} (socket: ${currentConfig.processor.socket})`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'powerSupply' && currentConfig.processor) {
      const requiredPower = (Number(currentConfig.processor.power) || 0) + (Number(currentConfig.graphicsCard?.power) || 0) + 100;
      if (Number(component.wattage) < requiredPower) {
        reasons.push(`Power Supply ${component.name} (wattage: ${component.wattage}W) insufficient for estimated ${requiredPower}W`);
        return { isCompatible: false, reasons };
      }
    }
    if (category === 'case' && currentConfig.motherboard) {
      const caseFormFactors = String(component.supportedFormFactors || component.formFactor).split(',').map(f => f.trim());
      if (!caseFormFactors.includes(currentConfig.motherboard.formFactor)) {
        reasons.push(`Case ${component.name} (supported: ${component.supportedFormFactors || component.formFactor}) incompatible with Motherboard ${currentConfig.motherboard.name} (form factor: ${currentConfig.motherboard.formFactor})`);
        return { isCompatible: false, reasons };
      }
    }
    return { isCompatible: true, reasons };
  };

  const buildCompatibilityGraph = (componentsByCategory) => {
    const graph = {};
    activeCategories.forEach(category => {
      graph[category] = componentsByCategory[category]?.filter(component => {
        const tempConfig = {};
        activeCategories.forEach(cat => {
          if (cat !== category && componentsByCategory[cat]?.length) {
            tempConfig[cat] = componentsByCategory[cat][0];
          }
        });
        tempConfig[category] = component;
        return checkCompatibility(category, component, tempConfig).isCompatible;
      }) || [];
    });
    return graph;
  };

  const getGreedyConfig = (componentsByCategory, maxBudget, isGaming = false) => {
    const config = {};
    let totalPrice = 0;
    for (const category of activeCategories) {
      const candidates = componentsByCategory[category]
        ?.filter(c => checkCompatibility(category, c, config).isCompatible)
        .filter(c => !isGaming || category !== 'processor' || ((Number(c.frequency) || 0) >= 4.0 && (Number(c.cores) || 0) >= 4))
        .sort((a, b) => {
          const scoreA = calculateComponentScore(a);
          const scoreB = calculateComponentScore(b);
          return (scoreB / (Number(b.price) || 1)) - (scoreA / (Number(a.price) || 1));
        });
      const selected = candidates?.find(c => totalPrice + Number(c.price) <= maxBudget);
      if (selected) {
        config[category] = selected;
        totalPrice += Number(selected.price);
      }
    }
    return {
      ...config,
      totalPrice,
      score: calculateConfigScore(config),
    };
  };

  const improveConfig = (baseConfig, componentsByCategory, maxBudget, isGaming = false) => {
    let bestConfig = { ...baseConfig };
    let bestScore = calculateConfigScore(baseConfig);
    for (let i = 0; i < activeCategories.length; i++) {
      for (let j = i; j < activeCategories.length; j++) {
        const cat1 = activeCategories[i];
        const cat2 = activeCategories[j];
        const candidates1 = componentsByCategory[cat1]?.filter(c => c !== baseConfig[cat1]);
        const candidates2 = cat1 === cat2 ? candidates1 : componentsByCategory[cat2]?.filter(c => c !== baseConfig[cat2]);
        for (const c1 of candidates1 || []) {
          for (const c2 of candidates2 || []) {
            const newConfig = { ...baseConfig, [cat1]: c1 };
            if (cat1 !== cat2) newConfig[cat2] = c2;
            const newPrice = Object.values(newConfig).reduce((sum, c) => sum + (Number(c?.price) || 0), 0);
            const newScore = calculateConfigScore(newConfig);
            const compatibility = Object.entries(newConfig).every(([cat, comp]) => 
              comp && checkCompatibility(cat, comp, newConfig).isCompatible
            );
            if (compatibility && newPrice <= maxBudget && newScore > bestScore && 
                (!isGaming || !newConfig.processor || ((Number(newConfig.processor.frequency) || 0) >= 4.0 && (Number(newConfig.processor.cores) || 0) >= 4))) {
              bestConfig = newConfig;
              bestScore = newScore;
            }
          }
        }
      }
    }
    return bestConfig;
  };

  const generateCombinations = useCallback((componentsByCategory, maxBudget, currentActiveCategories, isGaming = false) => {
    console.log('Бюджет:', maxBudget);
    console.log('Доступные процессоры:', componentsByCategory.processor.map(p => ({
      name: p.name,
      price: p.price,
      socket: p.socket,
      frequency: p.frequency,
      cores: p.cores,
      score: calculateComponentScore(p)
    })));
    console.log('Доступные материнские платы:', componentsByCategory.motherboard.map(m => ({
      name: m.name,
      price: m.price,
      socket: m.socket,
      ramType: m.ramType,
      supportedInterfaces: m.supportedInterfaces,
      pcieVersion: m.pcieVersion
    })));
    const results = [];
    const maxCombinations = 10000;

    const filteredComponents = buildCompatibilityGraph(componentsByCategory);

    const greedyConfig = getGreedyConfig(filteredComponents, maxBudget, isGaming);
    if (greedyConfig.totalPrice > 0 && calculateConfigScore(greedyConfig) >= (isGaming ? 100 : 50)) {
      console.log('Жадная конфигурация:', Object.entries(greedyConfig).map(([cat, comp]) => comp && `${cat}: ${comp.name} (${comp.price} ₸, score: ${calculateComponentScore(comp)})`));
      results.push(greedyConfig);
    }

    const improvedConfig = improveConfig(greedyConfig, filteredComponents, maxBudget, isGaming);
    if (improvedConfig.totalPrice > 0 && calculateConfigScore(improvedConfig) > calculateConfigScore(greedyConfig)) {
      console.log('Улучшенная конфигурация:', Object.entries(improvedConfig).map(([cat, comp]) => comp && `${cat}: ${comp.name} (${comp.price} ₸, score: ${calculateComponentScore(comp)})`));
      results.push(improvedConfig);
    }

    const buildConfig = (currentConfig, categoryIndex, totalPrice) => {
      if (results.length >= maxCombinations) return;
      if (totalPrice > maxBudget + 100000) return;
      if (categoryIndex >= currentActiveCategories.length) {
        if (totalPrice > 0 && totalPrice <= maxBudget + 100000) {
          const configScore = calculateConfigScore(currentConfig);
          if (!isGaming || configScore >= 100) {
            results.push({ ...currentConfig, totalPrice, score: configScore });
          }
        }
        return;
      }

      const category = currentActiveCategories[categoryIndex];
      const currentCategoryComponents = filteredComponents[category] || [];

      if (currentCategoryComponents.length === 0) {
        buildConfig(currentConfig, categoryIndex + 1, totalPrice);
        return;
      }

      currentCategoryComponents.forEach(component => {
        const { isCompatible, reasons } = checkCompatibility(category, component, currentConfig);
        if (!isCompatible) {
          console.log(`Исключён ${category}: ${component.name} (${component.price} ₸) из-за:`, reasons);
          return;
        }
        if (isGaming && category === 'processor' && ((Number(component.frequency) || 0) < 4.0 || (Number(component.cores) || 0) < 4)) {
          console.log(`Исключён процессор ${component.name} (frequency: ${component.frequency}, cores: ${component.cores}) для игрового ПК`);
          return;
        }

        buildConfig(
          { ...currentConfig, [category]: component },
          categoryIndex + 1,
          totalPrice + Number(component.price)
        );
      });
    };

    buildConfig({}, 0, 0);
    console.log(`Сгенерировано ${results.length} конфигураций`);
    return results;
  }, [selectedCategories]);

  const calculateTemplateStats = (templateComponents) => {
    const totalPrice = templateComponents.reduce((sum, c) => sum + Number(c.price), 0);
    const score = templateComponents.reduce((sum, c) => sum + calculateComponentScore(c), 0);
    return { totalPrice, score };
  };

  const predefinedTemplates = useMemo(() => {
    if (!components.length || budget || filterClicked) return [];

    const getCheapest = (category) => selectedComponents[category]?.sort((a, b) => Number(a.price) - Number(b.price))[0];
    const getBudgetGaming = (category) => {
      const items = selectedComponents[category]?.filter(c => {
        if (category === 'processor') {
          return (Number(c.frequency) || 0) >= 4.0 && (Number(c.cores) || 0) >= 4;
        }
        return true;
      }).sort((a, b) => {
        const scoreA = calculateComponentScore(a);
        const scoreB = calculateComponentScore(b);
        return (scoreB / (Number(b.price) || 1)) - (scoreA / (Number(a.price) || 1));
      });
      const avgPrice = items?.reduce((sum, c) => sum + Number(c.price), 0) / items?.length;
      return items?.find(c => Number(c.price) >= avgPrice * 0.2 && Number(c.price) <= avgPrice * 0.4);
    };
    const getOptimalGaming = (category) => {
      const items = selectedComponents[category]?.filter(c => {
        if (category === 'processor') {
          return (Number(c.frequency) || 0) >= 4.0 && (Number(c.cores) || 0) >= 4;
        }
        return true;
      }).sort((a, b) => calculateComponentScore(b) - calculateComponentScore(a));
      return items?.[0];
    };

    const templates = [
      {
        id: 'office-pc',
        name: 'Офисный ПК',
        description: 'Для работы с документами и браузером',
        components: ['processor', 'ram', 'storage', 'motherboard', 'case', 'powerSupply']
          .filter(cat => activeCategories.includes(cat))
          .map(cat => getCheapest(cat))
          .filter(Boolean),
      },
      {
        id: 'budget-gaming',
        name: 'Бюджетный игровой',
        description: 'Для нетребовательных игр',
        components: ['processor', 'graphicsCard', 'ram', 'storage', 'motherboard', 'cooler', 'case', 'powerSupply']
          .filter(cat => activeCategories.includes(cat))
          .map(cat => getBudgetGaming(cat))
          .filter(Boolean),
      },
      {
        id: 'optimal-gaming',
        name: 'Оптимальный гейминг',
        description: 'Для современных игр',
        components: ['processor', 'graphicsCard', 'ram', 'storage', 'motherboard', 'cooler', 'case', 'powerSupply']
          .filter(cat => activeCategories.includes(cat))
          .map(cat => getOptimalGaming(cat))
          .filter(Boolean),
      },
    ];

    return templates
      .map(template => ({
        ...template,
        ...calculateTemplateStats(template.components),
      }))
      .filter(template => template.components.length > 0 && template.components.every((comp, _, arr) => 
        checkCompatibility(comp.category, comp, arr.reduce((acc, c) => ({ ...acc, [c.category]: c }), {})).isCompatible
      ));
  }, [components, selectedCategories, budget, filterClicked]);

  const handleFilter = () => {
    if (!budget || isNaN(budget) || Number(budget) <= 0) {
      alert('Пожалуйста, введите корректный бюджет');
      return;
    }
    setFilterClicked(true);
    const maxBudget = Number(budget);
    const results = generateCombinations(selectedComponents, maxBudget, activeCategories, selectedCategories.includes('graphicsCard'));
    const sortedResults = results
      .filter(config => config.totalPrice > 0 && Object.keys(config).length > 1)
      .sort((a, b) => {
        const priceDiffA = Math.abs(maxBudget - a.totalPrice);
        const priceDiffB = Math.abs(maxBudget - b.totalPrice);
        if (priceDiffA === priceDiffB) return b.score - a.score;
        return priceDiffA - priceDiffB;
      })
      .slice(0, 10);
    setConfigurations(sortedResults);
  };

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/components');
        const data = await response.json();
        setComponents(data);
      } catch (error) {
        console.error('Ошибка загрузки компонентов:', error);
      }
    };
    fetchComponents();
  }, []);

  return (
    <div className="pc-builder">
      <h1>PC Builder</h1>
      <div className="filters">
        <div>
          <label>Бюджет (₸):</label>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Введите бюджет"
          />
        </div>
        <div>
          <label>Категории:</label>
          <select
            multiple
            value={selectedCategories}
            onChange={(e) => setSelectedCategories(Array.from(e.target.selectedOptions, option => option.value))}
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <button onClick={handleFilter}>Фильтровать</button>
      </div>

      <div className="templates">
        <h2>Шаблоны</h2>
        {predefinedTemplates.map(template => (
          <div key={template.id} className="template">
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <p>Цена: {template.totalPrice} ₸</p>
            <p>Score: {template.score}</p>
            <ul>
              {template.components.map((component, index) => (
                <li key={index}>
                  {component.category}: {component.name} ({component.price} ₸, score: {calculateComponentScore(component)})
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="configurations">
        <h2>Конфигурации</h2>
        {configurations.length === 0 && <p>Нет доступных конфигураций</p>}
        {configurations.map((config, index) => (
          <div key={index} className="configuration">
            <h3>Конфигурация {index + 1}</h3>
            <p>Общая цена: {config.totalPrice} ₸</p>
            <p>Score: {config.score}</p>
            <ul>
              {Object.entries(config).map(([category, component]) => (
                component && component.name && (
                  <li key={category}>
                    {category}: {component.name} ({component.price} ₸, score: {calculateComponentScore(component)})
                  </li>
                )
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PCBuilder;
