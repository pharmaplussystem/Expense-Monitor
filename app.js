import { supabase } from "./supabaseClient.js";
/**
 * DAILY EXPENSE MANAGER (UGANDA) - MAIN CONTROLLER
 * Currency: Ugandan Shillings (UGX / USh)
 * Real-time Supabase Cloud Integration & Resilient Offline State
 */

// GitHub Pages works from a repository subfolder, not from the domain root.
// Example: /daily-expense-manager-uganda/
const APP_BASE = window.location.pathname.split('/').slice(0, -1).join('/') + '/';
const LOGIN_URL = APP_BASE + 'login.html';
const HOME_URL = APP_BASE + 'index.html';

// Default Uganda Categories
const DEFAULT_UGANDA_CATEGORIES = [
  { id: 'cat-1', name: 'Food', icon: 'utensils', color: '#EF4444', type: 'expense' },
  { id: 'cat-2', name: 'Transport', icon: 'bus', color: '#F59E0B', type: 'expense' },
  { id: 'cat-3', name: 'Rent', icon: 'home', color: '#3B82F6', type: 'expense' },
  { id: 'cat-4', name: 'Utilities', icon: 'zap', color: '#8B5CF6', type: 'expense' },
  { id: 'cat-5', name: 'Airtime', icon: 'phone', color: '#10B981', type: 'expense' },
  { id: 'cat-6', name: 'Internet', icon: 'wifi', color: '#06B6D4', type: 'expense' },
  { id: 'cat-7', name: 'Shopping', icon: 'shopping-bag', color: '#EC4899', type: 'expense' },
  { id: 'cat-8', name: 'Education', icon: 'book-open', color: '#6366F1', type: 'expense' },
  { id: 'cat-9', name: 'Medical', icon: 'activity', color: '#DC2626', type: 'expense' },
  { id: 'cat-10', name: 'Entertainment', icon: 'film', color: '#F97316', type: 'expense' },
  { id: 'cat-11', name: 'Family', icon: 'users', color: '#14B8A6', type: 'expense' },
  { id: 'cat-12', name: 'Business', icon: 'briefcase', color: '#4F46E5', type: 'expense' },
  { id: 'cat-13', name: 'Church/Donations', icon: 'heart', color: '#84CC16', type: 'expense' },
  { id: 'cat-14', name: 'Debt/Loans', icon: 'credit-card', color: '#64748B', type: 'expense' },
  { id: 'cat-15', name: 'Other', icon: 'more-horizontal', color: '#94A3B8', type: 'expense' },
  { id: 'cat-16', name: 'Salary', icon: 'wallet', color: '#10B981', type: 'income' },
  { id: 'cat-17', name: 'Business income', icon: 'trending-up', color: '#059669', type: 'income' },
  { id: 'cat-18', name: 'Freelance income', icon: 'laptop', color: '#0D9488', type: 'income' },
  { id: 'cat-19', name: 'Investment', icon: 'bar-chart-2', color: '#0284C7', type: 'income' },
  { id: 'cat-20', name: 'Gifts', icon: 'gift', color: '#D97706', type: 'income' }
];

// Persistent State initialization
const state = {
  user: null,
  isSupabaseAuthenticated: false,
  currency: 'USh',
  theme: localStorage.getItem('dem_theme') || 'light',
  expenses: JSON.parse(localStorage.getItem('dem_expenses') || 'null') || [],
  income: JSON.parse(localStorage.getItem('dem_income') || 'null') || [],
  budgets: JSON.parse(localStorage.getItem('dem_budgets') || 'null') || [],
  savings: JSON.parse(localStorage.getItem('dem_savings') || 'null') || [],
  debts: JSON.parse(localStorage.getItem('dem_debts') || 'null') || [],
  categories: JSON.parse(localStorage.getItem('dem_categories') || 'null') || [...DEFAULT_UGANDA_CATEGORIES],
  debtTab: 'i_owe',
  charts: {},
  deferredPrompt: null
};

// Format currency in Ugandan Shillings (USh / UGX)
function formatUGX(amount) {
  const num = Number(amount) || 0;
  return 'USh ' + num.toLocaleString('en-US');
}

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Modal management
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    if (window.lucide) window.lucide.createIcons();
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// Read image as base64
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Navigation
function navigate(viewName) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));

  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  const navLink = document.querySelector(`.sidebar-nav [data-view="${viewName}"]`);
  if (navLink) navLink.classList.add('active');

  const mobileNavLink = document.querySelector(`.mobile-bottom-nav [data-view="${viewName}"]`);
  if (mobileNavLink) mobileNavLink.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    expenses: 'Expenses',
    income: 'Income',
    budgets: 'Budgets & Limits',
    savings: 'Savings Goals',
    debts: 'Debt Management',
    reports: 'Reports & Analytics',
    settings: 'Settings'
  };
  const heading = document.getElementById('page-heading');
  if (heading) heading.textContent = titles[viewName] || 'Dashboard';
  window.location.hash = viewName;

  if (viewName === 'reports') {
    renderReports();
  } else if (viewName === 'dashboard') {
    renderDashboard();
  }
}

// Update user badge in sidebar
function updateUserUI(user) {
  const nameEl = document.getElementById('sidebar-user-name');
  const emailEl = document.getElementById('sidebar-user-email');
  const avatarEl = document.getElementById('sidebar-avatar');
  const authBtnText = document.getElementById('auth-btn-text');
  const authBtnIcon = document.getElementById('auth-btn-icon');

  if (user && state.isSupabaseAuthenticated) {
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = user.email || 'Supabase Connected';
    if (avatarEl) avatarEl.textContent = displayName.slice(0, 2).toUpperCase();
    if (authBtnText) authBtnText.textContent = 'Account';
    if (authBtnIcon) authBtnIcon.setAttribute('data-lucide', 'user-cog');
  } else {
    if (nameEl) nameEl.textContent = 'Account Ready';
    if (emailEl) emailEl.textContent = 'Click to connect cloud';
    if (avatarEl) avatarEl.textContent = 'UG';
    if (authBtnText) authBtnText.textContent = 'Sign In / Register';
    if (authBtnIcon) authBtnIcon.setAttribute('data-lucide', 'log-in');
  }
  if (window.lucide) window.lucide.createIcons();
}

// Category Dropdown Population
function populateCategories() {
  const expenseSelect = document.getElementById('expense-category');
  const budgetSelect = document.getElementById('budget-category');
  const filterSelect = document.getElementById('expense-filter-category');
  const settingsList = document.getElementById('settings-categories-list');

  if (expenseSelect) {
    const currentVal = expenseSelect.value;
    expenseSelect.innerHTML = '';
    state.categories.filter(c => c.type === 'expense').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      expenseSelect.appendChild(opt);
    });
    if (currentVal) expenseSelect.value = currentVal;
  }

  if (budgetSelect) {
    const curVal = budgetSelect.value;
    budgetSelect.innerHTML = '<option value="Overall Monthly">Overall Monthly Budget</option>';
    state.categories.filter(c => c.type === 'expense').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      budgetSelect.appendChild(opt);
    });
    if (curVal) budgetSelect.value = curVal;
  }

  if (filterSelect) {
    const curVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All Categories</option>';
    state.categories.filter(c => c.type === 'expense').forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      filterSelect.appendChild(opt);
    });
    if (curVal) filterSelect.value = curVal;
  }

  if (settingsList) {
    settingsList.innerHTML = '';
    state.categories.filter(c => c.type === 'expense').forEach(c => {
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.style.cssText = `background-color: ${c.color || '#0F766E'}20; color: ${c.color || '#0F766E'}; border: 1px solid ${c.color || '#0F766E'}; padding: 0.4rem 0.75rem;`;
      badge.innerHTML = `<span>${c.name}</span>`;
      settingsList.appendChild(badge);
    });
  }
}

// Budget Exceeded Alert Check
function checkBudgetAlerts() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = state.expenses.filter(e => e.date && e.date.startsWith(currentMonth));

  state.budgets.filter(b => b.month_year === currentMonth).forEach(budget => {
    let spent = 0;
    if (budget.category_name === 'Overall Monthly') {
      spent = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    } else {
      spent = monthExpenses.filter(e => e.category_name === budget.category_name).reduce((sum, e) => sum + Number(e.amount), 0);
    }

    const pct = (spent / Number(budget.amount)) * 100;
    if (pct >= 100) {
      showToast(`Warning: Your budget for ${budget.category_name} has been exceeded! (${pct.toFixed(0)}%)`, 'error');
    } else if (pct >= (budget.alert_threshold || 80)) {
      showToast(`Notice: You have used ${pct.toFixed(0)}% of your ${budget.category_name} budget.`, 'warning');
    }
  });
}

function getPaymentBadge(method) {
  if (!method) return 'other';
  if (method.includes('Mobile') || method.includes('MoMo')) return 'momo';
  if (method.includes('Cash')) return 'cash';
  if (method.includes('Bank')) return 'bank';
  if (method.includes('Visa') || method.includes('Card')) return 'card';
  return 'other';
}

