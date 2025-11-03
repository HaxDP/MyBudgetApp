CREATE DATABASE IF NOT EXISTS mybudgetapp
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mybudgetapp;

CREATE TABLE Users (
    UserID INT AUTO_INCREMENT PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Email VARCHAR(255) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL COMMENT 'У реальному проєкті тут зберігався б хеш пароля',
    RegistrationDate DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Wallets (
    WalletID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Balance DECIMAL(15, 2) DEFAULT 0.00,
    Currency VARCHAR(10) DEFAULT 'UAH',
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE Categories (
    CategoryID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    Name VARCHAR(100) NOT NULL,
    Type ENUM('дохід', 'витрата') NOT NULL,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE Transactions (
    TransactionID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    WalletID INT NOT NULL,
    CategoryID INT NOT NULL,
    Amount DECIMAL(15, 2) NOT NULL,
    Type ENUM('дохід', 'витрата') NOT NULL,
    Date DATETIME DEFAULT CURRENT_TIMESTAMP,
    Description TEXT,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (WalletID) REFERENCES Wallets(WalletID) ON DELETE CASCADE,
    FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID) ON DELETE RESTRICT
);

CREATE TABLE Goals (
    GoalID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    Name VARCHAR(255) NOT NULL,
    TargetAmount DECIMAL(15, 2) NOT NULL,
    CurrentAmount DECIMAL(15, 2) DEFAULT 0.00,
    Deadline DATE,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE
);

CREATE TABLE Budgets (
    BudgetID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    CategoryID INT NOT NULL,
    Amount DECIMAL(15, 2) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    FOREIGN KEY (UserID) REFERENCES Users(UserID) ON DELETE CASCADE,
    FOREIGN KEY (CategoryID) REFERENCES Categories(CategoryID) ON DELETE CASCADE
);

CREATE INDEX idx_trans_user_date ON Transactions(UserID, Date);
CREATE INDEX idx_budgets_user_period ON Budgets(UserID, StartDate, EndDate);

INSERT INTO Users (Name, Email, Password) VALUES ('Test User', 'test@example.com', '1234554321');

INSERT INTO Wallets (UserID, Name, Balance) VALUES (1, 'Готівка', 1000);

INSERT INTO Categories (UserID, Name, Type) VALUES (1, 'Їжа', 'витрата');

INSERT INTO Goals (UserID, Name, TargetAmount, CurrentAmount) VALUES (1, 'Ноутбук', 20000, 5000);