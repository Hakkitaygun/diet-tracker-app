import React, { useState, useEffect, useCallback } from 'react';
import api from './api';
import './App.css';
import Dashboard from './components/Dashboard';
import MealTracker from './components/MealTracker';
import UserProfile from './components/UserProfile';
import AuthScreen from './components/AuthScreen';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [authReady, setAuthReady] = useState(false);
  const [authToken, setAuthToken] = useState(localStorage.getItem('authToken'));
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const bumpDashboardRefresh = useCallback(() => {
    setDashboardRefresh((prev) => prev + 1);
  }, []);

  const fetchUser = useCallback(async (targetUserId = userId) => {
    if (!targetUserId) return;
    try {
      setLoading(true);
      const response = await api.get(`/api/user/${targetUserId}`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const loadSession = async () => {
      if (!authToken) {
        localStorage.removeItem('userId');
        setUserId(null);
        setAuthReady(true);
        return;
      }

      try {
        const response = await api.get('/api/auth/me');
        const currentUser = response.data.user;
        setUser(currentUser);
        setUserId(String(currentUser.id));
        localStorage.setItem('userId', String(currentUser.id));
        localStorage.setItem('authToken', authToken);
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        setAuthToken(null);
        setUserId(null);
        setUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    loadSession();
  }, [authToken]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser]);

  const handleAuthSuccess = async (responseData) => {
    try {
      setLoading(true);
      const newUserId = responseData.user?.id || responseData.id;
      const token = responseData.token;

      if (token) {
        setAuthToken(token);
        localStorage.setItem('authToken', token);
      }

      setUserId(String(newUserId));
      localStorage.setItem('userId', String(newUserId));
      if (responseData.user) {
        setUser(responseData.user);
      }
      await fetchUser(newUserId);
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    setAuthToken(null);
    setUserId(null);
    setUser(null);
    setCurrentPage('dashboard');
  };

  if (!authReady) {
    return <div className="loading">Oturum doğrulanıyor...</div>;
  }

  if (!userId) {
    return <AuthScreen onSuccess={handleAuthSuccess} />;
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🥗 Diyetisyen</h1>
          <p>Kişiselleştirilmiş Beslenme Danışmanı</p>
        </div>
        <div className="user-info">
          <span>{user?.name}</span>
          <button 
            className="logout-btn"
            onClick={handleLogout}
          >
            Çıkış
          </button>
        </div>
      </header>

      <nav className="app-nav">
        <button 
          className={currentPage === 'dashboard' ? 'active' : ''}
          onClick={() => setCurrentPage('dashboard')}
        >
          📊 Ana Sayfa
        </button>
        <button 
          className={currentPage === 'meal-tracker' ? 'active' : ''}
          onClick={() => setCurrentPage('meal-tracker')}
        >
          🍽️ Beslenme Takibi
        </button>
        <button 
          className={currentPage === 'profile' ? 'active' : ''}
          onClick={() => setCurrentPage('profile')}
        >
          👤 Profil
        </button>
      </nav>

      <main className="app-main">
        {currentPage === 'dashboard' && <Dashboard userId={userId} user={user} onUpdate={fetchUser} refreshKey={dashboardRefresh} />}
        {currentPage === 'meal-tracker' && <MealTracker userId={userId} onMealAdded={() => { fetchUser(); bumpDashboardRefresh(); }} />}
        {currentPage === 'profile' && <UserProfile userId={userId} onUserUpdated={() => { fetchUser(); bumpDashboardRefresh(); }} />}
      </main>

      <footer className="app-footer">
        <p>💚 Sağlıklı bir yaşam için beslenme danışmanı</p>
      </footer>
    </div>
  );
}

export default App;