// ==============================================================================
// 1. EXPENSE MANAGEMENT - FULLY FUNCTIONAL
// ==============================================================================
function openAddExpenseModal() {
  const title = document.getElementById('modal-expense-title');
  if (title) title.textContent = 'Add Expense';
  const form = document.getElementById('form-expense');
  if (form) form.reset();

  const idInput = document.getElementById('expense-id');
  if (idInput) idInput.value = '';

  const dateInput = document.getElementById('expense-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  const timeInput = document.getElementById('expense-time');
  if (timeInput) {
    const now = new Date();
    timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const preview = document.getElementById('expense-receipt-preview');
  if (preview) {
    preview.src = '';
    preview.style.display = 'none';
  }

  populateCategories();
  openModal('modal-expense');
}

function editExpense(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  const title = document.getElementById('modal-expense-title');
  if (title) title.textContent = 'Edit Expense';

  document.getElementById('expense-id').value = exp.id;
  document.getElementById('expense-amount').value = exp.amount;
  document.getElementById('expense-category').value = exp.category_name;
  document.getElementById('expense-description').value = exp.description;
  document.getElementById('expense-date').value = exp.date;
  document.getElementById('expense-time').value = exp.time || '';
  document.getElementById('expense-payment-method').value = exp.payment_method;
  document.getElementById('expense-location').value = exp.location || '';
  document.getElementById('expense-notes').value = exp.notes || '';

  const preview = document.getElementById('expense-receipt-preview');
  if (exp.receipt_url && preview) {
    preview.src = exp.receipt_url;
    preview.style.display = 'block';
  } else if (preview) {
    preview.style.display = 'none';
  }

  openModal('modal-expense');
}

async function handleExpenseSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const idInput = document.getElementById('expense-id');
  const amountInput = document.getElementById('expense-amount');
  const categorySelect = document.getElementById('expense-category');
  const descInput = document.getElementById('expense-description');
  const dateInput = document.getElementById('expense-date');
  const timeInput = document.getElementById('expense-time');
  const paymentSelect = document.getElementById('expense-payment-method');
  const locationInput = document.getElementById('expense-location');
  const notesInput = document.getElementById('expense-notes');
  const receiptFileInput = document.getElementById('expense-receipt');

  const amount = parseFloat(amountInput.value);
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount in USh.', 'error');
    amountInput.focus();
    return;
  }

  const description = (descInput.value || '').trim();
  if (!description) {
    showToast('Please enter a description for the expense.', 'error');
    descInput.focus();
    return;
  }

  const category_name = categorySelect.value || 'Food';
  const date = dateInput.value || new Date().toISOString().split('T')[0];
  const time = timeInput.value || '12:00';
  const payment_method = paymentSelect.value || 'Cash';
  const location = (locationInput.value || '').trim();
  const notes = (notesInput.value || '').trim();
  const id = idInput.value;

  let receiptUrl = id ? (state.expenses.find(x => x.id === id) || {}).receipt_url : null;
  if (receiptFileInput && receiptFileInput.files && receiptFileInput.files[0]) {
    try {
      receiptUrl = await readFileAsBase64(receiptFileInput.files[0]);
    } catch (err) {
      console.warn('Receipt image read error:', err);
    }
  }

  const expData = {
    id: id || 'exp_' + Date.now(),
    user_id: state.user?.id || 'local_user',
    amount,
    category_name,
    description,
    date,
    time,
    payment_method,
    location,
    notes,
    receipt_url: receiptUrl
  };

  // Immediate Local Persistence
  if (id) {
    const idx = state.expenses.findIndex(x => x.id === id);
    if (idx !== -1) {
      state.expenses[idx] = expData;
    } else {
      state.expenses.unshift(expData);
    }
    showToast('Expense updated successfully.');
  } else {
    state.expenses.unshift(expData);
    showToast('Expense saved successfully.');
  }
  localStorage.setItem('dem_expenses', JSON.stringify(state.expenses));

  // Background Cloud Sync if connected to Supabase
  if (state.isSupabaseAuthenticated && state.user?.id) {
    (async () => {
      try {
        if (id) {
          await supabase.from('expenses').update({
            amount,
            category_name,
            description,
            date,
            time,
            payment_method,
            location,
            notes,
            receipt_url: receiptUrl
          }).eq('id', id).eq('user_id', state.user.id);
        } else {
          const { data: dbData } = await supabase.from('expenses').insert([{
            user_id: state.user.id,
            amount,
            category_name,
            description,
            date,
            time,
            payment_method,
            location,
            notes,
            receipt_url: receiptUrl
          }]).select().single();
          if (dbData && dbData.id) {
            expData.id = dbData.id;
            localStorage.setItem('dem_expenses', JSON.stringify(state.expenses));
          }
        }
      } catch (cloudErr) {
        console.warn('Supabase cloud sync background warning:', cloudErr);
      }
    })();
  }

  closeModal('modal-expense');
  checkBudgetAlerts();
  renderDashboard();
  renderExpenses();
}

// ==============================================================================
// 2. INCOME MANAGEMENT - FULLY FUNCTIONAL
// ==============================================================================
function openAddIncomeModal() {
  const title = document.getElementById('modal-income-title');
  if (title) title.textContent = 'Add Income';
  const form = document.getElementById('form-income');
  if (form) form.reset();

  const idInput = document.getElementById('income-id');
  if (idInput) idInput.value = '';

  const dateInput = document.getElementById('income-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  openModal('modal-income');
}

function editIncome(id) {
  const inc = state.income.find(i => i.id === id);
  if (!inc) return;

  const title = document.getElementById('modal-income-title');
  if (title) title.textContent = 'Edit Income';

  document.getElementById('income-id').value = inc.id;
  document.getElementById('income-amount').value = inc.amount;
  document.getElementById('income-source').value = inc.source;
  document.getElementById('income-description').value = inc.description || '';
  document.getElementById('income-date').value = inc.date;
  document.getElementById('income-payment-method').value = inc.payment_method;
  document.getElementById('income-notes').value = inc.notes || '';

  openModal('modal-income');
}

async function handleIncomeSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const idInput = document.getElementById('income-id');
  const amountInput = document.getElementById('income-amount');
  const sourceSelect = document.getElementById('income-source');
  const descInput = document.getElementById('income-description');
  const dateInput = document.getElementById('income-date');
  const paymentSelect = document.getElementById('income-payment-method');
  const notesInput = document.getElementById('income-notes');

  const amount = parseFloat(amountInput.value);
  if (!amount || isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount in USh.', 'error');
    amountInput.focus();
    return;
  }

  const source = sourceSelect.value || 'Salary';
  const description = (descInput.value || '').trim() || source;
  const date = dateInput.value || new Date().toISOString().split('T')[0];
  const payment_method = paymentSelect.value || 'Cash';
  const notes = (notesInput.value || '').trim();
  const id = idInput.value;

  const incData = {
    id: id || 'inc_' + Date.now(),
    user_id: state.user?.id || 'local_user',
    amount,
    source,
    description,
    date,
    payment_method,
    notes
  };

  // Immediate Local Persistence
  if (id) {
    const idx = state.income.findIndex(x => x.id === id);
    if (idx !== -1) {
      state.income[idx] = incData;
    } else {
      state.income.unshift(incData);
    }
    showToast('Income updated successfully.');
  } else {
    state.income.unshift(incData);
    showToast('Income recorded successfully.');
  }
  localStorage.setItem('dem_income', JSON.stringify(state.income));

  // Background Cloud Sync if connected to Supabase
  if (state.isSupabaseAuthenticated && state.user?.id) {
    (async () => {
      try {
        if (id) {
          await supabase.from('income').update({
            amount,
            source,
            description,
            date,
            payment_method,
            notes
          }).eq('id', id).eq('user_id', state.user.id);
        } else {
          const { data: dbData } = await supabase.from('income').insert([{
            user_id: state.user.id,
            amount,
            source,
            description,
            date,
            payment_method,
            notes
          }]).select().single();
          if (dbData && dbData.id) {
            incData.id = dbData.id;
            localStorage.setItem('dem_income', JSON.stringify(state.income));
          }
        }
      } catch (cloudErr) {
        console.warn('Supabase income sync background warning:', cloudErr);
      }
    })();
  }

  closeModal('modal-income');
  renderDashboard();
  renderIncome();
}

// ==============================================================================
// 3. BUDGETS, SAVINGS, DEBTS, CATEGORIES
// ==============================================================================
function openAddBudgetModal() {
  const form = document.getElementById('form-budget');
  if (form) form.reset();
  document.getElementById('budget-id').value = '';
  document.getElementById('budget-month').value = new Date().toISOString().slice(0, 7);
  populateCategories();
  openModal('modal-budget');
}

function openAddGoalModal() {
  const form = document.getElementById('form-goal');
  if (form) form.reset();
  document.getElementById('goal-id').value = '';
  openModal('modal-goal');
}

function openDepositModal(id, title) {
  document.getElementById('deposit-goal-id').value = id;
  document.getElementById('deposit-goal-name').textContent = title;
  document.getElementById('deposit-amount').value = '';
  openModal('modal-deposit');
}

