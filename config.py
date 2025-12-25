import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv('BOT_TOKEN')
WEB_APP_URL = os.getenv('WEB_APP_URL', 'https://your-server.com')  # Замените на ваш URL
WEBHOOK_PATH = "/webhook"
WEBHOOK_URL = f"{WEB_APP_URL}{WEBHOOK_PATH}"

ADMIN_IDS = [123456789]  # Замените на ваш ID телеграма
