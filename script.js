// ======= CONFIGURATION (Firebase v9 modular) =======
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, orderBy, query, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";

// IMPORTANT: For admin access, find your UID in the Firebase console (Authentication tab)
// and paste it here.
const ADMIN_UID = "REPLACE_WITH_YOUR_ADMIN_FIREBASE_UID"; 

// Fallback for local development if environment variables aren't set
if (!window.env) {
  console.warn("`window.env` is not set. Using placeholder keys. This will fail unless you replace them for local testing.");
  window.env = {
    FIREBASE_API_KEY: "YOUR_LOCAL_API_KEY",
    FIREBASE_AUTH_DOMAIN: "YOUR_LOCAL_AUTH_DOMAIN",
    FIREBASE_PROJECT_ID: "YOUR_LOCAL_PROJECT_ID",
    FIREBASE_STORAGE_BUCKET: "YOUR_LOCAL_STORAGE_BUCKET",
    FIREBASE_MESSAGING_SENDER_ID: "YOUR_LOCAL_MESSAGING_SENDER_ID",
    FIREBASE_APP_ID: "YOUR_LOCAL_APP_ID",
    FIREBASE_MEASUREMENT_ID: "YOUR_LOCAL_MEASUREMENT_ID"
  };
}

// SECURE: Keys are read from environment variables
const firebaseConfig = {
  apiKey: window.env.FIREBASE_API_KEY,
  authDomain: window.env.FIREBASE_AUTH_DOMAIN,
  projectId: window.env.FIREBASE_PROJECT_ID,
  storageBucket: window.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.env.FIREBASE_APP_ID,
  measurementId: window.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase with error handling
let app, analytics, auth, db;
try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  auth = getAuth(app);
  db = getFirestore(app);
  enableIndexedDbPersistence(db).catch(error => {
    console.warn('Firestore persistence not enabled:', error?.code || error?.message || error);
  });
} catch (error) {
  console.error("Firebase initialization failed:", error);
  alert("Firebase configuration is missing or invalid. The app will not work. Please check your API keys.");
}


// ======= DOM ELEMENTS =======
const DOM = {
  authSection: () => document.getElementById('auth-section'),
  dashboardSection: () => document.getElementById('dashboard'),
  adminSection: () => document.getElementById('admin-section'),
  userDisplayName: () => document.getElementById('user-display-name'),
  userAvatarImg: () => document.getElementById('user-avatar-img'),
  messageDiv: () => document.getElementById('message'),
  summaryDiv: () => document.getElementById('summary'),
  adminSummaryDiv: () => document.getElementById('admin-summary'),
  incomeList: () => document.getElementById('income-list'),
  expenseList: () => document.getElementById('expense-list'),
  incomeSource: () => document.getElementById('income-source'),
  incomeAmount: () => document.getElementById('income-amount'),
  expenseDescription: () => document.getElementById('expense-description'),
  expenseCategory: () => document.getElementById('expense-category'),
  expenseAmount: () => document.getElementById('expense-amount'),
  budgetCategory: () => document.getElementById('budget-category'),
  budgetAmount: () => document.getElementById('budget-amount'),
  categoryChart: () => document.getElementById('categoryChart'),
  incomeExpenseChart: () => document.getElementById('incomeExpenseChart'),
  adminSearch: () => document.getElementById('admin-search'),
  addIncomeBtn: () => document.getElementById('add-income-btn'),
  addExpenseBtn: () => document.getElementById('add-expense-btn'),
};

// ======= STATE VARIABLES =======
let isMaster = false;
let categoryChartInstance = null;
let incomeExpenseChartInstance = null;
let editingIncomeId = null;
let editingExpenseId = null;
let incomeUnsubscribe = null;
let expenseUnsubscribe = null;
let budgetUnsubscribe = null;
let incomeCache = [];
let expenseCache = [];
let budgetCache = {};

