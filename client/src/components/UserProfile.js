import React, { useState, useEffect } from 'react';
import api from '../api';
import './UserProfile.css';

const UserProfile = ({ userId, onUserCreated, onUserUpdated }) => {
  const [isCreating, setIsCreating] = useState(!userId);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'male',
    height: '',
    weight: '',
    goal: 'balanced',
    daily_calorie_goal: ''
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [weightHistory, setWeightHistory] = useState([]);

  const goals = [
    { value: 'weight_loss', label: 'Kilo Vermek' },
    { value: 'muscle_gain', label: 'Kas Kazanmak' },
    { value: 'balanced', label: 'Dengeli Beslenme' },
    { value: 'health', label: 'Sağlık' }
  ];

  useEffect(() => {
    if (userId) {
      fetchUser();
      fetchWeightHistory();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/user/${userId}`);
      setUser(response.data);
      setFormData({
        name: response.data.name,
        age: response.data.age || '',
        gender: response.data.gender || 'male',
        height: response.data.height || '',
        weight: response.data.weight || '',
        goal: response.data.goal || 'balanced',
        daily_calorie_goal: response.data.daily_calorie_goal || ''
      });
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeightHistory = async () => {
    try {
      const response = await api.get(`/api/user/${userId}/weight-history?days=90`);
      setWeightHistory(response.data);
    } catch (error) {
      console.error('Error fetching weight history:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Lütfen adınızı girin');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/user', {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        daily_calorie_goal: formData.daily_calorie_goal ? parseInt(formData.daily_calorie_goal) : null
      });

      setSuccessMessage('Profil başarıyla oluşturuldu!');
      if (onUserCreated) {
        onUserCreated(response.data);
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Profil oluşturulurken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put(`/api/user/${userId}`, {
        ...formData,
        age: formData.age ? parseInt(formData.age) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        daily_calorie_goal: formData.daily_calorie_goal ? parseInt(formData.daily_calorie_goal) : null
      });

      setSuccessMessage('Profil başarıyla güncellendi!');
      fetchUser();
      if (onUserUpdated) {
        onUserUpdated();
      }
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Profil güncellenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordWeight = async () => {
    const weight = prompt('Şimdiki kilonuzu girin (kg):');
    if (!weight) return;

    try {
      setLoading(true);
      await api.post(`/api/user/${userId}/weight`, {
        weight: parseFloat(weight)
      });

      setSuccessMessage('Kilo kaydedildi!');
      fetchWeightHistory();
      fetchUser();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error recording weight:', error);
      alert('Kilo kaydedilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (isCreating && !userId) {
    return (
      <div className="user-profile">
        <div className="profile-container">
          <div className="profile-header">
            <h2>🥗 Diyetisyen AI'ye Hoş Geldiniz</h2>
            <p>Önce profilinizi oluşturun</p>
          </div>

          {successMessage && <div className="success-message">{successMessage}</div>}

          <form onSubmit={handleCreateUser} className="profile-form">
            <div className="form-group">
              <label>Ad Soyad *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Adınızı ve soyadınızı girin"
                required
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Yaş</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                  placeholder="Yaşınız"
                />
              </div>

              <div className="form-group">
                <label>Cinsiyet</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                >
                  <option value="male">Erkek</option>
                  <option value="female">Kadın</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Boy (cm)</label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                  placeholder="cm"
                />
              </div>

              <div className="form-group">
                <label>Ağırlık (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  placeholder="kg"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Hedef</label>
              <select
                name="goal"
                value={formData.goal}
                onChange={handleInputChange}
              >
                {goals.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Günlük Kalori Hedefi (opsiyonel)</label>
              <input
                type="number"
                name="daily_calorie_goal"
                value={formData.daily_calorie_goal}
                onChange={handleInputChange}
                placeholder="Boş bırakırsanız otomatik hesaplanır (2000 kcal)"
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Oluşturuluyor...' : 'Profili Oluştur'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading && !user) {
    return <div className="loading">Profil yükleniyor...</div>;
  }

  return (
    <div className="user-profile">
      <div className="profile-header">
        <h2>👤 Profil Ayarları</h2>
        <p>Bilgilerinizi güncelleyin</p>
      </div>

      {successMessage && <div className="success-message">{successMessage}</div>}

      <div className="profile-grid">
        <div className="profile-card main-profile-card">
          <h3>Kişisel Bilgiler</h3>
          <form onSubmit={handleUpdateUser} className="profile-form">
            <div className="form-group">
              <label>Ad Soyad</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Yaş</label>
                <input
                  type="number"
                  name="age"
                  value={formData.age}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Cinsiyet</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                >
                  <option value="male">Erkek</option>
                  <option value="female">Kadın</option>
                </select>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Boy (cm)</label>
                <input
                  type="number"
                  name="height"
                  value={formData.height}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label>Ağırlık (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Hedef</label>
              <select
                name="goal"
                value={formData.goal}
                onChange={handleInputChange}
              >
                {goals.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Günlük Kalori Hedefi</label>
              <input
                type="number"
                name="daily_calorie_goal"
                value={formData.daily_calorie_goal}
                onChange={handleInputChange}
              />
            </div>

            <button type="submit" disabled={loading} className="submit-btn">
              {loading ? 'Güncelleniyor...' : 'Profili Güncelle'}
            </button>
          </form>
        </div>

        <div className="profile-card">
          <h3>Kilo Takibi</h3>
          {user && (
            <div className="weight-info">
              <div className="weight-display">
                <div className="weight-current">
                  <div className="label">Mevcut Kilo</div>
                  <div className="value">{user.weight || '-'}</div>
                  <div className="unit">kg</div>
                </div>
              </div>
              <button 
                onClick={handleRecordWeight}
                disabled={loading}
                className="record-weight-btn"
              >
                ⚖️ Kilo Kaydet
              </button>
            </div>
          )}

          {weightHistory.length > 0 && (
            <div className="weight-history">
              <h4>Son Kilolar</h4>
              <div className="history-list">
                {weightHistory.slice(0, 5).map((record, idx) => (
                  <div key={idx} className="history-item">
                    <span className="date">{new Date(record.date).toLocaleDateString('tr-TR')}</span>
                    <span className="weight">{record.weight} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
