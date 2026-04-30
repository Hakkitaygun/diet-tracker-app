import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import './MealTracker.css';

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MealTracker = ({ userId, onMealAdded }) => {
  const [meals, setMeals] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [foods, setFoods] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mealType, setMealType] = useState('Öğün');
  const [portionGrams, setPortionGrams] = useState(100);
  const [loading, setLoading] = useState(false);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const latestSearchSeqRef = useRef(0);

  const mealTypes = ['Kahvaltı', 'Ara Öğün', 'Öğle Yemeği', 'Ara Öğün 2', 'Akşam Yemeği'];

  const fetchFoods = useCallback(async (query = '', seq = null) => {
    setFoodSearchLoading(true);
    try {
      const response = await api.get('/api/food', {
        params: { search: query }
      });
      if (seq !== null && seq !== latestSearchSeqRef.current) {
        return;
      }
      setFoods(response.data);
    } catch (error) {
      if (seq !== null && seq !== latestSearchSeqRef.current) {
        return;
      }
      setFoods([]);
      setErrorMessage('Gıda aranırken hata oluştu.');
    } finally {
      if (seq !== null && seq !== latestSearchSeqRef.current) {
        return;
      }
      setFoodSearchLoading(false);
    }
  }, []);

  const fetchMeals = useCallback(async () => {
    try {
      const today = getLocalDate();
      const response = await api.get(`/api/meals/user/${userId}?date=${today}`);
      setMeals(response.data);
    } catch (error) {
      setErrorMessage('Öğünler yüklenirken hata oluştu.');
    }
  }, [userId]);

  useEffect(() => {
    fetchMeals();
  }, [userId, fetchMeals]);

  const handleSearchFood = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length === 0) {
      latestSearchSeqRef.current += 1;
      setFoods([]);
      setFoodSearchLoading(false);
    }
  };

  const handleSubmitFoodSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      latestSearchSeqRef.current += 1;
      setFoods([]);
      setFoodSearchLoading(false);
      return;
    }

    const seq = latestSearchSeqRef.current + 1;
    latestSearchSeqRef.current = seq;
    fetchFoods(trimmed, seq);
  };

  const handleSearchInputKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmitFoodSearch();
    }
  };

  const handleCreateMeal = async () => {
    try {
      setLoading(true);
      setErrorMessage('');
      const response = await api.post('/api/meals', {
        user_id: userId,
        meal_type: mealType
      });
      setSelectedMeal(response.data.id);
      fetchMeals();
      setMealType('Öğün');
      setSuccessMessage('Yemek oluşturuldu!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Yemek oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFoodToMeal = async (food) => {
    if (!selectedMeal) {
      alert('Lütfen önce bir yemek seçin');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      const safePortion = Math.max(1, Number(portionGrams) || 100);
      const multiplier = safePortion / 100;
      const calories = Math.round((food.calories_per_100g || 0) * multiplier);
      const protein = parseFloat(((food.protein_per_100g || 0) * multiplier).toFixed(1));
      const carbs = parseFloat(((food.carbs_per_100g || 0) * multiplier).toFixed(1));
      const fat = parseFloat(((food.fat_per_100g || 0) * multiplier).toFixed(1));

      await api.post(`/api/meals/${selectedMeal}/items`, {
        food_name: food.name,
        calories,
        protein,
        carbs,
        fat,
        portion_size: `${safePortion}g`
      });

      setSearchQuery('');
      setFoods([]);
      fetchMeals();
      onMealAdded();
      setSuccessMessage(`${food.name} eklendi!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Gıda öğüne eklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMealItem = async (mealId, itemId) => {
    if (!window.confirm('Bu öğün kalemini silmek istiyor musun?')) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      await api.delete(`/api/meals/${mealId}/items/${itemId}`);
      await fetchMeals();
      onMealAdded();
      setSuccessMessage('Öğün kalemi silindi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Öğün kalemi silinemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    if (!window.confirm('Bu öğünü tamamen silmek istiyor musun?')) {
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');
      await api.delete(`/api/meals/${mealId}`);
      if (selectedMeal === mealId) {
        setSelectedMeal(null);
      }
      await fetchMeals();
      onMealAdded();
      setSuccessMessage('Öğün silindi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage('Öğün silinemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="meal-tracker">
      <div className="tracker-header">
        <h2>🍽️ Beslenme Takibi</h2>
        <p>Yediklerinizi kaydedin ve otomatik kalori hesaplaması yapın</p>
      </div>

      {successMessage && <div className="success-message">{successMessage}</div>}
      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <div className="tracker-grid">
        <div className="tracker-card">
          <h3>Yeni Yemek Ekle</h3>
          <div className="form-group">
            <label>Yemek Türü</label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className="meal-select"
            >
              {mealTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreateMeal}
            disabled={loading}
            className="create-meal-btn"
          >
            {loading ? 'Oluşturuluyor...' : 'Yemek Oluştur'}
          </button>

          {selectedMeal && (
            <div className="selected-meal">
              <p className="info-text">✓ Yemek seçildi: ID {selectedMeal}</p>
              <p className="info-text small">Şimdi gıda ekleyebilirsiniz</p>
            </div>
          )}
        </div>

        <div className="tracker-card">
          <h3>Gıda Ara ve Ekle</h3>
          <div className="form-group">
            <label>Porsiyon (gram)</label>
            <input
              type="number"
              min="1"
              max="2000"
              value={portionGrams}
              onChange={(e) => setPortionGrams(e.target.value)}
              className="portion-input"
            />
          </div>
          <div className="form-group">
            <label>Gıda Adı</label>
            <div className="food-search-row">
              <input
                type="text"
                placeholder="Örn: Tavuk, Elma, Ekmek..."
                value={searchQuery}
                onChange={handleSearchFood}
                onKeyDown={handleSearchInputKeyDown}
                className="food-search"
                autoComplete="off"
              />
              <button
                type="button"
                className="search-food-btn"
                onClick={handleSubmitFoodSearch}
                disabled={loading || foodSearchLoading}
              >
                {foodSearchLoading ? 'Aranıyor...' : 'Ara'}
              </button>
            </div>
          </div>

          {searchQuery.trim().length > 0 && (
            <div className="food-suggestions">
              {foodSearchLoading && (
                <p className="no-results">Aranıyor...</p>
              )}
              {!foodSearchLoading && foods.length === 0 && (
                <p className="no-results">Sonuç bulunamadı</p>
              )}
              {foods.slice(0, 10).map((food) => {
                const multiplier = Math.max(1, Number(portionGrams) || 100) / 100;
                const portionCalories = Math.round((food.calories_per_100g || 0) * multiplier);
                const portionProtein = parseFloat(((food.protein_per_100g || 0) * multiplier).toFixed(1));
                const portionCarbs = parseFloat(((food.carbs_per_100g || 0) * multiplier).toFixed(1));
                const portionFat = parseFloat(((food.fat_per_100g || 0) * multiplier).toFixed(1));

                return (
                  <div key={food.id || food.name} className="food-suggestion">
                    <div className="food-info">
                      <div className="food-name">{food.name}</div>
                      <div className="food-nutrition-per-100">
                        <span className="nutrition-value">{food.calories_per_100g} kcal</span>
                        <span>P: {food.protein_per_100g}g</span>
                        <span>K: {food.carbs_per_100g}g</span>
                        <span>Y: {food.fat_per_100g}g</span>
                      </div>
                      <div className="food-nutrition-portion">
                        <strong>Seçili porsiyon ({portionGrams}g):</strong>
                        <span className="portion-calories">{portionCalories} kcal</span>
                        <span>P: {portionProtein}g · K: {portionCarbs}g · Y: {portionFat}g</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddFoodToMeal(food)}
                      disabled={!selectedMeal || loading}
                      className="add-food-btn"
                    >
                      Ekle
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="meals-section">
        <h3>Bugünün Yemekleri</h3>
        {meals.length === 0 ? (
          <div className="empty-meals">
            <p>Henüz yemek eklemediniz. Yukarıdan başlayın!</p>
          </div>
        ) : (
          <div className="meals-container">
            {meals.map((meal) => (
              <div key={meal.id} className="meal-card">
                <div className="meal-card-header">
                  <div className="meal-header-main">
                    <h4>{meal.meal_type}</h4>
                    <span className="meal-time">
                      {new Date(meal.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="delete-meal-btn"
                    onClick={() => handleDeleteMeal(meal.id)}
                    disabled={loading}
                  >
                    Öğünü Sil
                  </button>
                </div>
                {meal.items && meal.items.length > 0 ? (
                  <div className="meal-items-list">
                    {meal.items.map((item) => (
                      <div key={item.id} className="meal-item-row">
                        <div className="meal-item-main">
                          <div className="item-name">{item.food_name}</div>
                          <div className="item-nutrition">
                            <span className="calories">{item.calories} kcal</span>
                            <span className="protein">{Math.round(item.protein)}g P</span>
                            <span className="carbs">{Math.round(item.carbs)}g C</span>
                            <span className="fat">{Math.round(item.fat)}g Y</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="delete-item-btn"
                          onClick={() => handleDeleteMealItem(meal.id, item.id)}
                          disabled={loading}
                        >
                          Sil
                        </button>
                      </div>
                    ))}
                    <div className="meal-total">
                      <span>Toplam:</span>
                      <span className="total-calories">
                        {meal.items.reduce((sum, item) => sum + item.calories, 0)} kcal
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="empty-items">Henüz gıda eklenmedi</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MealTracker;