function openAddDebtModal() {
  const form = document.getElementById('form-debt');
  if (form) form.reset();
  document.getElementById('debt-id').value = '';
  document.getElementById('debt-date').value = new Date().toISOString().split('T')[0];
  openModal('modal-debt');
}

function openDebtPayModal(id, person, balance) {
  document.getElementById('debt-pay-id').value = id;
  document.getElementById('debt-pay-person').textContent = person;
  document.getElementById('debt-pay-balance').textContent = `Remaining Balance: ${formatUGX(balance)}`;
  document.getElementById('debt-payment-amount').value = '';
  openModal('modal-debt-pay');
}

function openAddCategoryModal() {
  const form = document.getElementById('form-category');
  if (form) form.reset();
  openModal('modal-category');
}

function viewReceipt(url) {
  const img = document.getElementById('receipt-full-img');
  if (img) img.src = url;
  openModal('modal-receipt-viewer');
}

// Delete Confirmation
let deleteAction = null;
function confirmDelete(type, id) {
  deleteAction = { type, id };
  openModal('modal-confirm');
}

async function handleDeleteConfirm() {
  if (!deleteAction) return;
  const { type, id } = deleteAction;

  if (type === 'expense') {
    state.expenses = state.expenses.filter(e => e.id !== id);
    localStorage.setItem('dem_expenses', JSON.stringify(state.expenses));
    showToast('Expense deleted.');
    if (state.isSupabaseAuthenticated) supabase.from('expenses').delete().eq('id', id).catch(() => {});
  } else if (type === 'income') {
    state.income = state.income.filter(i => i.id !== id);
    localStorage.setItem('dem_income', JSON.stringify(state.income));
    showToast('Income deleted.');
    if (state.isSupabaseAuthenticated) supabase.from('income').delete().eq('id', id).catch(() => {});
  } else if (type === 'budget') {
    state.budgets = state.budgets.filter(b => b.id !== id);
    localStorage.setItem('dem_budgets', JSON.stringify(state.budgets));
    showToast('Budget deleted.');
    if (state.isSupabaseAuthenticated) supabase.from('budgets').delete().eq('id', id).catch(() => {});
  } else if (type === 'savings') {
    state.savings = state.savings.filter(s => s.id !== id);
    localStorage.setItem('dem_savings', JSON.stringify(state.savings));
    showToast('Savings goal deleted.');
    if (state.isSupabaseAuthenticated) supabase.from('savings_goals').delete().eq('id', id).catch(() => {});
  } else if (type === 'debt') {
    state.debts = state.debts.filter(d => d.id !== id);
    localStorage.setItem('dem_debts', JSON.stringify(state.debts));
    showToast('Debt deleted.');
    if (state.isSupabaseAuthenticated) supabase.from('debts').delete().eq('id', id).catch(() => {});
  }

  closeModal('modal-confirm');
  renderDashboard();
  renderExpenses();
  renderIncome();
  renderBudgets();
  renderSavings();
  renderDebts();
}

// ==============================================================================
// VIEW RENDERERS
// ==============================================================================