// ======= UTILITY FUNCTIONS =======
function escapeHTML(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p.innerHTML;
}

function showSection(sectionId) {
  document.querySelectorAll('section').forEach(sec => sec.style.display = 'none');
  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = (sectionId === 'dashboard' || sectionId === 'admin-section') ? 'flex' : 'block';
  }
}

function resetFinanceInputs() {
  document.querySelectorAll('.form-card input').forEach(input => input.value = '');
  DOM.addIncomeBtn().textContent = 'Add Income';
  DOM.addExpenseBtn().textContent = 'Add Expense';
  editingIncomeId = null;
  editingExpenseId = null;
}

function showMessage(message, isError = false) {
  const messageElement = DOM.messageDiv();
  if (!messageElement) return;
  messageElement.textContent = message;
  messageElement.className = isError ? 'message-box error' : 'message-box success';
  messageElement.style.display = 'block';
  setTimeout(() => { messageElement.style.display = 'none'; }, 5000);
}

function toggleTheme() {
    const body = document.body;
    const currentTheme = localStorage.getItem('theme') || 'dark';
    let nextTheme;

    if (currentTheme === 'dark') nextTheme = 'light';
    else if (currentTheme === 'light') nextTheme = 'modern';
    else nextTheme = 'dark';
    
    body.classList.remove('dark', 'light', 'modern');
    if (nextTheme !== 'dark') {
      body.classList.add(nextTheme);
    }
    localStorage.setItem('theme', nextTheme);

    const themeIcon = document.querySelector('#theme-toggle i');
    if (nextTheme === 'light') themeIcon.className = 'fa-solid fa-sun';
    else if (nextTheme === 'modern') themeIcon.className = 'fa-solid fa-swatchbook';
    else themeIcon.className = 'fa-solid fa-moon';
}


// ======= AUTHENTICATION FUNCTIONS =======
async function signInWithGoogle() {
  if (!auth) return showMessage("Firebase is not initialized. Check your API keys.", true);
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp()
    }, { merge: true });

    showMessage("Signed in successfully!");
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    showMessage(`Sign-in failed: ${error.code}`, true);
  }
}

function logout() {
  isMaster = false;
  signOut(auth).catch(error => console.error("Logout error:", error));
}


// ======= FINANCE MANAGEMENT FUNCTIONS =======
async function addOrUpdateEntry(type, data, id) {
    const userId = auth.currentUser?.uid;
    if (!userId) return showMessage('Not logged in.', true);
  
    const collectionName = type === 'income' ? 'income' : 'expenses';
    try {
      if (id) {
        await updateDoc(doc(db, 'users', userId, collectionName, id), data);
      } else {
        data.date = serverTimestamp();
        await addDoc(collection(db, 'users', userId, collectionName), data);
      }
      showMessage(`${type.charAt(0).toUpperCase() + type.slice(1)} saved successfully!`);
      resetFinanceInputs();
    } catch (error) {
      showMessage(`Failed to save ${type}: ${error.message}`, true);
    }
}

function startEditIncome(id, amount, source) {
  DOM.incomeSource().value = source;
  DOM.incomeAmount().value = amount;
  DOM.addIncomeBtn().textContent = 'Update Income';
  editingIncomeId = id;
  DOM.incomeSource().focus();
}

function startEditExpense(id, amount, description, category) {
  DOM.expenseDescription().value = description;
  DOM.expenseCategory().value = category;
  DOM.expenseAmount().value = amount;
  DOM.addExpenseBtn().textContent = 'Update Expense';
  editingExpenseId = id;
  DOM.expenseDescription().focus();
}

async function deleteEntry(type, id) {
  if (!confirm(`Are you sure you want to delete this ${type} entry?`)) return;
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  const collectionName = type === 'income' ? 'income' : 'expenses';
  try {
    await deleteDoc(doc(db, 'users', userId, collectionName, id));
    showMessage(`${type} entry deleted.`);
  } catch (error) {
    showMessage(`Failed to delete ${type}: ${error.message}`, true);
  }
}

