// 🚨🚨🚨 КРИТИЧНО: СКОПИРУЙТЕ URL ВАШЕГО НОВОГО WORKER'А ИЗ CLOUDFLARE СЮДА 🚨🚨🚨
const WORKER_URL = 'https://crm-facebook.brelok2023.workers.dev'; 

// Соответствие ID товара на сайте к названию столбца в Google Sheets.
const PRODUCT_SHEET_MAP = {
    'p_A': { name: 'ФН', sheet_col: 'Кол_ФН', is_main: true },
    'p_B': { name: 'НН', sheet_col: 'Кол_НН', is_main: true },
    'p_C': { name: 'Н', sheet_col: 'Кол_Н', is_main: true },
    'p_D': { name: 'ФФ', sheet_col: 'Кол_ФФ', is_main: true },
    'p_E': { name: 'Обьеденить фото', sheet_col: 'Кол_Обьед', is_main: true },
    
    // Дополнительные товары
    'p_F': { name: 'Ланц1', sheet_col: 'Кол_Ланц1', is_main: false },
    'p_G': { name: 'Ланц2', sheet_col: 'Кол_Ланц2', is_main: false },
    'p_H': { name: 'Ланц3', sheet_col: 'Кол_Ланц3', is_main: false },
    'p_I': { name: 'Бампер', sheet_col: 'Кол_Бампер', is_main: false },
    'p_J': { name: 'Картон', sheet_col: 'Кол_Картон', is_main: false },
    'p_K': { name: 'Пластик', sheet_col: 'Кол_Пластик', is_main: false },
    'p_L': { name: 'Брелок (0 грн)', sheet_col: 'Кол_Брелок0', is_main: false },
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('crmOrderForm');
    const productList = document.getElementById('productList');
    const totalSummaryEl = document.getElementById('totalSummary');
    
    // ------------------------------------------
    // 1. ЛОГИКА ИНТЕРФЕЙСА (ВАШ СТАБИЛЬНЫЙ КОД)
    // ------------------------------------------

    // Обробляє клік по всій області товару
    productList.addEventListener('click', (e) => {
        const item = e.target.closest('.product-item');
        if (!item) return;

        const checkbox = item.querySelector('.product-checkbox');
        const select = item.querySelector('.quantity-select');

        // Якщо клікнули не по самому SELECT, перемикаємо чекбокс
        if (!e.target.closest('.quantity-select')) {
            checkbox.checked = !checkbox.checked;
        }

        // Синхронізація стану:
        if (checkbox.checked) {
            item.classList.add('selected');
            select.disabled = false;
        } else {
            item.classList.remove('selected');
            select.disabled = true;
            select.value = '1'; // Скидання кількості
        }

        updateTotalSummary();
    });

    // Обробка зміни кількості
    productList.addEventListener('change', (e) => {
        if (e.target.classList.contains('quantity-select')) {
            updateTotalSummary();
        }
    });

    // Автоматичний розрахунок загальної суми
    function updateTotalSummary() {
        let total = 0;
        let hasItems = false;
        
        document.querySelectorAll('.product-item').forEach(item => {
            const checkbox = item.querySelector('.product-checkbox');
            
            if (checkbox.checked) {
                const price = parseFloat(item.dataset.price);
                const quantity = parseInt(item.querySelector('.quantity-select').value);
                total += price * quantity;
                hasItems = true;
            }
        });

        totalSummaryEl.textContent = `Загальна Сума: ${total.toFixed(2)} грн`;
        
        // Включаємо/виключаємо кнопку відправки на основі наявності товарів
        const sendButton = document.getElementById('sendOrderBtn');
        if (sendButton) {
            sendButton.disabled = !hasItems;
        }
    }

    // Ініціалізація при завантаженні
    updateTotalSummary(); 
    

    // ------------------------------------------
    // 2. ОНОВЛЕНА ЛОГІКА ВІДПРАВКИ В GOOGLE SHEETS
    // ------------------------------------------

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const sendButton = document.getElementById('sendOrderBtn');
        const statusMessage = document.getElementById('statusMessage');
        
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Відправка...';
        statusMessage.textContent = ''; 

        // Збір основних даних з ВАШИХ ID
        let clientFacebook = document.getElementById('clientFacebook').value.trim();
        const isUrgent = document.getElementById('isUrgent').checked;
        const paymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value;
        
        // **ПРОВЕРКИ**
        if (!clientFacebook) {
            statusMessage.textContent = '❌ Будь ласка, вкажіть Нік Facebook.';
            statusMessage.style.color = 'red';
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
            return;
        }
        if (!paymentMethod) {
            statusMessage.textContent = '❌ Оберіть метод оплати.';
            statusMessage.style.color = 'red';
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
            return;
        }

        // Додаємо знак для СРОЧНОСТИ
        if (isUrgent) {
            clientFacebook = `🚨 ${clientFacebook}`;
        }

        // 1. Сбор данных о товарах и формирование полезной нагрузки (payload)
        const selectedProducts = {
            main_items: [], // Для Заказ жетон (D)
            extra_items: [], // Для Доп.товары (E)
            counts: {} // Для Кол.ФН, Кол.НН и т.д. (O-Z)
        };
        
        // Инициализация всех счетчиков товаров
        Object.values(PRODUCT_SHEET_MAP).forEach(p => {
            selectedProducts.counts[p.sheet_col] = 0;
        });

        document.querySelectorAll('.product-item').forEach(item => {
            const checkbox = item.querySelector('.product-checkbox');
            if (checkbox.checked) {
                const productId = item.dataset.id;
                const productInfo = PRODUCT_SHEET_MAP[productId];
                const quantity = parseInt(item.querySelector('.quantity-select').value);
                
                // Формирование текстового описания
                const productText = `${productInfo.name} (${quantity} шт.)`;
                
                if (productInfo.is_main) {
                    selectedProducts.main_items.push(productText);
                } else {
                    selectedProducts.extra_items.push(productText);
                }
                
                // Заполнение счетчиков
                selectedProducts.counts[productInfo.sheet_col] = quantity;
            }
        });

        if (selectedProducts.main_items.length === 0 && selectedProducts.extra_items.length === 0) {
            statusMessage.textContent = '❌ Оберіть хоча б одну опцію.';
            statusMessage.style.color = 'red';
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
            return;
        }


        // Преобразование метода оплаты в формат Google Sheets
        let paymentValue;
        switch (paymentMethod) {
            case 'prepayment':
                paymentValue = 'Предоплата 150 грн';
                break;
            case 'full':
                paymentValue = 'Повна оплата';
                break;
            case 'postpay':
                paymentValue = 'Накладений платіж';
                break;
            default:
                paymentValue = '';
        }
        
        // 2. Формирование Финального Payload для Worker'а (Google Sheets)
        const payload = {
            // Дата будет добавлена Worker'ом
            // Колонка C
            Ник: clientFacebook,
            // Колонка D
            Заказ_жетон: selectedProducts.main_items.join(' + ') || '-',
            // Колонка E
            Доп_товары: selectedProducts.extra_items.join(' + ') || '-',
            // Колонка F
            Предоплата: paymentValue,
            
            // Колонка O до Z (Кол-ть)
            ...selectedProducts.counts,
        };

        // --- ТОЧКА ОТПРАВКИ НА ВАШ НОВЫЙ WORKER (GOOGGLE SHEETS) ---
        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Ожидаем ответ от Apps Script через Worker: {status: 'success', row_added: 42}
            const data = await response.json();

            if (data.status === 'success') {
                statusMessage.innerHTML = `✅ Замовлення успішно відправлено! Рядок: <b>${data.row_added}</b>`;
                statusMessage.style.color = '#007bff';
                form.reset(); 
                
                // Скидання стану інтерфейсу
                document.querySelectorAll('.product-item').forEach(item => item.classList.remove('selected'));
                document.querySelectorAll('.quantity-select').forEach(select => select.disabled = true);
            } else {
                statusMessage.innerHTML = `❌ Помилка при записі в Google Sheets: ${data.message || 'Невідома помилка.'}`;
                statusMessage.style.color = 'red';
            }

        } catch (error) {
            console.error('Ошибка отправки:', error);
            statusMessage.innerHTML = `❌ Критична помилка з'єднання: ${error.message}`;
            statusMessage.style.color = 'red';
        } finally {
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
            updateTotalSummary(); 
            setTimeout(() => statusMessage.innerHTML = '', 5000); 
        }
    });
});
