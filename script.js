// ======= CONFIGURATION (Firebase v9 modular) =======
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence, doc, getDoc, setDoc, updateDoc, addDoc, collection, serverTimestamp, onSnapshot, orderBy, query, getDocs, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";

const ADMIN_UID = "XmnfOTHAroTqlJE9GEIlu4Vo4Ay1"; 

if (!window.env) {
  console.warn("Using fallback keys for local testing.");
  window.env = {
    FIREBASE_API_KEY: "AIzaSyB8BfbOECPgrWIrJPw7d2dVKRNda6evID0",
    FIREBASE_AUTH_DOMAIN: "personal-finance-manager-a59ea.firebaseapp.com",
    FIREBASE_PROJECT_ID: "personal-finance-manager-a59ea",
    FIREBASE_STORAGE_BUCKET: "personal-finance-manager-a59ea.firebasestorage.app",
    FIREBASE_MESSAGING_SENDER_ID: "162807840707",
    FIREBASE_APP_ID: "1:162807840707:web:2be1d036daf26683db0776",
    FIREBASE_MEASUREMENT_ID: "G-VYPHC8YMJM"
  };
}

const firebaseConfig = {
  apiKey: window.env.FIREBASE_API_KEY,
  authDomain: window.env.FIREBASE_AUTH_DOMAIN,
  projectId: window.env.FIREBASE_PROJECT_ID,
  storageBucket: window.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: window.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: window.env.FIREBASE_APP_ID,
  measurementId: window.env.FIREBASE_MEASUREMENT_ID
};

let app, analytics, auth, db;
try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  auth = getAuth(app);
  db = getFirestore(app);
  enableIndexedDbPersistence(db).catch(error => console.warn('Firestore persistence failed:', error.code));
} catch (error) {
  console.error("Firebase initialization failed:", error);
  alert("Could not connect to Firebase. Please check your API keys and configuration.");
}

// ======= DOM ELEMENTS =======
const DOM = {
  loginSection: () => document.getElementById('login-section'),
  registerSection: () => document.getElementById('register-section'),
  dashboardSection: () => document.getElementById('dashboard'),
  adminSection: () => document.getElementById('admin-section'),
  userDisplayName: () => document.getElementById('user-display-name'),
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
  // Auth form elements
  loginUsername: () => document.getElementById('login-username'),
  loginPassword: () => document.getElementById('login-password'),
  regUsername: () => document.getElementById('reg-username'),
  regPassword: () => document.getElementById('reg-password'),
  regConfirmPassword: () => document.getElementById('reg-confirm-password'),
  usernameStatus: () => document.getElementById('username-status'),
  passwordRequirements: () => document.getElementById('password-requirements'),
  confirmPasswordStatus: () => document.getElementById('confirm-password-status'),
  registerBtn: () => document.getElementById('register-btn'),
};

// ======= STATE & UTILITY =======
let isMaster = false;
let categoryChartInstance, incomeExpenseChartInstance;
let editingIncomeId = null, editingExpenseId = null;
let incomeUnsubscribe, expenseUnsubscribe, budgetUnsubscribe;
let incomeCache = [], expenseCache = [], budgetCache = {};
let usernameCheckTimeout;

function showSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const current = document.querySelector('section:not([style*="display: none"])');

    if (current === target) return;

    if (current) {
        current.classList.add('section-exit');
        current.addEventListener('animationend', function handler() {
            current.style.display = 'none';
            current.classList.remove('section-exit');
            this.removeEventListener('animationend', handler);
        });
    }

    target.style.display = (sectionId.includes('dashboard') || sectionId.includes('admin')) ? 'flex' : 'block';
    target.classList.add('section-enter');
    target.addEventListener('animationend', function handler() {
        target.classList.remove('section-enter');
        this.removeEventListener('animationend', handler);
    });
}