async function setBudget() {
    const category = DOM.budgetCategory().value.trim();
    const amount = parseFloat(DOM.budgetAmount().value);
    const userId = auth.currentUser?.uid;
    if (!userId || !category || isNaN(amount) || amount <= 0) {
      return showMessage('Please provide a valid category and amount.', true);
    }
    try {
      await setDoc(doc(db, 'users', userId, 'budgets', category), { amount });
      showMessage('Budget set successfully!');
      resetFinanceInputs();
    } catch (error) {
      showMessage(`Failed to set budget: ${error.message}`, true);
    }
}

// ======= DATA LOADING, RENDERING & CHARTS =======
function attachRealtimeListeners(userId) {
    if (incomeUnsubscribe) incomeUnsubscribe();
    if (expenseUnsubscribe) expenseUnsubscribe();
    if (budgetUnsubscribe) budgetUnsubscribe();

    if (!userId) return;

    const render = () => renderFromCaches();

    incomeUnsubscribe = onSnapshot(query(collection(db, 'users', userId, 'income'), orderBy('date', 'desc')), (snapshot) => {
        incomeCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    });
    expenseUnsubscribe = onSnapshot(query(collection(db, 'users', userId, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
        expenseCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
    });
    budgetUnsubscribe = onSnapshot(collection(db, 'users', userId, 'budgets'), (snapshot) => {
        budgetCache = Object.fromEntries(snapshot.docs.map(d => [d.id, d.data().amount]));
        render();
    });
}

function renderFromCaches() {
    let totalIncome = 0, totalExpense = 0, categoryTotals = {}, incomeMonthly = {}, expenseMonthly = {};
    const getMonthKey = (ts) => ts ? new Date(ts.seconds * 1000).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);

    const createListItemHTML = (item, type) => {
        const amount = item.amount || 0;
        if (type === 'income') {
            totalIncome += amount;
            incomeMonthly[getMonthKey(item.date)] = (incomeMonthly[getMonthKey(item.date)] || 0) + amount;
            return `<li><span>${escapeHTML(item.source)}: $${amount.toFixed(2)}</span><span class="entry-buttons"><button class="edit-btn" data-id="${item.id}"><i class="fas fa-pen"></i></button><button class="delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button></span></li>`;
        } else {
            totalExpense += amount;
            const category = item.category || 'Other';
            categoryTotals[category] = (categoryTotals[category] || 0) + amount;
            expenseMonthly[getMonthKey(item.date)] = (expenseMonthly[getMonthKey(item.date)] || 0) + amount;
            return `<li><span>${escapeHTML(item.description)} (${escapeHTML(category)}): $${amount.toFixed(2)}</span><span class="entry-buttons"><button class="edit-btn" data-id="${item.id}"><i class="fas fa-pen"></i></button><button class="delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button></span></li>`;
        }
    };
    
    DOM.incomeList().innerHTML = incomeCache.map(item => createListItemHTML(item, 'income')).join('');
    DOM.expenseList().innerHTML = expenseCache.map(item => createListItemHTML(item, 'expense')).join('');
    
    updateSummary(totalIncome, totalExpense, budgetCache, categoryTotals);
    updateCharts(categoryTotals, incomeMonthly, expenseMonthly);
}

