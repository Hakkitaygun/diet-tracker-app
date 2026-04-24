import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './MealTracker.css';

// Get local date in YYYY-MM-DD format (not UTC)
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
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const mealTypes = ['Kahvaltı', 'Ara Öğün', 'Öğle Yemeği', 'Ara Öğün 2', 'Akşam Yemeği'];

  const fetchFoods = useCallback(async (query = '') => {
    try {
      const response = await api.get('/api/food', {
        params: { search: query }
      });
      setFoods(response.data);
    } catch (error) {
      console.error('Error fetching foods:', error);
    }
  }, []);

  const fetchMeals = useCallback(async () => {
    try {
      const today = getLocalDate();
      const response = await api.get(`/api/meals/user/${userId}?date=${today}`);
      setMeals(response.data);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchFoods();
    fetchMeals();
  }, [userId, fetchFoods, fetchMeals]);

  const handleSearchFood = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length > 0) {
      fetchFoods(query);
    } else {
      setFoods([]);
    }
  };

  const handleCreateMeal = async () => {
    try {
      setLoading(true);
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
      console.error('Error creating meal:', error);
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
      // Assuming 100g portion by default
      const calories = Math.round(food.calories_per_100g);
      const protein = parseFloat((food.protein_per_100g).toFixed(1));
      const carbs = parseFloat((food.carbs_per_100g).toFixed(1));
      const fat = parseFloat((food.fat_per_100g).toFixed(1));

      await api.post(`/api/meals/${selectedMeal}/items`, {
        food_name: food.name,
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        portion_size: '100g'
      });

      setSearchQuery('');
      setFoods([]);
      fetchMeals();
      onMealAdded();
      setSuccessMessage(`${food.name} eklendi!`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding food to meal:', error);
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
              {mealTypes.map(type => (
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
            <label>Gıda Adı</label>
            <input
              type="text"
              placeholder="Örn: Tavuk, Elma, Ekmek..."
              value={searchQuery}
              onChange={handleSearchFood}
              className="food-search"
              autoComplete="off"
            />
          </div>

          <div className="food-suggestions">
            {searchQuery.length > 0 && foods.length === 0 && (
              <p className="no-results">Sonuç bulunamadı</p>
            )}
            {foods.slice(0, 10).map(food => (
              <div key={food.id} className="food-suggestion">
                <div className="food-info">
                  <div className="food-name">{food.name}</div>
                  <div className="food-details">
                    <span>{food.calories_per_100g} kcal/100g</span>
                    <span>Protein: {food.protein_per_100g}g</span>
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
            ))}
          </div>
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
            {meals.map(meal => (
              <div key={meal.id} className="meal-card">
                <div className="meal-card-header">
                  <h4>{meal.meal_type}</h4>
                  <span className="meal-time">
                    {new Date(meal.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {meal.items && meal.items.length > 0 ? (
                  <div className="meal-items-list">
                    {meal.items.map(item => (
                      <div key={item.id} className="meal-item-row">
                        <div className="item-name">{item.food_name}</div>
                        <div className="item-nutrition">
                          <span className="calories">{item.calories} kcal</span>
                          <span className="protein">{Math.round(item.protein)}g P</span>
                          <span className="carbs">{Math.round(item.carbs)}g C</span>
                          <span className="fat">{Math.round(item.fat)}g Y</span>
                        </div>
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
