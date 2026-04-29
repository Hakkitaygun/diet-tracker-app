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
  { name: 'Buğday', calories_per_100g: 111, protein: 4.5, carbs: 23, fat: 0.4, category: 'Tahıllar', description: 'Haşlanmış buğday' },
  { name: 'Makarna', calories_per_100g: 131, protein: 5, carbs: 25, fat: 1.1, category: 'Tahıllar', description: 'Pişmiş makarna' },
  
  // Vegetables
  { name: 'Domates', calories_per_100g: 18, protein: 0.9, carbs: 3.9, fat: 0.2, category: 'Sebzeler', description: 'Taze domates' },
  { name: 'Salata', calories_per_100g: 15, protein: 1.2, carbs: 3, fat: 0.2, category: 'Sebzeler', description: 'Yeşil salata' },
  { name: 'Patates', calories_per_100g: 77, protein: 2, carbs: 17, fat: 0.1, category: 'Sebzeler', description: 'Pişmiş patates' },
  { name: 'Patlıcan', calories_per_100g: 25, protein: 1, carbs: 6, fat: 0.2, category: 'Sebzeler', description: 'Pişmiş patlıcan' },
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
  { name: 'Nutella', calories_per_100g: 539, protein: 6.3, carbs: 57.5, fat: 30.9, category: 'Tatlılar', description: 'Kakaolu fındık kreması' },
  
  // Beverages
  { name: 'Süt kahvesi', calories_per_100g: 25, protein: 1.5, carbs: 2, fat: 1, category: 'İçecekler', description: 'Kahve ve süt' },
  { name: 'Çay', calories_per_100g: 2, protein: 0, carbs: 0, fat: 0, category: 'İçecekler', description: 'Sade çay' },
  { name: 'Portakal suyu', calories_per_100g: 45, protein: 0.7, carbs: 11, fat: 0.2, category: 'İçecekler', description: 'Taze portakal suyu' },
  { name: 'Gazlı içecek', calories_per_100g: 42, protein: 0, carbs: 11, fat: 0, category: 'İçecekler', description: 'Şekerli gazlı içecek' },

  // Breakfast and protein staples
  { name: 'Yumurta', calories_per_100g: 155, protein: 13, carbs: 1.1, fat: 11, category: 'Protein Kaynakları', description: 'Bütün yumurta' },
  { name: 'Lor peyniri', calories_per_100g: 98, protein: 18, carbs: 3, fat: 2, category: 'Süt Ürünleri', description: 'Yağsız lor peyniri' },
  { name: 'Kefir', calories_per_100g: 52, protein: 3.4, carbs: 4.8, fat: 2, category: 'Süt Ürünleri', description: 'Doğal kefir' },
  { name: 'Yulaf ezmesi', calories_per_100g: 389, protein: 17, carbs: 66, fat: 7, category: 'Tahıllar', description: 'Çiğ yulaf ezmesi' },
  { name: 'Hindi göğsü', calories_per_100g: 135, protein: 29, carbs: 0, fat: 1.5, category: 'Et', description: 'Yağsız hindi göğsü' },
  { name: 'Ton balığı', calories_per_100g: 132, protein: 29, carbs: 0, fat: 1, category: 'Balık', description: 'Suda ton balığı' },
  { name: 'Kıyma', calories_per_100g: 242, protein: 26, carbs: 0, fat: 15, category: 'Et', description: 'Az yağlı dana kıyma' },

  // Grain and legume options
  { name: 'Bulgur', calories_per_100g: 83, protein: 3.1, carbs: 18.6, fat: 0.2, category: 'Tahıllar', description: 'Pişmiş bulgur' },
  { name: 'Tam buğday ekmeği', calories_per_100g: 247, protein: 13, carbs: 41, fat: 4.2, category: 'Tahıllar', description: 'Tam buğday ekmeği' },
  { name: 'Tam buğday makarna', calories_per_100g: 124, protein: 5.3, carbs: 26, fat: 0.9, category: 'Tahıllar', description: 'Pişmiş tam buğday makarna' },
  { name: 'Mercimek', calories_per_100g: 116, protein: 9, carbs: 20, fat: 0.4, category: 'Baklagiller', description: 'Pişmiş mercimek' },

  // Vegetables and healthy fats
  { name: 'Salatalık', calories_per_100g: 15, protein: 0.7, carbs: 3.6, fat: 0.1, category: 'Sebzeler', description: 'Taze salatalık' },
  { name: 'Ispanak', calories_per_100g: 23, protein: 2.9, carbs: 3.6, fat: 0.4, category: 'Sebzeler', description: 'Pişmiş ıspanak' },
  { name: 'Kabak', calories_per_100g: 17, protein: 1.2, carbs: 3.1, fat: 0.3, category: 'Sebzeler', description: 'Pişmiş kabak' },
  { name: 'Mantar', calories_per_100g: 22, protein: 3.1, carbs: 3.3, fat: 0.3, category: 'Sebzeler', description: 'Pişmiş mantar' },
  { name: 'Avokado', calories_per_100g: 160, protein: 2, carbs: 9, fat: 15, category: 'Meyveler', description: 'Olgun avokado' },
  { name: 'Zeytin', calories_per_100g: 115, protein: 0.8, carbs: 6, fat: 10.7, category: 'Yağlar', description: 'Siyah zeytin' },
  { name: 'Ceviz', calories_per_100g: 654, protein: 15, carbs: 14, fat: 65, category: 'Yemişler', description: 'Çiğ ceviz' },
  { name: 'Fındık', calories_per_100g: 628, protein: 15, carbs: 17, fat: 61, category: 'Yemişler', description: 'Çiğ fındık' },
  { name: 'Kinoa', calories_per_100g: 120, protein: 4.4, carbs: 21, fat: 1.9, category: 'Tahıllar', description: 'Pişmiş kinoa' },
  { name: 'Mısır', calories_per_100g: 96, protein: 3.4, carbs: 21, fat: 1.5, category: 'Tahıllar', description: 'Haşlanmış mısır taneleri' },
  
  // Popular dishes and special foods
  { name: 'Sushi', calories_per_100g: 127, protein: 5.4, carbs: 20.3, fat: 2.2, category: 'Yemek', description: 'Standart sushi (pirinç ve balık)' },
  { name: 'Pizza', calories_per_100g: 265, protein: 11, carbs: 36, fat: 10, category: 'Yemek', description: 'Standart pizza' },
  { name: 'Hamburger', calories_per_100g: 215, protein: 15, carbs: 16, fat: 11, category: 'Yemek', description: 'Standart hamburger' },
  { name: 'Döner', calories_per_100g: 188, protein: 15, carbs: 15, fat: 9, category: 'Yemek', description: 'Et döner ekmek ile' },
  { name: 'Kebap', calories_per_100g: 168, protein: 26, carbs: 2, fat: 7, category: 'Yemek', description: 'Kuşbaşı kebap' },
  { name: 'Makarna bolonez', calories_per_100g: 118, protein: 8.5, carbs: 14, fat: 3.5, category: 'Yemek', description: 'Makarna bolonez sosu ile' },
  { name: 'Çorba', calories_per_100g: 45, protein: 2.5, carbs: 7, fat: 0.8, category: 'Yemek', description: 'Standart et çorbası' },
  { name: 'Pilav', calories_per_100g: 150, protein: 4.5, carbs: 28, fat: 3, category: 'Yemek', description: 'Pirinç pilav' },
  { name: 'Türk kahvaltısı', calories_per_100g: 185, protein: 8, carbs: 20, fat: 9, category: 'Yemek', description: 'Peynir, zeytin, ekmek, yumurta' },
  { name: 'Omlet', calories_per_100g: 154, protein: 13.6, carbs: 1.1, fat: 11, category: 'Yemek', description: 'Standart 2 yumurtalı omlet' },
  { name: 'Biftek', calories_per_100g: 250, protein: 28, carbs: 0, fat: 14, category: 'Yemek', description: 'Pişmiş sığır biftek' },
  { name: 'Salata', calories_per_100g: 25, protein: 2, carbs: 4, fat: 0.5, category: 'Yemek', description: 'Yeşil salata' },
  { name: 'Çiğ köfte', calories_per_100g: 187, protein: 15, carbs: 12, fat: 9, category: 'Yemek', description: 'Geleneksel çiğ köfte' },
  { name: 'Lahmacun', calories_per_100g: 239, protein: 12, carbs: 22, fat: 12, category: 'Yemek', description: 'Standart lahmacun' },
  { name: 'Manti', calories_per_100g: 155, protein: 7, carbs: 18, fat: 6, category: 'Yemek', description: 'Haşlanmış manti' },
  { name: 'Dolma', calories_per_100g: 98, protein: 4, carbs: 15, fat: 3, category: 'Yemek', description: 'Standart dolma' },
  { name: 'Falafel', calories_per_100g: 333, protein: 13, carbs: 28, fat: 17, category: 'Yemek', description: 'Kızartılmış nohut falafel' },
  { name: 'Humus', calories_per_100g: 150, protein: 7.5, carbs: 14, fat: 8, category: 'Yemek', description: 'Nohutlu humus' },
  { name: 'Pide', calories_per_100g: 220, protein: 10, carbs: 28, fat: 8, category: 'Yemek', description: 'Standart etli pide' },
  { name: 'Pastirma', calories_per_100g: 226, protein: 30, carbs: 0, fat: 11, category: 'Et Ürünleri', description: 'Pastirma' },
  { name: 'Sucuk', calories_per_100g: 435, protein: 20, carbs: 2, fat: 39, category: 'Et Ürünleri', description: 'Kuru sucuk' },
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