function updateSummary(totalIncome, totalExpense, budgets, categoryTotals) {
  const balance = totalIncome - totalExpense;
  let budgetHtml = '<h3>Budgets:</h3><ul>';
  if (Object.keys(budgets).length === 0) {
      budgetHtml += '<li>No budgets set.</li>';
  } else {
      for (const [category, limit] of Object.entries(budgets)) {
          const spent = categoryTotals[category] || 0;
          const percentage = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
          const budgetClass = percentage >= 100 ? 'budget-bar-red' : percentage >= 90 ? 'budget-bar-yellow' : 'budget-bar-green';
          budgetHtml += `<li><span>${escapeHTML(category)}: $${limit.toFixed(2)}</span><div class="budget-bar-container"><div class="budget-bar-fill ${budgetClass}" style="width:${percentage}%;"></div></div><small>Used: $${spent.toFixed(2)} (${percentage.toFixed(1)}%)</small></li>`;
      }
  }
  budgetHtml += '</ul>';
  DOM.summaryDiv().innerHTML = `<p>Total Income: $${totalIncome.toFixed(2)}</p><p>Total Expense: $${totalExpense.toFixed(2)}</p><p>Balance: $${balance.toFixed(2)}</p>${budgetHtml}`;
}

function updateCharts(categoryTotals, incomeMonthly, expenseMonthly) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (incomeExpenseChartInstance) incomeExpenseChartInstance.destroy();
    
    if(DOM.categoryChart()) {
      categoryChartInstance = new Chart(DOM.categoryChart().getContext('2d'), {
          type: 'pie', data: { labels: Object.keys(categoryTotals), datasets: [{ data: Object.values(categoryTotals), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }] }
      });
    }

    if(DOM.incomeExpenseChart()) {
      const months = [...new Set([...Object.keys(incomeMonthly), ...Object.keys(expenseMonthly)])].sort();
      incomeExpenseChartInstance = new Chart(DOM.incomeExpenseChart().getContext('2d'), {
          type: 'line', data: { labels: months, datasets: [ { label: 'Income', data: months.map(m => incomeMonthly[m] || 0), borderColor: '#36A2EB', fill: false }, { label: 'Expense', data: months.map(m => expenseMonthly[m] || 0), borderColor: '#FF6384', fill: false } ] }, options: { scales: { y: { beginAtZero: true } } }
      });
    }
}

// ======= ADMIN FUNCTIONS (Restored) =======
async function loadAllUsersData() {
    DOM.adminSummaryDiv().innerHTML = 'Loading user data...';
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        DOM.adminSummaryDiv().innerHTML = '';
        if (usersSnapshot.empty) {
            DOM.adminSummaryDiv().innerHTML = '<p>No user data found.</p>';
            return;
        }
        for (const userDoc of usersSnapshot.docs) {
             const userId = userDoc.id;
             const [incomesSnapshot, expensesSnapshot] = await Promise.all([
                 getDocs(collection(db, "users", userId, "income")),
                 getDocs(collection(db, "users", userId, "expenses"))
             ]);
             
             let totalIncome = 0, totalExpense = 0;
             incomesSnapshot.forEach(doc => totalIncome += doc.data().amount || 0);
             expensesSnapshot.forEach(doc => totalExpense += doc.data().amount || 0);

             const userCard = document.createElement('div');
             userCard.className = 'card admin-user-card';
             userCard.dataset.userid = userId;
             userCard.innerHTML = `
                 <strong>User ID:</strong> ${escapeHTML(userId)}<br>
                 <strong>Email:</strong> ${escapeHTML(userDoc.data().email)}<br>
                 Income: $${totalIncome.toFixed(2)}, Expense: $${totalExpense.toFixed(2)}`;
             DOM.adminSummaryDiv().appendChild(userCard);
        }
    } catch (error) {
        showMessage(`Failed to load admin data: ${error.message}`, true);
        console.error("Admin data load error:", error);
    }
}

