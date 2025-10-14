document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('crmOrderForm');
    const productList = document.getElementById('productList');
    const totalSummaryEl = document.getElementById('totalSummary');
    
    // ------------------------------------------
    // 1. ЛОГІКА ІНТЕРФЕЙСУ (Чекбокс + QTY + Сума)
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
        
        document.querySelectorAll('.product-item').forEach(item => {
            const checkbox = item.querySelector('.product-checkbox');
            
            if (checkbox.checked) {
                const price = parseFloat(item.dataset.price);
                const quantity = parseInt(item.querySelector('.quantity-select').value);
                total += price * quantity;
            }
        });

        totalSummaryEl.textContent = `Загальна Сума: ${total.toFixed(2)} грн`;
    }

    // Ініціалізація при завантаженні
    updateTotalSummary(); 

    // ------------------------------------------
    // 2. ЛОГІКА ВІДПРАВКИ ЗАМОВЛЕННЯ
    // ------------------------------------------

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const sendButton = document.getElementById('sendOrderBtn');
        const statusMessage = document.getElementById('statusMessage');
        
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Відправка...';
        statusMessage.textContent = ''; 

        let clientFacebook = document.getElementById('clientFacebook').value.trim();
        const isUrgent = document.getElementById('isUrgent').checked;
        const paymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value;
        

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

        // Додаємо знак оклику, якщо обрано терміновість
        if (isUrgent) {
            clientFacebook = `! ${clientFacebook}`;
        }


        const cartItems = [];
        document.querySelectorAll('.product-item').forEach(item => {
            const checkbox = item.querySelector('.product-checkbox');
            if (checkbox.checked) {
                const price = parseFloat(item.dataset.price);
                const quantity = parseInt(item.querySelector('.quantity-select').value);
                
                cartItems.push({
                    id: item.dataset.id,
                    name: item.dataset.name,
                    price: price,
                    quantity: quantity
                });
            }
        });

        if (cartItems.length === 0) {
            statusMessage.textContent = '❌ Оберіть хоча б одну опцію.';
            statusMessage.style.color = 'red';
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> Сформувати Замовлення';
            return;
        }

        // Формування Payload для Cloudflare Worker
        const payload = {
            source: "Facebook CRM", // Нове джерело
            clientName: clientFacebook, // Нік ФБ як основне ім'я
            clientPhone: paymentMethod, // Використовуємо поле телефону для методу оплати
            instagramNickname: clientFacebook, // Використовуємо для таблиці
            deliveryAddress: 'Facebook Direct', 
            // Додаткові поля, які Worker може обробити
            paymentMethod: paymentMethod,
            isUrgent: isUrgent,
            
            cartItems: cartItems
        };

        // --- ТОЧКА ВІДПРАВКИ НА ВАШ WORKER ---
        try {
            const response = await fetch('https://telegram-sender.brelok2023.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.ok) {
                statusMessage.innerHTML = `✅ Замовлення № <b>${data.orderId}</b> успішно відправлено!`;
                statusMessage.style.color = '#007bff';
                form.reset(); // Очищення форми
                // Скидання стану інтерфейсу
                document.querySelectorAll('.product-item').forEach(item => item.classList.remove('selected'));
                document.querySelectorAll('.quantity-select').forEach(select => select.disabled = true);
            } else {
                statusMessage.innerHTML = `❌ Помилка: ${data.error || 'Невідома помилка від Worker.'}`;
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
