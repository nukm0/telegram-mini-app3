import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional

class Database:
    def __init__(self, db_name='vape_market.db'):
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.create_tables()
    
    def create_tables(self):
        cursor = self.conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                phone TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица объявлений
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                category TEXT NOT NULL,
                photos TEXT,  # JSON массив с URL фото
                location TEXT,
                contact_preference TEXT DEFAULT 'telegram',
                is_active BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                views INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Таблица избранного
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS favorites (
                user_id INTEGER NOT NULL,
                ad_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, ad_id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (ad_id) REFERENCES ads (id) ON DELETE CASCADE
            )
        ''')
        
        self.conn.commit()
    
    def register_user(self, telegram_id: int, username: str = None, 
                     first_name: str = None, last_name: str = None) -> int:
        """Регистрация/обновление пользователя"""
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO users 
            (telegram_id, username, first_name, last_name) 
            VALUES (?, ?, ?, ?)
        ''', (telegram_id, username, first_name, last_name))
        self.conn.commit()
        return cursor.lastrowid
    
    def create_ad(self, user_id: int, title: str, description: str, 
                 price: float, category: str, photos: List[str] = None,
                 location: str = None, contact_preference: str = 'telegram') -> int:
        """Создание нового объявления"""
        cursor = self.conn.cursor()
        photos_json = json.dumps(photos) if photos else '[]'
        
        cursor.execute('''
            INSERT INTO ads 
            (user_id, title, description, price, category, photos, location, contact_preference)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, title, description, price, category, photos_json, location, contact_preference))
        
        self.conn.commit()
        return cursor.lastrowid
    
    def get_ads(self, category: str = None, user_id: int = None, 
               limit: int = 50, offset: int = 0, search_query: str = None) -> List[Dict]:
        """Получение объявлений с фильтрами"""
        cursor = self.conn.cursor()
        
        query = '''
            SELECT ads.*, 
                   users.telegram_id, 
                   users.username, 
                   users.first_name,
                   COUNT(favorites.ad_id) as favorites_count
            FROM ads
            LEFT JOIN users ON ads.user_id = users.id
            LEFT JOIN favorites ON ads.id = favorites.ad_id
            WHERE ads.is_active = 1
        '''
        params = []
        
        if category:
            query += ' AND ads.category = ?'
            params.append(category)
        
        if user_id:
            query += ' AND ads.user_id = ?'
            params.append(user_id)
        
        if search_query:
            query += ' AND (ads.title LIKE ? OR ads.description LIKE ?)'
            params.extend([f'%{search_query}%', f'%{search_query}%'])
        
        query += ' GROUP BY ads.id ORDER BY ads.created_at DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        ads = []
        for row in rows:
            ad = dict(row)
            ad['photos'] = json.loads(ad['photos']) if ad['photos'] else []
            ads.append(ad)
        
        return ads
    
    def get_ad_by_id(self, ad_id: int) -> Optional[Dict]:
        """Получение объявления по ID"""
        cursor = self.conn.cursor()
        
        cursor.execute('''
            UPDATE ads SET views = views + 1 WHERE id = ?
        ''', (ad_id,))
        
        cursor.execute('''
            SELECT ads.*, 
                   users.telegram_id, 
                   users.username, 
                   users.first_name
            FROM ads
            LEFT JOIN users ON ads.user_id = users.id
            WHERE ads.id = ?
        ''', (ad_id,))
        
        row = cursor.fetchone()
        if row:
            ad = dict(row)
            ad['photos'] = json.loads(ad['photos']) if ad['photos'] else []
            self.conn.commit()
            return ad
        
        return None
    
    def get_user_by_telegram_id(self, telegram_id: int) -> Optional[Dict]:
        """Получение пользователя по Telegram ID"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM users WHERE telegram_id = ?', (telegram_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def toggle_favorite(self, user_id: int, ad_id: int) -> bool:
        """Добавление/удаление из избранного"""
        cursor = self.conn.cursor()
        
        # Проверяем, есть ли уже в избранном
        cursor.execute('SELECT 1 FROM favorites WHERE user_id = ? AND ad_id = ?', 
                      (user_id, ad_id))
        
        if cursor.fetchone():
            # Удаляем из избранного
            cursor.execute('DELETE FROM favorites WHERE user_id = ? AND ad_id = ?', 
                          (user_id, ad_id))
            is_favorite = False
        else:
            # Добавляем в избранное
            cursor.execute('INSERT INTO favorites (user_id, ad_id) VALUES (?, ?)', 
                          (user_id, ad_id))
            is_favorite = True
        
        self.conn.commit()
        return is_favorite
    
    def get_user_favorites(self, user_id: int) -> List[Dict]:
        """Получение избранных объявлений пользователя"""
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT ads.*, 
                   users.telegram_id, 
                   users.username, 
                   users.first_name
            FROM ads
            JOIN favorites ON ads.id = favorites.ad_id
            LEFT JOIN users ON ads.user_id = users.id
            WHERE favorites.user_id = ? AND ads.is_active = 1
            ORDER BY favorites.created_at DESC
        ''', (user_id,))
        
        rows = cursor.fetchall()
        ads = []
        for row in rows:
            ad = dict(row)
            ad['photos'] = json.loads(ad['photos']) if ad['photos'] else []
            ads.append(ad)
        
        return ads
    
    def delete_ad(self, user_id: int, ad_id: int) -> bool:
        """Удаление объявления (деактивация)"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE ads SET is_active = 0 
            WHERE id = ? AND user_id = ?
        ''', (ad_id, user_id))
        
        affected = cursor.rowcount
        self.conn.commit()
        return affected > 0
    
    def get_user_stats(self, user_id: int) -> Dict:
        """Получение статистики пользователя"""
        cursor = self.conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total_ads,
                SUM(views) as total_views,
                COUNT(DISTINCT favorites.ad_id) as total_favorites
            FROM ads
            LEFT JOIN favorites ON ads.id = favorites.ad_id
            WHERE ads.user_id = ? AND ads.is_active = 1
        ''', (user_id,))
        
        stats = dict(cursor.fetchone())
        
        # Получаем последние объявления
        cursor.execute('''
            SELECT id, title, price, views, created_at
            FROM ads
            WHERE user_id = ? AND is_active = 1
            ORDER BY created_at DESC
            LIMIT 5
        ''', (user_id,))
        
        stats['recent_ads'] = [dict(row) for row in cursor.fetchall()]
        
        return stats
