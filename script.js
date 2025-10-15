document.addEventListener('DOMContentLoaded', () => {
    // 🚨🚨🚨 ВАЖНО: ВСТАВЬТЕ СКОПИРОВАННЫЙ URL ВАШЕГО ВЕБ-ПРИЛОЖЕНИЯ СЮДА 🚨🚨🚨
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxiPNFUj929I4nqkk0m_6PN956y2WiI-6ZaIKxd88qZkJx8eSPUGowrGi3IHP2FgzA4NA/exec';

    // Соответствие ID товара на сайте к кодовому названию в таблице
    const PRODUCT_MAP = {
        'p_A': { name: 'ФН', is_main: true },
        'p_B': { name: 'НН', is_main: true },
        'p_C': { name: 'Н', is_main: true },
        'p_D': { name: 'ФФ', is_main: true },
        'p_E': { name: 'Обьед', is_main: true },
        'p_F': { name: 'Ланц1', is_main: false },
        'p_G': { name: 'Ланц2', is_main: false },
        'p_H': { name: 'Ланц3', is_main: false },
        'p_I': { name: 'Бампер', is_main: false },
        'p_J': { name: 'Картон', is_main: false },
        'p_K': { name: 'Пластик', is_main: false },
        'p_L': { name: 'Брелок0', is_main: false },
    };

    const form = document.getElementById('crmOrderForm');
    const productList = document.getElementById('productList');
    const totalSummaryEl = document.getElementById('totalSummary');
    const sendButton = document.getElementById('sendOrderBtn');
    const statusMessage = document.getElementById('statusMessage');

    // --- Логика интерфейса (без изменений) ---
    function setupEventListeners() {
        productList.addEventListener('click', (e) => {
            const item = e.target.closest('.product-item');
            if (!item) return;
            const checkbox = item.querySelector('.product-checkbox');
            if (!e.target.closest('.quantity-select')) {
                checkbox.checked = !checkbox.checked;
            }
            updateItemState(item);
            updateTotalSummary();
        });
        productList.addEventListener('change', (e) => {
            if (e.target.classList.contains('quantity-select')) {
                updateTotalSummary();
            }
        });
    }

    function updateItemState(item) {
        const checkbox = item.querySelector('.product-checkbox');
        const select = item.querySelector('.quantity-select');
        if (checkbox.checked) {
            item.classList.add('selected');
            select.disabled = false;
        } else {
            item.classList.remove('selected');
            select.disabled = true;
            select.value = '1';
        }
    }

    function updateTotalSummary() {
        let total = 0;
        let hasItems = false;
        document.querySelectorAll('.product-item.selected').forEach(item => {
            const price = parseFloat(item.dataset.price);
            const quantity = parseInt(item.querySelector('.quantity-select').value);
            total += price * quantity;
            hasItems = true;
        });
        totalSummaryEl.textContent = `Загальна Сума: ${total.toFixed(2)} грн`;
        sendButton.disabled = !hasItems;
    }

    // --- ФИНАЛЬНАЯ ЛОГИКА ОТПРАВКИ ФОРМЫ ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Відправка...';
        statusMessage.textContent = '';

        // --- 1. Сбор данных ---
        const clientFacebook = document.getElementById('clientFacebook').value.trim();
        const isUrgent = document.getElementById('isUrgent').checked;
        
        const mainItems = [];
        const extraItems = [];

        document.querySelectorAll('.product-item.selected').forEach(item => {
            const productId = item.dataset.id;
            const productInfo = PRODUCT_MAP[productId];
            const quantity = parseInt(item.querySelector('.quantity-select').value);
            
            // Создаем массив из названий товара, повторенный quantity раз
            const itemsArray = Array(quantity).fill(productInfo.name);
            
            if (productInfo.is_main) {
                mainItems.push(...itemsArray);
            } else {
                extraItems.push(...itemsArray);
            }
        });
        
        const paymentMethodRadio = form.querySelector('input[name="paymentMethod"]:checked');
        if (!clientFacebook || !paymentMethodRadio) {
            showError('Будь ласка, заповніть Нік та оберіть метод оплати.');
            return;
        }

        // --- 2. Расчет Предоплаты ---
        let prepaymentAmount = 0;
        const totalAmountText = totalSummaryEl.textContent;
        const totalAmount = parseFloat(totalAmountText.match(/[\d\.]+/)[0]);
        
        if (paymentMethodRadio.id === 'payment-prepay') {
            prepaymentAmount = 150;
        } else if (paymentMethodRadio.id === 'payment-full') {
            prepaymentAmount = totalAmount;
        }
        
        // --- 3. Формирование Payload для отправки ---
        const payload = {
            Ник: clientFacebook,
            isUrgent: isUrgent, // Отправляем флаг срочности
            Заказ_жетон: mainItems.join('+') || '-',
            Доп_товары: extraItems.join('+') || '-',
            Предоплата: prepaymentAmount,
        };

        // --- 4. Отправка данных ---
        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                // mode: 'no-cors' - Убираем, чтобы получать ответ от сервера
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.status === 'success') {
                showSuccess(`✅ Замовлення успішно відправлено! Рядок: ${result.row_added}`);
                form.reset();
                document.querySelectorAll('.product-item').forEach(item => {
                     item.classList.remove('selected');
                     const select = item.querySelector('.quantity-select');
                     if(select) {
                        select.disabled = true;
                        select.value = '1';
                     }
                });
                updateTotalSummary();
            } else {
                 showError(`❌ Помилка: ${result.message || 'Невідома помилка сервера.'}`);
            }

        } catch (error) {
            console.error('Ошибка отправки:', error);
            showError(`❌ Критична помилка з'єднання: ${error.message}`);
        }
    });

    function showError(message) {
        statusMessage.textContent = message;
        statusMessage.style.color = 'red';
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
    }

    function showSuccess(message) {
        statusMessage.textContent = message;
        statusMessage.style.color = '#007bff';
        sendButton.disabled = false;
        sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
        setTimeout(() => statusMessage.textContent = '', 7000);
    }
    
    // Инициализация
    setupEventListeners();
    updateTotalSummary();
});
