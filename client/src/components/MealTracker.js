import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [portionGrams, setPortionGrams] = useState(100);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoHint, setPhotoHint] = useState('');
  const latestSearchSeqRef = useRef(0);

  const mealTypes = ['Kahvaltı', 'Ara Öğün', 'Öğle Yemeği', 'Ara Öğün 2', 'Akşam Yemeği'];

  const fetchFoods = useCallback(async (query = '', seq = null) => {
    try {
      const response = await api.get('/api/food', {
        params: { search: query }
      });
      if (seq !== null && seq !== latestSearchSeqRef.current) {
        return;
      }
      setFoods(response.data);
    } catch (error) {
      console.error('Error fetching foods:', error);
      if (seq !== null && seq !== latestSearchSeqRef.current) {
        return;
      }
      setFoods([]);
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
    fetchMeals();
  }, [userId, fetchMeals]);

  const handleSearchFood = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length === 0) {
      latestSearchSeqRef.current += 1;
      setFoods([]);
    }
  };

  const handleSubmitFoodSearch = () => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) {
      latestSearchSeqRef.current += 1;
      setFoods([]);
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
      const safePortion = Math.max(1, Number(portionGrams) || 100);
      const multiplier = safePortion / 100;
      const calories = Math.round((food.calories_per_100g || 0) * multiplier);
      const protein = parseFloat(((food.protein_per_100g || 0) * multiplier).toFixed(1));
      const carbs = parseFloat(((food.carbs_per_100g || 0) * multiplier).toFixed(1));
      const fat = parseFloat(((food.fat_per_100g || 0) * multiplier).toFixed(1));

      await api.post(`/api/meals/${selectedMeal}/items`, {
        food_name: food.name,
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
        portion_size: `${safePortion}g`
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

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Lütfen bir resim dosyası seçin.');
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setPhotoError('Fotoğraf çok büyük. En fazla 6MB yükleyin.');
      return;
    }

    setPhotoFile(file);
    setPhotoError('');
    setPhotoAnalysis(null);

    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleAnalyzePhoto = async () => {
    if (!photoFile || !photoPreview) {
      setPhotoError('Önce bir fotoğraf seçin.');
      return;
    }

    try {
      setPhotoLoading(true);
      setPhotoError('');

      const [, base64Data] = photoPreview.split(',');
      const response = await api.post('/api/food/analyze-image', {
        image_base64: base64Data,
        mime_type: photoFile.type,
        hint_text: photoHint || searchQuery || ''
      });

      setPhotoAnalysis(response.data);
      if (response.data?.food_name) {
        setSearchQuery(response.data.food_name);
      }
    } catch (error) {
      const message = error?.response?.data?.error || 'Fotoğraf analiz edilemedi.';
      setPhotoError(message);
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleAddPhotoEstimate = async () => {
    if (!selectedMeal) {
      alert('Lütfen önce bir yemek seçin');
      return;
    }

    if (!photoAnalysis) return;

    try {
      setLoading(true);
      await api.post(`/api/meals/${selectedMeal}/items`, {
        food_name: `AI Fotoğraf: ${photoAnalysis.food_name}`,
        calories: photoAnalysis.total_calories,
        protein: parseFloat((photoAnalysis.protein || 0).toFixed(1)),
        carbs: parseFloat((photoAnalysis.carbs || 0).toFixed(1)),
        fat: parseFloat((photoAnalysis.fat || 0).toFixed(1)),
        portion_size: `${photoAnalysis.estimated_grams}g (AI)`
      });

      fetchMeals();
      onMealAdded();
      setSuccessMessage('Fotoğraf analizi yemeğe eklendi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error adding photo estimate to meal:', error);
      setPhotoError('Fotoğraf sonucu eklenemedi.');
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
      await api.delete(`/api/meals/${mealId}/items/${itemId}`);
      await fetchMeals();
      onMealAdded();
      setSuccessMessage('Öğün kalemi silindi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting meal item:', error);
      setPhotoError(error?.response?.data?.error || 'Öğün kalemi silinemedi.');
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
      await api.delete(`/api/meals/${mealId}`);
      if (selectedMeal === mealId) {
        setSelectedMeal(null);
      }
      await fetchMeals();
      onMealAdded();
      setSuccessMessage('Öğün silindi!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting meal:', error);
      setPhotoError(error?.response?.data?.error || 'Öğün silinemedi.');
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
                disabled={loading}
              >
                Ara
              </button>
            </div>
          </div>

          <div className="photo-analyzer">
            <div className="photo-version-badge">Foto AI v3</div>
            <label className="photo-upload-label">
              <span>Ürün Fotoğrafı</span>
              <input type="file" accept="image/*" onChange={handlePhotoSelect} />
            </label>
            <div className="photo-hint-wrap">
              <label>Ürün ipucu (opsiyonel)</label>
              <input
                type="text"
                placeholder="Örn: muz, tavuklu pilav, salata"
                value={photoHint}
                onChange={(e) => setPhotoHint(e.target.value)}
                className="photo-hint-input"
              />
            </div>
            {photoPreview && (
              <div className="photo-preview-wrap">
                <img src={photoPreview} alt="Yüklenen ürün" className="photo-preview" />
                <button
                  type="button"
                  className="analyze-photo-btn"
                  onClick={handleAnalyzePhoto}
                  disabled={photoLoading}
                >
                  {photoLoading ? 'Analiz ediliyor...' : 'Fotoğrafı Analiz Et'}
                </button>
              </div>
            )}
            {photoError && <p className="photo-error">{photoError}</p>}
          </div>

          {photoAnalysis && (
            <div className="photo-analysis-card">
              <div className="photo-analysis-head">
                <strong>{photoAnalysis.food_name}</strong>
                <span>
                  {photoAnalysis.confidence === 'high'
                    ? 'yuksek guven'
                    : photoAnalysis.confidence === 'medium'
                      ? 'orta guven'
                      : 'dusuk guven'}
                </span>
              </div>
              <div className="photo-analysis-stats">
                <div><b>{photoAnalysis.estimated_grams}g</b> tahmini porsiyon</div>
                <div><b>{photoAnalysis.total_calories} kcal</b> toplam</div>
                <div>P: {photoAnalysis.protein}g · K: {photoAnalysis.carbs}g · Y: {photoAnalysis.fat}g</div>
              </div>
              {photoAnalysis.notes && !photoAnalysis.notes.toLowerCase().includes('api error') && (
                <p className="photo-analysis-notes">{photoAnalysis.notes}</p>
              )}
              <button
                type="button"
                className="add-photo-btn"
                onClick={handleAddPhotoEstimate}
                disabled={!selectedMeal || loading}
              >
                Yemeğe Ekle
              </button>
            </div>
          )}

          {searchQuery.trim().length > 0 && (
            <div className="food-suggestions">
              {foods.length === 0 && (
              <p className="no-results">Sonuç bulunamadı</p>
              )}
              {foods.slice(0, 10).map(food => (
                <div key={food.id || food.name} className="food-suggestion">
                  <div className="food-info">
                    <div className="food-name">
                      {food.name}
                      {food.ai_generated && <span className="ai-food-badge">AI</span>}
                    </div>
                    <div className="food-details">
                      <span>{food.calories_per_100g} kcal/100g</span>
                      <span>Protein: {food.protein_per_100g}g</span>
                      <span>
                        Secili porsiyon: {Math.round((food.calories_per_100g || 0) * (Math.max(1, Number(portionGrams) || 100) / 100))} kcal
                      </span>
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
            {meals.map(meal => (
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
                    {meal.items.map(item => (
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
