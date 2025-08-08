import json
import os
import hashlib
import matplotlib.pyplot as plt
from datetime import datetime

# Keywords for auto-categorizing expenses
CATEGORY_KEYWORDS = {
    "Food": ["pizza", "restaurant", "lunch", "dinner", "coffee", "groceries", "breakfast", "snacks"],
    "Travel": ["uber", "taxi", "flight", "train", "bus", "cab", "fuel", "petrol"],
    "Bills": ["electricity", "water", "internet", "phone", "gas", "rent"],
}

USERS_FILE = "users.json"

MASTER_USERNAME = "MasterVincent"
MASTER_PASSWORD_HASH = hashlib.sha256("Master@210404".encode()).hexdigest()

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def load_users():
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading users: {e}")
            return {}
    else:
        return {}

def save_users(users):
    try:
        with open(USERS_FILE, "w") as f:
            json.dump(users, f, indent=4)
    except Exception as e:
        print(f"Error saving users: {e}")

def get_data_filenames(username):
    return (f"{username}_income.json", f"{username}_expense.json", f"{username}_budgets.json")

def load_data(username):
    income_file, expense_file, _ = get_data_filenames(username)
    try:
        if os.path.exists(income_file):
            with open(income_file, "r") as f:
                income_entries = json.load(f)
        else:
            income_entries = []
    except Exception as e:
        print(f"Error loading income data: {e}")
        income_entries = []

    try:
        if os.path.exists(expense_file):
            with open(expense_file, "r") as f:
                expense_entries = json.load(f)
        else:
            expense_entries = []
    except Exception as e:
        print(f"Error loading expense data: {e}")
        expense_entries = []

    return income_entries, expense_entries

def save_data(username, income_entries, expense_entries):
    income_file, expense_file, _ = get_data_filenames(username)
    try:
        with open(income_file, "w") as f:
            json.dump(income_entries, f, indent=4)
    except Exception as e:
        print(f"Error saving income data: {e}")
    try:
        with open(expense_file, "w") as f:
            json.dump(expense_entries, f, indent=4)
    except Exception as e:
        print(f"Error saving expense data: {e}")

def load_budgets(username):
    _, _, budget_file = get_data_filenames(username)
    try:
        if os.path.exists(budget_file):
            with open(budget_file, "r") as f:
                return json.load(f)
        else:
            return {}
    except Exception as e:
        print(f"Error loading budgets: {e}")
        return {}

def save_budgets(username, budgets):
    _, _, budget_file = get_data_filenames(username)
    try:
        with open(budget_file, "w") as f:
            json.dump(budgets, f, indent=4)
    except Exception as e:
        print(f"Error saving budgets: {e}")

def suggest_category(description):
    description = description.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in description for keyword in keywords):
            return category
    return "Other"

def get_menu_choice(options):
    while True:
        choice = input("Choose an option: ").strip()
        if choice in options:
            return choice
        print(f"Invalid choice. Please enter one of {', '.join(options)}.")

def get_positive_float(prompt):
    while True:
        val = input(prompt).strip()
        try:
            num = float(val)
            if num > 0:
                return num
            else:
                print("Please enter a positive number.")
        except ValueError:
            print("Invalid input. Please enter a valid number.")

def show_help():
    print("\n--- Personal Finance Manager Help ---")
    print("This app helps you manage your income, expenses, budgets, and visualize your finances.")
    print("Main features:")
    print("- Add income and expense entries with descriptions and categories.")
    print("- Automatically categorizes expenses based on keywords.")
    print("- Set budget limits and get alerts when nearing or exceeding budgets.")
    print("- View summaries and visual charts.")
    print("- User authentication with master admin access.")
    print("\nNavigate menus by inputting the numbers shown.")
    print("Ensure you enter valid data when prompted.\n")

def register_user(users):
    print("\n--- User Registration ---")
    username = input("Enter new username: ").strip()
    if username == MASTER_USERNAME:
        print("This username is reserved. Please choose a different one.\n")
        return None
    if username in users:
        print("Username already exists. Please choose a different one.\n")
        return None
    password = input("Enter password: ")
    password_confirm = input("Confirm password: ")
    if password != password_confirm:
        print("Passwords do not match. Registration failed.\n")
        return None
    users[username] = hash_password(password)
    save_users(users)
    print(f"User '{username}' registered successfully.\n")
    return username

