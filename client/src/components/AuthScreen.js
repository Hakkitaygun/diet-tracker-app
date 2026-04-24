import React, { useState } from 'react';
import api from '../api';
import './AuthScreen.css';

const AuthScreen = ({ onSuccess }) => {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    gender: 'male',
    height: '',
    weight: '',
    goal: 'balanced',
    daily_calorie_goal: ''
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login'
        ? { email: formData.email, password: formData.password }
        : {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            age: formData.age ? parseInt(formData.age, 10) : null,
            gender: formData.gender,
            height: formData.height ? parseFloat(formData.height) : null,
            weight: formData.weight ? parseFloat(formData.weight) : null,
            goal: formData.goal,
            daily_calorie_goal: formData.daily_calorie_goal ? parseInt(formData.daily_calorie_goal, 10) : null
          };

      const response = await api.post(endpoint, payload);
      onSuccess(response.data);
    } catch (error) {
      setError(error?.response?.data?.error || 'Giriş yapılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🥗 Diyetisyen AI</h1>
          <p>Hesabınıza giriş yapın veya yeni bir hesap oluşturun.</p>
        </div>

        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Giriş Yap</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Kayıt Ol</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <input name="name" value={formData.name} onChange={handleChange} placeholder="Ad Soyad" required />
              <div className="auth-grid">
                <input name="age" type="number" value={formData.age} onChange={handleChange} placeholder="Yaş" />
                <select name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="male">Erkek</option>
                  <option value="female">Kadın</option>
                </select>
              </div>
              <div className="auth-grid">
                <input name="height" type="number" value={formData.height} onChange={handleChange} placeholder="Boy (cm)" />
                <input name="weight" type="number" step="0.1" value={formData.weight} onChange={handleChange} placeholder="Kilo (kg)" />
              </div>
              <select name="goal" value={formData.goal} onChange={handleChange}>
                <option value="balanced">Dengeli Beslenme</option>
                <option value="weight_loss">Kilo Vermek</option>
                <option value="muscle_gain">Kas Kazanmak</option>
                <option value="health">Sağlık</option>
              </select>
              <input name="daily_calorie_goal" type="number" value={formData.daily_calorie_goal} onChange={handleChange} placeholder="Günlük kalori hedefi (opsiyonel)" />
            </>
          )}

          <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="E-posta" required />
          <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Şifre" required />

          <button type="submit" disabled={loading}>
            {loading ? 'İşleniyor...' : mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;