function showMessage(message, isError = false) {
  const el = DOM.messageDiv();
  el.textContent = message;
  el.className = isError ? 'message-box error show' : 'message-box success show';
  setTimeout(() => el.classList.remove('show'), 5000);
}

// ======= AUTHENTICATION =======
async function register() {
    const username = DOM.regUsername().value.trim();
    const password = DOM.regPassword().value;
    const confirmPassword = DOM.regConfirmPassword().value;

    if (password !== confirmPassword) {
        return showMessage("Passwords do not match.", true);
    }
    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*.,?]).{8,}$/;
    if (!passwordRegex.test(password)) {
        return showMessage("Password does not meet the requirements.", true);
    }

    try {
        const usernameLower = username.toLowerCase();
        const usernameRef = doc(db, 'usernames', usernameLower);
        const docSnap = await getDoc(usernameRef);

        if (docSnap.exists()) {
            return showMessage("Username is already taken.", true);
        }

        const dummyEmail = `${usernameLower}@pfm.local`;
        const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
        const user = userCredential.user;

        await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, "users", user.uid);
            transaction.set(usernameRef, { uid: user.uid });
            transaction.set(userDocRef, { username: username });
        });

        showMessage("Registration successful! Please log in.");
        showSection('login-section');
    } catch (error) {
        console.error("Registration Error:", error);
        showMessage(error.message, true);
    }
}

async function login() {
    const username = DOM.loginUsername().value.trim();
    const password = DOM.loginPassword().value;

    if (!username || !password) {
        return showMessage("Please enter username and password.", true);
    }

    try {
        const dummyEmail = `${username.toLowerCase()}@pfm.local`;
        await signInWithEmailAndPassword(auth, dummyEmail, password);
    } catch (error) {
        console.error("Login Error:", error);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            showMessage("Invalid username or password.", true);
        } else {
            showMessage(error.message, true);
        }
    }
}

function logout() {
    isMaster = false;
    signOut(auth).catch(error => console.error("Logout error:", error));
}


// ======= REGISTRATION FORM VALIDATION =======
function validateRegistrationForm() {
    const username = DOM.regUsername().value.trim();
    const password = DOM.regPassword().value;
    const confirmPassword = DOM.regConfirmPassword().value;

    let isUsernameAvailable = false;
    let isUsernameLengthValid = username.length >= 3;
    
    if (isUsernameLengthValid) {
        DOM.usernameStatus().textContent = 'Checking...';
        DOM.usernameStatus().className = 'input-hint';
        clearTimeout(usernameCheckTimeout);
        usernameCheckTimeout = setTimeout(async () => {
            const usernameRef = doc(db, 'usernames', username.toLowerCase());
            const docSnap = await getDoc(usernameRef);
            if (docSnap.exists()) {
                DOM.usernameStatus().textContent = 'Username is already taken.';
                DOM.usernameStatus().className = 'input-hint error';
                isUsernameAvailable = false;
            } else {
                DOM.usernameStatus().textContent = 'Username is available!';
                DOM.usernameStatus().className = 'input-hint success';
                isUsernameAvailable = true;
            }
            checkAllFields();
        }, 500);
    } else {
        DOM.usernameStatus().textContent = 'Username must be at least 3 characters.';
        DOM.usernameStatus().className = 'input-hint error';
        isUsernameAvailable = false;
    }

    const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*.,?]).{8,}$/;
    const isPasswordValid = passwordRegex.test(password);
    DOM.passwordRequirements().className = isPasswordValid ? 'input-hint success' : 'input-hint';
    if (!isPasswordValid && password.length > 0) {
        DOM.passwordRequirements().className = 'input-hint error';
    }


    const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;
    if (confirmPassword.length > 0) {
        DOM.confirmPasswordStatus().textContent = doPasswordsMatch ? 'Passwords match.' : 'Passwords do not match.';
        DOM.confirmPasswordStatus().className = doPasswordsMatch ? 'input-hint success' : 'input-hint error';
    } else {
         DOM.confirmPasswordStatus().textContent = '';
    }

    function checkAllFields() {
       DOM.registerBtn().disabled = !(isUsernameAvailable && isPasswordValid && doPasswordsMatch);
    }
    // We call this here for immediate feedback on password fields, 
    // and rely on the async check to handle the username part.
    checkAllFields(); 
}