def login_user(users):
    print("\n--- User Login ---")
    username = input("Username: ").strip()
    password = input("Password: ")

    # Master login check
    if username == MASTER_USERNAME and hash_password(password) == MASTER_PASSWORD_HASH:
        print("Master login successful. Admin privileges granted.\n")
        return MASTER_USERNAME

    if username not in users:
        print("User not found. Please register first.\n")
        return None
    if users[username] != hash_password(password):
        print("Incorrect password.\n")
        return None
    print(f"Logged in as '{username}'.\n")
    return username

def add_income(username, income_entries, expense_entries):
    source = input("Enter income source: ").strip()
    while source == "":
        print("Source cannot be empty.")
        source = input("Enter income source: ").strip()
    amount = get_positive_float("Enter income amount: ")
    income_entries.append({
        "source": source,
        "amount": amount,
        "date": datetime.now().strftime("%Y-%m-%d")
    })
    save_data(username, income_entries, expense_entries)
    print("Income added and saved successfully.\n")

def set_budget(username, budgets):
    category = input("Enter category to set budget for: ").strip()
    while category == "":
        print("Category cannot be empty.")
        category = input("Enter category to set budget for: ").strip()
    amount = get_positive_float(f"Enter budget amount for '{category}': ")
    budgets[category] = amount
    save_budgets(username, budgets)
    print(f"Budget for '{category}' set to {amount:.2f}\n")

def get_category_total(expense_entries, category):
    return sum(entry["amount"] for entry in expense_entries if entry["category"] == category)

def check_budget_alert(expense_entries, budgets, category):
    if category in budgets:
        spent = get_category_total(expense_entries, category)
        budget = budgets[category]
        if spent >= budget:
            print(f"*** ALERT: You have exceeded your budget for '{category}'! ***")
        elif spent >= 0.9 * budget:
            print(f"*** Warning: You are nearing your budget limit for '{category}'. ***")

def add_expense(username, income_entries, expense_entries, budgets):
    description = input("Enter expense description: ").strip()
    while description == "":
        print("Description cannot be empty.")
        description = input("Enter expense description: ").strip()
    auto_category = suggest_category(description)
    print(f"Suggested category: {auto_category}")
    category = input(f"Enter expense category (Press Enter to accept '{auto_category}'): ").strip()
    category = category if category else auto_category
    amount = get_positive_float("Enter expense amount: ")
    expense_entries.append({
        "category": category,
        "amount": amount,
        "description": description,
        "date": datetime.now().strftime("%Y-%m-%d")
    })
    save_data(username, income_entries, expense_entries)
    print("Expense added and saved successfully.\n")
    check_budget_alert(expense_entries, budgets, category)

def plot_expenses_by_category(expense_entries):
    if not expense_entries:
        print("No expense data to display.\n")
        return
    category_totals = {}
    for entry in expense_entries:
        category_totals[entry["category"]] = category_totals.get(entry["category"], 0) + entry["amount"]
    categories = list(category_totals.keys())
    amounts = [category_totals[cat] for cat in categories]

    plt.bar(categories, amounts)
    plt.xlabel("Category")
    plt.ylabel("Total Expense")
    plt.title("Expenses by Category")
    plt.show()

def view_summary(income_entries, expense_entries, budgets):
    total_income = sum(entry["amount"] for entry in income_entries)
    total_expense = sum(entry["amount"] for entry in expense_entries)

    print("\n----- Summary -----")
    print(f"Total Income: {total_income:.2f}")
    print(f"Total Expense: {total_expense:.2f}")
    print(f"Balance: {total_income - total_expense:.2f}\n")

    print("Expenses by Category:")
    category_totals = {}
    for entry in expense_entries:
        category_totals[entry["category"]] = category_totals.get(entry["category"], 0) + entry["amount"]
    for category, amount in category_totals.items():
        line = f"  {category}: {amount:.2f}"
        if budgets.get(category):
            line += f" / Budget: {budgets[category]:.2f}"
            if amount >= budgets[category]:
                line += " (Exceeded)"
            elif amount >= 0.9 * budgets[category]:
                line += " (Nearing limit)"
        print(line)
    print("-------------------\n")

