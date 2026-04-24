import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

// Get local date in YYYY-MM-DD format (not UTC)
const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Dashboard = ({ userId, user, onUpdate, refreshKey }) => {
  const [dailySummary, setDailySummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [todayMeals, setTodayMeals] = useState([]);

  const fetchDailySummary = useCallback(async () => {
    try {
      setLoading(true);
      const today = getLocalDate();
      const response = await axios.get(`/api/meals/summary/${userId}?date=${today}`);
      setDailySummary(response.data);
    } catch (error) {
      console.error('Error fetching daily summary:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchTodayMeals = useCallback(async () => {
    try {
      const today = getLocalDate();
      const response = await axios.get(`/api/meals/user/${userId}?date=${today}`);
      setTodayMeals(response.data);
    } catch (error) {
      console.error('Error fetching meals:', error);
    }
  }, [userId]);

  useEffect(() => {
    fetchDailySummary();
    fetchTodayMeals();
  }, [userId, refreshKey, fetchDailySummary, fetchTodayMeals]);

  if (loading) {
    return <div className="dashboard-loading">Veriler yükleniyor...</div>;
  }

  const dailyGoal = user?.daily_calorie_goal || 2000;
  const caloriesConsumed = dailySummary?.total_calories || 0;
  const remaining = Math.max(0, dailyGoal - caloriesConsumed);
  const percentage = Math.round((caloriesConsumed / dailyGoal) * 100);

  const nutritionData = [
    { name: 'Protein', value: dailySummary?.total_protein || 0, color: '#FF6B6B' },
    { name: 'Karbohidrat', value: dailySummary?.total_carbs || 0, color: '#4ECDC4' },
    { name: 'Yağ', value: dailySummary?.total_fat || 0, color: '#FFE66D' }
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Bugünün Özeti</h2>
        <p>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card main-card">
          <h3>Günlük Kalori Hedefi</h3>
          <div className="calorie-display">
            <div className="calorie-circle">
              <div className="circle-content">
                <div className="consumed">{caloriesConsumed}</div>
                <div className="unit">/ {dailyGoal} kcal</div>
              </div>
            </div>
            <div className="calorie-info">
              <div className="info-item">
                <span className="label">Tüketilen:</span>
                <span className="value">{caloriesConsumed}</span>
              </div>
              <div className="info-item">
                <span className="label">Kalan:</span>
                <span className="value">{remaining}</span>
              </div>
              <div className="info-item">
                <span className="label">İlerleme:</span>
                <span className="value">{percentage}%</span>
              </div>
            </div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <h3>Makronutrientler</h3>
          <div className="macro-grid">
            <div className="macro-item">
              <div className="macro-value">{Math.round(dailySummary?.total_protein || 0)}g</div>
              <div className="macro-label">Protein</div>
              <div className="macro-desc">({Math.round((dailySummary?.total_protein || 0) * 4)} kcal)</div>
            </div>
            <div className="macro-item">
              <div className="macro-value">{Math.round(dailySummary?.total_carbs || 0)}g</div>
              <div className="macro-label">Karbohidrat</div>
              <div className="macro-desc">({Math.round((dailySummary?.total_carbs || 0) * 4)} kcal)</div>
            </div>
            <div className="macro-item">
              <div className="macro-value">{Math.round(dailySummary?.total_fat || 0)}g</div>
              <div className="macro-label">Yağ</div>
              <div className="macro-desc">({Math.round((dailySummary?.total_fat || 0) * 9)} kcal)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Beslenme Dağılımı</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={nutritionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {nutritionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="dashboard-card">
          <h3>Yemeklerim</h3>
          <div className="meals-list">
            {todayMeals.length === 0 ? (
              <p className="empty-state">Bugün henüz yemek eklemediniz</p>
            ) : (
              todayMeals.map(meal => (
                <div key={meal.id} className="meal-item">
                  <div className="meal-header">
                    <span className="meal-type">{meal.meal_type}</span>
                    <span className="meal-time">
                      {new Date(meal.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {meal.items && meal.items.length > 0 && (
                    <div className="meal-items">
                      {meal.items.map(item => (
                        <div key={item.id} className="meal-food-item">
                          <span className="food-name">{item.food_name}</span>
                          <span className="food-calories">{item.calories} kcal</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