// Dashboard
function renderDashboard() {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);

  // 1. Today's Expenses
  const todayExpenses = state.expenses.filter(e => e.date === todayStr);
  const todayTotal = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const elTodayExp = document.getElementById('stat-today-expenses');
  if (elTodayExp) elTodayExp.textContent = formatUGX(todayTotal);

  const elTodayCount = document.getElementById('stat-today-count');
  if (elTodayCount) elTodayCount.textContent = `${todayExpenses.length} transaction${todayExpenses.length === 1 ? '' : 's'} today`;

  // 2. This Month's Expenses
  const monthExpenses = state.expenses.filter(e => e.date && e.date.startsWith(currentMonthStr));
  const monthTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const elMonthExp = document.getElementById('stat-month-expenses');
  if (elMonthExp) elMonthExp.textContent = formatUGX(monthTotal);

  // 3. Total Income (This Month)
  const monthIncome = state.income.filter(i => i.date && i.date.startsWith(currentMonthStr));
  const incomeTotal = monthIncome.reduce((sum, i) => sum + Number(i.amount), 0);
  const elTotalIncome = document.getElementById('stat-total-income');
  if (elTotalIncome) elTotalIncome.textContent = formatUGX(incomeTotal);

  // 4. Current Balance (Cumulative Income - Cumulative Expenses)
  const allIncomeTotal = state.income.reduce((sum, i) => sum + Number(i.amount), 0);
  const allExpenseTotal = state.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const currentBalance = allIncomeTotal - allExpenseTotal;
  const balanceEl = document.getElementById('stat-current-balance');
  if (balanceEl) {
    balanceEl.textContent = formatUGX(currentBalance);
    balanceEl.style.color = currentBalance >= 0 ? '' : 'var(--accent-red)';
  }

  // 5. Budget Remaining
  const overallBudget = state.budgets.find(b => b.category_name === 'Overall Monthly' && b.month_year === currentMonthStr);
  const budgetTarget = overallBudget ? Number(overallBudget.amount) : 0;
  const budgetRemaining = budgetTarget > 0 ? budgetTarget - monthTotal : 0;
  const elBudgetRem = document.getElementById('stat-budget-remaining');
  if (elBudgetRem) elBudgetRem.textContent = formatUGX(budgetRemaining > 0 ? budgetRemaining : 0);

  const budgetPct = budgetTarget > 0 ? Math.min(100, Math.round((monthTotal / budgetTarget) * 100)) : 0;
  const elBudgetPct = document.getElementById('stat-budget-pct');
  if (elBudgetPct) elBudgetPct.textContent = budgetTarget > 0 ? `${budgetPct}% of ${formatUGX(budgetTarget)} used` : 'No monthly limit set';

  // Recent Expenses
  const recent = [...state.expenses].sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00'))).slice(0, 5);
  const tbody = document.getElementById('dashboard-recent-expenses-tbody');
  const mobileContainer = document.getElementById('dashboard-recent-expenses-mobile');
  const emptyState = document.getElementById('dashboard-expenses-empty');

  if (tbody) tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  if (recent.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    recent.forEach(exp => {
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge" style="background-color: #f1f5f9; color: #0f172a;">${exp.category_name}</span></td>
          <td><strong>${exp.description}</strong></td>
          <td><span class="badge badge-${getPaymentBadge(exp.payment_method)}">${exp.payment_method}</span></td>
          <td>${exp.date} ${exp.time || ''}</td>
          <td>${exp.location || '-'}</td>
          <td class="amount-expense">${formatUGX(exp.amount)}</td>
          <td style="text-align: right;">
            <button class="icon-btn" onclick="window.app.editExpense('${exp.id}')" title="Edit"><i data-lucide="edit-2"></i></button>
            <button class="icon-btn" onclick="window.app.confirmDelete('expense', '${exp.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      if (mobileContainer) {
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
          <div class="transaction-header">
            <div class="transaction-category">
              <span>${exp.category_name}</span>
            </div>
            <span class="amount-expense">${formatUGX(exp.amount)}</span>
          </div>
          <div class="transaction-desc">${exp.description}</div>
          <div class="transaction-meta">
            <span>${exp.date} • ${exp.time || ''}</span>
            <span class="badge badge-${getPaymentBadge(exp.payment_method)}">${exp.payment_method}</span>
          </div>
          <div class="transaction-actions">
            <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.editExpense('${exp.id}')">Edit</button>
            <button class="btn-outline-danger" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.confirmDelete('expense', '${exp.id}')">Delete</button>
          </div>
        `;
        mobileContainer.appendChild(card);
      }
    });
  }

  renderDashboardCharts(monthExpenses);
  if (window.lucide) window.lucide.createIcons();
}

function renderDashboardCharts(monthExpenses) {
  const trendCtx = document.getElementById('chart-dashboard-trend');
  if (trendCtx && window.Chart) {
    const days = [];
    const values = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      days.push(d.slice(5));
      const dayTotal = state.expenses.filter(e => e.date === d).reduce((sum, e) => sum + Number(e.amount), 0);
      values.push(dayTotal);
    }

    if (state.charts.dashTrend) state.charts.dashTrend.destroy();
    state.charts.dashTrend = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Spending (UGX)',
          data: values,
          borderColor: '#0F766E',
          backgroundColor: 'rgba(15, 118, 110, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: val => 'USh ' + (val >= 1000 ? (val / 1000) + 'k' : val) }
          }
        }
      }
    });
  }

  const catCtx = document.getElementById('chart-dashboard-categories');
  if (catCtx && window.Chart) {
    const catTotals = {};
    monthExpenses.forEach(e => {
      catTotals[e.category_name] = (catTotals[e.category_name] || 0) + Number(e.amount);
    });

    const labels = Object.keys(catTotals);
    const data = Object.values(catTotals);

    if (state.charts.dashCat) state.charts.dashCat.destroy();
    state.charts.dashCat = new Chart(catCtx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  }
}

// Expenses View
function renderExpenses() {
  const catFilterEl = document.getElementById('expense-filter-category');
  const payFilterEl = document.getElementById('expense-filter-payment');
  const dateFilterEl = document.getElementById('expense-filter-date');
  const sortFilterEl = document.getElementById('expense-sort');
  const searchEl = document.getElementById('global-search');

  const catFilter = catFilterEl ? catFilterEl.value : 'all';
  const payFilter = payFilterEl ? payFilterEl.value : 'all';
  const dateFilter = dateFilterEl ? dateFilterEl.value : 'all';
  const sortFilter = sortFilterEl ? sortFilterEl.value : 'date-desc';
  const query = (searchEl ? searchEl.value : '').toLowerCase().trim();

  let list = [...state.expenses];

  if (query) {
    list = list.filter(e =>
      (e.description || '').toLowerCase().includes(query) ||
      (e.category_name || '').toLowerCase().includes(query) ||
      (e.location && e.location.toLowerCase().includes(query)) ||
      (e.notes && e.notes.toLowerCase().includes(query)) ||
      (e.payment_method || '').toLowerCase().includes(query)
    );
  }

  if (catFilter !== 'all') {
    list = list.filter(e => e.category_name === catFilter);
  }

  if (payFilter !== 'all') {
    list = list.filter(e => e.payment_method === payFilter);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const curMonthStr = todayStr.slice(0, 7);
  if (dateFilter === 'today') {
    list = list.filter(e => e.date === todayStr);
  } else if (dateFilter === 'this_month') {
    list = list.filter(e => e.date && e.date.startsWith(curMonthStr));
  } else if (dateFilter === 'this_year') {
    list = list.filter(e => e.date && e.date.startsWith(todayStr.slice(0, 4)));
  }

  if (sortFilter === 'date-desc') {
    list.sort((a, b) => new Date(b.date + 'T' + (b.time || '00:00')) - new Date(a.date + 'T' + (a.time || '00:00')));
  } else if (sortFilter === 'date-asc') {
    list.sort((a, b) => new Date(a.date + 'T' + (a.time || '00:00')) - new Date(b.date + 'T' + (b.time || '00:00')));
  } else if (sortFilter === 'amount-desc') {
    list.sort((a, b) => Number(b.amount) - Number(a.amount));
  } else if (sortFilter === 'amount-asc') {
    list.sort((a, b) => Number(a.amount) - Number(b.amount));
  }

  const tbody = document.getElementById('expenses-table-tbody');
  const mobileContainer = document.getElementById('expenses-cards-mobile');
  const emptyState = document.getElementById('expenses-empty-state');

  if (tbody) tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  if (list.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    list.forEach(exp => {
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge" style="background-color: #f1f5f9; color: #0f172a;">${exp.category_name}</span></td>
          <td><strong>${exp.description}</strong></td>
          <td><span class="badge badge-${getPaymentBadge(exp.payment_method)}">${exp.payment_method}</span></td>
          <td>${exp.date}</td>
          <td>${exp.time || '-'}</td>
          <td>${exp.location || '-'}</td>
          <td>${exp.receipt_url ? `<button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="window.app.viewReceipt('${exp.receipt_url}')"><i data-lucide="image"></i></button>` : '-'}</td>
          <td class="amount-expense">${formatUGX(exp.amount)}</td>
          <td style="text-align: right;">
            <button class="icon-btn" onclick="window.app.editExpense('${exp.id}')" title="Edit"><i data-lucide="edit-2"></i></button>
            <button class="icon-btn" onclick="window.app.confirmDelete('expense', '${exp.id}')" title="Delete"><i data-lucide="trash-2"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      if (mobileContainer) {
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
          <div class="transaction-header">
            <div class="transaction-category">
              <span>${exp.category_name}</span>
            </div>
            <span class="amount-expense">${formatUGX(exp.amount)}</span>
          </div>
          <div class="transaction-desc">${exp.description}</div>
          <div class="transaction-meta">
            <span>${exp.date} • ${exp.time || ''}</span>
            <span class="badge badge-${getPaymentBadge(exp.payment_method)}">${exp.payment_method}</span>
          </div>
          <div class="transaction-actions">
            ${exp.receipt_url ? `<button class="btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.viewReceipt('${exp.receipt_url}')">Receipt</button>` : ''}
            <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.editExpense('${exp.id}')">Edit</button>
            <button class="btn-outline-danger" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.confirmDelete('expense', '${exp.id}')">Delete</button>
          </div>
        `;
        mobileContainer.appendChild(card);
      }
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

// Income View
function renderIncome() {
  const tbody = document.getElementById('income-table-tbody');
  const mobileContainer = document.getElementById('income-cards-mobile');
  const emptyState = document.getElementById('income-empty-state');

  if (tbody) tbody.innerHTML = '';
  if (mobileContainer) mobileContainer.innerHTML = '';

  if (state.income.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    state.income.forEach(inc => {
      if (tbody) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge badge-cash">${inc.source}</span></td>
          <td><strong>${inc.description || inc.source}</strong></td>
          <td><span class="badge badge-${getPaymentBadge(inc.payment_method)}">${inc.payment_method}</span></td>
          <td>${inc.date}</td>
          <td>${inc.notes || '-'}</td>
          <td class="amount-income">${formatUGX(inc.amount)}</td>
          <td style="text-align: right;">
            <button class="icon-btn" onclick="window.app.editIncome('${inc.id}')"><i data-lucide="edit-2"></i></button>
            <button class="icon-btn" onclick="window.app.confirmDelete('income', '${inc.id}')"><i data-lucide="trash-2"></i></button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      if (mobileContainer) {
        const card = document.createElement('div');
        card.className = 'transaction-card';
        card.innerHTML = `
          <div class="transaction-header">
            <span class="badge badge-cash">${inc.source}</span>
            <span class="amount-income">${formatUGX(inc.amount)}</span>
          </div>
          <div class="transaction-desc">${inc.description || inc.source}</div>
          <div class="transaction-meta">
            <span>${inc.date}</span>
            <span class="badge badge-${getPaymentBadge(inc.payment_method)}">${inc.payment_method}</span>
          </div>
          <div class="transaction-actions">
            <button class="btn-secondary" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.editIncome('${inc.id}')">Edit</button>
            <button class="btn-outline-danger" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;" onclick="window.app.confirmDelete('income', '${inc.id}')">Delete</button>
          </div>
        `;
        mobileContainer.appendChild(card);
      }
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

// Budgets View
function renderBudgets() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthExpenses = state.expenses.filter(e => e.date && e.date.startsWith(currentMonth));
  const monthTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const overall = state.budgets.find(b => b.category_name === 'Overall Monthly' && b.month_year === currentMonth);
  const overallLimit = overall ? Number(overall.amount) : 0;
  const overallPct = overallLimit > 0 ? Math.round((monthTotal / overallLimit) * 100) : 0;
  const overallRemaining = overallLimit - monthTotal;

  const elAmount = document.getElementById('budget-overall-amount');
  if (elAmount) elAmount.textContent = formatUGX(overallLimit);

  const elSpent = document.getElementById('budget-overall-spent');
  if (elSpent) elSpent.textContent = `Spent: ${formatUGX(monthTotal)} (${overallPct}%)`;

  const elRem = document.getElementById('budget-overall-remaining');
  if (elRem) elRem.textContent = `Remaining: ${formatUGX(overallRemaining > 0 ? overallRemaining : 0)}`;

  const overallFill = document.getElementById('budget-overall-fill');
  if (overallFill) {
    overallFill.style.width = `${Math.min(overallPct, 100)}%`;
    overallFill.className = `progress-bar-fill ${overallPct >= 100 ? 'progress-danger' : overallPct >= 80 ? 'progress-warn' : 'progress-safe'}`;
  }

  const container = document.getElementById('budgets-container');
  const emptyState = document.getElementById('budgets-empty-state');
  if (container) container.innerHTML = '';

  const categoryBudgets = state.budgets.filter(b => b.category_name !== 'Overall Monthly');
  if (categoryBudgets.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    categoryBudgets.forEach(b => {
      const spent = monthExpenses.filter(e => e.category_name === b.category_name).reduce((sum, e) => sum + Number(e.amount), 0);
      const limit = Number(b.amount);
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const remaining = limit - spent;
      const statusClass = pct >= 100 ? 'progress-danger' : pct >= (b.alert_threshold || 80) ? 'progress-warn' : 'progress-safe';

      if (container) {
        const card = document.createElement('div');
        card.className = 'budget-card';
        card.innerHTML = `
          <div class="budget-card-top">
            <div>
              <div style="font-weight: 700; font-size: 1.05rem;">${b.category_name}</div>
              <div class="stat-subtext">Month: ${b.month_year}</div>
            </div>
            <button class="icon-btn" onclick="window.app.confirmDelete('budget', '${b.id}')"><i data-lucide="trash-2"></i></button>
          </div>
          <div style="margin: 0.5rem 0;">
            <div style="font-size: 1.25rem; font-weight: 800;">${formatUGX(spent)} <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">/ ${formatUGX(limit)}</span></div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill ${statusClass}" style="width: ${Math.min(pct, 100)}%;"></div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted);">
            <span>${pct}% used</span>
            <span>${remaining >= 0 ? formatUGX(remaining) + ' left' : 'Exceeded by ' + formatUGX(Math.abs(remaining))}</span>
          </div>
        `;
        container.appendChild(card);
      }
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

// Savings View
function renderSavings() {
  const container = document.getElementById('savings-container');
  const emptyState = document.getElementById('savings-empty-state');
  if (container) container.innerHTML = '';

  if (state.savings.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    state.savings.forEach(goal => {
      const target = Number(goal.target_amount);
      const current = Number(goal.current_amount || 0);
      const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

      if (container) {
        const card = document.createElement('div');
        card.className = 'goal-card';
        card.innerHTML = `
          <div class="goal-card-top">
            <div>
              <h4 style="font-weight: 700; font-size: 1.1rem;">${goal.title}</h4>
              <div class="stat-subtext">${goal.target_date ? 'Target Date: ' + goal.target_date : 'Open goal'}</div>
            </div>
            <button class="icon-btn" onclick="window.app.confirmDelete('savings', '${goal.id}')"><i data-lucide="trash-2"></i></button>
          </div>
          <div style="margin: 0.75rem 0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">${formatUGX(current)}</span>
              <span class="stat-subtext">Target: ${formatUGX(target)}</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill progress-safe" style="width: ${pct}%;"></div>
            </div>
            <div style="text-align: right; font-size: 0.8rem; font-weight: 600; color: var(--primary);">${pct}% completed</div>
          </div>
          ${goal.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">${goal.notes}</div>` : ''}
          <button class="btn-primary" style="width: 100%; justify-content: center; font-size: 0.85rem;" onclick="window.app.openDepositModal('${goal.id}', '${goal.title.replace(/'/g, "\\'")}')">
            <i data-lucide="plus"></i>
            <span>Add Money toward Goal</span>
          </button>
        `;
        container.appendChild(card);
      }
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

// Debts View
function renderDebts() {
  const container = document.getElementById('debts-container');
  const emptyState = document.getElementById('debts-empty-state');
  if (container) container.innerHTML = '';

  const iOweCount = state.debts.filter(d => d.type === 'i_owe').length;
  const owedToMeCount = state.debts.filter(d => d.type === 'owed_to_me').length;
  const countIOwe = document.getElementById('count-i-owe');
  const countOwedToMe = document.getElementById('count-owed-to-me');
  if (countIOwe) countIOwe.textContent = iOweCount;
  if (countOwedToMe) countOwedToMe.textContent = owedToMeCount;

  const currentTab = state.debtTab || 'i_owe';
  const list = state.debts.filter(d => d.type === currentTab);

  if (list.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
  } else {
    if (emptyState) emptyState.style.display = 'none';
    list.forEach(debt => {
      const amount = Number(debt.amount);
      const paid = Number(debt.paid_amount || 0);
      const balance = amount - paid;
      const statusColor = debt.status === 'Paid' ? '#10B981' : debt.status === 'Overdue' ? '#EF4444' : '#F59E0B';

      if (container) {
        const card = document.createElement('div');
        card.className = 'debt-card';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
            <div>
              <h4 style="font-weight: 700; font-size: 1.1rem;">${debt.person}</h4>
              <div class="stat-subtext">${debt.description || (debt.type === 'i_owe' ? 'Money I owe' : 'Owed to me')}</div>
            </div>
            <span class="badge" style="background-color: ${statusColor}20; color: ${statusColor};">${debt.status}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 0.5rem 0; font-size: 0.9rem;">
            <span>Total: <strong>${formatUGX(amount)}</strong></span>
            <span>Paid: <strong>${formatUGX(paid)}</strong></span>
          </div>
          <div style="font-size: 1.1rem; font-weight: 800; color: ${currentTab === 'i_owe' ? 'var(--accent-red)' : 'var(--primary)'};">
            Remaining Balance: ${formatUGX(balance > 0 ? balance : 0)}
          </div>
          <div class="stat-subtext" style="margin: 0.35rem 0 0.75rem;">Due Date: ${debt.due_date || 'No deadline'}</div>
          <div style="display: flex; gap: 0.5rem;">
            ${balance > 0 ? `<button class="btn-primary" style="flex: 1; font-size: 0.8rem; justify-content: center;" onclick="window.app.openDebtPayModal('${debt.id}', '${debt.person.replace(/'/g, "\\'")}', ${balance})">Record Payment</button>` : ''}
            <button class="icon-btn" onclick="window.app.confirmDelete('debt', '${debt.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        `;
        container.appendChild(card);
      }
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

// Reports View
function renderReports() {
  const periodEl = document.getElementById('report-period-select');
  const period = periodEl ? periodEl.value : 'this_month';
  const today = new Date().toISOString().split('T')[0];
  const curMonth = today.slice(0, 7);

  let filteredExpenses = [...state.expenses];
  let filteredIncome = [...state.income];

  if (period === 'today') {
    filteredExpenses = filteredExpenses.filter(e => e.date === today);
    filteredIncome = filteredIncome.filter(i => i.date === today);
  } else if (period === 'this_month') {
    filteredExpenses = filteredExpenses.filter(e => e.date && e.date.startsWith(curMonth));
    filteredIncome = filteredIncome.filter(i => i.date && i.date.startsWith(curMonth));
  } else if (period === 'this_year') {
    filteredExpenses = filteredExpenses.filter(e => e.date && e.date.startsWith(today.slice(0, 4)));
    filteredIncome = filteredIncome.filter(i => i.date && i.date.startsWith(today.slice(0, 4)));
  }

  const totalExp = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalInc = filteredIncome.reduce((s, i) => s + Number(i.amount), 0);
  const netBal = totalInc - totalExp;

  const elTotInc = document.getElementById('rep-total-income');
  if (elTotInc) elTotInc.textContent = formatUGX(totalInc);

  const elTotExp = document.getElementById('rep-total-expense');
  if (elTotExp) elTotExp.textContent = formatUGX(totalExp);

  const elNetBal = document.getElementById('rep-net-balance');
  if (elNetBal) elNetBal.textContent = formatUGX(netBal);

  const activeDays = new Set(filteredExpenses.map(e => e.date)).size || 1;
  const elAvgDaily = document.getElementById('rep-avg-daily');
  if (elAvgDaily) elAvgDaily.textContent = formatUGX(Math.round(totalExp / activeDays));

  const catTotals = {};
  filteredExpenses.forEach(e => {
    catTotals[e.category_name] = (catTotals[e.category_name] || 0) + Number(e.amount);
  });
  let topCat = '-';
  let topCatAmount = 0;
  Object.entries(catTotals).forEach(([cat, amt]) => {
    if (amt > topCatAmount) {
      topCat = cat;
      topCatAmount = amt;
    }
  });

  const elTopCat = document.getElementById('rep-top-category');
  if (elTopCat) elTopCat.textContent = topCat;

  const elTopCatAmt = document.getElementById('rep-top-category-amount');
  if (elTopCatAmt) elTopCatAmt.textContent = formatUGX(topCatAmount);

  let highestExp = null;
  filteredExpenses.forEach(e => {
    if (!highestExp || Number(e.amount) > Number(highestExp.amount)) {
      highestExp = e;
    }
  });

  const elHighExp = document.getElementById('rep-highest-expense');
  if (elHighExp) elHighExp.textContent = highestExp ? highestExp.description : '-';

  const elHighExpAmt = document.getElementById('rep-highest-expense-amount');
  if (elHighExpAmt) elHighExpAmt.textContent = highestExp ? formatUGX(highestExp.amount) : formatUGX(0);

  const tbody = document.getElementById('report-category-summary-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    Object.entries(catTotals).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      const txCount = filteredExpenses.filter(e => e.category_name === cat).length;
      const pct = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${cat}</strong></td>
        <td>${txCount}</td>
        <td class="amount-expense">${formatUGX(amt)}</td>
        <td>${pct}%</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderReportCharts(totalInc, totalExp, catTotals, filteredExpenses);
}

function renderReportCharts(totalInc, totalExp, catTotals, filteredExpenses) {
  if (!window.Chart) return;

  const ctxIncExp = document.getElementById('chart-report-income-vs-expense');
  if (ctxIncExp) {
    if (state.charts.repIncExp) state.charts.repIncExp.destroy();
    state.charts.repIncExp = new Chart(ctxIncExp, {
      type: 'bar',
      data: {
        labels: ['Income (Inflow)', 'Expenses (Outflow)'],
        datasets: [{
          data: [totalInc, totalExp],
          backgroundColor: ['#10B981', '#EF4444'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: v => 'USh ' + (v >= 1000 ? (v / 1000) + 'k' : v) } }
        }
      }
    });
  }

  const ctxCat = document.getElementById('chart-report-category-breakdown');
  if (ctxCat) {
    if (state.charts.repCat) state.charts.repCat.destroy();
    state.charts.repCat = new Chart(ctxCat, {
      type: 'pie',
      data: {
        labels: Object.keys(catTotals),
        datasets: [{
          data: Object.values(catTotals),
          backgroundColor: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } }
      }
    });
  }

  const ctxTime = document.getElementById('chart-report-spending-trend');
  if (ctxTime) {
    const datesMap = {};
    filteredExpenses.forEach(e => {
      datesMap[e.date] = (datesMap[e.date] || 0) + Number(e.amount);
    });
    const sortedDates = Object.keys(datesMap).sort();

    if (state.charts.repTime) state.charts.repTime.destroy();
    state.charts.repTime = new Chart(ctxTime, {
      type: 'line',
      data: {
        labels: sortedDates,
        datasets: [{
          label: 'Expenditure',
          data: sortedDates.map(d => datesMap[d]),
          borderColor: '#0F766E',
          backgroundColor: 'rgba(15, 118, 110, 0.15)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  const ctxPay = document.getElementById('chart-report-payment-methods');
  if (ctxPay) {
    const payMap = {};
    filteredExpenses.forEach(e => {
      payMap[e.payment_method] = (payMap[e.payment_method] || 0) + Number(e.amount);
    });

    if (state.charts.repPay) state.charts.repPay.destroy();
    state.charts.repPay = new Chart(ctxPay, {
      type: 'doughnut',
      data: {
        labels: Object.keys(payMap),
        datasets: [{
          data: Object.values(payMap),
          backgroundColor: ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#64748B']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }
}

// Exports
function exportCSV() {
  const headers = ['Category', 'Description', 'Amount (UGX)', 'Date', 'Time', 'Payment Method', 'Location', 'Notes'];
  const rows = state.expenses.map(e => [
    `"${e.category_name}"`,
    `"${(e.description || '').replace(/"/g, '""')}"`,
    e.amount,
    e.date,
    e.time || '',
    `"${e.payment_method}"`,
    `"${(e.location || '').replace(/"/g, '""')}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `daily_expenses_uganda_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('CSV exported successfully.');
}

function exportExcel() {
  if (!window.XLSX) {
    showToast('Export library loading. Please try again.', 'warning');
    return;
  }
  const expenseData = state.expenses.map(e => ({
    Category: e.category_name,
    Description: e.description,
    'Amount (UGX)': Number(e.amount),
    Date: e.date,
    Time: e.time,
    'Payment Method': e.payment_method,
    Location: e.location,
    Notes: e.notes
  }));

  const incomeData = state.income.map(i => ({
    Source: i.source,
    Description: i.description,
    'Amount (UGX)': Number(i.amount),
    Date: i.date,
    'Payment Method': i.payment_method,
    Notes: i.notes
  }));

  const wb = window.XLSX.utils.book_new();
  const wsExp = window.XLSX.utils.json_to_sheet(expenseData);
  const wsInc = window.XLSX.utils.json_to_sheet(incomeData);

  window.XLSX.utils.book_append_sheet(wb, wsExp, 'Expenses');
  window.XLSX.utils.book_append_sheet(wb, wsInc, 'Income');

  window.XLSX.writeFile(wb, `financial_report_uganda_${new Date().toISOString().split('T')[0]}.xlsx`);
  showToast('Excel report downloaded.');
}

function exportPDF() {
  const element = document.getElementById('printable-report-area');
  if (window.html2pdf) {
    const opt = {
      margin: 0.5,
      filename: `uganda_expense_report_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    window.html2pdf().set(opt).from(element).save();
    showToast('PDF generated.');
  } else {
    window.print();
  }
}

// Theme
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dem_theme', theme);

  const iconName = theme === 'dark' ? 'sun' : 'moon';
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) themeIcon.setAttribute('data-lucide', iconName);

  const settingsThemeIcon = document.getElementById('settings-theme-icon');
  if (settingsThemeIcon) settingsThemeIcon.setAttribute('data-lucide', iconName);

  const settingsThemeText = document.getElementById('settings-theme-text');
  if (settingsThemeText) settingsThemeText.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';

  if (window.lucide) window.lucide.createIcons();
}

function toggleTheme() {
  setTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// PWA Install
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.deferredPrompt = e;
  const btn = document.getElementById('sidebar-install-btn');
  if (btn) btn.style.display = 'flex';
  const setBtn = document.getElementById('settings-install-pwa');
  if (setBtn) setBtn.style.display = 'inline-flex';
});

async function triggerInstall() {
  if (state.deferredPrompt) {
    state.deferredPrompt.prompt();
    const { outcome } = await state.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Daily Expense Manager installed!');
      const btn = document.getElementById('sidebar-install-btn');
      if (btn) btn.style.display = 'none';
    }
    state.deferredPrompt = null;
  } else {
    showToast('To install, tap Share in Safari / Menu in Chrome and choose "Add to Home Screen".');
  }
}

// Connectivity
window.addEventListener('online', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.style.display = 'none';
  showToast('Back online.');
});

window.addEventListener('offline', () => {
  const banner = document.getElementById('offline-banner');
  if (banner) banner.style.display = 'block';
  showToast('Working offline. Local changes are saved.', 'warning');
});

// Load Supabase cloud data for authenticated user
async function loadSupabaseUserData(userId) {
  try {
    const { data: dbExpenses } = await supabase.from('expenses').select('*').eq('user_id', userId).order('date', { ascending: false });
    if (dbExpenses && dbExpenses.length > 0) {
      state.expenses = dbExpenses;
      localStorage.setItem('dem_expenses', JSON.stringify(state.expenses));
    }

    const { data: dbIncome } = await supabase.from('income').select('*').eq('user_id', userId).order('date', { ascending: false });
    if (dbIncome && dbIncome.length > 0) {
      state.income = dbIncome;
      localStorage.setItem('dem_income', JSON.stringify(state.income));
    }

    const { data: dbBudgets } = await supabase.from('budgets').select('*').eq('user_id', userId);
    if (dbBudgets && dbBudgets.length > 0) {
      state.budgets = dbBudgets;
      localStorage.setItem('dem_budgets', JSON.stringify(state.budgets));
    }

    const { data: dbSavings } = await supabase.from('savings_goals').select('*').eq('user_id', userId);
    if (dbSavings && dbSavings.length > 0) {
      state.savings = dbSavings;
      localStorage.setItem('dem_savings', JSON.stringify(state.savings));
    }

    const { data: dbDebts } = await supabase.from('debts').select('*').eq('user_id', userId);
    if (dbDebts && dbDebts.length > 0) {
      state.debts = dbDebts;
      localStorage.setItem('dem_debts', JSON.stringify(state.debts));
    }

    renderDashboard();
    renderExpenses();
    renderIncome();
    renderBudgets();
    renderSavings();
    renderDebts();
  } catch (err) {
    console.warn('Error loading Supabase cloud data:', err);
  }
}

// ==============================================================================
// INITIALIZATION ON DOMContentLoaded
// ==============================================================================
async function initApp() {
  const loadingScreen = document.getElementById('account-loading-screen');
  const stepText = document.getElementById('loading-step-text');
  const appContainer = document.getElementById('app-container');

  // Only a real Supabase session is treated as authenticated.
  // Old localStorage login flags are deliberately not used as authentication.
  let session = null;

  try {
    if (stepText) stepText.textContent = 'Verifying secure session...';

    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timed out')), 10000))
    ]);

    session = result?.data?.session || null;
  } catch (err) {
    console.warn('Session verification warning:', err);
  }

  if (!session?.user) {
    localStorage.removeItem('dem_user_logged_in');
    localStorage.removeItem('dem_auth_user');
    window.location.replace(LOGIN_URL);
    return;
  }

  state.user = session.user;
  state.isSupabaseAuthenticated = true;
  localStorage.setItem('dem_user_logged_in', 'true');
  localStorage.setItem('dem_auth_user', JSON.stringify(session.user));
  updateUserUI(state.user);

  // Show the application immediately. Cloud records load in the background,
  // so one slow database query can never leave the loading screen spinning forever.
  if (appContainer) appContainer.style.display = 'flex';
  if (stepText) stepText.textContent = 'Loading your financial records...';

  populateCategories();
  setTheme(state.theme);

  renderDashboard();
  renderExpenses();
  renderIncome();
  renderBudgets();
  renderSavings();
  renderDebts();

  loadSupabaseUserData(session.user.id)
    .catch(err => console.warn('Cloud data loading warning:', err))
    .finally(() => {
      if (stepText) stepText.textContent = 'Dashboard ready';
    });

  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 450);
  }


  if (appContainer) appContainer.style.display = 'flex';

  populateCategories();
  setTheme(state.theme);

  // Initial Render
  renderDashboard();
  renderExpenses();
  renderIncome();
  renderBudgets();
  renderSavings();
  renderDebts();

  // Smoothly fade out the account loading animation screen
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.remove();
    }, 450);
  }

  // Navigation Links
  document.querySelectorAll('.nav-link[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.getAttribute('data-view'));
    });
  });

  document.querySelectorAll('.mobile-nav-item[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(link.getAttribute('data-view'));
    });
  });

  // Theme & Install Buttons
  const themeToggle = document.getElementById('theme-toggle-btn');
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  const settingsThemeToggle = document.getElementById('settings-theme-toggle');
  if (settingsThemeToggle) settingsThemeToggle.addEventListener('click', toggleTheme);

  const sidebarInstall = document.getElementById('sidebar-install-btn');
  if (sidebarInstall) sidebarInstall.addEventListener('click', triggerInstall);

  const settingsInstall = document.getElementById('settings-install-pwa');
  if (settingsInstall) settingsInstall.addEventListener('click', triggerInstall);

  const mobileMoreBtn = document.getElementById('mobile-more-btn');
  if (mobileMoreBtn) mobileMoreBtn.addEventListener('click', () => openModal('modal-mobile-more'));

  // Main Add Action Triggers
  const headerAddExpense = document.getElementById('header-add-expense-btn');
  if (headerAddExpense) headerAddExpense.addEventListener('click', openAddExpenseModal);

  const mobileAddBtn = document.getElementById('mobile-central-add-btn');
  if (mobileAddBtn) mobileAddBtn.addEventListener('click', openAddExpenseModal);

  const qaAddExpense = document.getElementById('qa-add-expense');
  if (qaAddExpense) qaAddExpense.addEventListener('click', openAddExpenseModal);

  const qaAddIncome = document.getElementById('qa-add-income');
  if (qaAddIncome) qaAddIncome.addEventListener('click', openAddIncomeModal);

  const qaSetBudget = document.getElementById('qa-set-budget');
  if (qaSetBudget) qaSetBudget.addEventListener('click', openAddBudgetModal);

  const qaNewGoal = document.getElementById('qa-new-goal');
  if (qaNewGoal) qaNewGoal.addEventListener('click', openAddGoalModal);

  const qaAddDebt = document.getElementById('qa-add-debt');
  if (qaAddDebt) qaAddDebt.addEventListener('click', openAddDebtModal);

  // Form Submissions - EXPENSE (Form submit + Button click)
  const formExpense = document.getElementById('form-expense');
  if (formExpense) {
    formExpense.addEventListener('submit', handleExpenseSubmit);
  }
  const btnSaveExpense = document.getElementById('btn-save-expense');
  if (btnSaveExpense) {
    btnSaveExpense.addEventListener('click', (e) => {
      if (formExpense && formExpense.checkValidity && !formExpense.checkValidity()) {
        formExpense.reportValidity();
        return;
      }
      handleExpenseSubmit(e);
    });
  }

  // Form Submissions - INCOME (Form submit + Button click)
  const formIncome = document.getElementById('form-income');
  if (formIncome) {
    formIncome.addEventListener('submit', handleIncomeSubmit);
  }
  const btnSaveIncome = document.getElementById('btn-save-income');
  if (btnSaveIncome) {
    btnSaveIncome.addEventListener('click', (e) => {
      if (formIncome && formIncome.checkValidity && !formIncome.checkValidity()) {
        formIncome.reportValidity();
        return;
      }
      handleIncomeSubmit(e);
    });
  }

  // Form Submissions - BUDGET
  const formBudget = document.getElementById('form-budget');
  if (formBudget) {
    formBudget.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById('budget-amount').value);
      if (!amount) return;

      const category_name = document.getElementById('budget-category').value;
      const month_year = document.getElementById('budget-month').value;
      const alert_threshold = parseInt(document.getElementById('budget-threshold').value) || 80;

      const existingIdx = state.budgets.findIndex(b => b.category_name === category_name && b.month_year === month_year);
      const budgetData = {
        id: 'bud_' + Date.now(),
        category_name,
        amount,
        month_year,
        alert_threshold
      };

      if (existingIdx !== -1) {
        state.budgets[existingIdx].amount = amount;
        state.budgets[existingIdx].alert_threshold = alert_threshold;
      } else {
        state.budgets.push(budgetData);
      }

      localStorage.setItem('dem_budgets', JSON.stringify(state.budgets));
      closeModal('modal-budget');
      showToast('Budget saved.');
      renderBudgets();
      renderDashboard();
    });
  }

  // Form Submissions - GOAL
  const formGoal = document.getElementById('form-goal');
  if (formGoal) {
    formGoal.addEventListener('submit', (e) => {
      e.preventDefault();
      const target = parseFloat(document.getElementById('goal-target').value);
      if (!target) return;

      state.savings.push({
        id: 'sav_' + Date.now(),
        title: document.getElementById('goal-title').value,
        target_amount: target,
        current_amount: parseFloat(document.getElementById('goal-current').value) || 0,
        target_date: document.getElementById('goal-target-date').value,
        notes: document.getElementById('goal-notes').value
      });

      localStorage.setItem('dem_savings', JSON.stringify(state.savings));
      closeModal('modal-goal');
      showToast('Savings goal created.');
      renderSavings();
    });
  }

  // Form Submissions - DEPOSIT
  const formDeposit = document.getElementById('form-deposit');
  if (formDeposit) {
    formDeposit.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('deposit-goal-id').value;
      const deposit = parseFloat(document.getElementById('deposit-amount').value);
      if (!deposit || deposit <= 0) return;

      const goal = state.savings.find(s => s.id === id);
      if (goal) {
        goal.current_amount = Number(goal.current_amount || 0) + deposit;
        localStorage.setItem('dem_savings', JSON.stringify(state.savings));
        showToast(`Added ${formatUGX(deposit)} to ${goal.title}!`);
        renderSavings();
      }
      closeModal('modal-deposit');
    });
  }

  // Form Submissions - DEBT
  const formDebt = document.getElementById('form-debt');
  if (formDebt) {
    formDebt.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = parseFloat(document.getElementById('debt-amount').value);
      if (!amount) return;

      state.debts.push({
        id: 'dbt_' + Date.now(),
        type: document.getElementById('debt-type').value,
        person: document.getElementById('debt-person').value,
        amount,
        paid_amount: parseFloat(document.getElementById('debt-paid').value) || 0,
        date: document.getElementById('debt-date').value,
        due_date: document.getElementById('debt-due-date').value,
        status: document.getElementById('debt-status').value,
        description: document.getElementById('debt-description').value
      });

      localStorage.setItem('dem_debts', JSON.stringify(state.debts));
      closeModal('modal-debt');
      showToast('Debt record saved.');
      renderDebts();
    });
  }

  // Form Submissions - DEBT PAYMENT
  const formDebtPay = document.getElementById('form-debt-pay');
  if (formDebtPay) {
    formDebtPay.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('debt-pay-id').value;
      const payment = parseFloat(document.getElementById('debt-payment-amount').value);
      if (!payment) return;

      const debt = state.debts.find(d => d.id === id);
      if (debt) {
        debt.paid_amount = Number(debt.paid_amount || 0) + payment;
        debt.status = debt.paid_amount >= Number(debt.amount) ? 'Paid' : 'Partially Paid';
        localStorage.setItem('dem_debts', JSON.stringify(state.debts));
        showToast(`Payment of ${formatUGX(payment)} recorded.`);
        renderDebts();
      }
      closeModal('modal-debt-pay');
    });
  }

  // Form Submissions - CATEGORY
  const formCategory = document.getElementById('form-category');
  if (formCategory) {
    formCategory.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('cat-name').value.trim();
      if (!name) return;

      const newCat = {
        id: 'cat_' + Date.now(),
        name,
        type: document.getElementById('cat-type').value,
        color: document.getElementById('cat-color').value,
        icon: 'tag'
      };

      state.categories.push(newCat);
      localStorage.setItem('dem_categories', JSON.stringify(state.categories));
      populateCategories();
      closeModal('modal-category');
      showToast(`Category "${name}" created.`);
    });
  }

  // Confirmation Delete Button
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', handleDeleteConfirm);
  }

  // Debt Tabs
  const debtTabIOwe = document.getElementById('debt-tab-i-owe');
  const debtTabOwedToMe = document.getElementById('debt-tab-owed-to-me');
  if (debtTabIOwe && debtTabOwedToMe) {
    debtTabIOwe.addEventListener('click', () => {
      state.debtTab = 'i_owe';
      debtTabIOwe.className = 'btn-primary';
      debtTabOwedToMe.className = 'btn-secondary';
      renderDebts();
    });

    debtTabOwedToMe.addEventListener('click', () => {
      state.debtTab = 'owed_to_me';
      debtTabOwedToMe.className = 'btn-primary';
      debtTabIOwe.className = 'btn-secondary';
      renderDebts();
    });
  }

  // Filters & Search
  const filterCat = document.getElementById('expense-filter-category');
  if (filterCat) filterCat.addEventListener('change', renderExpenses);

  const filterPay = document.getElementById('expense-filter-payment');
  if (filterPay) filterPay.addEventListener('change', renderExpenses);

  const filterDate = document.getElementById('expense-filter-date');
  if (filterDate) filterDate.addEventListener('change', renderExpenses);

  const sortFilter = document.getElementById('expense-sort');
  if (sortFilter) sortFilter.addEventListener('change', renderExpenses);

  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', () => {
      if (document.getElementById('view-expenses')?.classList.contains('active')) {
        renderExpenses();
      }
    });
  }

  // Reports Period
  const reportPeriod = document.getElementById('report-period-select');
  if (reportPeriod) {
    reportPeriod.addEventListener('change', (e) => {
      const customDates = document.getElementById('report-custom-dates');
      if (customDates) customDates.style.display = e.target.value === 'custom' ? 'flex' : 'none';
      renderReports();
    });
  }

  // Reports Actions
  const repPrint = document.getElementById('report-print-btn');
  if (repPrint) repPrint.addEventListener('click', () => window.print());

  const repCsv = document.getElementById('report-export-csv-btn');
  if (repCsv) repCsv.addEventListener('click', exportCSV);

  const expCsv = document.getElementById('expense-export-csv-btn');
  if (expCsv) expCsv.addEventListener('click', exportCSV);

  const repXls = document.getElementById('report-export-excel-btn');
  if (repXls) repXls.addEventListener('click', exportExcel);

  const repPdf = document.getElementById('report-export-pdf-btn');
  if (repPdf) repPdf.addEventListener('click', exportPDF);

  // Auth Button
  const authToggleBtn = document.getElementById('auth-toggle-btn');
  if (authToggleBtn) {
    authToggleBtn.addEventListener('click', () => {
      if (state.isSupabaseAuthenticated) {
        navigate('settings');
      } else {
        openModal('modal-auth');
      }
    });
  }

  // Auth Modal Switching & Form
  let isSignUpMode = false;
  const authTitle = document.getElementById('auth-modal-title');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authSwitchMode = document.getElementById('auth-switch-mode');
  const authNameGroup = document.getElementById('auth-name-group');
  const authErrorMsg = document.getElementById('auth-error-msg');

  if (authNameGroup) authNameGroup.style.display = 'none';

  if (authSwitchMode) {
    authSwitchMode.addEventListener('click', (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      if (authErrorMsg) {
        authErrorMsg.textContent = '';
        authErrorMsg.style.display = 'none';
      }
      if (isSignUpMode) {
        if (authTitle) authTitle.textContent = 'Create an Account';
        if (authSubmitBtn) authSubmitBtn.textContent = 'Sign Up';
        authSwitchMode.textContent = 'Already have an account? Sign In';
        if (authNameGroup) authNameGroup.style.display = 'block';
      } else {
        if (authTitle) authTitle.textContent = 'Sign In to Daily Expense Manager';
        if (authSubmitBtn) authSubmitBtn.textContent = 'Sign In';
        authSwitchMode.textContent = "Don't have an account? Sign Up";
        if (authNameGroup) authNameGroup.style.display = 'none';
      }
    });
  }

  const formAuth = document.getElementById('form-auth');
  if (formAuth) {
    formAuth.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const fullName = document.getElementById('auth-name') ? document.getElementById('auth-name').value.trim() : '';

      if (authErrorMsg) {
        authErrorMsg.textContent = '';
        authErrorMsg.style.display = 'none';
      }

      if (authSubmitBtn) {
        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = isSignUpMode ? 'Signing Up...' : 'Signing In...';
      }

      try {
        if (isSignUpMode) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
          });
          if (error) throw error;
          
          // Do NOT auto-login. If a session exists, sign it out.
          if (data?.session) {
            await supabase.auth.signOut();
          }

          // Switch to Sign In view inside modal
          isSignUpMode = false;
          updateAuthModalMode();

          // Keep / pre-fill the email in the input
          const authEmailInput = document.getElementById('auth-email');
          if (authEmailInput) authEmailInput.value = email;
          const authPasswordInput = document.getElementById('auth-password');
          if (authPasswordInput) authPasswordInput.value = '';

          // Show clear success message
          if (authErrorMsg) {
            authErrorMsg.textContent = "Your account has been created. Please check your email and verify your address before logging in.";
            authErrorMsg.style.display = "block";
            authErrorMsg.className = "auth-message-box success";
          }
          showToast("Account created! Please check your email to verify before logging in.", "success");
          return;
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;

          // * Only redirect when a real session exists after login.
          if (data?.session) {
            state.user = data.user;
            state.isSupabaseAuthenticated = true;
            localStorage.setItem('dem_user_logged_in', 'true');
            if (data.user) {
              localStorage.setItem('dem_auth_user', JSON.stringify(data.user));
            }
            updateUserUI(state.user);
            closeModal('modal-auth');
            showToast('Signed in successfully!');
            await loadSupabaseUserData(state.user.id);
          } else {
            if (authErrorMsg) {
              authErrorMsg.textContent = "Check your email and confirm your account before logging in.";
              authErrorMsg.style.display = "block";
              authErrorMsg.style.color = "#0369a1";
              authErrorMsg.style.backgroundColor = "#e0f2fe";
              authErrorMsg.style.borderColor = "#38bdf8";
            }
          }
        }
      } catch (err) {
        console.error('Auth error:', err);
        if (authErrorMsg) {
          authErrorMsg.textContent = err.message || 'Authentication failed. Please check credentials.';
          authErrorMsg.style.display = 'block';
        }
      } finally {
        if (authSubmitBtn) {
          authSubmitBtn.disabled = false;
          authSubmitBtn.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
        }
      }
    });
  }
  // Single logout control lives in the top header. The sidebar Account button opens Settings.
  const headerLogout = document.getElementById('header-logout-btn');
  if (headerLogout) headerLogout.addEventListener('click', handleSignOut);

  // Backup & Import
  const backupBtn = document.getElementById('backup-download-btn');
  if (backupBtn) {
    backupBtn.addEventListener('click', () => {
      const fullBackup = {
        version: '2.0',
        export_date: new Date().toISOString(),
        currency: 'UGX',
        expenses: state.expenses,
        income: state.income,
        budgets: state.budgets,
        savings: state.savings,
        debts: state.debts,
        categories: state.categories
      };
      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expense_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showToast('Backup JSON downloaded.');
    });
  }

  const importInput = document.getElementById('backup-import-input');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          if (data.expenses) state.expenses = data.expenses;
          if (data.income) state.income = data.income;
          if (data.budgets) state.budgets = data.budgets;
          if (data.savings) state.savings = data.savings;
          if (data.debts) state.debts = data.debts;
          if (data.categories) state.categories = data.categories;

          localStorage.setItem('dem_expenses', JSON.stringify(state.expenses));
          localStorage.setItem('dem_income', JSON.stringify(state.income));
          localStorage.setItem('dem_budgets', JSON.stringify(state.budgets));
          localStorage.setItem('dem_savings', JSON.stringify(state.savings));
          localStorage.setItem('dem_debts', JSON.stringify(state.debts));
          localStorage.setItem('dem_categories', JSON.stringify(state.categories));

          showToast('Data restored successfully!');
          populateCategories();
          renderDashboard();
          renderExpenses();
          renderIncome();
          renderBudgets();
          renderSavings();
          renderDebts();
        } catch (err) {
          showToast('Invalid backup file.', 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  // Profile Form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('profile-name-input').value;
      const email = document.getElementById('profile-email-input').value;
      const phone = document.getElementById('profile-phone-input').value;
      const currency = document.getElementById('profile-currency-input').value || 'USh';

      localStorage.setItem('dem_profile', JSON.stringify({ name, email, phone, currency }));
      if (name) {
        document.getElementById('sidebar-user-name').textContent = name;
        document.getElementById('sidebar-avatar').textContent = name.slice(0, 2).toUpperCase();
      }
      showToast('Profile updated.');
    });
  }

  // Supabase Credentials in settings
  const supaForm = document.getElementById('supabase-config-form');
  if (supaForm) {
    supaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const url = document.getElementById('supabase-url-input').value.trim();
      const key = document.getElementById('supabase-anon-key-input').value.trim();
      if (url && key) {
        localStorage.setItem('dem_supabase_url', url);
        localStorage.setItem('dem_supabase_anon_key', key);
        showToast('Credentials saved. Reloading...');
        setTimeout(() => window.location.reload(), 800);
      }
    });
  }

  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigate(hash);
  if (window.lucide) window.lucide.createIcons();
}

async function handleSignOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Signout warning:', err);
  }
  localStorage.removeItem('dem_user_logged_in');
  localStorage.removeItem('dem_auth_user');
  state.user = null;
  state.isSupabaseAuthenticated = false;
  updateUserUI(null);
  window.location.replace(LOGIN_URL);
}

// Attach to DOMContentLoaded or execute immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Expose on window for inline HTML attributes
window.app = {
  navigate,
  openModal,
  closeModal,
  openAddExpenseModal,
  editExpense,
  handleExpenseSubmit,
  openAddIncomeModal,
  editIncome,
  handleIncomeSubmit,
  openAddBudgetModal,
  openAddGoalModal,
  openDepositModal,
  openAddDebtModal,
  openDebtPayModal,
  openAddCategoryModal,
  viewReceipt,
  confirmDelete,
  handleSignOut
};
