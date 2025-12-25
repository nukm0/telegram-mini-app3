import sqlite3
import json
from datetime import datetime

class Database:
    def __init__(self, db_name='marketplace.db'):
        self.conn = sqlite3.connect(db_name, check_same_thread=False)
        self.create_tables()
    
    def create_tables(self):
        cursor = self.conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                phone_number TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Таблица объявлений
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS ads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                price REAL,
                photos TEXT,  # JSON массив фото
                category TEXT,
                location TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        ''')
        
        # Таблица категорий
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                emoji TEXT
            )
        ''')
        
        # Добавляем категории по умолчанию
        default_categories = [
            ('Электроника', '📱'),
            ('Одежда', '👕'),
            ('Недвижимость', '🏠'),
            ('Авто', '🚗'),
            ('Услуги', '🛠️'),
            ('Работа', '💼'),
            ('Для дома', '🏡'),
            ('Хобби', '🎨')
        ]
        
        cursor.execute('SELECT COUNT(*) FROM categories')
        if cursor.fetchone()[0] == 0:
            cursor.executemany('INSERT INTO categories (name, emoji) VALUES (?, ?)', default_categories)
        
        self.conn.commit()
    
    def add_user(self, user_id, username, full_name):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO users (user_id, username, full_name) 
            VALUES (?, ?, ?)
        ''', (user_id, username, full_name))
        self.conn.commit()
    
    def create_ad(self, user_id, title, description, price, photos, category, location):
        cursor = self.conn.cursor()
        photos_json = json.dumps(photos)
        cursor.execute('''
            INSERT INTO ads (user_id, title, description, price, photos, category, location)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, title, description, price, photos_json, category, location))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_user_ads(self, user_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM ads 
            WHERE user_id = ? AND is_active = 1 
            ORDER BY created_at DESC
        ''', (user_id,))
        return cursor.fetchall()
    
    def get_all_ads(self, limit=50, offset=0):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT a.*, u.username, u.full_name 
            FROM ads a
            LEFT JOIN users u ON a.user_id = u.user_id
            WHERE a.is_active = 1
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        return cursor.fetchall()
    
    def get_ad_by_id(self, ad_id):
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT a.*, u.username, u.full_name 
            FROM ads a
            LEFT JOIN users u ON a.user_id = u.user_id
            WHERE a.id = ?
        ''', (ad_id,))
        return cursor.fetchone()
    
    def get_categories(self):
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM categories ORDER BY name')
        return cursor.fetchall()
    
    def search_ads(self, query, category=None):
        cursor = self.conn.cursor()
        if category:
            cursor.execute('''
                SELECT a.*, u.username, u.full_name 
                FROM ads a
                LEFT JOIN users u ON a.user_id = u.user_id
                WHERE a.is_active = 1 
                AND (a.title LIKE ? OR a.description LIKE ?)
                AND a.category = ?
                ORDER BY a.created_at DESC
            ''', (f'%{query}%', f'%{query}%', category))
        else:
            cursor.execute('''
                SELECT a.*, u.username, u.full_name 
                FROM ads a
                LEFT JOIN
