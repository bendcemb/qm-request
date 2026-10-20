import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

class Config:
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', 5432))
    DB_NAME = os.getenv('DB_NAME', 'qm_request_db')
    DB_USER = os.getenv('DB_USER', 'admincomp')
    DB_PASSWORD = os.getenv('DB_PASSWORD', "g-9[k'[vo")
    
    SECRET_KEY = os.getenv('SECRET_KEY', 'qm_request_secure_default_secret_2026')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin@qm2026')
    PORT = int(os.getenv('PORT', 5000))
    DEBUG = os.getenv('FLASK_ENV', 'production') == 'development'
    TEMPLATES_AUTO_RELOAD = True
    
    # Upload Configurations
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', str(BASE_DIR / 'uploads'))
    if not os.path.isabs(UPLOAD_FOLDER):
        UPLOAD_FOLDER = str(BASE_DIR / UPLOAD_FOLDER)
    MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', 10 * 1024 * 1024)) # 10MB limit
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'docx', 'xls'}
