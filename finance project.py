# Personal Finance Manager - Console App (Basic Prototype)

import json
import os

# --- Add this to the top of the python file (after imports) ---
CATEGORY_KEYWORDS = {
    "Food": ["pizza", "restaurant", "lunch", "dinner", "coffee", "groceries", "breakfast", "snacks"],
    "Travel": ["uber", "taxi", "flight", "train", "bus", "cab", "fuel", "petrol"],
    "Bills": ["electricity", "water", "internet", "phone", "gas", "rent"]
# We can add more categories and keywords if neccessary.
}

def suggest_category(description):
    description = description.lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in description for keyword in keywords):
            return category
        return "Other"
    

# File paths for data storage
INCOME_FILE = "income_data.json"
EXPENSE_FILE = "expense_data.json"

# Load data from files or initialize empty lists
def load_data():
    if os.path.exists(INCOME_FILE):
        with open(INCOME_FILE, "r") as f:
            income_entries = json.load(f)

    else:
        income_entries = []

    if os.path.exists(EXPENSE_FILE):
        with open(EXPENSE_FILE, "r") as f:
            expense_entries = json.load(f)

    else:
        expense_entries = []

    return income_entries, expense_entries

# Save data to files
def save_data(income_entries, expense_entries):
    with open(INCOME_FILE, "w") as f:
        json.dump(income_entries, f, indent=4)
    with open(EXPENSE_FILE, "w") as f:
        json.dump(expense_entries, f, indent=4)

# Add income entry and save
def add_income(income_entries, expense_entries):
    source = input("Enter income source: ")
    try:
        amount = float(input("Enter income amount: "))
        income_entries.append({"source": source, "amount": amount})
        save_data(income_entries, expense_entries)
        print("Income added and saved successfully.\n")
    except ValueError:
        print("Invalid amount. Please enter a number.\n")

# Add expense entry and save
def add_expense(income_entries, expense_entries):
    description = input("Enter expense description: ")
    auto_category = suggest_category(description)
    print(f"Suggested category: {auto_category}")
    category = input(f"Enter expense category (Press Enter to accept'{auto_category}'): ")
    category = category if category else auto_category
    try:
        amount = float (input("Enter expense amount: "))
        expense_entries.append

#view summary report
def view_summary(income_entries, expense_entries):
    total_income = sum(entry["amount"] for entry in income_entries)
    total_expense = sum(entry["amount"] for entry in expense_entries)

    print("\n----- summary -----")
    print(f"Total Income: {total_income:.2f}")
    print(f"Total Expense: {total_expense:.2f}")
    print(f"Balance: {total_income - total_expense:.2f}\n")

    print("Expenses by Category:")
    category_total = {}
    for entry in expense_entries:
        category_total[entry["category"]] = category_total.get(entry["category"], 0) + entry["amount"]
        for category, amount in category_total.items():
            print(f" {category}: {amount:.2f}")
        print("----------------\n")

def main():
    income_entries, expense_entries = load_data()

    while True:
        print("Personal Finance Manager")
        print("1. Add Income")
        print("2. Add Expense")
        print("3. View Summary")
        print("4. Exit")
        choice = input("Choose an option: ")

        if choice == "1":
            add_income(income_entries, expense_entries)
        elif choice == "2":
            add_expense(income_entries, expense_entries)
        elif choice == "3":
            view_summary(income_entries, expense_entries)
        elif choice == "4":
            print("Existing program, Goodbye!")
            break
        else:
            print("Invalid choise. Please select a valid option.\n")

if __name__ == "__main__":
    main()