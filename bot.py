import logging
from aiogram import Bot, Dispatcher, types
from aiogram.contrib.middlewares.logging import LoggingMiddleware
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.utils import executor
import config
from database import Database

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация бота
bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher(bot)
dp.middleware.setup(LoggingMiddleware())

# Инициализация базы данных
db = Database()

@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    """Обработчик команды /start"""
    # Регистрируем пользователя
    user_id = message.from_user.id
    username = message.from_user.username
    first_name = message.from_user.first_name
    last_name = message.from_user.last_name
    
    db.register_user(user_id, username, first_name, last_name)
    
    # Создаем клавиатуру с кнопкой Mini App
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton(
            text="📱 Открыть магазин",
            web_app=WebAppInfo(url=f"{config.WEB_APP_URL}/index.html?user_id={user_id}")
        )
    )
    keyboard.add(
        InlineKeyboardButton("📋 Мои объявления", callback_data="my_ads"),
        InlineKeyboardButton("❤️ Избранное", callback_data="favorites")
    )
    keyboard.add(
        InlineKeyboardButton("ℹ️ Помощь", callback_data="help"),
        InlineKeyboardButton("📞 Поддержка", url="https://t.me/username")  # Замените на ваш юзернейм
    )
    
    welcome_text = f"""
    🚀 *Добро пожаловать в Vape Marketplace!*
    
    📱 *Наш Mini App включает:*
    • 📋 Просмотр всех объявлений
    • ➕ Создание своих объявлений
    • 📸 Загрузка фото из галереи
    • 💬 Написание продавцу в Telegram
    • ❤️ Добавление в избранное
    
    🏷 *Категории товаров:*
    🔄 Расходники (атомайзеры, испарители)
    💧 Жидкость (солевые, обычные)
    🚬 Одноразовые устройства
    🔋 Под системы (моды, аккумуляторы)
    📦 Другое (аксессуары, запчасти)
    
    Нажмите кнопку ниже, чтобы открыть магазин! 👇
    """
    
    await message.answer(welcome_text, 
                        parse_mode='Markdown', 
                        reply_markup=keyboard)

@dp.callback_query_handler(lambda c: c.data == 'my_ads')
async def process_my_ads(callback_query: types.CallbackQuery):
    """Показ объявлений пользователя"""
    user = db.get_user_by_telegram_id(callback_query.from_user.id)
    if not user:
        return
    
    ads = db.get_ads(user_id=user['id'])
    
    if not ads:
        await callback_query.answer("У вас пока нет объявлений", show_alert=True)
        return
    
    text = "📋 *Ваши объявления:*\n\n"
    for ad in ads[:5]:  # Показываем первые 5
        text += f"• *{ad['title']}* - {ad['price']}₽\n"
        text += f"  👁 {ad['views']} просмотров\n\n"
    
    if len(ads) > 5:
        text += f"*И ещё {len(ads) - 5} объявлений...*\n"
    
    text += "\nЧтобы управлять объявлениями, откройте Mini App 📱"
    
    await callback_query.message.answer(text, parse_mode='Markdown')
    await callback_query.answer()

@dp.callback_query_handler(lambda c: c.data == 'favorites')
async def process_favorites(callback_query: types.CallbackQuery):
    """Показ избранного"""
    user = db.get_user_by_telegram_id(callback_query.from_user.id)
    if not user:
        return
    
    favorites = db.get_user_favorites(user['id'])
    
    if not favorites:
        await callback_query.answer("В избранном пока ничего нет", show_alert=True)
        return
    
    text = "❤️ *Ваши избранные объявления:*\n\n"
    for ad in favorites[:5]:  # Показываем первые 5
        text += f"• *{ad['title']}* - {ad['price']}₽\n"
        text += f"  👁 {ad['views']} просмотров\n\n"
    
    if len(favorites) > 5:
        text += f"*И ещё {len(favorites) - 5} в избранном...*\n"
    
    text += "\nЧтобы просмотреть все, откройте Mini App 📱"
    
    await callback_query.message.answer(text, parse_mode='Markdown')
    await callback_query.answer()

@dp.callback_query_handler(lambda c: c.data == 'help')
async def process_help(callback_query: types.CallbackQuery):
    """Показ помощи"""
    help_text = """
    *❓ Помощь по использованию Vape Marketplace*
    
    *📱 Как пользоваться Mini App:*
    1. Нажмите кнопку "Открыть магазин"
    2. Для создания объявления нажмите "➕ Создать"
    3. Загрузите фото из галереи
    4. Заполните все поля
    5. Опубликуйте объявление
    
    *💬 Как связаться с продавцом:*
    • Нажмите кнопку "Написать продавцу" в объявлении
    • Вы перейдете в Telegram к продавцу
    
    *⚠️ Правила:*
    • Запрещена продажа несовершеннолетним
    • Только оригинальная продукция
    • Будьте вежливы в общении
    
    *📞 Поддержка:* @username
    """
    
    await callback_query.message.answer(help_text, parse_mode='Markdown')
    await callback_query.answer()

@dp.message_handler(content_types=types.ContentType.TEXT)
async def handle_text(message: types.Message):
    """Обработка текстовых сообщений"""
    if message.text.lower() == 'магазин':
        await cmd_start(message)
    else:
        await message.answer("Используйте кнопки меню или команду /start")

if __name__ == '__main__':
    from web_app import run_web_server
    import threading
    
    # Запускаем веб-сервер в отдельном потоке
    web_thread = threading.Thread(target=run_web_server)
    web_thread.daemon = True
    web_thread.start()
    
    logger.info("Бот запущен!")
    executor.start_polling(dp, skip_updates=True)
