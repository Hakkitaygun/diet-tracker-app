import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import Dashboard from './components/Dashboard';
import MealTracker from './components/MealTracker';
import Recommendations from './components/Recommendations';
import UserProfile from './components/UserProfile';
import Analytics from './components/Analytics';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userId, setUserId] = useState(localStorage.getItem('userId'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/user/${userId}`);
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser]);

  const handleCreateUser = async (responseData) => {
    try {
      setLoading(true);
      const newUserId = responseData.id;
      setUserId(newUserId);
      localStorage.setItem('userId', newUserId);
      await fetchUser();
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return <UserProfile onUserCreated={handleCreateUser} />;
  }

  if (loading) {
    return <div className="loading">Yükleniyor...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>🥗 Diyetisyen AI</h1>
          <p>Kişiselleştirilmiş Beslenme Danışmanı</p>
        </div>
        <div className="user-info">
          <span>{user?.name}</span>
          <button 
            className="logout-btn"
            onClick={() => {
              setUserId(null);
              localStorage.removeItem('userId');
            }}
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
          className={currentPage === 'recommendations' ? 'active' : ''}
          onClick={() => setCurrentPage('recommendations')}
        >
          ⚡ Öneriler
        </button>
        <button 
          className={currentPage === 'analytics' ? 'active' : ''}
          onClick={() => setCurrentPage('analytics')}
        >
          📈 İstatistikler
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
        {currentPage === 'meal-tracker' && <MealTracker userId={userId} onMealAdded={() => { fetchUser(); setDashboardRefresh(prev => prev + 1); }} />}
        {currentPage === 'recommendations' && <Recommendations userId={userId} refreshKey={dashboardRefresh} />}
        {currentPage === 'analytics' && <Analytics userId={userId} />}
        {currentPage === 'profile' && <UserProfile userId={userId} onUserUpdated={fetchUser} />}
      </main>

      <footer className="app-footer">
        <p>💚 Sağlıklı bir yaşam için yapay zeka destekli beslenme danışmanı</p>
      </footer>
    </div>
  );
}

export default App;
