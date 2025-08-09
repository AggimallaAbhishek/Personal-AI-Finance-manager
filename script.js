// MASTER LOGIN CREDENTIALS
const MASTER_USERNAME = "MasterVincent";
const MASTER_PASSWORD = "Master@210404";
let isMaster = false;

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyB8BfbOECPgrWIrJPw7d2dVKRNda6evID0",
  authDomain: "personal-finance-manager-a59ea.firebaseapp.com",
  projectId: "personal-finance-manager-a59ea",
  storageBucket: "personal-finance-manager-a59ea.firebasestorage.app",
  messagingSenderId: "162807840707",
  appId: "1:162807840707:web:2be1d036daf26683db0776",
  measurementId: "G-VYPHC8YMJM"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const authSection = document.getElementById('auth-section');
const financeSection = document.getElementById('finance-section');
const adminSection = document.getElementById('admin-section');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const messageDiv = document.getElementById('message');
const summaryDiv = document.getElementById('summary');
const adminSummaryDiv = document.getElementById('admin-summary');

let categoryChartInstance = null;
let incomeExpenseChartInstance = null;

function showMessage(msg, isError = false) {
  messageDiv.textContent = msg;
  messageDiv.style.color = isError ? 'red' : 'green';
  setTimeout(() => { messageDiv.textContent = ""; }, 5000);
}

function register() {
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  auth.createUserWithEmailAndPassword(email, password)
    .then(() => showMessage('Registration successful!'))
    .catch(error => showMessage(error.message, true));
}

function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  // Master Admin check
  if (email === MASTER_USERNAME && password === MASTER_PASSWORD) {
    isMaster = true;
    showMessage('Logged in as MASTER ADMIN');
    authSection.style.display = 'none';
    financeSection.style.display = 'none';
    adminSection.style.display = 'block';
    userInfo.style.display = 'block';
    userEmailSpan.textContent = `${MASTER_USERNAME} (Admin)`;
    loadAllUsersData();
    return;
  }

  // Normal login
  isMaster = false;
  auth.signInWithEmailAndPassword(email, password)
    .then(() => showMessage('Logged in successfully!'))
    .catch(error => showMessage(error.message, true));
}

function logout() {
  if (isMaster) {
    isMaster = false;
    userInfo.style.display = 'none';
    adminSection.style.display = 'none';
    authSection.style.display = 'block';
    adminSummaryDiv.innerHTML = '';
    return;
  }
  auth.signOut();
}

// -------- Master Admin View --------
async function loadAllUsersData() {
  adminSummaryDiv.innerHTML = "<h3>All Users Data</h3>";
  try {
    const usersSnap = await db.collection("users").get();
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      let incomes = await db.collection("users").doc(userId).collection("income").get();
      let expenses = await db.collection("users").doc(userId).collection("expenses").get();

      let totalIncome = 0, totalExpense = 0;
      incomes.forEach(doc => totalIncome += doc.data().amount);
      expenses.forEach(doc => totalExpense += doc.data().amount);

      adminSummaryDiv.innerHTML += `
        <div>
          <strong>User ID:</strong> ${userId}<br>
          Income: ${totalIncome.toFixed(2)}, Expense: ${totalExpense.toFixed(2)}, Balance: ${(totalIncome - totalExpense).toFixed(2)}
        </div>
      `;
    }
  } catch (e) {
    showMessage("Error fetching users data: " + e.message, true);
  }
}

