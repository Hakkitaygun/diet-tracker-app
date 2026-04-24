import React, { useState, useEffect } from 'react';
import api from '../api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';

const Analytics = ({ userId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [userId, days]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/ai/analytics/${userId}?days=${days}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">İstatistikler yükleniyor...</div>;
  }

  if (!analytics) {
    return <div className="error">İstatistikler yüklenemedi</div>;
  }

  const chartData = analytics.daily.reverse();

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2>📈 Beslenme İstatistikleri</h2>
        <div className="date-filter">
          <button 
            className={days === 7 ? 'active' : ''}
            onClick={() => setDays(7)}
          >
            1 Hafta
          </button>
          <button 
            className={days === 30 ? 'active' : ''}
            onClick={() => setDays(30)}
          >
            1 Ay
          </button>
          <button 
            className={days === 90 ? 'active' : ''}
            onClick={() => setDays(90)}
          >
            3 Ay
          </button>
        </div>
      </div>

      <div className="analytics-summary">
        <div className="summary-card">
          <div className="card-label">Ortalama Günlük Kalori</div>
          <div className="card-value">{analytics.average.calories}</div>
          <div className="card-unit">kcal</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Ortalama Protein</div>
          <div className="card-value">{analytics.average.protein}</div>
          <div className="card-unit">g</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Ortalama Karbohidrat</div>
          <div className="card-value">{analytics.average.carbs}</div>
          <div className="card-unit">g</div>
        </div>
        <div className="summary-card">
          <div className="card-label">Ortalama Yağ</div>
          <div className="card-value">{analytics.average.fat}</div>
          <div className="card-unit">g</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Günlük Kalori Alımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#999', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#999', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: '#f9f9f9', 
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="total_calories" 
                stroke="#667eea" 
                strokeWidth={2}
                dot={{ fill: '#667eea', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Makronutrient Dağılımı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis 
                dataKey="date"
                tick={{ fill: '#999', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fill: '#999', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  background: '#f9f9f9', 
                  border: '1px solid #ddd',
                  borderRadius: '5px'
                }}
              />
              <Legend />
              <Bar dataKey="total_protein" fill="#FF6B6B" name="Protein (g)" />
              <Bar dataKey="total_carbs" fill="#4ECDC4" name="Karbohidrat (g)" />
              <Bar dataKey="total_fat" fill="#FFE66D" name="Yağ (g)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="trends-section">
        <h3>📊 Eğilimler</h3>
        <div className="trends-grid">
          <div className="trend-card">
            <div className="trend-icon">📈</div>
            <div className="trend-content">
              <div className="trend-title">Kalori Eğilimi</div>
              <div className="trend-value">{analytics.trends.caloriesTrend}</div>
              <div className="trend-change">
                {analytics.trends.change > 0 ? '+' : ''}{analytics.trends.change} kcal
              </div>
            </div>
          </div>
          <div className="trend-card">
            <div className="trend-icon">💪</div>
            <div className="trend-content">
              <div className="trend-title">Protein Alımı</div>
              <div className="trend-value">{analytics.average.protein}g/gün</div>
              <div className="trend-change">Hedef: 50-100g</div>
            </div>
          </div>
          <div className="trend-card">
            <div className="trend-icon">🌾</div>
            <div className="trend-content">
              <div className="trend-title">Karbohidrat</div>
              <div className="trend-value">{analytics.average.carbs}g/gün</div>
              <div className="trend-change">Hedef: 225-325g</div>
            </div>
          </div>
          <div className="trend-card">
            <div className="trend-icon">🌿</div>
            <div className="trend-content">
              <div className="trend-title">Yağ Alımı</div>
              <div className="trend-value">{analytics.average.fat}g/gün</div>
              <div className="trend-change">Hedef: 50-75g</div>
            </div>
          </div>
        </div>
      </div>

      <div className="insights-section">
        <h3>💡 İçgörüler</h3>
        <div className="insights-list">
          <div className="insight-item">
            <div className="insight-icon">✓</div>
            <div className="insight-text">
              Seçili dönemde <strong>{chartData.length} gün</strong> veri kaydettiniz
            </div>
          </div>
          <div className="insight-item">
            <div className="insight-icon">✓</div>
            <div className="insight-text">
              Günlük ortalama <strong>{analytics.average.calories} kcal</strong> tüketiyorsunuz
            </div>
          </div>
          {analytics.average.protein >= 50 && (
            <div className="insight-item">
              <div className="insight-icon">✓</div>
              <div className="insight-text">
                <strong>Harika!</strong> Protein hedefine ulaşıyorsunuz
              </div>
            </div>
          )}
          {analytics.average.calories < 1500 && (
            <div className="insight-item warning">
              <div className="insight-icon">⚠️</div>
              <div className="insight-text">
                <strong>Dikkat:</strong> Kalori alımınız düşük görünüyor. Beslenme uzmanına danışın
              </div>
            </div>
          )}
          <div className="insight-item">
            <div className="insight-icon">💡</div>
            <div className="insight-text">
              Makronutrient dengenizi korumaya çalışın: %20-30 Protein, %45-65 Karbohidrat, %20-35 Yağ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
