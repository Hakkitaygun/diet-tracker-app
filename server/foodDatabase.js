const { usePostgres, run } = require('./database');

// Comprehensive Turkish and International Food Database
const FOOD_DATABASE = [
  // Meats
  { name: 'Tavuk göğsü', calories_per_100g: 165, protein: 31, carbs: 0, fat: 3.6, category: 'Et', description: 'Kızartılmamış tavuk göğsü' },
  { name: 'Kırmızı et', calories_per_100g: 250, protein: 26, carbs: 0, fat: 15, category: 'Et', description: 'Çiğ kırmızı et' },
  { name: 'Balık', calories_per_100g: 100, protein: 22, carbs: 0, fat: 1, category: 'Balık', description: 'Beyaz balık' },
  { name: 'Somon', calories_per_100g: 208, protein: 20, carbs: 0, fat: 13, category: 'Balık', description: 'Somon' },
  
  // Grains
  { name: 'Beyaz ekmek', calories_per_100g: 265, protein: 9, carbs: 49, fat: 3.3, category: 'Tahıllar', description: 'Beyaz ekmek' },
  { name: 'Buğday ekmeği', calories_per_100g: 265, protein: 9, carbs: 49, fat: 3.3, category: 'Tahıllar', description: 'Tam buğday ekmeği' },
  { name: 'Pirinç', calories_per_100g: 130, protein: 2.7, carbs: 28, fat: 0.3, category: 'Tahıllar', description: 'Pişmiş pirinç' },
  { name: 'Makarna', calories_per_100g: 131, protein: 5, carbs: 25, fat: 1.1, category: 'Tahıllar', description: 'Pişmiş makarna' },
  
  // Vegetables
  { name: 'Domates', calories_per_100g: 18, protein: 0.9, carbs: 3.9, fat: 0.2, category: 'Sebzeler', description: 'Taze domates' },
  { name: 'Salata', calories_per_100g: 15, protein: 1.2, carbs: 3, fat: 0.2, category: 'Sebzeler', description: 'Yeşil salata' },
  { name: 'Patates', calories_per_100g: 77, protein: 2, carbs: 17, fat: 0.1, category: 'Sebzeler', description: 'Pişmiş patates' },
  { name: 'Havuç', calories_per_100g: 41, protein: 0.9, carbs: 10, fat: 0.2, category: 'Sebzeler', description: 'Taze havuç' },
  { name: 'Broccoli', calories_per_100g: 34, protein: 2.8, carbs: 7, fat: 0.4, category: 'Sebzeler', description: 'Pişmiş broccoli' },
  { name: 'Soğan', calories_per_100g: 40, protein: 1.1, carbs: 9, fat: 0.1, category: 'Sebzeler', description: 'Taze soğan' },
  { name: 'Sarımsak', calories_per_100g: 149, protein: 6.4, carbs: 33, fat: 0.5, category: 'Sebzeler', description: 'Taze sarımsak' },
  
  // Fruits
  { name: 'Elma', calories_per_100g: 52, protein: 0.3, carbs: 14, fat: 0.2, category: 'Meyveler', description: 'Taze elma' },
  { name: 'Muz', calories_per_100g: 89, protein: 1.1, carbs: 23, fat: 0.3, category: 'Meyveler', description: 'Taze muz' },
  { name: 'Portakal', calories_per_100g: 47, protein: 0.9, carbs: 12, fat: 0.1, category: 'Meyveler', description: 'Taze portakal' },
  { name: 'Çilek', calories_per_100g: 32, protein: 0.8, carbs: 8, fat: 0.3, category: 'Meyveler', description: 'Taze çilek' },
  { name: 'Üzüm', calories_per_100g: 69, protein: 0.7, carbs: 18, fat: 0.2, category: 'Meyveler', description: 'Taze üzüm' },
  { name: 'Karpuz', calories_per_100g: 30, protein: 0.6, carbs: 8, fat: 0.2, category: 'Meyveler', description: 'Taze karpuz' },
  
  // Dairy
  { name: 'Süt', calories_per_100g: 61, protein: 3.2, carbs: 4.8, fat: 3.3, category: 'Süt Ürünleri', description: 'Tam yağlı süt' },
  { name: 'Peynir', calories_per_100g: 402, protein: 25, carbs: 1.3, fat: 33, category: 'Süt Ürünleri', description: 'Beyaz peynir' },
  { name: 'Yoğurt', calories_per_100g: 59, protein: 3.5, carbs: 3.3, fat: 3.3, category: 'Süt Ürünleri', description: 'Tam yağlı yoğurt' },
  
  // Legumes
  { name: 'Fasulye', calories_per_100g: 127, protein: 8.7, carbs: 23, fat: 0.4, category: 'Baklagiller', description: 'Pişmiş fasulye' },
  { name: 'Nohut', calories_per_100g: 164, protein: 8.9, carbs: 27, fat: 2.6, category: 'Baklagiller', description: 'Pişmiş nohut' },
  
  // Oils
  { name: 'Zeytinyağı', calories_per_100g: 884, protein: 0, carbs: 0, fat: 100, category: 'Yağlar', description: 'Zeytinyağı' },
  { name: 'Ayçiçek yağı', calories_per_100g: 884, protein: 0, carbs: 0, fat: 100, category: 'Yağlar', description: 'Ayçiçek yağı' },
  
  // Nuts
  { name: 'Yer fıstığı', calories_per_100g: 567, protein: 26, carbs: 16, fat: 49, category: 'Yemişler', description: 'Tuz eklenmemiş yer fıstığı' },
  { name: 'Badem', calories_per_100g: 579, protein: 21, carbs: 22, fat: 50, category: 'Yemişler', description: 'Badem' },
  
  // Beverages
  { name: 'Süt kahvesi', calories_per_100g: 25, protein: 1.5, carbs: 2, fat: 1, category: 'İçecekler', description: 'Kahve ve süt' },
  { name: 'Çay', calories_per_100g: 2, protein: 0, carbs: 0, fat: 0, category: 'İçecekler', description: 'Sade çay' },
  { name: 'Portakal suyu', calories_per_100g: 45, protein: 0.7, carbs: 11, fat: 0.2, category: 'İçecekler', description: 'Taze portakal suyu' },
  { name: 'Gazlı içecek', calories_per_100g: 42, protein: 0, carbs: 11, fat: 0, category: 'İçecekler', description: 'Şekerli gazlı içecek' },
];

// Initialize food database
const initializeFoodDatabase = async () => {
  try {
    for (const food of FOOD_DATABASE) {
      const insertSql = usePostgres
        ? `INSERT INTO food_database (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category, description)
           VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (name) DO NOTHING`
        : `INSERT OR IGNORE INTO food_database (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`;

      await run(
        insertSql,
        [food.name, food.calories_per_100g, food.protein, food.carbs, food.fat, food.category, food.description]
      );
    }
    console.log('Food database initialized');
  } catch (error) {
    console.error('Error initializing food database:', error);
  }
};

module.exports = {
  FOOD_DATABASE,
  initializeFoodDatabase
};
