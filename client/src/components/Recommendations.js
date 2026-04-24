import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import './Recommendations.css';

const Recommendations = ({ userId, refreshKey = 0 }) => {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState('');
  const isFetchingRef = useRef(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const getCacheKey = useCallback((type) => `ai_${type}_${userId}`, [userId]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || !recommendations) return;

    const userMessage = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await api.post('/api/ai/chat', {
        user_id: userId,
        user_question: userMessage,
        current_recommendations: recommendations.aiRecommendations,
        current_suggestions: suggestions?.aiSuggestions || '',
        daily_nutrition: {
          calories: recommendations.consumption.calories,
          protein: recommendations.consumption.protein,
          carbs: recommendations.consumption.carbs,
          fat: recommendations.consumption.fat
        }
      });

      setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      const errorMsg = error?.response?.data?.error || 'Yanıt alınamadı. Lütfen tekrar deneyin.';
      setChatMessages(prev => [...prev, { role: 'error', content: errorMsg }]);
    } finally {
      setChatLoading(false);
    }
  };

  const readCache = useCallback((type) => {
    try {
      const raw = sessionStorage.getItem(getCacheKey(type));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }, [getCacheKey]);

  const writeCache = useCallback((type, data) => {
    try {
      sessionStorage.setItem(getCacheKey(type), JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (err) {
      // Ignore cache failures (storage full, disabled, etc.)
    }
  }, [getCacheKey]);

  const isCacheFresh = (cached, maxAgeMs) => {
    if (!cached?.timestamp) return false;
    return Date.now() - cached.timestamp < maxAgeMs;
  };

  const hasInvalidSuggestionCache = useCallback((cached) => {
    const text = String(cached?.data?.aiSuggestions || '');
    return text.includes('Ogun onerileri alinamadi') || text.includes('Öğün önerileri alınamadı');
  }, []);

  const fetchRecommendations = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache only if we're not forcing a refresh
      const cached = readCache('recommendations');
      // Only use cache if it's fresh (1 hour TTL - prevent excessive API calls)
      if (!forceRefresh && cached?.data && isCacheFresh(cached, 60 * 60 * 1000)) {
        setRecommendations(cached.data);
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await api.post('/api/ai/recommendations', {
        user_id: userId
      });
      setRecommendations(response.data);
      writeCache('recommendations', response.data);
    } catch (error) {
      const message = error?.response?.data?.error || error.message || 'Bilinmeyen hata';
      if (message.includes('429')) {
        setError('Rate limit doldu. Lütfen 1 dakika bekleyip tekrar deneyin.');
        // Try to show cached data if available
        const cached = readCache('recommendations');
        if (cached?.data) {
          setRecommendations(cached.data);
        }
      } else {
        setError('AI tavsiye alınamadı. Lütfen daha sonra tekrar deneyin.');
      }
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, readCache, writeCache]);

  const fetchSuggestions = useCallback(async (forceRefresh = false) => {
    try {
      const cached = readCache('suggestions');
      if (!forceRefresh && cached?.data && isCacheFresh(cached, 60 * 60 * 1000) && !hasInvalidSuggestionCache(cached)) {
        setSuggestions(cached.data);
        return;
      }

      const response = await api.get(`/api/ai/suggestions/${userId}`);
      setSuggestions(response.data);
      writeCache('suggestions', response.data);
    } catch (error) {
      const message = error?.response?.data?.error || error.message || 'Bilinmeyen hata';
      if (message.includes('429')) {
        setError('Rate limit doldu. Lütfen 1 dakika bekleyip tekrar deneyin.');
        const cached = readCache('suggestions');
        if (cached?.data) {
          setSuggestions(cached.data);
        }
      }
      console.error('Error fetching suggestions:', error);
    }
  }, [userId, readCache, writeCache, hasInvalidSuggestionCache]);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!userId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setError('');
    await fetchRecommendations(forceRefresh);
    await fetchSuggestions(forceRefresh);
    isFetchingRef.current = false;
  }, [userId, fetchRecommendations, fetchSuggestions]);

  useEffect(() => {
    loadData();
  }, [userId, loadData]);

  useEffect(() => {
    if (refreshKey > 0) {
      loadData(true);
    }
  }, [refreshKey, loadData]);

  if (loading) {
    return <div className="loading">Tavsiyeler yükleniyor...</div>;
  }

  if (!recommendations) {
    return <div className="error">Tavsiyeler yüklenemedi</div>;
  }

  return (
    <div className="recommendations">
      <div className="recommendations-header">
        <h2>⚡ AI Destekli Diyetisyen Önerileri</h2>
        <p>Yapay zeka tabanlı kişiselleştirilmiş beslenme tavsiyeleri</p>
      </div>

      {error && (
        <div className="error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      <div className="recommendations-summary">
        <div className="summary-card">
          <div className="summary-item">
            <div className="label">Günlük Hedef</div>
            <div className="value">{recommendations.user.daily_calorie_goal || 2000}</div>
            <div className="unit">kcal</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-item">
            <div className="label">Tüketilen</div>
            <div className="value">{recommendations.consumption.calories}</div>
            <div className="unit">kcal</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-item">
            <div className="label">Kalan</div>
            <div className="value">{recommendations.remaining.calories}</div>
            <div className="unit">kcal ({recommendations.remaining.percentage}%)</div>
          </div>
        </div>
      </div>

      <div className="recommendations-grid">
        <div className="recommendations-card main-rec">
          <h3>🤖 Yapay Zeka Diyetisyen Önerileri</h3>
          {recommendations?.aiRecommendations ? (
            <div className="ai-recommendations">
              <div className="ai-text">
                {recommendations.aiRecommendations}
              </div>
            </div>
          ) : (
            <p className="empty-state">AI önerileri yükleniyor...</p>
          )}
        </div>

        <div className="recommendations-card">
          <h3>🔍 Makro Besin Analizi</h3>
          {recommendations.macroAnalysis ? (
            <div className="nutrition-analysis">
              <div className="analysis-item">
                <div className="label">Protein Oranı</div>
                <div className="value">{recommendations.macroAnalysis.proteinPercentage}%</div>
                <div className="bar">
                  <div 
                    className="bar-fill" 
                    style={{ width: `${recommendations.macroAnalysis.proteinPercentage}%`, background: '#FF6B6B' }}
                  ></div>
                </div>
                <div className="target">Hedef: %20-30</div>
              </div>
              <div className="analysis-item">
                <div className="label">Karbohidrat Oranı</div>
                <div className="value">{recommendations.macroAnalysis.carbPercentage}%</div>
                <div className="bar">
                  <div 
                    className="bar-fill" 
                    style={{ width: `${recommendations.macroAnalysis.carbPercentage}%`, background: '#4ECDC4' }}
                  ></div>
                </div>
                <div className="target">Hedef: %45-65</div>
              </div>
              <div className="analysis-item">
                <div className="label">Yağ Oranı</div>
                <div className="value">{recommendations.macroAnalysis.fatPercentage}%</div>
                <div className="bar">
                  <div 
                    className="bar-fill" 
                    style={{ width: `${recommendations.macroAnalysis.fatPercentage}%`, background: '#FFE66D' }}
                  ></div>
                </div>
                <div className="target">Hedef: %20-35</div>
              </div>
            </div>
          ) : (
            <p className="empty-state">Makro analiz hesaplanıyor...</p>
          )}
        </div>
      </div>

      {suggestions?.aiSuggestions && (
        <div className="suggestions-section">
          <h3>🍽️ AI Yemek Önerileri</h3>
          <div className="ai-suggestions">
            <div className="ai-text">
              {suggestions.aiSuggestions}
            </div>
          </div>
          <div className="suggestion-stats">
            <div className="stat-item">
              <span className="stat-label">Kalan Kalori:</span>
              <span className="stat-value">{suggestions.remainingCalories} kcal</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Tüketilen:</span>
              <span className="stat-value">{suggestions.currentCalories} kcal</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Günlük Hedef:</span>
              <span className="stat-value">{suggestions.dailyGoal} kcal</span>
            </div>
          </div>
        </div>
      )}

      <div className="refresh-section">
        <button onClick={() => loadData(true)} className="refresh-btn">
          🔄 Tavsiyeleeri Yenile
        </button>
      </div>

      {/* AI Chat Section */}
      <div className="ai-chat-section">
        <h3>💬 AI Diyetisyene Sor</h3>
        <div className="chat-messages">
          {chatMessages.length === 0 && (
            <div className="chat-empty">
              <p>Yapay zekaya sorularınızı sorun. Örnek: "Daha ucuz öğün önerebilir misin?", "Yüksek protein seçenekleri neler?", vb.</p>
            </div>
          )}
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input-area">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Örn: Daha ucuz öğün önerebilir misin? Vegan seçenekler neler? Hızlı hazırlanan yemekler..."
            className="chat-textarea"
            disabled={chatLoading}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !chatLoading) {
                handleChatSubmit();
              }
            }}
          />
          <button
            onClick={handleChatSubmit}
            disabled={chatLoading || !chatInput.trim() || !recommendations}
            className="chat-send-btn"
          >
            {chatLoading ? '⏳ Yanıtlanıyor...' : '📤 Gönder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Recommendations;