// ======= FINANCE & DATA FUNCTIONS =======
function resetFinanceInputs() {
  document.querySelectorAll('.form-card input').forEach(input => input.value = '');
  DOM.addIncomeBtn().textContent = 'Add Income';
  DOM.addExpenseBtn().textContent = 'Add Expense';
  editingIncomeId = null;
  editingExpenseId = null;
}

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

function attachRealtimeListeners(userId) {
    if (incomeUnsubscribe) incomeUnsubscribe();
    if (expenseUnsubscribe) expenseUnsubscribe();
    if (budgetUnsubscribe) budgetUnsubscribe();

    if (!userId) {
        incomeCache = [], expenseCache = [], budgetCache = {};
        renderFromCaches();
        return;
    }

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
        const base = `<li><span>${type === 'income' ? item.source : `${item.description} (${item.category || 'Other'})`}: $${amount.toFixed(2)}</span>`;
        const buttons = `<span class="entry-buttons"><button class="edit-btn" data-id="${item.id}"><i class="fas fa-pen"></i></button><button class="delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button></span></li>`;
        if (type === 'income') { totalIncome += amount; incomeMonthly[getMonthKey(item.date)] = (incomeMonthly[getMonthKey(item.date)] || 0) + amount; }
        else { totalExpense += amount; const category = item.category || 'Other'; categoryTotals[category] = (categoryTotals[category] || 0) + amount; expenseMonthly[getMonthKey(item.date)] = (expenseMonthly[getMonthKey(item.date)] || 0) + amount; }
        return base + buttons;
    };
    
    DOM.incomeList().innerHTML = incomeCache.map(item => createListItemHTML(item, 'income')).join('') || "<li>No income recorded.</li>";
    DOM.expenseList().innerHTML = expenseCache.map(item => createListItemHTML(item, 'expense')).join('') || "<li>No expenses recorded.</li>";
    
    updateSummary(totalIncome, totalExpense, budgetCache, categoryTotals);
    updateCharts(categoryTotals, incomeMonthly, expenseMonthly);
}

function updateSummary(totalIncome, totalExpense, budgets, categoryTotals) {
  const balance = totalIncome - totalExpense;
  DOM.summaryDiv().innerHTML = `<p>Total Income: $${totalIncome.toFixed(2)}</p><p>Total Expense: $${totalExpense.toFixed(2)}</p><p>Balance: $${balance.toFixed(2)}</p><h3>Budgets:</h3><ul>` +
  (Object.keys(budgets).length === 0 ? '<li>No budgets set.</li>' : Object.entries(budgets).map(([category, limit]) => {
      const spent = categoryTotals[category] || 0;
      const percentage = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      const budgetClass = percentage >= 100 ? 'budget-bar-red' : percentage >= 90 ? 'budget-bar-yellow' : 'budget-bar-green';
      return `<li><span>${category}: $${limit.toFixed(2)}</span><div class="budget-bar-container"><div class="budget-bar-fill ${budgetClass}" style="width:${percentage}%;"></div></div><small>Used: $${spent.toFixed(2)} (${percentage.toFixed(1)}%)</small></li>`;
  }).join('')) + '</ul>';
}