// -------- Normal User Functions --------
async function loadFinanceData(userUid) {
  const incomes = await db.collection('users').doc(userUid).collection('income').get();
  const expenses = await db.collection('users').doc(userUid).collection('expenses').get();
  const budgetsSnap = await db.collection('users').doc(userUid).collection('budgets').get();

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryTotals = {};
  const budgets = {};

  incomes.forEach(doc => totalIncome += doc.data().amount);
  expenses.forEach(doc => {
    const { amount, category } = doc.data();
    totalExpense += amount;
    categoryTotals[category] = (categoryTotals[category] || 0) + amount;
  });
  budgetsSnap.forEach(doc => budgets[doc.id] = doc.data().amount);

  let html = `<p>Total Income: ${totalIncome.toFixed(2)}</p>`;
  html += `<p>Total Expense: ${totalExpense.toFixed(2)}</p>`;
  html += `<p>Balance: ${(totalIncome - totalExpense).toFixed(2)}</p>`;

  html += '<h3>Expenses by Category:</h3><ul>';
  for (const [cat, amt] of Object.entries(categoryTotals)) {
    html += `<li>${cat}: ${amt.toFixed(2)}</li>`;
  }
  html += '</ul>';

  html += '<h3>Budgets:</h3><ul>';
  for (const [cat, limit] of Object.entries(budgets)) {
    const spent = categoryTotals[cat] || 0;
    let status = '';
    if (spent >= limit) status = ' (Exceeded)';
    else if (spent >= 0.9 * limit) status = ' (Nearing limit)';
    html += `<li>${cat}: Limit = ${limit.toFixed(2)}${status}</li>`;
  }
  html += '</ul>';

  summaryDiv.innerHTML = html;

  // Destroy old charts
  if (categoryChartInstance) categoryChartInstance.destroy();
  if (incomeExpenseChartInstance) incomeExpenseChartInstance.destroy();

  // Pie Chart: Expenses by Category
  const ctxCategory = document.getElementById('categoryChart').getContext('2d');
  categoryChartInstance = new Chart(ctxCategory, {
    type: 'pie',
    data: {
      labels: Object.keys(categoryTotals),
      datasets: [{
        label: 'Expenses by Category',
        data: Object.values(categoryTotals),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
      }]
    }
  });

  // Bar Chart: Income vs Expense
  const ctxIncomeExpense = document.getElementById('incomeExpenseChart').getContext('2d');
  incomeExpenseChartInstance = new Chart(ctxIncomeExpense, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expense'],
      datasets: [{
        label: 'Amount',
        data: [totalIncome, totalExpense],
        backgroundColor: ['#36A2EB', '#FF6384']
      }]
    },
    options: { scales: { y: { beginAtZero: true } } }
  });
}

function addIncome() {
  const source = document.getElementById('income-source').value;
  const amount = parseFloat(document.getElementById('income-amount').value);
  if (!source || isNaN(amount) || amount <= 0) return showMessage('Invalid income entry', true);

  const user = auth.currentUser;
  db.collection('users').doc(user.uid).collection('income').add({
    source, amount, date: new Date()
  }).then(() => { showMessage('Income added'); loadFinanceData(user.uid); });
}

function addExpense() {
  const description = document.getElementById('expense-description').value;
  let category = document.getElementById('expense-category').value || 'Other';
  const amount = parseFloat(document.getElementById('expense-amount').value);
  if (!description || isNaN(amount) || amount <= 0) return showMessage('Invalid expense entry', true);

  const user = auth.currentUser;
  db.collection('users').doc(user.uid).collection('expenses').add({
    description, category, amount, date: new Date()
  }).then(() => { showMessage('Expense added'); loadFinanceData(user.uid); });
}

function setBudget() {
  const category = document.getElementById('budget-category').value;
  const amount = parseFloat(document.getElementById('budget-amount').value);
  if (!category || isNaN(amount) || amount <= 0) return showMessage('Invalid budget entry', true);

  const user = auth.currentUser;
  db.collection('users').doc(user.uid).collection('budgets').doc(category).set({ amount })
    .then(() => { showMessage('Budget set'); loadFinanceData(user.uid); });
}

// Firebase Auth listener
auth.onAuthStateChanged(user => {
  if (isMaster) return; // Master logged in manually
  if (user) {
    authSection.style.display = 'none';
    financeSection.style.display = 'block';
    adminSection.style.display = 'none';
    userInfo.style.display = 'block';
    userEmailSpan.textContent = user.email;
    loadFinanceData(user.uid);
  } else {
    authSection.style.display = 'block';
    financeSection.style.display = 'none';
    adminSection.style.display = 'none';
    userInfo.style.display = 'none';
    userEmailSpan.textContent = '';
    summaryDiv.innerHTML = '';
  }
});
