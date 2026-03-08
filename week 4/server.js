const http = require('http');
const url = require('url');

let accounts = {};
let transactions = {};
let nextAccountId = 1;
let nextTransactionId = 1;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  try {
    // ─── POST /accounts ───
    if (method === 'POST' && pathname === '/accounts') {
      const body = await parseBody(req);
      const { name, initialBalance } = body;

      if (
        !name ||
        typeof name !== 'string' ||
        initialBalance === undefined ||
        initialBalance === null ||
        typeof initialBalance !== 'number' ||
        initialBalance < 0
      ) {
        return sendJSON(res, 400, { error: 'Invalid account data' });
      }

      const id = nextAccountId++;
      accounts[id] = { id, name, balance: initialBalance, transactions: [] };

      return sendJSON(res, 201, { id, name, balance: initialBalance });
    }

    // ─── GET /accounts?id={accountId} ───
    if (method === 'GET' && pathname === '/accounts') {
      const accountId = parseInt(parsedUrl.query.id, 10);

      if (isNaN(accountId) || !accounts[accountId]) {
        return sendJSON(res, 400, { error: 'Account not found' });
      }

      const account = accounts[accountId];
      const txList = account.transactions.map((tid) => transactions[tid]);

      return sendJSON(res, 200, {
        id: account.id,
        name: account.name,
        balance: account.balance,
        transactions: txList,
      });
    }

    // ─── POST /transactions/deposit ───
    if (method === 'POST' && pathname === '/transactions/deposit') {
      const body = await parseBody(req);
      const { accountId, amount } = body;

      if (!accounts[accountId]) {
        return sendJSON(res, 400, { error: 'Account not found' });
      }

      if (amount === undefined || typeof amount !== 'number' || amount <= 0) {
        return sendJSON(res, 400, { error: 'Invalid amount' });
      }

      accounts[accountId].balance += amount;

      const transactionId = nextTransactionId++;
      const txn = {
        transactionId,
        accountId,
        type: 'deposit',
        amount,
        balance: accounts[accountId].balance,
      };

      transactions[transactionId] = txn;
      accounts[accountId].transactions.push(transactionId);

      return sendJSON(res, 201, txn);
    }

    // ─── POST /transactions/withdraw ───
    if (method === 'POST' && pathname === '/transactions/withdraw') {
      const body = await parseBody(req);
      const { accountId, amount } = body;

      if (!accounts[accountId]) {
        return sendJSON(res, 400, { error: 'Account not found' });
      }

      if (amount === undefined || typeof amount !== 'number' || amount <= 0) {
        return sendJSON(res, 400, { error: 'Invalid amount' });
      }

      if (accounts[accountId].balance < amount) {
        return sendJSON(res, 400, { error: 'Insufficient balance' });
      }

      accounts[accountId].balance -= amount;

      const transactionId = nextTransactionId++;
      const txn = {
        transactionId,
        accountId,
        type: 'withdraw',
        amount,
        balance: accounts[accountId].balance,
      };

      transactions[transactionId] = txn;
      accounts[accountId].transactions.push(transactionId);

      return sendJSON(res, 201, txn);
    }

    // ─── GET /transactions?accountId={accountId} ───
    if (method === 'GET' && pathname === '/transactions') {
      const accountId = parseInt(parsedUrl.query.accountId, 10);

      if (isNaN(accountId) || !accounts[accountId]) {
        return sendJSON(res, 400, { error: 'Account not found' });
      }

      const txList = accounts[accountId].transactions.map(
        (tid) => transactions[tid]
      );

      return sendJSON(res, 200, { transactions: txList });
    }

    // ─── 404 for everything else ───
    sendJSON(res, 404, { error: 'Not Found' });
  } catch (err) {
    sendJSON(res, 400, { error: 'Invalid JSON' });
  }
});

server.listen(process.env.PORT, () =>
  console.log(`Server running at http://localhost:${process.env.PORT}`)
);
