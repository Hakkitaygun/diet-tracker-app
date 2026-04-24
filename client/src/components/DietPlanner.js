import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import './DietPlanner.css';

const toCsv = (list) => Array.isArray(list) ? list.join(', ') : '';
const toArray = (text) => String(text || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const DietPlanner = ({ userId }) => {
  const [overview, setOverview] = useState(null);
  const [form, setForm] = useState({
    favorite_foods: '',
    banned_foods: '',
    diet_style: 'balanced',
    notes: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadPlanner = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/diet/overview/${userId}`);
      setOverview(response.data);
      setForm({
        favorite_foods: toCsv(response.data.preferences?.favorite_foods),
        banned_foods: toCsv(response.data.preferences?.banned_foods),
        diet_style: response.data.preferences?.diet_style || 'balanced',
        notes: response.data.preferences?.notes || ''
      });
    } catch (err) {
      console.error('Error loading diet planner:', err);
      setError('Diyet planı yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPlanner();
  }, [loadPlanner]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await api.put(`/api/diet/preferences/${userId}`, {
        favorite_foods: toArray(form.favorite_foods),
        banned_foods: toArray(form.banned_foods),
        diet_style: form.diet_style,
        notes: form.notes
      });
      setMessage('Tercihler kaydedildi.');
      await loadPlanner();
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      console.error('Error saving diet preferences:', err);
      setError('Tercihler kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !overview) {
    return <div className="diet-planner loading">Diyet planı hazırlanıyor...</div>;
  }

  return (
    <div className="diet-planner">
      <div className="planner-hero">
        <div>
          <h2>🗓️ Diyet Planlayıcı</h2>
          <p>Favori yiyeceklerini, yasaklıları, haftalık planı ve alışveriş listesini burada yönet.</p>
        </div>
        <div className="planner-goal-badge">
          Hedef: {overview?.user?.goal || 'balanced'}
        </div>
      </div>

      {error && <div className="planner-alert error">{error}</div>}
      {message && <div className="planner-alert success">{message}</div>}

      <div className="planner-grid">
        <section className="planner-card">
          <h3>Tercihler</h3>
          <div className="planner-form">
            <label>
              Favori besinler
              <textarea
                name="favorite_foods"
                value={form.favorite_foods}
                onChange={handleChange}
                placeholder="Örn: yumurta, yoğurt, tavuk göğsü"
              />
            </label>
            <label>
              Yasaklı besinler
              <textarea
                name="banned_foods"
                value={form.banned_foods}
                onChange={handleChange}
                placeholder="Örn: gazlı içecek, beyaz ekmek"
              />
            </label>
            <label>
              Program tipi
              <select name="diet_style" value={form.diet_style} onChange={handleChange}>
                <option value="balanced">Dengeli</option>
                <option value="weight_loss">Kilo verme</option>
                <option value="muscle_gain">Kas kazanma</option>
                <option value="health">Sağlık</option>
              </select>
            </label>
            <label>
              Notlar
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Alerji, sevilen tatlar, öğün düzeni..."
              />
            </label>
            <button className="planner-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Tercihleri Kaydet'}
            </button>
          </div>
        </section>

        <section className="planner-card">
          <h3>Programlar</h3>
          <div className="program-list">
            {overview?.programs?.map((program) => (
              <article key={program.id} className={`program-item ${program.active ? 'active' : ''}`}>
                <div className="program-item-head">
                  <strong>{program.title}</strong>
                  <span>{program.targetCalories} kcal</span>
                </div>
                <p>{program.focus}</p>
                <ul>
                  {program.rules.map((rule, idx) => <li key={idx}>{rule}</li>)}
                </ul>
                <small>{program.dailyExample}</small>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="planner-card wide">
        <h3>Haftalık Plan</h3>
        <div className="week-grid">
          {overview?.weeklyPlan?.days?.map((day) => (
            <article key={day.day} className="day-card">
              <div className="day-header">
                <strong>{day.day}</strong>
                <span>{day.calories} kcal</span>
              </div>
              <div className="day-macro">P {day.protein}g · K {day.carbs}g · Y {day.fat}g</div>
              {day.meals.map((meal) => (
                <div key={meal.title} className="meal-block">
                  <h4>{meal.title}</h4>
                  <p>{meal.totals.calories} kcal</p>
                  <ul>
                    {meal.items.map((item, idx) => (
                      <li key={idx}>{item.name} - {item.grams}g</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
      </section>

      <section className="planner-card wide">
        <h3>Alışveriş Listesi</h3>
        <div className="shopping-list">
          {overview?.shoppingList?.map((item) => (
            <div key={item.name} className="shopping-item">
              <strong>{item.name}</strong>
              <span>{item.grams}g</span>
              <small>{item.category}</small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DietPlanner;
