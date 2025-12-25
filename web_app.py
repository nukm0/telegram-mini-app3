from flask import Flask, render_template, request, jsonify, send_file
import json
import os
from database import Database
import config

app = Flask(__name__, static_folder='.', static_url_path='')
db = Database()

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/api/ads')
def get_ads():
    """API для получения объявлений"""
    category = request.args.get('category')
    user_id = request.args.get('user_id', type=int)
    search = request.args.get('search')
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    ads = db.get_ads(category=category, user_id=user_id, 
                    limit=limit, offset=offset, search_query=search)
    
    # Преобразуем datetime в строку для JSON
    for ad in ads:
        if 'created_at' in ad:
            ad['created_at'] = str(ad['created_at'])
    
    return jsonify(ads)

@app.route('/api/ad/<int:ad_id>')
def get_ad(ad_id):
    """API для получения конкретного объявления"""
    ad = db.get_ad_by_id(ad_id)
    if ad and 'created_at' in ad:
        ad['created_at'] = str(ad['created_at'])
    return jsonify(ad if ad else {})

@app.route('/api/create_ad', methods=['POST'])
def create_ad():
    """API для создания объявления"""
    data = request.json
    
    required_fields = ['user_id', 'title', 'price', 'category']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing {field}'}), 400
    
    # Получаем пользователя
    user = db.get_user_by_telegram_id(data['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Создаем объявление
    ad_id = db.create_ad(
        user_id=user['id'],
        title=data['title'],
        description=data.get('description', ''),
        price=float(data['price']),
        category=data['category'],
        photos=data.get('photos', []),
        location=data.get('location', ''),
        contact_preference=data.get('contact_preference', 'telegram')
    )
    
    return jsonify({'success': True, 'ad_id': ad_id})

@app.route('/api/user/<int:telegram_id>')
def get_user(telegram_id):
    """API для получения информации о пользователе"""
    user = db.get_user_by_telegram_id(telegram_id)
    if user:
        # Убираем приватные данные
        user.pop('phone', None)
    return jsonify(user if user else {})

@app.route('/api/toggle_favorite', methods=['POST'])
def toggle_favorite():
    """API для добавления/удаления из избранного"""
    data = request.json
    
    user = db.get_user_by_telegram_id(data['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    is_favorite = db.toggle_favorite(user['id'], data['ad_id'])
    return jsonify({'success': True, 'is_favorite': is_favorite})

@app.route('/api/user_favorites/<int:telegram_id>')
def get_user_favorites(telegram_id):
    """API для получения избранного пользователя"""
    user = db.get_user_by_telegram_id(telegram_id)
    if not user:
        return jsonify([])
    
    favorites = db.get_user_favorites(user['id'])
    for fav in favorites:
        if 'created_at' in fav:
            fav['created_at'] = str(fav['created_at'])
    
    return jsonify(favorites)

@app.route('/api/categories')
def get_categories():
    """API для получения категорий"""
    return jsonify(config.CATEGORIES)

@app.route('/api/delete_ad', methods=['POST'])
def delete_ad():
    """API для удаления объявления"""
    data = request.json
    
    user = db.get_user_by_telegram_id(data['user_id'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    success = db.delete_ad(user['id'], data['ad_id'])
    return jsonify({'success': success})

@app.route('/api/stats/<int:telegram_id>')
def get_stats(telegram_id):
    """API для получения статистики пользователя"""
    user = db.get_user_by_telegram_id(telegram_id)
    if not user:
        return jsonify({})
    
    stats = db.get_user_stats(user['id'])
    return jsonify(stats)

@app.route('/upload_photo', methods=['POST'])
def upload_photo():
    """Эндпоинт для загрузки фото (заглушка - в реальности нужно настроить хостинг файлов)"""
    # В реальном приложении здесь будет код для сохранения файлов
    # Для демо возвращаем заглушку
    return jsonify({
        'success': True,
        'url': 'https://via.placeholder.com/400x300/7B1FA2/FFFFFF?text=Vape+Photo'
    })

def run_web_server():
    """Запуск веб-сервера"""
    app.run(host=config.WEB_SERVER_HOST, 
           port=config.WEB_SERVER_PORT, 
           debug=False)

if __name__ == '__main__':
    run_web_server()
