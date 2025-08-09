from flask import Flask, render_template, request, redirect, url_for, session, flash
import json
import os
import hashlib
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Change this to a secure secret key!

USERS_FILE = 'users.json'

MASTER_USERNAME = "MasterVincent"
MASTER_PASSWORD_HASH = hashlib.sha256("Master@210404".encode()).hexdigest()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=4)

def get_data_filenames(username):
    return (f"{username}_income.json", f"{username}_expense.json", f"{username}_budgets.json")

def load_data(username):
    income_file, expense_file, _ = get_data_filenames(username)
    if os.path.exists(income_file):
        with open(income_file, 'r') as f:
            income_entries = json.load(f)
    else:
        income_entries = []

    if os.path.exists(expense_file):
        with open(expense_file, 'r') as f:
            expense_entries = json.load(f)
    else:
        expense_entries = []

    return income_entries, expense_entries

def save_data(username, income_entries, expense_entries):
    income_file, expense_file, _ = get_data_filenames(username)
    with open(income_file, 'w') as f:
        json.dump(income_entries, f, indent=4)
    with open(expense_file, 'w') as f:
        json.dump(expense_entries, f, indent=4)

# ROUTES BELOW

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']

        if username == MASTER_USERNAME and hash_password(password) == MASTER_PASSWORD_HASH:
            session['username'] = username
            session['is_master'] = True
            flash('Logged in as Master Admin.', 'success')
            return redirect(url_for('dashboard'))

        users = load_users()
        if username in users and users[username] == hash_password(password):
            session['username'] = username
            session['is_master'] = False
            flash(f'Welcome, {username}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'danger')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username'].strip()
        password = request.form['password']
        password_confirm = request.form['password_confirm']

        if username == MASTER_USERNAME:
            flash('This username is reserved.', 'danger')
            return redirect(url_for('register'))

        users = load_users()
        if username in users:
            flash('Username already exists.', 'danger')
            return redirect(url_for('register'))

        if password != password_confirm:
            flash('Passwords do not match.', 'danger')
            return redirect(url_for('register'))

        users[username] = hash_password(password)
        save_users(users)
        flash('Registration successful. Please log in.', 'success')
        return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'username' not in session:
        flash('Please log in to access the dashboard.', 'warning')
        return redirect(url_for('login'))

    username = session['username']
    income_entries, expense_entries = load_data(username)

    total_income = sum(entry['amount'] for entry in income_entries)
    total_expense = sum(entry['amount'] for entry in expense_entries)
    balance = total_income - total_expense

    # Simple expense categorization for display (optional enhancement later)
    category_totals = {}
    for entry in expense_entries:
        category = entry.get('category', 'Other')
        category_totals[category] = category_totals.get(category, 0) + entry['amount']

    return render_template('dashboard.html', username=username,
                           income=total_income,
                           expense=total_expense,
                           balance=balance,
                           category_totals=category_totals)

@app.route('/add_income', methods=['GET', 'POST'])
def add_income():
    if 'username' not in session:
        flash('Please log in first.', 'warning')
        return redirect(url_for('login'))

    if request.method == 'POST':
        source = request.form['source'].strip()
        amount_str = request.form['amount'].strip()
        if not source:
            flash('Income source cannot be empty.', 'danger')
            return redirect(url_for('add_income'))
        try:
            amount = float(amount_str)
            if amount <= 0:
                raise ValueError
        except ValueError:
            flash('Enter a valid positive amount.', 'danger')
            return redirect(url_for('add_income'))

        username = session['username']
        income_entries, expense_entries = load_data(username)
        income_entries.append({
            'source': source,
            'amount': amount,
            'date': datetime.now().strftime("%Y-%m-%d")
        })
        save_data(username, income_entries, expense_entries)
        flash('Income added successfully!', 'success')
        return redirect(url_for('dashboard'))

    return render_template('add_income.html')

@app.route('/add_expense', methods=['GET', 'POST'])
def add_expense():
    if 'username' not in session:
        flash('Please log in first.', 'warning')
        return redirect(url_for('login'))

    if request.method == 'POST':
        description = request.form['description'].strip()
        category = request.form['category'].strip()
        amount_str = request.form['amount'].strip()
        if not description:
            flash('Description cannot be empty.', 'danger')
            return redirect(url_for('add_expense'))
        if not category:
            category = 'Other'
        try:
            amount = float(amount_str)
            if amount <= 0:
                raise ValueError
        except ValueError:
            flash('Enter a valid positive amount.', 'danger')
            return redirect(url_for('add_expense'))

        username = session['username']
        income_entries, expense_entries = load_data(username)
        expense_entries.append({
            'description': description,
            'category': category,
            'amount': amount,
            'date': datetime.now().strftime("%Y-%m-%d")
        })
        save_data(username, income_entries, expense_entries)
        flash('Expense added successfully!', 'success')
        return redirect(url_for('dashboard'))

    return render_template('add_expense.html')

if __name__ == "__main__":
    app.run(debug=True)
