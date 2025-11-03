const API_BASE_URL = 'https://mybudgetapp-production-8c3a.up.railway.app';

function getUserData() {
    const userDataString = localStorage.getItem('myBudgetAppUser');
    if (!userDataString) {
        window.location.href = 'login.html';
        return null;
    }
    return JSON.parse(userDataString);
}

const currentUser = getUserData();
let currentUserId;
if (currentUser) {
    currentUserId = currentUser.UserID;
}

let categoryChart;
let categoriesCache = [];
let walletsCache = [];
let currentTransactionsCache = [];
let editModalInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    
    if (!currentUser) return; 

    const transactionForm = document.getElementById('transaction-form');
    const walletSelect = document.getElementById('wallet-select');
    const categorySelect = document.getElementById('category-select');
    const typeSelect = document.getElementById('type');
    
    const summaryIncomeEl = document.getElementById('summary-income');
    const summaryExpensesEl = document.getElementById('summary-expenses');
    const categoryChartCtx = document.getElementById('categoryChart').getContext('2d');
    const totalBalanceEl = document.getElementById('total-balance');
    
    const addWalletForm = document.getElementById('add-wallet-form');
    const newWalletNameInput = document.getElementById('new-wallet-name');
    const walletsListUl = document.getElementById('wallets-list');
    
    const addCategoryForm = document.getElementById('add-category-form');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const newCategoryTypeSelect = document.getElementById('new-category-type');
    const categoriesListUl = document.getElementById('categories-list');
    
    const logoutButton = document.getElementById('logout-button');
    const userNameDisplay = document.getElementById('user-name-display');
    const themeToggle = document.getElementById('checkbox');
    
    const transactionsTableBody = document.getElementById('transactions-table-body');
    const editModalEl = document.getElementById('editTransactionModal');
    const editTransactionForm = document.getElementById('edit-transaction-form');
    const editTransactionId = document.getElementById('edit-transaction-id');
    const editDateInput = document.getElementById('edit-date');
    const editWalletSelect = document.getElementById('edit-wallet-select');
    const editCategorySelect = document.getElementById('edit-category-select');
    const editTypeSelect = document.getElementById('edit-type');
    const editAmountInput = document.getElementById('edit-amount');
    const editDescriptionInput = document.getElementById('edit-description');
    const editSaveBtn = document.getElementById('edit-save-btn');
    const editDeleteBtn = document.getElementById('edit-delete-btn');
    
    if (!editModalEl) {
        console.error("Помилка: Модальне вікно 'editTransactionModal' не знайдено.");
        return;
    }
    editModalInstance = new bootstrap.Modal(editModalEl);

    userNameDisplay.textContent = currentUser.Name;

    transactionForm.addEventListener('submit', handleAddTransaction);
    logoutButton.addEventListener('click', handleLogout);
    categorySelect.addEventListener('change', onCategoryChange);
    addWalletForm.addEventListener('submit', handleAddWallet);
    walletsListUl.addEventListener('click', handleDeleteWallet);
    themeToggle.addEventListener('change', handleThemeToggle);
    
    addCategoryForm.addEventListener('submit', handleAddCategory);
    categoriesListUl.addEventListener('click', handleDeleteCategory);
    
    transactionsTableBody.addEventListener('click', handleOpenEditModal);
    editSaveBtn.addEventListener('click', handleSaveTransaction);
    editDeleteBtn.addEventListener('click', handleDeleteTransactionFromModal);
    editCategorySelect.addEventListener('change', onEditCategoryChange);
    
    function loadAllData() {
        loadWallets();
        loadCategories();
        loadDashboardReport();
        loadTransactions();
    }

    function setupTheme() {
        const currentTheme = localStorage.getItem('myBudgetAppTheme');
        if (currentTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            themeToggle.checked = true;
        } else {
            document.body.setAttribute('data-theme', 'light');
            themeToggle.checked = false;
        }
        
        if (categoryChart) {
            loadDashboardReport();
        }
    }

    function handleThemeToggle() {
        if (themeToggle.checked) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('myBudgetAppTheme', 'dark');
        } else {
            document.body.setAttribute('data-theme', 'light');
            localStorage.setItem('myBudgetAppTheme', 'light');
        }
        loadDashboardReport(); 
    }

    function handleLogout() {
        localStorage.removeItem('myBudgetAppUser');
        window.location.href = 'login.html';
    }

    async function loadWallets() {
        try {
            const response = await fetch(`${API_BASE_URL}/wallets/${currentUserId}`);
            if (!response.ok) throw new Error('Помилка завантаження гаманців');
            
            walletsCache = await response.json();
            
            walletSelect.innerHTML = ''; 
            walletsListUl.innerHTML = '';

            if (walletsCache.length === 0) {
                const msg = '<option value="">Створіть гаманець</option>';
                walletSelect.innerHTML = msg;
                walletsListUl.innerHTML = '<li class="list-group-item">У вас ще немає гаманців</li>';
                return;
            }

            walletsCache.forEach(wallet => {
                const balance = Number(wallet.Balance || 0).toFixed(2);

                const option = document.createElement('option');
                option.value = wallet.WalletID;
                option.textContent = `${wallet.Name} (${balance} грн)`;
                walletSelect.appendChild(option);
                
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.textContent = `${wallet.Name} (${balance} грн)`;
                li.innerHTML += ` <button class="btn btn-danger btn-sm delete-wallet-btn" data-wallet-id="${wallet.WalletID}">Видалити</button>`;
                walletsListUl.appendChild(li);
            });
        } catch (error) {
            console.error(error);
            walletSelect.innerHTML = '<option value="">Помилка</option>';
            walletsListUl.innerHTML = '<li class="list-group-item text-danger">Помилка завантаження</li>';
        }
    }

    async function handleAddWallet(event) {
        event.preventDefault();
        const newName = newWalletNameInput.value.trim();
        if (!newName) return;

        try {
            const response = await fetch(`${API_BASE_URL}/wallets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ UserID: currentUserId, Name: newName })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Не вдалося додати гаманець');
            }
            
            newWalletNameInput.value = '';
            loadWallets();
            
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    async function handleDeleteWallet(event) {
        if (!event.target.classList.contains('delete-wallet-btn')) {
            return;
        }
        
        const walletId = event.target.dataset.walletId;
        
        if (!confirm('Ви впевнені, що хочете видалити цей гаманець? УСІ транзакції в ньому будуть видалені!')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/wallets/${walletId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Не вдалося видалити гаманець');
            }
            
            loadWallets();
            loadDashboardReport();
            loadTransactions(); 
            
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/categories/${currentUserId}`);
            if (!response.ok) throw new Error('Помилка завантаження категорій');
            
            categoriesCache = await response.json(); 
            
            categorySelect.innerHTML = ''; 
            categoriesListUl.innerHTML = '';

            if (categoriesCache.length === 0) {
                const msg = '<option value="">Створіть категорію</option>';
                categorySelect.innerHTML = msg;
                categoriesListUl.innerHTML = '<li class="list-group-item">У вас ще немає категорій</li>';
                return;
            }

            categoriesCache.forEach(category => {
                const option = document.createElement('option');
                option.value = category.CategoryID;
                option.textContent = category.Name;
                categorySelect.appendChild(option);
                
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.textContent = `${category.Name} (${category.Type})`;
                li.innerHTML += ` <button class="btn btn-danger btn-sm delete-category-btn" data-category-id="${category.CategoryID}">Видалити</button>`;
                categoriesListUl.appendChild(li);
            });
            
            onCategoryChange(); 

        } catch (error) {
            console.error(error);
            categorySelect.innerHTML = '<option value="">Помилка</option>';
            categoriesListUl.innerHTML = '<li class="list-group-item text-danger">Помилка завантаження</li>';
        }
    }

    function onCategoryChange() {
        const selectedCategoryId = categorySelect.value;
        const selectedCategory = categoriesCache.find(c => c.CategoryID == selectedCategoryId);
        
        if (selectedCategory) {
            typeSelect.value = selectedCategory.Type;
        }
    }

    async function handleAddCategory(event) {
        event.preventDefault();
        
        const newName = newCategoryNameInput.value.trim();
        const newType = newCategoryTypeSelect.value;
        if (!newName) return;

        try {
            const response = await fetch(`${API_BASE_URL}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ UserID: currentUserId, Name: newName, Type: newType })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Не вдалося додати категорію');
            }
            
            newCategoryNameInput.value = '';
            loadCategories();
            
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    async function handleDeleteCategory(event) {
        if (!event.target.classList.contains('delete-category-btn')) {
            return;
        }
        
        const categoryId = event.target.dataset.categoryId;
        
        if (!confirm('Ви впевнені, що хочете видалити цю категорію?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Не вдалося видалити категорію');
            }
            
            loadCategories();
            loadDashboardReport();
            loadTransactions();
            
        } catch (error) {
            console.error(error);
            alert(error.message);
        }
    }

    async function handleAddTransaction(event) {
        event.preventDefault(); 

        if (!walletSelect.value || !categorySelect.value) {
            alert("Будь ласка, створіть гаманець та категорію перед додаванням транзакції.");
            return;
        }

        const transactionData = {
            UserID: currentUserId,
            WalletID: walletSelect.value,
            CategoryID: categorySelect.value,
            Amount: document.getElementById('amount').value,
            Type: typeSelect.value,
            Description: document.getElementById('description').value
        };

        if (!navigator.onLine) {
            alert("Немає інтернет-з'єднання. Спробуйте пізніше.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/transactions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Помилка при додаванні транзакції');
            }

            transactionForm.reset();
            onCategoryChange();
            
            loadDashboardReport();
            loadWallets();
            loadTransactions();

        } catch (error) {
            console.error('Помилка:', error);
            alert(error.message);
        }
    }

    async function loadDashboardReport() {
        if (!navigator.onLine) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/dashboard/${currentUserId}`);
            if (!response.ok) throw new Error('Помилка завантаження звіту');
            
            const data = await response.json();
            
            totalBalanceEl.textContent = `${Number(data.totalBalance || 0).toFixed(2)} грн`;
            summaryIncomeEl.textContent = (data.summary.TotalIncome || '0.00');
            summaryExpensesEl.textContent = (data.summary.TotalExpenses || '0.00');

            const labels = data.categoryBreakdown.map(c => c.Name);
            const values = data.categoryBreakdown.map(c => Number(c.Total));

            if (categoryChart) {
                categoryChart.destroy();
            }
            
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            const chartTextColor = isDark ? '#f8f9fa' : '#212529';
            const chartBorderColor = isDark ? '#495057' : '#dee2e6';

            categoryChart = new Chart(categoryChartCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Витрати',
                        data: values,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 206, 86, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                            'rgba(153, 102, 255, 0.8)',
                            'rgba(255, 159, 64, 0.8)'
                        ],
                        hoverOffset: 4,
                        borderWidth: 2,
                        borderColor: chartBorderColor
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            labels: {
                                color: chartTextColor
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error(error);
        }
    }

    async function loadTransactions() {
        try {
            const response = await fetch(`${API_BASE_URL}/transactions/${currentUserId}`);
            if (!response.ok) throw new Error('Помилка завантаження транзакцій');
            
            currentTransactionsCache = await response.json();
            renderTransactions(currentTransactionsCache);
            
        } catch (error) {
            console.error(error);
            transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-danger text-center">Помилка завантаження історії</td></tr>`;
        }
    }

    function renderTransactions(transactions) {
        transactionsTableBody.innerHTML = '';
        
        if (transactions.length === 0) {
            transactionsTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Історія транзакцій порожня.</td></tr>`;
            return;
        }
        
        transactions.forEach(t => {
            const date = new Date(t.Date);
            const formattedDate = `${date.toLocaleDateString('uk-UA')} <span>${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>`;
            
            const amountClass = t.Type === 'дохід' ? 'text-success' : 'text-danger';
            const amountSign = t.Type === 'дохід' ? '+' : '-';
            const amount = Number(t.Amount).toFixed(2);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${t.CategoryName}</td>
                <td>${t.WalletName}</td>
                <td>${t.Description || ''}</td>
                <td class="text-end ${amountClass}">${amountSign}${amount}</td>
                <td class="text-end">
                    <button class="btn btn-outline-primary btn-sm edit-btn" data-transaction-id="${t.TransactionID}">
                        <i class="bi bi-pencil-fill" data-transaction-id="${t.TransactionID}"></i>
                    </button>
                </td>
            `;
            transactionsTableBody.appendChild(row);
        });
    }

    function handleOpenEditModal(event) {
        const target = event.target;
        if (!target.classList.contains('edit-btn') && !target.classList.contains('bi-pencil-fill')) {
            return;
        }
        
        const transactionId = target.dataset.transactionId;
        const transaction = currentTransactionsCache.find(t => t.TransactionID == transactionId);
        
        if (!transaction) {
            console.error('Транзакцію не знайдено в кеші!');
            return;
        }
        
        editTransactionId.value = transaction.TransactionID;
        
        const localDate = new Date(transaction.Date);
        localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
        editDateInput.value = localDate.toISOString().slice(0, 16);
        
        editAmountInput.value = Number(transaction.Amount).toFixed(2);
        editDescriptionInput.value = transaction.Description || '';
        editTypeSelect.value = transaction.Type;
        
        populateEditSelects(transaction.WalletID, transaction.CategoryID);
        
        editModalInstance.show();
    }

    function populateEditSelects(selectedWalletId, selectedCategoryId) {
        editWalletSelect.innerHTML = '';
        walletsCache.forEach(w => {
            const option = document.createElement('option');
            option.value = w.WalletID;
            option.textContent = w.Name;
            if (w.WalletID == selectedWalletId) {
                option.selected = true;
            }
            editWalletSelect.appendChild(option);
        });
        
        editCategorySelect.innerHTML = '';
        categoriesCache.forEach(c => {
            const option = document.createElement('option');
            option.value = c.CategoryID;
            option.textContent = c.Name;
            if (c.CategoryID == selectedCategoryId) {
                option.selected = true;
            }
            editCategorySelect.appendChild(option);
        });

        onEditCategoryChange();
    }

    function onEditCategoryChange() {
        const selectedCategoryId = editCategorySelect.value;
        const selectedCategory = categoriesCache.find(c => c.CategoryID == selectedCategoryId);
        
        if (selectedCategory) {
            editTypeSelect.value = selectedCategory.Type;
        }
    }

    async function handleSaveTransaction() {
        const transactionId = editTransactionId.value;
        
        const updatedData = {
            WalletID: editWalletSelect.value,
            CategoryID: editCategorySelect.value,
            Amount: editAmountInput.value,
            Type: editTypeSelect.value,
            Description: editDescriptionInput.value,
            Date: editDateInput.value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Помилка оновлення транзакції');
            }
            
            editModalInstance.hide();
            loadAllData();

        } catch (error) {
            console.error('Помилка:', error);
            alert(error.message);
        }
    }

    async function handleDeleteTransactionFromModal() {
        const transactionId = editTransactionId.value;
        
        if (!confirm('Ви впевнені, що хочете видалити цю транзакцію? Гроші повернуться на гаманець.')) {
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Помилка видалення транзакції');
            }
            
            editModalInstance.hide();
            loadAllData();

        } catch (error) {
            console.error('Помилка:', error);
            alert(error.message);
        }
    }
    
    setupTheme(); 
    loadAllData();
});