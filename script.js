document.addEventListener('DOMContentLoaded', () => {
    // 🚨🚨🚨 УБЕДИТЕСЬ, ЧТО ЗДЕСЬ ВАШ ПРАВИЛЬНЫЙ URL ОТ CLOUDFLARE 🚨🚨🚨
    const WORKER_URL = 'https://crm-facebook.brelok2023.workers.dev';

    // --- Основные элементы страницы ---
    const form = document.getElementById('crmOrderForm');
    const productList = document.getElementById('productList');
    const sendButton = document.getElementById('sendOrderBtn');
    const statusMessage = document.getElementById('statusMessage');
    const totalSummaryEl = document.getElementById('totalSummary');
    const extraChargeInput = document.getElementById('extraCharge');
    const orderCommentInput = document.getElementById('orderComment');
    const paymentOptions = document.querySelector('.radio-group');
    const customPrepaymentInput = document.getElementById('customPrepaymentAmount');
    const customPrepaymentRadio = document.getElementById('payment-custom');

    if (!totalSummaryEl) {
        alert("КРИТИЧЕСКАЯ ОШИБКА: Элемент с id 'totalSummary' не найден!");
        return;
    }

    // --- ЕДИНСТВЕННЫЙ И ПРАВИЛЬНЫЙ СПИСОК ТОВАРОВ ---
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

    // --- Функции управления интерфейсом ---
    function setupEventListeners() {
        productList.addEventListener('click', handleProductInteraction);
        productList.addEventListener('change', handleProductInteraction);
        extraChargeInput.addEventListener('input', updateTotalSummary);
        paymentOptions.addEventListener('change', (e) => {
            if (e.target.name === 'paymentMethod') {
                if (customPrepaymentRadio.checked) {
                    customPrepaymentInput.disabled = false;
                    customPrepaymentInput.focus();
                } else {
                    customPrepaymentInput.disabled = true;
                    customPrepaymentInput.value = '';
                }
            }
        });
    }

    function handleProductInteraction(e) {
        const item = e.target.closest('.product-item');
        if (!item) return;
        const checkbox = item.querySelector('.product-checkbox');
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

    // --- Функция отправки формы ---
    async function submitForm(e) {
        e.preventDefault();
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Відправка...';
        statusMessage.textContent = '';

        const clientFacebook = document.getElementById('clientFacebook').value.trim();
        const isUrgent = document.getElementById('isUrgent').checked;
        const mainItems = [], extraItems = [];
        
        document.querySelectorAll('.product-item.selected').forEach(item => {
            const info = PRODUCT_MAP[item.dataset.id];
            const qty = parseInt(item.querySelector('.quantity-select').value);
            const arr = Array(qty).fill(info.name);
            if (info.is_main) mainItems.push(...arr);
            else extraItems.push(...arr);
        });

        const paymentMethodRadio = form.querySelector('input[name="paymentMethod"]:checked');
        if (!clientFacebook || !paymentMethodRadio) {
            showError('Будь ласка, заповніть Нік та оберіть метод оплати.');
            return;
        }

        let prepaymentAmount = 0;
        const totalAmount = parseFloat(totalSummaryEl.textContent.match(/[\d\.]+/)[0]);
        if (paymentMethodRadio.id === 'payment-prepay') prepaymentAmount = 150;
        else if (paymentMethodRadio.id === 'payment-full') prepaymentAmount = totalAmount;
        else if (paymentMethodRadio.id === 'payment-custom') prepaymentAmount = parseFloat(customPrepaymentInput.value) || 0;

        const payload = {
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
                showSuccess(`✅ Замовлення успішно відправлено! Рядок: ${result.row_added}`);
                form.reset();
                document.querySelectorAll('.product-item').forEach(item => updateItemState(item));
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

    // --- Вспомогательные функции для сообщений ---
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

    // --- Инициализация ---
    form.addEventListener('submit', submitForm);
    setupEventListeners();
    updateTotalSummary();
});