function updateCharts(categoryTotals, incomeMonthly, expenseMonthly) {
    if (categoryChartInstance) categoryChartInstance.destroy();
    if (incomeExpenseChartInstance) incomeExpenseChartInstance.destroy();
    
    if(DOM.categoryChart()) categoryChartInstance = new Chart(DOM.categoryChart().getContext('2d'), { type: 'pie', data: { labels: Object.keys(categoryTotals), datasets: [{ data: Object.values(categoryTotals), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }] } });

    if(DOM.incomeExpenseChart()) {
      const months = [...new Set([...Object.keys(incomeMonthly), ...Object.keys(expenseMonthly)])].sort();
      incomeExpenseChartInstance = new Chart(DOM.incomeExpenseChart().getContext('2d'), { type: 'line', data: { labels: months, datasets: [ { label: 'Income', data: months.map(m => incomeMonthly[m] || 0), borderColor: '#36A2EB', fill: false }, { label: 'Expense', data: months.map(m => expenseMonthly[m] || 0), borderColor: '#FF6384', fill: false } ] }, options: { scales: { y: { beginAtZero: true } } } });
    }
}

async function loadAllUsersData() { /* ... unchanged ... */ }

// ======= EVENT LISTENERS & INITIALIZATION =======
document.addEventListener("DOMContentLoaded", () => {
  if (!auth) return;
  showSection('login-section');
  document.body.classList.add('auth-active');

  document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); showSection('register-section'); });
  document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); showSection('login-section'); });

  document.getElementById('login-btn').addEventListener('click', login);
  document.getElementById('register-btn').addEventListener('click', register);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('logout-btn-admin')?.addEventListener('click', logout);

  DOM.regUsername().addEventListener('input', validateRegistrationForm);
  DOM.regPassword().addEventListener('input', validateRegistrationForm);
  DOM.regConfirmPassword().addEventListener('input', validateRegistrationForm);

  const addIncomeBtn = document.getElementById('add-income-btn');
  if(addIncomeBtn) addIncomeBtn.addEventListener('click', () => {
    const data = { source: DOM.incomeSource().value.trim(), amount: parseFloat(DOM.incomeAmount().value) };
    if (!data.source || isNaN(data.amount) || data.amount <= 0) return showMessage('Invalid income data.', true);
    addOrUpdateEntry('income', data, editingIncomeId);
  });

  const addExpenseBtn = document.getElementById('add-expense-btn');
  if(addExpenseBtn) addExpenseBtn.addEventListener('click', () => {
    const data = { description: DOM.expenseDescription().value.trim(), category: DOM.expenseCategory().value.trim() || 'Other', amount: parseFloat(DOM.expenseAmount().value) };
    if (!data.description || isNaN(data.amount) || data.amount <= 0) return showMessage('Invalid expense data.', true);
    addOrUpdateEntry('expense', data, editingExpenseId);
  });
  
  document.getElementById('set-budget-btn')?.addEventListener('click', setBudget);
  
  const listActionHandler = (e, type, cache) => {
    const button = e.target.closest('button');
    if (!button) return;
    const id = button.dataset.id;
    const item = cache.find(i => i.id === id);
    if (!item) return;
    if (button.classList.contains('edit-btn')) {
        if (type === 'income') startEditIncome(id, item.amount, item.source);
        else startEditExpense(id, item.amount, item.description, item.category);
    }
    if (button.classList.contains('delete-btn')) deleteEntry(type, id);
  };
  DOM.incomeList().addEventListener('click', (e) => listActionHandler(e, 'income', incomeCache));
  DOM.expenseList().addEventListener('click', (e) => listActionHandler(e, 'expense', expenseCache));
});

onAuthStateChanged(auth, async (user) => {
  if (user && user.uid === ADMIN_UID) {
    isMaster = true;
    showSection('admin-section');
    document.body.classList.remove('auth-active');
    loadAllUsersData();
    return;
  }
  
  isMaster = false;
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        DOM.userDisplayName().textContent = userDoc.data().username;
    }
    showSection('dashboard');
    document.body.classList.remove('auth-active');
    attachRealtimeListeners(user.uid);
  } else {
    showSection('login-section');
    document.body.classList.add('auth-active');
    attachRealtimeListeners(null);
  }
});