def plot_income_vs_expense_over_time(income_entries, expense_entries):
    if not income_entries and not expense_entries:
        print("No income or expense data to display.\n")
        return
    def get_month_key(date_str):
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%Y-%m")

    filtered_entries = [e for e in income_entries + expense_entries if 'date' in e]

    if not filtered_entries:
        print("No dated entries to plot.\n")
        return

    months = sorted({get_month_key(e["date"]) for e in filtered_entries})

    income_monthly = {m: 0 for m in months}
    expense_monthly = {m: 0 for m in months}

    for e in income_entries:
        if 'date' in e:
            m = get_month_key(e["date"])
            income_monthly[m] += e["amount"]

    for e in expense_entries:
        if 'date' in e:
            m = get_month_key(e["date"])
            expense_monthly[m] += e["amount"]

    plt.plot(months, [income_monthly[m] for m in months], label="Income", marker="o")
    plt.plot(months, [expense_monthly[m] for m in months], label="Expense", marker="o")
    plt.xlabel("Month")
    plt.ylabel("Amount")
    plt.title("Monthly Income vs. Expense")
    plt.legend()
    plt.show()

def admin_menu(users):
    while True:
        print("\n--- Master Admin Menu ---")
        print("1. List all users")
        print("2. Reset user password")
        print("3. Delete user account")
        print("4. Logout")
        choice = get_menu_choice({"1", "2", "3", "4"})

        if choice == "1":
            print("\nRegistered Users:")
            for user in users:
                if user != MASTER_USERNAME:
                    print(f"- {user}")
            print()
        elif choice == "2":
            username = input("Enter the username to reset password: ").strip()
            if username == MASTER_USERNAME:
                print("Cannot reset master password.\n")
            elif username in users:
                new_password = input(f"Enter new password for '{username}': ")
                password_confirm = input("Confirm new password: ")
                if new_password == password_confirm:
                    users[username] = hash_password(new_password)
                    save_users(users)
                    print(f"Password updated for user '{username}'.\n")
                else:
                    print("Passwords do not match. Password not changed.\n")
            else:
                print("User not found.\n")
        elif choice == "3":
            username = input("Enter the username to delete: ").strip()
            if username == MASTER_USERNAME:
                print("Cannot delete master user.\n")
            elif username in users:
                confirm = input(f"Are you sure you want to delete user '{username}'? This cannot be undone (yes/no): ").strip().lower()
                if confirm == "yes":
                    users.pop(username)
                    save_users(users)
                    income_file, expense_file, budget_file = get_data_filenames(username)
                    for file in [income_file, expense_file, budget_file]:
                        if os.path.exists(file):
                            try:
                                os.remove(file)
                            except Exception as e:
                                print(f"Error deleting file {file}: {e}")
                    print(f"User '{username}' and their data deleted.\n")
                else:
                    print("Deletion cancelled.\n")
            else:
                print("User not found.\n")
        elif choice == "4":
            print("Logging out of master admin account.\n")
            break

def main():
    users = load_users()
    current_user = None

    try:
        while True:
            if not current_user:
                print("Welcome to Personal Finance Manager")
                print("1. Login")
                print("2. Register")
                print("3. Help")
                print("4. Exit")
                choice = get_menu_choice({"1", "2", "3", "4"})

                if choice == "1":
                    user = login_user(users)
                    if user:
                        current_user = user
                        if current_user == MASTER_USERNAME:
                            admin_menu(users)
                            current_user = None
                        else:
                            income_entries, expense_entries = load_data(current_user)
                            budgets = load_budgets(current_user)
                elif choice == "2":
                    user = register_user(users)
                    if user:
                        current_user = user
                        income_entries, expense_entries = [], []
                        budgets = {}
                elif choice == "3":
                    show_help()
                elif choice == "4":
                    print("Exiting program. Goodbye!")
                    break
            else:
                print(f"\nLogged in as: {current_user}")
                print("1. Add Income")
                print("2. Add Expense")
                print("3. View Summary")
                print("4. Set Category Budget")
                print("5. Logout")
                print("6. Visualize Expenses by Category")
                print("7. Visualize Monthly Income vs. Expense")
                print("8. Help")
                choice = get_menu_choice({"1", "2", "3", "4", "5", "6", "7", "8"})

                if choice == "1":
                    add_income(current_user, income_entries, expense_entries)
                elif choice == "2":
                    add_expense(current_user, income_entries, expense_entries, budgets)
                elif choice == "3":
                    view_summary(income_entries, expense_entries, budgets)
                elif choice == "4":
                    set_budget(current_user, budgets)
                elif choice == "5":
                    print(f"User '{current_user}' logged out.\n")
                    current_user = None
                elif choice == "6":
                    plot_expenses_by_category(expense_entries)
                elif choice == "7":
                    plot_income_vs_expense_over_time(income_entries, expense_entries)
                elif choice == "8":
                    show_help()

    except KeyboardInterrupt:
        print("\n\nProgram interrupted. Exiting gracefully. Goodbye!")

if __name__ == "__main__":
    main()
