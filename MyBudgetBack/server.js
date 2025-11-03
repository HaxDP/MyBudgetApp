const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const pool = require('./db');

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
    'https://monumental-alpaca-f9eea3.netlify.app'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
}));
app.use(express.json());

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const [userExists] = await pool.query('SELECT * FROM Users WHERE Email = ?', [email]);
    if (userExists.length > 0) {
      return res.status(400).json({ error: 'Користувач з таким email вже існує' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const [result] = await pool.query(
      'INSERT INTO Users (Name, Email, Password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );
    await pool.query(
      'INSERT INTO Wallets (UserID, Name, Balance) VALUES (?, ?, ?)',
      [result.insertId, 'Готівка', 0]
    );
    res.status(201).json({ UserID: result.insertId, message: 'Користувача створено!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при реєстрації' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await pool.query('SELECT * FROM Users WHERE Email = ?', [email]);
    if (users.length === 0) {
      return res.status(400).json({ error: 'Невірний email або пароль' });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.Password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Невірний email або пароль' });
    }
    res.json({
      UserID: user.UserID,
      Name: user.Name,
      Email: user.Email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при логіні' });
  }
});

app.get('/wallets/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [wallets] = await pool.query(
      'SELECT WalletID, Name, Balance FROM Wallets WHERE UserID = ?',
      [userId]
    );
    res.json(wallets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при завантаженні гаманців' });
  }
});

app.post('/wallets', async (req, res) => {
  try {
    const { UserID, Name } = req.body;
    if (!Name) {
      return res.status(400).json({ error: 'Назва гаманця не може бути порожньою' });
    }
    const [result] = await pool.query(
      'INSERT INTO Wallets (UserID, Name, Balance) VALUES (?, ?, 0.00)',
      [UserID, Name]
    );
    res.status(201).json({ WalletID: result.insertId, Name: Name, Balance: 0.00 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при створенні гаманця' });
  }
});

app.delete('/wallets/:walletId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { walletId } = req.params;

    await connection.beginTransaction();

    const [transactions] = await connection.query(
        'SELECT * FROM Transactions WHERE WalletID = ?',
        [walletId]
    );

    if (transactions.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: 'Неможливо видалити гаманець, оскільки до нього прив\'язані транзакції.' });
    }

    await connection.query('DELETE FROM Wallets WHERE WalletID = ?', [walletId]);
    await connection.commit();
    
    res.json({ message: 'Гаманець успішно видалено' });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Помилка при видаленні гаманця' });
  } finally {
    connection.release();
  }
});


app.get('/categories/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [categories] = await pool.query(
      'SELECT CategoryID, Name, Type FROM Categories WHERE UserID = ?',
      [userId]
    );
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при завантаженні категорій' });
  }
});

app.post('/categories', async (req, res) => {
  try {
    const { UserID, Name, Type } = req.body;
    if (!Name || !Type) {
      return res.status(400).json({ error: 'Назва та тип категорії є обов\'язковими' });
    }
    const [result] = await pool.query(
      'INSERT INTO Categories (UserID, Name, Type) VALUES (?, ?, ?)',
      [UserID, Name, Type]
    );
    res.status(201).json({ CategoryID: result.insertId, Name: Name, Type: Type });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при створенні категорії' });
  }
});

app.delete('/categories/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    await pool.query('DELETE FROM Categories WHERE CategoryID = ?', [categoryId]);
    res.json({ message: 'Категорію успішно видалено' });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: 'Неможливо видалити категорію, доки вона використовується у транзакціях.' });
    }
    console.error(error);
    res.status(500).json({ error: 'Помилка при видаленні категорії' });
  }
});

app.post('/transactions', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { UserID, WalletID, CategoryID, Amount, Type, Description } = req.body;

    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO Transactions (UserID, WalletID, CategoryID, Amount, Type, Description, Date) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [UserID, WalletID, CategoryID, Amount, Type, Description]
    );

    const updateQuery = Type === 'дохід'
      ? 'UPDATE Wallets SET Balance = Balance + ? WHERE WalletID = ?'
      : 'UPDATE Wallets SET Balance = Balance - ? WHERE WalletID = ?';

    await connection.query(updateQuery, [Amount, WalletID]);

    await connection.commit();

    res.status(201).json({ TransactionID: result.insertId });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Помилка при додаванні транзакції' });
  } finally {
    connection.release();
  }
});