// ======= EVENT LISTENERS & INITIALIZATION =======
document.addEventListener("DOMContentLoaded", () => {
  showSection('auth-section');
  document.body.classList.add('auth-active');
  
  const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme !== 'dark') document.body.classList.add(savedTheme);
  const themeIcon = document.querySelector('#theme-toggle i');
  if (savedTheme === 'light') themeIcon.className = 'fa-solid fa-sun';
  else if (savedTheme === 'modern') themeIcon.className = 'fa-solid fa-swatchbook';

  document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('logout-btn-admin')?.addEventListener('click', logout);
  
  DOM.addIncomeBtn().addEventListener('click', () => {
    const data = { source: DOM.incomeSource().value.trim(), amount: parseFloat(DOM.incomeAmount().value) };
    if (!data.source || isNaN(data.amount) || data.amount <= 0) return showMessage('Invalid income data.', true);
    addOrUpdateEntry('income', data, editingIncomeId);
  });
  DOM.addExpenseBtn().addEventListener('click', () => {
    const data = { description: DOM.expenseDescription().value.trim(), category: DOM.expenseCategory().value.trim() || 'Other', amount: parseFloat(DOM.expenseAmount().value) };
    if (!data.description || isNaN(data.amount) || data.amount <= 0) return showMessage('Invalid expense data.', true);
    addOrUpdateEntry('expense', data, editingExpenseId);
  });
  document.getElementById('set-budget-btn').addEventListener('click', setBudget);
  
  DOM.incomeList().addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;
    const item = incomeCache.find(i => i.id === id);
    if (button.classList.contains('edit-btn')) startEditIncome(id, item.amount, item.source);
    if (button.classList.contains('delete-btn')) deleteEntry('income', id);
  });
  DOM.expenseList().addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;
    const item = expenseCache.find(i => i.id === id);
    if (button.classList.contains('edit-btn')) startEditExpense(id, item.amount, item.description, item.category);
    if (button.classList.contains('delete-btn')) deleteEntry('expense', id);
  });
  
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});

onAuthStateChanged(auth, user => {
  if (user && user.uid === ADMIN_UID) {
    isMaster = true;
    showSection('admin-section');
    loadAllUsersData();
    document.body.classList.remove('auth-active');
    return;
  }
  
  isMaster = false;
  if (user) {
    showSection('dashboard');
    document.body.classList.remove('auth-active');
    DOM.userDisplayName().textContent = user.displayName || user.email;
    DOM.userAvatarImg().src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=6a11cb&color=fff`;
    attachRealtimeListeners(user.uid);
  } else {
    showSection('auth-section');
    document.body.classList.add('auth-active');
    resetFinanceInputs();
    attachRealtimeListeners(null);
  }
});

// Make modal functions globally available
window.showHelp = (topic) => {
    const content = {
      'features': { title: 'Features', content: '<p>Track income, expenses, budgets, and view reports.</p>' },
      'privacy': { title: 'Privacy Policy', content: '<p>Your data is securely stored and is never shared.</p>' },
      'getting-started': { title: 'Getting Started', content: '<p>1. Add income. 2. Add expenses. 3. Set budgets. 4. View your overview.</p>' },
      'faq': { title: 'FAQ', content: '<p>Q: How do I edit an entry? A: Click the pencil icon.</p>' },
      'terms': { title: 'Terms of Service', content: '<p>Use this app responsibly.</p>' }
    };
    const { title, content: body } = content[topic] || { title: 'Help', content: 'Content not found.' };
    showModal(title, body);
};
window.showContact = () => showModal('Contact Us', '<p>For support, please reach out via our official channels.</p>');
window.exportData = () => showMessage("Exporting data...", false); // Placeholder
window.showIncomeForm = () => document.getElementById('income-source').scrollIntoView({ behavior: 'smooth', block: 'center' });
window.showExpenseForm = () => document.getElementById('expense-description').scrollIntoView({ behavior: 'smooth', block: 'center' });
window.showBudgetForm = () => document.getElementById('budget-category').scrollIntoView({ behavior: 'smooth', block: 'center' });

function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'help-modal';
    modal.innerHTML = `<div class="modal-overlay"></div><div class="modal-content"><div class="modal-header"><h3>${title}</h3><button class="modal-close">&times;</button></div><div class="modal-body">${content}</div></div>`;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    };
    modal.querySelector('.modal-overlay').onclick = closeModal;
    modal.querySelector('.modal-close').onclick = closeModal;
}

