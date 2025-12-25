class VapeMarketplace {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.currentUser = null;
        this.ads = [];
        this.categories = {};
        this.currentScreen = 'main';
        this.selectedCategory = null;
        this.photos = [];
        this.offset = 0;
        this.limit = 10;
        
        this.init();
    }
    
    async init() {
        // Инициализация Telegram Web App
        this.tg.expand();
        this.tg.enableClosingConfirmation();
        
        // Получаем user_id из параметров URL
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('user_id');
        
        if (userId) {
            await this.loadUser(parseInt(userId));
        }
        
        // Загружаем категории и объявления
        await this.loadCategories();
        await this.loadAds();
        
        // Инициализируем UI
        this.initUI();
        this.bindEvents();
        
        // Скрываем загрузчик
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('main-screen').classList.remove('hidden');
    }
    
    async loadUser(userId) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            if (response.ok) {
                this.currentUser = await response.json();
                this.updateProfileUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователя:', error);
        }
    }
    
    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                this.categories = await response.json();
                this.updateCategoriesUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки категорий:', error);
        }
    }
    
    async loadAds(category = null, reset = true) {
        if (reset) {
            this.offset = 0;
            this.ads = [];
        }
        
        try {
            let url = `/api/ads?limit=${this.limit}&offset=${this.offset}`;
            if (category) {
                url += `&category=${encodeURIComponent(category)}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                const newAds = await response.json();
                this.ads = reset ? newAds : [...this.ads, ...newAds];
                this.offset += newAds.length;
                this.updateAdsUI();
            }
        } catch (error) {
            console.error('Ошибка загрузки объявлений:', error);
        }
    }
    
    initUI() {
        // Инициализация навигации
        this.updateCategoriesUI();
        this.updateAdsUI();
        
        if (this.currentUser) {
            this.updateProfileUI();
        }
    }
    
    updateCategoriesUI() {
        const container = document.getElementById('category-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        Object.entries(this.categories).forEach(([key, value]) => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.textContent = value;
            btn.dataset.category = key;
            btn.addEventListener('click', () => this.filterByCategory(key));
            container.appendChild(btn);
        });
        
        // Обновляем полный список категорий
        const fullContainer = document.getElementById('categories-full');
        if (fullContainer) {
            fullContainer.innerHTML = '';
            Object.entries(this.categories).forEach(([key, value]) => {
                const categoryItem = document.createElement('div');
                categoryItem.className = 'category-full-item';
                categoryItem.innerHTML = `
                    <i class="fas fa-${this.getCategoryIcon(key)}"></i>
                    <span>${value}</span>
                    <i class="fas fa-chevron-right"></i>
                `;
                categoryItem.addEventListener('click', () => this.filterByCategory(key));
                fullContainer.appendChild(categoryItem);
            });
        }
    }
    
    getCategoryIcon(category) {
        const icons = {
            'расходники': 'cogs',
            'жидкость': 'tint',
            'одноразки': 'smoking',
            'подсистемы': 'battery-full',
            'другое': 'box'
        };
        return icons[category] || 'tag';
    }
    
    updateAdsUI() {
        const container = document.getElementById('ads-grid');
        if (!container) return;
        
        if (this.ads.length === 0) {
            container.innerHTML = `
                <div class="no-ads">
                    <i class="fas fa-box-open"></i>
                    <p>Пока нет объявлений в этой категории</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        this.ads.forEach(ad => {
            const adCard = document.createElement('div');
            adCard.className = 'ad-card';
            adCard.dataset.id = ad.id;
            
            const photoUrl = ad.photos && ad.photos.length > 0 
                ? ad.photos[0] 
                : 'https://via.placeholder.com/300x200/7B1FA2/FFFFFF?text=Vape';
            
            adCard.innerHTML = `
                <div class="ad-image">
                    <img src="${photoUrl}" alt="${ad.title}" onerror="this.src='https://via.placeholder.com/300x200/7B1FA2/FFFFFF?text=Vape'">
                </div>
                <div class="ad-info">
                    <h3 class="ad-title">${ad.title}</h3>
                    <div class="ad-price">${ad.price}₽</div>
                    <span class="ad-category">${this.categories[ad.category] || ad.category}</span>
                </div>
            `;
            
            adCard.addEventListener('click', () => this.showAdDetail(ad.id));
            container.appendChild(adCard);
        });
        
        // Показываем/скрываем кнопку "Показать еще"
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.style.display = this.ads.length >= this.offset ? 'block' : 'none';
        }
    }
    
    updateProfileUI() {
        if (!this.currentUser) return;
        
        const profileName = document.getElementById('profile-name');
        const profileUsername = document.getElementById('profile-username');
        
        if (profileName) {
            profileName.textContent = this.currentUser.first_name || 'Пользователь';
        }
        
        if (profileUsername) {
            profileUsername.textContent = this.currentUser.username 
                ? `@${this.currentUser.username}` 
                : 'Без username';
        }
        
        // Загружаем статистику
        this.loadUserStats();
    }
    
    async loadUserStats() {
        if (!this.currentUser) return;
        
        try {
            const response = await fetch(`/api/stats/${this.currentUser.telegram_id}`);
            if (response.ok) {
                const stats = await response.json();
                this.updateStatsUI(stats);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }
    
    updateStatsUI(stats) {
        const container = document.getElementById('profile-stats');
        if (!container) return;
        
        container.innerHTML = `
            <div class="stat-card">
                <span class="stat-value">${stats.total_ads || 0}</span>
                <span class="stat-label">Объявления</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.total_views || 0}</span>
                <span class="stat-label">Просмотры</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">${stats.total_favorites || 0}</span>
                <span class="stat-label">В избранном</span>
            </div>
        `;
    }
    
    bindEvents() {
        // Навигация
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const screen = e.currentTarget.dataset.screen;
                this.showScreen(screen);
                
                // Обновляем активную кнопку
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });
        
        // Кнопки назад
        document.querySelectorAll('.back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetScreen = e.currentTarget.dataset.back;
                this.showScreen(targetScreen);
            });
        });
        
        // Поиск
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchAds(e.target.value);
                }, 500);
            });
        }
        
        // Кнопка создания объявления
        const createBtn = document.getElementById('create-ad-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.showScreen('create'));
        }
        
        // Кнопка загрузки фото
        const uploadBtn = document.getElementById('upload-photo-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.showPhotoModal());
        }
        
        // Кнопка публикации
        const publishBtn = document.getElementById('publish-btn');
        if (publishBtn) {
            publishBtn.addEventListener('click', () => this.publishAd());
        }
        
        // Счетчик символов в описании
        const descriptionTextarea = document.getElementById('ad-description');
        if (descriptionTextarea) {
            descriptionTextarea.addEventListener('input', (e) => {
                const charCount = document.getElementById('char-count');
                if (charCount) {
                    charCount.textContent = e.target.value.length;
                }
            });
        }
        
        // Кнопка "Показать еще"
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadMoreAds());
        }
        
        // Кнопки профиля
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => this.showScreen('profile'));
        }
        
        const favoritesBtn = document.getElementById('favorites-btn');
        if (favoritesBtn) {
            favoritesBtn.addEventListener('click', () => this.showFavorites());
        }
        
        // Модальные окна
        const successOkBtn = document.getElementById('success-ok-btn');
        if (successOkBtn) {
            successOkBtn.addEventListener('click', () => this.hideModal('success'));
        }
        
        const closePhotoModal = document.getElementById('close-photo-modal');
        if (closePhotoModal) {
            closePhotoModal.addEventListener('click', () => this.hideModal('photo'));
        }
        
        // Загрузка фото
        const galleryBtn = document.getElementById('gallery-btn');
        if (galleryBtn) {
            galleryBtn.addEventListener('click', () => this.uploadPhotoFromGallery());
        }
    }
    
    showScreen(screenName) {
        // Скрываем все экраны
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Показываем нужный экран
        const screenElement = document.getElementById(`${screenName}-screen`);
        if (screenElement) {
            screenElement.classList.remove('hidden');
            this.currentScreen = screenName;
            
            // Загружаем данные для экрана
            if (screenName === 'favorites') {
                this.loadFavorites();
            } else if (screenName === 'my-ads') {
                this.loadMyAds();
            }
        }
    }
    
    async filterByCategory(category) {
        this.selectedCategory = category;
        
        // Обновляем активную кнопку категории
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.category === category) {
                btn.classList.add('active');
            }
        });
        
        await this.loadAds(category, true);
        this.showScreen('main');
    }
    
    async searchAds(query) {
        if (!query.trim()) {
            await this.loadAds(this.selectedCategory, true);
            return;
        }
        
        try {
            let url = `/api/ads?search=${encodeURIComponent(query)}&limit=${this.limit}`;
            if (this.selectedCategory) {
                url += `&category=${encodeURIComponent(this.selectedCategory)}`;
            }
            
            const response = await fetch(url);
            if (response.ok) {
                this.ads = await response.json();
                this.updateAdsUI();
            }
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }
    
    async showAdDetail(adId) {
        try {
            const response = await fetch(`/api/ad/${adId}`);
            if (response.ok) {
                const ad = await response.json();
                this.updateAdDetailUI(ad);
                this.showScreen('ad-detail');
            }
        } catch (error) {
            console.error('Ошибка загрузки объявления:', error);
        }
    }
    
    updateAdDetailUI(ad) {
        // Заголовок
        const titleElement = document.getElementById('ad-detail-title');
        if (titleElement) titleElement.textContent = ad.title;
        
        // Цена
        const priceElement = document.getElementById('ad-price-detail');
        if (priceElement) priceElement.textContent = `${ad.price}₽`;
        
        // Категория
        const categoryElement = document.getElementById('ad-category-detail');
        if (categoryElement) {
            categoryElement.textContent = this.categories[ad.category] || ad.category;
        }
        
        // Просмотры
        const viewsElement = document.getElementById('ad-views');
        if (viewsElement) {
            viewsElement.textContent = `${ad.views} просмотров`;
        }
        
        // Дата
        const dateElement = document.getElementById('ad-date');
        if (dateElement) {
            const date = new Date(ad.created_at);
            dateElement.textContent = date.toLocaleDateString('ru-RU');
        }
        
        // Описание
        const descriptionElement = document.getElementById('ad-description-detail');
        if (descriptionElement) {
            descriptionElement.textContent = ad.description || 'Нет описания';
        }
        
        // Местоположение
        const locationElement = document.getElementById('ad-location-detail');
        if (locationElement) {
            locationElement.textContent = ad.location || 'Не указано';
        }
        
        // Галерея фото
        const galleryElement = document.getElementById('ad-gallery');
        if (galleryElement) {
            galleryElement.innerHTML = '';
            
            if (ad.photos && ad.photos.length > 0) {
                ad.photos.forEach(photoUrl => {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'gallery-image';
                    imgContainer.innerHTML = `
                        <img src="${photoUrl}" alt="${ad.title}" 
                             onerror="this.src='https://via.placeholder.com/300x200/7B1FA2/FFFFFF?text=Vape'">
                    `;
                    galleryElement.appendChild(imgContainer);
                });
            } else {
                galleryElement.innerHTML = `
                    <div class="gallery-image">
                        <img src="https://via.placeholder.com/300x200/7B1FA2/FFFFFF?text=Нет+фото" alt="Нет фото">
                    </div>
                `;
            }
        }
        
        // Информация о продавце
        const sellerNameElement = document.getElementById('seller-name');
        if (sellerNameElement) {
            sellerNameElement.textContent = ad.first_name || 'Продавец';
        }
        
        // Кнопка связи с продавцом
        const contactBtn = document.getElementById('contact-seller-btn');
        if (contactBtn && ad.username) {
            contactBtn.onclick = () => {
                window.open(`https://t.me/${ad.username}`, '_blank');
            };
        } else if (contactBtn && ad.telegram_id) {
            contactBtn.onclick = () => {
                window.open(`tg://user?id=${ad.telegram_id}`, '_blank');
            };
        }
        
        // Кнопка избранного
        const favoriteBtn = document.getElementById('ad-favorite-btn');
        if (favoriteBtn && this.currentUser) {
            favoriteBtn.onclick = () => this.toggleFavorite(ad.id, favoriteBtn);
        }
    }
    
    async toggleFavorite(adId, buttonElement) {
        if (!this.currentUser) {
            this.showScreen('profile');
            return;
        }
        
        try {
            const response = await fetch('/api/toggle_favorite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.currentUser.telegram_id,
                    ad_id: adId
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (buttonElement) {
                    const icon = buttonElement.querySelector('i');
                    if (icon) {
                        icon.className = result.is_favorite 
                            ? 'fas fa-heart' 
                            : 'far fa-heart';
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка добавления в избранное:', error);
        }
    }
    
    async loadFavorites() {
        if (!this.currentUser) {
            this.showScreen('profile');
            return;
        }
        
        try {
            const response = await fetch(`/api/user_favorites/${this.currentUser.telegram_id}`);
            if (response.ok) {
                const favorites = await response.json();
                this.updateFavoritesUI(favorites);
            }
        } catch (error) {
            console.error('Ошибка загрузки избранного:', error);
        }
    }
    
    updateFavoritesUI(favorites) {
        const container = document.getElementById('favorites-list');
        if (!container) return;
        
        if (favorites.length === 0) {
            container.innerHTML = `
                <div class="no-favorites">
                    <i class="far fa-heart"></i>
                    <p>В избранном пока ничего нет</p>
                    <button class="secondary-btn" onclick="app.showScreen('main')">
                        Перейти к объявлениям
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        favorites.forEach(ad => {
            const adItem = document.createElement('div');
            adItem.className = 'favorite-item';
            adItem.innerHTML = `
                <div class="favorite-image">
                    <img src="${ad.photos && ad.photos.length > 0 ? ad.photos[0] : 'https://via.placeholder.com/100x100/7B1FA2/FFFFFF?text=Vape'}" 
                         alt="${ad.title}">
                </div>
                <div class="favorite-info">
                    <h4>${ad.title}</h4>
                    <div class="favorite-price">${ad.price}₽</div>
                    <div class="favorite-category">${this.categories[ad.category] || ad.category}</div>
                </div>
                <button class="remove-favorite-btn" data-id="${ad.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // Клик на объявление
            adItem.querySelector('.favorite-info').addEventListener('click', () => {
                this.showAdDetail(ad.id);
            });
            
            // Кнопка удаления из избранного
            const removeBtn = adItem.querySelector('.remove-favorite-btn');
            removeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleFavorite(ad.id, null);
                adItem.remove();
                
                // Если список пуст, показываем сообщение
                if (container.children.length === 0) {
                    this.updateFavoritesUI([]);
                }
            });
            
            container.appendChild(adItem);
        });
    }
    
    async loadMyAds() {
        if (!this.currentUser) return;
        
        const user = await this.loadUserData(this.currentUser.telegram_id);
        if (!user) return;
        
        try {
            const response = await fetch(`/api/ads?user_id=${user.id}`);
            if (response.ok) {
                const ads = await response.json();
                this.updateMyAdsUI(ads);
            }
        } catch (error) {
            console.error('Ошибка загрузки моих объявлений:', error);
        }
    }
    
    async loadUserData(telegramId) {
        try {
            const response = await fetch(`/api/user/${telegramId}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
        }
        return null;
    }
    
    updateMyAdsUI(ads) {
        const container = document.getElementById('my-ads-list');
        if (!container) return;
        
        if (ads.length === 0) {
            container.innerHTML = `
                <div class="no-my-ads">
                    <i class="fas fa-box-open"></i>
                    <p>У вас пока нет объявлений</p>
                    <button class="primary-btn" onclick="app.showScreen('create')">
                        Создать первое объявление
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '';
        
        ads.forEach(ad => {
            const adItem = document.createElement('div');
            adItem.className = 'my-ad-item';
            
            const photoUrl = ad.photos && ad.photos.length > 0 
                ? ad.photos[0] 
                : 'https://via.placeholder.com/100x100/7B1FA2/FFFFFF?text=Vape';
            
            adItem.innerHTML = `
                <div class="my-ad-image">
                    <img src="${photoUrl}" alt="${ad.title}">
                </div>
                <div class="my-ad-info">
                    <h4>${ad.title}</h4>
                    <div class="my-ad-price">${ad.price}₽</div>
                    <div class="my-ad-meta">
                        <span>👁 ${ad.views} просмотров</span>
                        <span>${new Date(ad.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                </div>
                <div class="my-ad-actions">
                    <button class="edit-ad-btn" data-id="${ad.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-ad-btn" data-id="${ad.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            // Клик на объявление
            adItem.querySelector('.my-ad-info').addEventListener('click', () => {
                this.showAdDetail(ad.id);
            });
            
            // Кнопка удаления
            const deleteBtn = adItem.querySelector('.delete-ad-btn');
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('Удалить это объявление?')) {
                    await this.deleteAd(ad.id);
                    adItem.remove();
                    
                    // Если список пуст, обновляем UI
                    if (container.children.length === 0) {
                        this.updateMyAdsUI([]);
                    }
                }
            });
            
            container.appendChild(adItem);
        });
    }
    
    async deleteAd(adId) {
        if (!this.currentUser) return false;
        
        try {
            const response = await fetch('/api/delete_ad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: this.currentUser.telegram_id,
                    ad_id: adId
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                return result.success;
            }
        } catch (error) {
            console.error('Ошибка удаления объявления:', error);
        }
        return false;
    }
    
    showPhotoModal() {
        this.showModal('photo');
    }
    
    showModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        const overlay = document.getElementById('modal-overlay');
        
        if (modal && overlay) {
            modal.classList.remove('hidden');
            overlay.classList.remove('hidden');
        }
    }
    
    hideModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        const overlay = document.getElementById('modal-overlay');
        
        if (modal && overlay) {
            modal.classList.add('hidden');
            overlay.classList.add('hidden');
        }
    }
    
    async uploadPhotoFromGallery() {
        // В реальном приложении здесь будет вызов API загрузки файлов
        // Для демо используем заглушку
        
        this.hideModal('photo');
        
        // Добавляем заглушечное фото
        this.addPhoto('https://via.placeholder.com/400x300/7B1FA2/FFFFFF?text=Vape+Photo');
    }
    
    addPhoto(url) {
        if (this.photos.length >= 5) {
            alert('Максимум 5 фотографий');
            return;
        }
        
        this.photos.push(url);
        this.updatePhotosPreview();
    }
    
    updatePhotosPreview() {
        const container = document.getElementById('photos-preview');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.photos.forEach((photoUrl, index) => {
            const preview = document.createElement('div');
            preview.className = 'photo-preview';
            preview.innerHTML = `
                <img src="${photoUrl}" alt="Фото ${index + 1}">
                <button class="remove-photo" data-index="${index}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            preview.querySelector('.remove-photo').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removePhoto(index);
            });
            
            container.appendChild(preview);
        });
    }
    
    removePhoto(index) {
        this.photos.splice(index, 1);
        this.updatePhotosPreview();
    }
    
    async publishAd() {
        if (!this.currentUser) {
            alert('Пожалуйста, войдите в систему');
            return;
        }
        
        // Получаем данные из формы
        const title = document.getElementById('ad-title').value.trim();
        const category = document.getElementById('ad-category').value;
        const price = parseFloat(document.getElementById('ad-price').value);
        const location = document.getElementById('ad-location').value.trim();
        const description = document.getElementById('ad-description').value.trim();
        const contact = document.querySelector('input[name="contact"]:checked').value;
        
        // Валидация
        if (!title) {
            alert('Введите название товара');
            return;
        }
        
        if (!category) {
            alert('Выберите категорию');
            return;
        }
        
        if (!price || price <= 0) {
            alert('Введите корректную цену');
            return;
        }
        
        // Подготовка данных
        const adData = {
            user_id: this.currentUser.telegram_id,
            title: title,
            description: description,
            price: price,
            category: category,
            photos: this.photos,
            location: location,
            contact_preference: contact
        };
        
        try {
            const response = await fetch('/api/create_ad', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(adData)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Сброс формы
                    this.resetForm();
                    
                    // Показать сообщение об успехе
                    this.showModal('success');
                    
                    // Обновить список объявлений
                    await this.loadAds(this.selectedCategory, true);
                }
            } else {
                const error = await response.json();
                alert(`Ошибка: ${error.error}`);
            }
        } catch (error) {
            console.error('Ошибка публикации объявления:', error);
            alert('Ошибка при публикации объявления');
        }
    }
    
    resetForm() {
        document.getElementById('ad-title').value = '';
        document.getElementById('ad-category').value = '';
        document.getElementById('ad-price').value = '';
        document.getElementById('ad-location').value = '';
        document.getElementById('ad-description').value = '';
        document.getElementById('char-count').textContent = '0';
        
        this.photos = [];
        this.updatePhotosPreview();
    }
    
    async loadMoreAds() {
        await this.loadAds(this.selectedCategory, false);
    }
}

// Инициализация приложения
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new VapeMarketplace();
});

// Делаем приложение доступным глобально
window.app = app;