app.get('/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const [summary] = await pool.query(
      `SELECT
          SUM(CASE WHEN Type = 'дохід' THEN Amount ELSE 0 END) AS TotalIncome,
          SUM(CASE WHEN Type = 'витрата' THEN Amount ELSE 0 END) AS TotalExpenses
         FROM Transactions
         WHERE UserID = ? AND Date >= DATE_FORMAT(NOW(), '%Y-%m-01')`,
      [userId]
    );

    const [categoryBreakdown] = await pool.query(
      `SELECT c.Name, SUM(t.Amount) AS Total
         FROM Transactions t
         JOIN Categories c ON t.CategoryID = c.CategoryID
         WHERE t.UserID = ? AND t.Type = 'витрата' AND t.Date >= DATE_FORMAT(NOW(), '%Y-%m-01')
         GROUP BY c.Name
         HAVING Total > 0
         ORDER BY Total DESC`,
      [userId]
    );

    const [totalBalanceResult] = await pool.query(
      `SELECT SUM(Balance) AS TotalBalance
         FROM Wallets
         WHERE UserID = ?`,
      [userId]
    );

    res.json({
      summary: summary[0],
      categoryBreakdown: categoryBreakdown,
      totalBalance: totalBalanceResult[0].TotalBalance || 0
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при завантаженні звіту' });
  }
});

// ### НОВІ МАРШРУТИ ДЛЯ ІСТОРІЇ ТРАНЗАКЦІЙ ###

app.get('/transactions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [transactions] = await pool.query(
      `SELECT 
          t.TransactionID, 
          t.Amount, 
          t.Type, 
          t.Description, 
          t.Date, 
          t.WalletID,
          t.CategoryID,
          c.Name AS CategoryName, 
          w.Name AS WalletName 
       FROM Transactions t 
       JOIN Categories c ON t.CategoryID = c.CategoryID 
       JOIN Wallets w ON t.WalletID = w.WalletID 
       WHERE t.UserID = ? 
       ORDER BY t.Date DESC`,
      [userId]
    );
    res.json(transactions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Помилка при завантаженні транзакцій' });
  }
});

app.delete('/transactions/:transactionId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { transactionId } = req.params;

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT WalletID, Amount, Type FROM Transactions WHERE TransactionID = ?', [transactionId]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Транзакцію не знайдено' });
    }
    const t = rows[0];

    const adjustment = t.Type === 'дохід' ? -t.Amount : t.Amount;
    await connection.query(
      'UPDATE Wallets SET Balance = Balance + ? WHERE WalletID = ?',
      [adjustment, t.WalletID]
    );

    await connection.query('DELETE FROM Transactions WHERE TransactionID = ?', [transactionId]);

    await connection.commit();
    res.json({ message: 'Транзакцію успішно видалено' });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Помилка при видаленні транзакції' });
  } finally {
    connection.release();
  }
});

app.put('/transactions/:transactionId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { transactionId } = req.params;
    const { WalletID, CategoryID, Amount, Type, Description, Date: TransactionDate } = req.body;

    await connection.beginTransaction();

    const [rows] = await connection.query('SELECT WalletID, Amount, Type FROM Transactions WHERE TransactionID = ?', [transactionId]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Транзакцію не знайдено' });
    }
    const original = rows[0];

    const originalAdjustment = original.Type === 'дохід' ? -original.Amount : original.Amount;
    await connection.query(
      'UPDATE Wallets SET Balance = Balance + ? WHERE WalletID = ?',
      [originalAdjustment, original.WalletID]
    );

    const newAdjustment = Type === 'дохід' ? Amount : -Amount;
    await connection.query(
      'UPDATE Wallets SET Balance = Balance + ? WHERE WalletID = ?',
      [newAdjustment, WalletID]
    );

    await connection.query(
      'UPDATE Transactions SET WalletID = ?, CategoryID = ?, Amount = ?, Type = ?, Description = ?, Date = ? WHERE TransactionID = ?',
      [WalletID, CategoryID, Amount, Type, Description, TransactionDate, transactionId]
    );

    await connection.commit();
    res.json({ message: 'Транзакцію успішно оновлено' });

  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Помилка при оновленні транзакції' });
  } finally {
    connection.release();
  }
});

console.log("--- ЗАПУСК НОВОЇ ВЕРСІЇ СЕРВЕРА (v3) ---"); 

app.listen(port, '0.0.0.0', () => {
    console.log(`--- УСПІШНИЙ ЗАПУСК v3 на порту ${port} ---`);
    console.log(`🚀 Сервер "MyBudgetApp" запущено на порту ${port}`);
});