document.addEventListener('DOMContentLoaded', () => {
    
    // 1. --- ЛОГИКА ВКЛАДОК (TABS) ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // 2. --- НАСТРОЙКИ ---
    const WORKER_URL = 'https://crm-facebook.brelok2023.workers.dev';

    // 3. --- ЭЛЕМЕНТЫ ФОРМЫ ---
    const form = document.getElementById('crmOrderForm');
    const productList = document.getElementById('productList');
    const sendButton = document.getElementById('sendOrderBtn');
    const statusMessage = document.getElementById('statusMessage');
    const totalSummaryEl = document.getElementById('totalSummary');
    const extraChargeInput = document.getElementById('extraCharge');
    const orderCommentInput = document.getElementById('orderComment');
    
    // Элементы для ССЫЛКИ (Новые)
    const linkContainer = document.getElementById('orderLinkContainer');
    const linkInput = document.getElementById('generatedLink');
    const copyBtn = document.getElementById('copyLinkBtn');
    const copyFeedback = document.getElementById('copyFeedback');
    
    // Группа радио-кнопок
    const paymentOptionsContainer = document.querySelector('.radio-group');
    const customPrepaymentInput = document.getElementById('customPrepaymentAmount');
    const customPrepaymentRadio = document.getElementById('payment-custom');

    // 4. --- СПИСОК ТОВАРОВ ---
    const PRODUCT_MAP = {
        // Жетоны
        'p_A': { name: 'ФН', is_main: true },
        'p_B': { name: 'НН', is_main: true },
        'p_C': { name: 'Н', is_main: true },
        'p_D': { name: 'ФФ', is_main: true },
        'p_E': { name: 'Обьед', is_main: true },
        // Допы
        'p_F': { name: 'Ланц1', is_main: false },
        'p_G': { name: 'Ланц2', is_main: false },
        'p_H': { name: 'Ланц3', is_main: false },
        'p_I': { name: 'Бампер', is_main: false },
        'p_J': { name: 'Картон', is_main: false },
        'p_K': { name: 'Пластик', is_main: false },
        'p_L': { name: 'Брелок0', is_main: false },
        
        // Зажигалки
        'p_Zap1': { name: 'ЗапН', is_main: true },
        'p_Zap2': { name: 'ЗапНН', is_main: true },
        'p_Zap3': { name: 'ЗапФН', is_main: true },

        // Браслеты
        'p_Brasl1': { name: 'БрасШкіра', is_main: true }, 
        'p_Brasl2': { name: 'БраслТест2', is_main: true },
        'p_Brasl3': { name: 'БраслТест3', is_main: true },

        // Другое
        'p_Other1': { name: 'ИншеТест1', is_main: true },
        'p_Other2': { name: 'ИншеТест2', is_main: true },
        'p_Other3': { name: 'ИншеТест3', is_main: true },
    };

    // 5. --- СЛУШАТЕЛИ СОБЫТИЙ ---
    function setupEventListeners() {
        productList.addEventListener('click', handleProductInteraction);
        productList.addEventListener('change', handleProductInteraction);
        extraChargeInput.addEventListener('input', updateTotalSummary);
        
        // Логика переключения оплаты
        paymentOptionsContainer.addEventListener('change', (e) => {
            if (e.target.name === 'payment') {
                if (customPrepaymentRadio.checked) {
                    customPrepaymentInput.disabled = false;
                    customPrepaymentInput.focus();
                } else {
                    customPrepaymentInput.disabled = true;
                    customPrepaymentInput.value = '';
                }
            }
        });
        
        // Логика кнопки КОПИРОВАТЬ
        if(copyBtn) {
            copyBtn.addEventListener('click', () => {
                if(!linkInput.value) return;
                
                linkInput.select();
                linkInput.setSelectionRange(0, 99999); // Для мобилок
                
                navigator.clipboard.writeText(linkInput.value).then(() => {
                    copyFeedback.style.display = 'block';
                    setTimeout(() => { copyFeedback.style.display = 'none'; }, 2000);
                });
            });
        }
    }

    // Обработка кликов по товарам
    function handleProductInteraction(e) {
        const item = e.target.closest('.product-item');
        if (!item) return;
        const checkbox = item.querySelector('.product-checkbox');
        
        // Если клик не по селекту количества, переключаем чекбокс
        if (e.type === 'click' && !e.target.closest('.quantity-select')) {
            checkbox.checked = !checkbox.checked;
        }
        updateItemState(item);
        updateTotalSummary();
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
            total += (parseFloat(item.dataset.price) * parseInt(item.querySelector('.quantity-select').value));
            hasItems = true;
        });
        total += parseFloat(extraChargeInput.value) || 0;
        totalSummaryEl.textContent = `Загальна Сума: ${total.toFixed(2)} грн`;
        sendButton.disabled = !hasItems;
    }

    // --- ГЕНЕРАТОР УНИКАЛЬНОГО ID ЗАКАЗА ---
    function generateOrderId() {
        return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    }

    // 6. --- ОТПРАВКА ФОРМЫ ---
    async function submitForm(e) {
        e.preventDefault();
        
        // Скрываем прошлую ссылку при новой отправке
        if(linkContainer) linkContainer.style.display = 'none';
        
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Відправка...';
        statusMessage.textContent = '';

        const clientFacebook = document.getElementById('clientFacebook').value.trim();
        const markRedCheckbox = document.getElementById('markRed');
        const isUrgent = markRedCheckbox ? markRedCheckbox.checked : false;

        const mainItems = [], extraItems = [];
        document.querySelectorAll('.product-item.selected').forEach(item => {
            const info = PRODUCT_MAP[item.dataset.id];
            const qty = parseInt(item.querySelector('.quantity-select').value);
            const arr = Array(qty).fill(info.name);
            if (info.is_main) mainItems.push(...arr);
            else extraItems.push(...arr);
        });

        const paymentMethodRadio = form.querySelector('input[name="payment"]:checked');

        if (!clientFacebook || !paymentMethodRadio) {
            showError('Будь ласка, заповніть Нік та оберіть метод оплати.');
            return;
        }

        let prepaymentAmount = 0;
        const totalAmount = parseFloat(totalSummaryEl.textContent.match(/[\d\.]+/)[0]);
        
        if (paymentMethodRadio.id === 'payment-prepay150') {
            prepaymentAmount = 150;
        } else if (paymentMethodRadio.id === 'payment-prepay250') {
            prepaymentAmount = 250;
        } else if (paymentMethodRadio.id === 'payment-full') {
            prepaymentAmount = totalAmount;
        } else if (paymentMethodRadio.id === 'payment-custom') {
            prepaymentAmount = parseFloat(customPrepaymentInput.value) || 0;
        }

        // Генерируем ID
        const currentOrderId = generateOrderId();

        const payload = {
            order_id: currentOrderId, 
            Ник: clientFacebook,
            isUrgent: isUrgent,      
            Заказ_жетон: mainItems.join('+') || '-',
            Доп_товары: extraItems.join('+') || '-',
            Предоплата: prepaymentAmount,
            extraCharge: parseFloat(extraChargeInput.value) || 0,
            comment: orderCommentInput.value.trim()
        };

        try {
            const response = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            
            if (result.status === 'success') {
                showSuccess(`✅ Заказ ID: ${currentOrderId} створено!`); 
                
                // --- ЛОГИКА ОТОБРАЖЕНИЯ ССЫЛКИ ---
                if(linkContainer && linkInput) {
                    const fullLink = `https://dostavkagravochka.github.io/index.html?id=${currentOrderId}`;
                    linkInput.value = fullLink;
                    linkContainer.style.display = 'block'; // Показываем блок
                }
                
                form.reset();
                document.querySelectorAll('.product-item').forEach(item => {
                    item.querySelector('.product-checkbox').checked = false; 
                    updateItemState(item);
                });
                
                if(markRedCheckbox) markRedCheckbox.checked = false;
                updateTotalSummary();
                customPrepaymentInput.disabled = true;

            } else {
                showError(`❌ Помилка: ${result.message || 'Невідома помилка сервера.'}`);
            }
        } catch (error) {
            console.error('Ошибка отправки:', error);
            showError(`❌ Критична помилка з'єднання: ${error.message}`);
        }
    }

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
        sendButton.innerHTML = '<i class="fas fa-check"></i> Замовлення відправлено';
        setTimeout(() => { 
            // Возвращаем кнопку в исходное состояние через 5 сек
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
        }, 5000);
    }

    form.addEventListener('submit', submitForm);
    setupEventListeners();
    updateTotalSummary();
});
