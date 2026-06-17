(function() {
  // ========== STORAGE & STATE ==========
  const STORAGE_KEY = 'RESTAURANT_PORTAL_V2_DATA';
  
  let appData = {
    users: [
      { 
        name: 'Admin', 
        username: 'admin', 
        password: 'admin123', 
        role: 'Admin',
        permissions: ['overview','cash','expenses','stock','menu','payroll','permissions','alerts','settings']
      }
    ],
    currentUser: null,
    restaurantName: 'Restaurant Control',
    theme: 'fresh',
    stockSections: ['Frozen','Bakery','Cleaning','General'],
    cashEntries: [],
    expenses: [],
    stockEntries: [],
    menuItems: [],
    payrollEntries: [],
    alerts: [],
    // Date filter state
    dateFilter: { from: '', to: '' }
  };

  function saveData() { 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); 
  }
  
  function loadData() {
    let stored = localStorage.getItem(STORAGE_KEY);
    if(stored) {
      try { appData = JSON.parse(stored); } catch(e) { console.error('Data load error:', e); }
    }
    // Ensure defaults
    if(!appData.users || appData.users.length === 0) {
      appData.users = [{ name:'Admin', username:'admin', password:'admin123', role:'Admin', permissions: ['overview','cash','expenses','stock','menu','payroll','permissions','alerts','settings'] }];
    }
    if(!appData.stockSections) appData.stockSections = ['Frozen','Bakery','Cleaning','General'];
    if(!appData.expenses) appData.expenses = [];
    if(!appData.cashEntries) appData.cashEntries = [];
    if(!appData.menuItems) appData.menuItems = [];
    if(!appData.payrollEntries) appData.payrollEntries = [];
    if(!appData.alerts) appData.alerts = [];
    if(!appData.dateFilter) appData.dateFilter = { from: '', to: '' };
  }

  // ========== HELPERS ==========
  const toast = (msg) => {
    let t = document.getElementById('toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(()=> t.classList.remove('show'), 3000);
  };
  
  const todayStr = () => new Date().toISOString().split('T')[0];
  
  function getFilteredData(dataArray) {
    if(!appData.dateFilter.from && !appData.dateFilter.to) return dataArray;
    return dataArray.filter(item => {
      let itemDate = item.date || '';
      if(appData.dateFilter.from && itemDate < appData.dateFilter.from) return false;
      if(appData.dateFilter.to && itemDate > appData.dateFilter.to) return false;
      return true;
    });
  }

  function calculateRemainingCash(cashEntries) {
    return cashEntries.reduce((total, e) => {
      let opening = parseFloat(e.openingCash) || 0;
      let cashSale = parseFloat(e.cashSale) || 0;
      let cardSale = parseFloat(e.cardSale) || 0;
      let onlineSale = parseFloat(e.onlineSale) || 0;
      let deliverySale = parseFloat(e.deliverySale) || 0;
      let expenses = parseFloat(e.expenses) || 0;
      let bankDeposit = parseFloat(e.bankDeposit) || 0;
      let withdrawal = parseFloat(e.withdrawal) || 0;
      let countedCash = parseFloat(e.countedCash) || 0;
      // Remaining = Opening + All Sales - Expenses - Bank - Withdrawal
      // Or simply use Counted Cash as actual remaining
      return total + (countedCash > 0 ? countedCash : (opening + cashSale + cardSale + onlineSale + deliverySale - expenses - bankDeposit - withdrawal));
    }, 0);
  }

  function checkLowStock(stockEntries) {
    return stockEntries.filter(e => {
      let closing = (parseFloat(e.opening)||0) + (parseFloat(e.purchase)||0) - (parseFloat(e.used)||0) - (parseFloat(e.wastage)||0);
      return closing < (parseFloat(e.minimumStock)||0);
    }).length;
  }

  // ========== PERMISSIONS & NAVIGATION ==========
  const allSections = ['overview','cash','expenses','stock','menu','payroll','permissions','alerts','settings'];
  
  function getUserPermissions() {
    if(!appData.currentUser) return allSections;
    // Admin sees all
    if(appData.currentUser.role === 'Admin') return allSections;
    // Otherwise use custom permissions array
    return appData.currentUser.permissions || ['overview'];
  }

  function renderNavigation() {
    let container = document.getElementById('navContainer');
    if(!container) return;
    let allowed = getUserPermissions();
    container.innerHTML = allSections.map(sec => {
      let visible = allowed.includes(sec);
      return `<button class="nav-tab ${sec==='overview'?'active':''}" data-section="${sec}" ${!visible?'style="display:none"':''}>${sec.charAt(0).toUpperCase()+sec.slice(1)}</button>`;
    }).join('');
    
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        switchSection(btn.dataset.section);
      });
    });
  }

  function switchSection(sectionId) {
    document.querySelectorAll('.section-panel').forEach(s=>s.classList.remove('active'));
    let sec = document.getElementById(sectionId);
    if(sec) sec.classList.add('active');
    document.getElementById('pageTitle').textContent = sec?.dataset.title || sectionId;
    renderSectionContent(sectionId);
  }

  // ========== RENDER SECTIONS ==========
  function renderSectionContent(sectionId) {
    switch(sectionId) {
      case 'overview': renderOverview(); break;
      case 'cash': renderCash(); break;
      case 'expenses': renderExpenses(); break;
      case 'stock': renderStock(); break;
      case 'menu': renderMenu(); break;
      case 'payroll': renderPayroll(); break;
      case 'permissions': renderPermissions(); break;
      case 'alerts': renderAlerts(); break;
      case 'settings': renderSettings(); break;
    }
  }

  // ===== OVERVIEW (Dashboard with Remaining Amount) =====
  function renderOverview() {
    let sec = document.getElementById('overview');
    let filteredCash = getFilteredData(appData.cashEntries);
    let filteredExpenses = getFilteredData(appData.expenses);
    let filteredStock = getFilteredData(appData.stockEntries);
    
    let totalSales = filteredCash.reduce((s,e)=> s + (parseFloat(e.cashSale)||0)+(parseFloat(e.cardSale)||0)+(parseFloat(e.onlineSale)||0)+(parseFloat(e.deliverySale)||0), 0);
    let remainingCash = calculateRemainingCash(filteredCash);
    let totalExpenses = filteredExpenses.reduce((s,e)=> s+(parseFloat(e.amount)||0), 0);
    let lowStockCount = checkLowStock(filteredStock);
    let cashDifference = filteredCash.reduce((s,e) => {
      let expected = (parseFloat(e.openingCash)||0) + (parseFloat(e.cashSale)||0) + (parseFloat(e.cardSale)||0) + (parseFloat(e.onlineSale)||0) + (parseFloat(e.deliverySale)||0) - (parseFloat(e.expenses)||0) - (parseFloat(e.bankDeposit)||0) - (parseFloat(e.withdrawal)||0);
      return s + ((parseFloat(e.countedCash)||0) - expected);
    }, 0);
    
    sec.innerHTML = `
      <div class="section-heading">
        <h2>📊 Dashboard Overview</h2>
        <p class="muted">Real-time cash, expenses & stock summary</p>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card highlight">
          <span>💰 System Sales</span>
          <strong>${totalSales.toFixed(2)}</strong>
        </div>
        <div class="kpi-card highlight">
          <span>🏦 Remaining Cash</span>
          <strong style="color:${remainingCash >= 0 ? 'var(--success)' : 'var(--danger)'}">${remainingCash.toFixed(2)}</strong>
        </div>
        <div class="kpi-card">
          <span>💸 Total Expenses</span>
          <strong>${totalExpenses.toFixed(2)}</strong>
        </div>
        <div class="kpi-card">
          <span>⚠️ Cash Difference</span>
          <strong style="color:${Math.abs(cashDifference) > 10 ? 'var(--danger)' : 'var(--text)'}">${cashDifference.toFixed(2)}</strong>
        </div>
        <div class="kpi-card">
          <span>📦 Low Stock Items</span>
          <strong style="color:${lowStockCount > 0 ? 'var(--danger)' : 'var(--success)'}">${lowStockCount}</strong>
        </div>
      </div>
      <div class="content-grid">
        <div class="panel">
          <div class="panel-title">🔴 Low Stock Alerts</div>
          <div class="mini-list">
            ${filteredStock.filter(e => {
              let closing = (parseFloat(e.opening)||0)+(parseFloat(e.purchase)||0)-(parseFloat(e.used)||0)-(parseFloat(e.wastage)||0);
              return closing < (parseFloat(e.minimumStock)||0);
            }).map(e => {
              let closing = (parseFloat(e.opening)||0)+(parseFloat(e.purchase)||0)-(parseFloat(e.used)||0)-(parseFloat(e.wastage)||0);
              return `<div style="padding:0.3rem 0; border-bottom:1px solid var(--border);">⚠️ <strong>${e.item}</strong> (${e.category}) - Closing: ${closing} / Min: ${e.minimumStock||0}</div>`;
            }).join('') || '<div style="color:var(--success);">✅ All stock levels are good!</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-title">💵 Recent Cash Entries</div>
          <div class="mini-list">
            ${filteredCash.slice(-5).reverse().map(e => `<div style="padding:0.3rem 0; border-bottom:1px solid var(--border);">${e.date} | Sale: ${((parseFloat(e.cashSale)||0)+(parseFloat(e.cardSale)||0)).toFixed(2)} | Remaining: ${((parseFloat(e.countedCash)||0) || ((parseFloat(e.openingCash)||0)+(parseFloat(e.cashSale)||0)-(parseFloat(e.expenses)||0))).toFixed(2)}</div>`).join('') || '<div class="muted">No cash entries yet</div>'}
          </div>
        </div>
      </div>`;
  }

  // ===== CASH =====
  function renderCash() {
    let sec = document.getElementById('cash');
    let filtered = getFilteredData(appData.cashEntries);
    sec.innerHTML = `
      <div class="section-heading"><h2>💵 Cash Management</h2></div>
      <form id="cashForm" class="form-grid">
        <label>Date <input name="date" type="date" required value="${todayStr()}"/></label>
        <label>Opening Cash <input name="openingCash" type="number" step="0.01" value="0"/></label>
        <label>Cash Sale <input name="cashSale" type="number" step="0.01" value="0"/></label>
        <label>Card Sale <input name="cardSale" type="number" step="0.01" value="0"/></label>
        <label>Online Sale <input name="onlineSale" type="number" step="0.01" value="0"/></label>
        <label>Delivery Sale <input name="deliverySale" type="number" step="0.01" value="0"/></label>
        <label>Expenses Paid <input name="expenses" type="number" step="0.01" value="0"/></label>
        <label>Bank Deposit <input name="bankDeposit" type="number" step="0.01" value="0"/></label>
        <label>Owner Withdrawal <input name="withdrawal" type="number" step="0.01" value="0"/></label>
        <label>Counted Cash (Actual) <input name="countedCash" type="number" step="0.01" value="0"/></label>
        <button type="submit">💾 Save Cash Day</button>
      </form>
      <div class="table-wrap">
        <table><thead><tr><th>Date</th><th>System Sale</th><th>Opening</th><th>Counted Cash</th><th>Remaining</th><th>Difference</th></tr></thead>
        <tbody>${filtered.map(e => {
          let systemSale = (parseFloat(e.cashSale)||0)+(parseFloat(e.cardSale)||0)+(parseFloat(e.onlineSale)||0)+(parseFloat(e.deliverySale)||0);
          let expected = (parseFloat(e.openingCash)||0) + systemSale - (parseFloat(e.expenses)||0) - (parseFloat(e.bankDeposit)||0) - (parseFloat(e.withdrawal)||0);
          let remaining = (parseFloat(e.countedCash)||0) > 0 ? parseFloat(e.countedCash) : expected;
          let diff = (parseFloat(e.countedCash)||0) - expected;
          return `<tr><td>${e.date}</td><td>${systemSale.toFixed(2)}</td><td>${e.openingCash||0}</td><td>${e.countedCash||0}</td><td style="color:${remaining>=0?'var(--success)':'var(--danger)'}">${remaining.toFixed(2)}</td><td style="color:${Math.abs(diff)>10?'var(--danger)':'var(--text)'}">${diff.toFixed(2)}</td></tr>`;
        }).join('')}</tbody></table>
      </div>`;
    
    document.getElementById('cashForm').addEventListener('submit', (e) => {
      e.preventDefault();
      let entry = Object.fromEntries(new FormData(e.target));
      entry.user = appData.currentUser?.username || 'admin';
      appData.cashEntries.push(entry);
      saveData();
      renderCash();
      toast('✅ Cash entry saved successfully!');
    });
  }

  // ===== EXPENSES =====
  function renderExpenses() {
    let sec = document.getElementById('expenses');
    let filtered = getFilteredData(appData.expenses);
    sec.innerHTML = `
      <div class="section-heading"><h2>💸 Manual Expenses</h2></div>
      <form id="expenseForm" class="form-grid">
        <label>Date <input name="date" type="date" required value="${todayStr()}"/></label>
        <label>Category <input name="category" required placeholder="Rent, Gas, Salary"/></label>
        <label>Expense Name <input name="title" required placeholder="Gas cylinder"/></label>
        <label>Method <select name="method"><option>Cash</option><option>Bank</option><option>Card</option></select></label>
        <label>Amount <input name="amount" type="number" step="0.01" value="0"/></label>
        <label>Paid By <input name="paidBy" placeholder="Manager"/></label>
        <label>Notes <input name="notes" placeholder="Optional"/></label>
        <button type="submit">💾 Save Expense</button>
      </form>
      <div class="table-wrap">
        <table><thead><tr><th>Date</th><th>Category</th><th>Expense</th><th>Method</th><th>Amount</th><th>Paid By</th></tr></thead>
        <tbody>${filtered.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${e.title}</td><td>${e.method}</td><td>${e.amount}</td><td>${e.paidBy||''}</td></tr>`).join('')}</tbody></table>
      </div>`;
    
    document.getElementById('expenseForm').addEventListener('submit', (e) => {
      e.preventDefault();
      let entry = Object.fromEntries(new FormData(e.target));
      entry.user = appData.currentUser?.username;
      appData.expenses.push(entry);
      saveData();
      renderExpenses();
      toast('✅ Expense saved!');
    });
  }

  // ===== STOCK =====
  function renderStock() {
    let sec = document.getElementById('stock');
    let selectedSection = sec.dataset.selectedStock || 'All';
    let filtered = getFilteredData(appData.stockEntries).filter(e => selectedSection === 'All' || e.category === selectedSection);
    
    sec.innerHTML = `
      <div class="section-heading"><h2>📦 Stock Control</h2></div>
      <div class="stock-layout">
        <div class="panel">
          <div class="panel-title">Stock Sections</div>
          <form id="stockSectionForm" class="stacked-form">
            <label>New Section Name <input name="name" required placeholder="Frozen, Bakery"/></label>
            <button type="submit">➕ Add Section</button>
          </form>
          <div class="section-tabs">${['All', ...appData.stockSections].map(s => `<span class="section-tab ${selectedSection===s?'active':''}" data-section="${s}">${s}</span>`).join('')}</div>
        </div>
      </div>
      <form id="stockForm" class="form-grid">
        <label>Date <input name="date" type="date" required value="${todayStr()}"/></label>
        <label>Category <select name="category">${appData.stockSections.map(s=>`<option>${s}</option>`).join('')}</select></label>
        <label>Item <input name="item" required placeholder="Chicken"/></label>
        <label>Unit <select name="unit"><option>kg</option><option>gram</option><option>ltr</option><option>piece</option><option>dozen</option></select></label>
        <label>Opening <input name="opening" type="number" step="0.001" value="0"/></label>
        <label>Purchase <input name="purchase" type="number" step="0.001" value="0"/></label>
        <label>Used/Sold <input name="used" type="number" step="0.001" value="0"/></label>
        <label>Wastage <input name="wastage" type="number" step="0.001" value="0"/></label>
        <label>Physical Closing <input name="physicalClosing" type="number" step="0.001" value="0"/></label>
        <label>⚠️ Minimum Stock <input name="minimumStock" type="number" step="0.001" value="0"/></label>
        <label>Unit Cost <input name="unitCost" type="number" step="0.01" value="0"/></label>
        <button type="submit">💾 Save Stock Entry</button>
      </form>
      <div class="table-wrap">
        <table><thead><tr><th>Date</th><th>Category</th><th>Item</th><th>Opening</th><th>Purchase</th><th>Used</th><th>Closing</th><th>Min</th><th>Status</th><th>Value</th></tr></thead>
        <tbody>${filtered.map(e => {
          let closing = (parseFloat(e.opening)||0) + (parseFloat(e.purchase)||0) - (parseFloat(e.used)||0) - (parseFloat(e.wastage)||0);
          let value = closing * (parseFloat(e.unitCost)||0);
          let isLow = closing < (parseFloat(e.minimumStock)||0);
          return `<tr>
            <td>${e.date}</td><td>${e.category}</td><td>${e.item}</td>
            <td>${e.opening||0}</td><td>${e.purchase||0}</td><td>${e.used||0}</td>
            <td>${closing.toFixed(2)}</td><td>${e.minimumStock||0}</td>
            <td style="color:${isLow?'var(--danger)':'var(--success)'};font-weight:bold;">${isLow?'⚠️ LOW':'✅ OK'}</td>
            <td>${value.toFixed(2)}</td>
          </tr>`;
        }).join('')}</tbody></table>
      </div>`;
    
    document.getElementById('stockSectionForm').addEventListener('submit', (e) => {
      e.preventDefault();
      let name = e.target.name.value.trim();
      if(name && !appData.stockSections.includes(name)) {
        appData.stockSections.push(name);
        saveData();
        renderStock();
        toast('✅ Section added!');
      }
    });
    
    document.querySelectorAll('.section-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        sec.dataset.selectedStock = tab.dataset.section;
        renderStock();
      });
    });
    
    document.getElementById('stockForm').addEventListener('submit', (e) => {
      e.preventDefault();
      let entry = Object.fromEntries(new FormData(e.target));
      entry.user = appData.currentUser?.username;
      appData.stockEntries.push(entry);
      saveData();
      renderStock();
      toast('✅ Stock entry saved!');
    });
  }

  // ===== MENU =====
  function renderMenu() {
    let sec = document.getElementById('menu');
    let filtered = getFilteredData(appData.menuItems);
    sec.innerHTML = `
      <div class="section-heading"><h2>🍽️ Menu Costing</h2></div>
      <form id="menuForm" class="form-grid">
        <label>Date <input name="date" type="date" required value="${todayStr()}"/></label>
        <label>Menu Item <input name="name" required/></label>
        <label>Sale Price <input name="price" type="number" step="0.01" value="0"/></label>
        <label>Daily Qty <input name="qty" type="number" value="1"/></label>
        <label>Meat Cost <input name="meatCost" type="number" step="0.01" value="0"/></label>
        <label>Grain Cost <input name="grainCost" type="number" step="0.01" value="0"/></label>
        <label>Dairy Cost <input name="dairyCost" type="number" step="0.01" value="0"/></label>
        <label>Other Cost <input name="otherCost" type="number" step="0.01" value="0"/></label>
        <button type="submit">💾 Save Menu Item</button>
      </form>
      <div class="table-wrap">
        <table><thead><tr><th>Date</th><th>Item</th><th>Price</th><th>Recipe Cost</th><th>Profit</th></tr></thead>
        <tbody>${filtered.map(m => {
          let cost = (parseFloat(m.meatCost)||0)+(parseFloat(m.grainCost)||0)+(parseFloat(m.dairyCost)||0)+(parseFloat(m.otherCost)||0);
          return `<tr><td>${m.date}</td><td>${m.name}</td><td>${m.price}</td><td>${cost.toFixed(2)}</td><td>${((parseFloat(m.price)||0)-cost).toFixed(2)}</td></tr>`;
        }).join('')}</tbody></table>
      </div>`;
    
    document.getElementById('menuForm').addEventListener('submit', (e) => {
      e.preventDefault();
      appData.menuItems.push(Object.fromEntries(new FormData(e.target)));
      saveData();
      renderMenu();
      toast('✅ Menu item saved!');
    });
  }

  // ===== PAYROLL =====
  function renderPayroll() {
    let sec = document.getElementById('payroll');
    let filtered = getFilteredData(appData.payrollEntries);
    sec.innerHTML = `
      <div class="section-heading"><h2>👥 Payroll</h2></div>
      <form id="payrollForm" class="form-grid">
        <label>Date <input name="date" type="date" required value="${todayStr()}"/></label>
        <label>Staff Name <input name="staff" required/></label>
        <label>Role <input name="role"/></label>
        <label>Shift <select name="shift"><option>Morning</option><option>Evening</option><option>Full Day</option></select></label>
        <label>Daily Salary <input name="dailySalary" type="number" step="0.01" value="0"/></label>
        <label>Days Worked <input name="daysWorked" type="number" value="1"/></label>
        <label>Overtime <input name="overtime" type="number" step="0.01" value="0"/></label>
        <label>Advance <input name="advance" type="number" step="0.01" value="0"/></label>
        <button type="submit">💾 Save Payroll</button>
      </form>
      <div class="table-wrap">
        <table><thead><tr><th>Date</th><th>Staff</th><th>Gross</th><th>Advance</th><th>Net Pay</th></tr></thead>
        <tbody>${filtered.map(p => {
          let gross = (parseFloat(p.dailySalary)||0)*(parseFloat(p.daysWorked)||1)+(parseFloat(p.overtime)||0);
          return `<tr><td>${p.date}</td><td>${p.staff}</td><td>${gross.toFixed(2)}</td><td>${p.advance||0}</td><td>${(gross-(parseFloat(p.advance)||0)).toFixed(2)}</td></tr>`;
        }).join('')}</tbody></table>
      </div>`;
    
    document.getElementById('payrollForm').addEventListener('submit', (e) => {
      e.preventDefault();
      appData.payrollEntries.push(Object.fromEntries(new FormData(e.target)));
      saveData();
      renderPayroll();
      toast('✅ Payroll saved!');
    });
  }

  // ===== PERMISSIONS (Custom Checkboxes) =====
  function renderPermissions() {
    let sec = document.getElementById('permissions');
    sec.innerHTML = `
      <div class="section-heading">
        <h2>🔐 User Permissions</h2>
        <p class="muted">Add users and customize what each user can access</p>
      </div>
      <form id="userForm" class="form-grid">
        <label>Full Name <input name="name" required/></label>
        <label>Username <input name="username" required/></label>
        <label>Password <input name="password" required/></label>
        <label>Role
          <select name="role">
            <option>Admin</option><option>Manager</option><option>Cashier</option>
            <option>Stock Keeper</option><option>Payroll</option><option>Expense Staff</option>
          </select>
        </label>
        <button type="submit">➕ Add User</button>
      </form>
      <div class="permissions-grid" id="permissionsGrid"></div>`;
    
    renderPermissionsGrid();
    
    document.getElementById('userForm').addEventListener('submit', (e) => {
      e.preventDefault();
      let newUser = Object.fromEntries(new FormData(e.target));
      if(appData.users.some(u => u.username === newUser.username)) {
        toast('❌ Username already exists!');
        return;
      }
      // Default permissions based on role
      const defaultPerms = {
        Admin: allSections,
        Manager: ['overview','cash','expenses','stock','menu','payroll','alerts','settings'],
        Cashier: ['overview','cash'],
        'Stock Keeper': ['overview','stock'],
        Payroll: ['overview','payroll'],
        'Expense Staff': ['overview','expenses']
      };
      newUser.permissions = defaultPerms[newUser.role] || ['overview'];
      appData.users.push(newUser);
      saveData();
      renderPermissions();
      toast('✅ User added! Set custom permissions below.');
    });
  }

  function renderPermissionsGrid() {
    let grid = document.getElementById('permissionsGrid');
    if(!grid) return;
    
    grid.innerHTML = appData.users.map((user, index) => `
      <div class="perm-card">
        <h3>
          <span>${user.name} <small class="muted">(@${user.username})</small></span>
          <span class="badge">${user.role}</span>
        </h3>
        <div class="perm-checks">
          ${allSections.map(sec => `
            <label>
              <input type="checkbox" 
                ${user.permissions?.includes(sec) ? 'checked' : ''} 
                ${user.role === 'Admin' ? 'disabled' : ''}
                data-user-index="${index}" 
                data-section="${sec}"
                onchange="window.updateUserPermission(${index}, '${sec}', this.checked)" />
              ${sec.charAt(0).toUpperCase()+sec.slice(1)}
            </label>
          `).join('')}
        </div>
        ${user.role !== 'Admin' ? `<button onclick="window.deleteUser(${index})" style="margin-top:0.5rem; background:var(--danger); width:100%;">🗑️ Delete User</button>` : ''}
      </div>
    `).join('');
  }

  // Global functions for permission updates
  window.updateUserPermission = function(userIndex, section, checked) {
    if(!appData.users[userIndex].permissions) appData.users[userIndex].permissions = ['overview'];
    if(checked) {
      if(!appData.users[userIndex].permissions.includes(section)) {
        appData.users[userIndex].permissions.push(section);
      }
    } else {
      appData.users[userIndex].permissions = appData.users[userIndex].permissions.filter(s => s !== section);
    }
    // Always keep overview
    if(!appData.users[userIndex].permissions.includes('overview')) {
      appData.users[userIndex].permissions.unshift('overview');
    }
    saveData();
    toast('✅ Permissions updated!');
  };

  window.deleteUser = function(index) {
    if(confirm('Are you sure you want to delete this user?')) {
      appData.users.splice(index, 1);
      saveData();
      renderPermissions();
      toast('🗑️ User deleted!');
    }
  };

  // ===== ALERTS & SETTINGS =====
  function renderAlerts() {
    document.getElementById('alerts').innerHTML = `
      <div class="section-heading"><h2>📱 WhatsApp Alerts</h2><p class="muted">Configure automated alerts (Coming Soon)</p></div>
      <div class="panel"><p>WhatsApp integration requires Twilio/API setup.</p></div>`;
  }
  
  function renderSettings() {
    document.getElementById('settings').innerHTML = `
      <div class="section-heading"><h2>⚙️ Settings</h2></div>
      <div class="content-grid">
        <div class="panel">
          <div class="panel-title">Restaurant Info</div>
          <label>Restaurant Name <input id="settingsRestaurantName" value="${appData.restaurantName}"/></label>
          <button id="saveSettingsBtn" style="margin-top:0.5rem;">💾 Save</button>
        </div>
        <div class="panel">
          <div class="panel-title">Data Backup</div>
          <p class="muted">Your data is saved in browser localStorage. Export regularly for safety.</p>
          <button id="exportDataBtn2">📥 Export All Data</button>
          <button id="importDataBtn2" style="margin-top:0.5rem;">📤 Import Backup</button>
          <input type="file" id="importFileInput2" accept=".json" hidden />
        </div>
      </div>`;
    
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
      appData.restaurantName = document.getElementById('settingsRestaurantName').value;
      saveData();
      toast('✅ Settings saved!');
    });
    
    document.getElementById('exportDataBtn2').addEventListener('click', exportData);
    document.getElementById('importDataBtn2').addEventListener('click', () => document.getElementById('importFileInput2').click());
    document.getElementById('importFileInput2').addEventListener('change', importData);
  }

  // ========== DATA BACKUP (Export/Import) ==========
  function exportData() {
    let dataStr = JSON.stringify(appData, null, 2);
    let blob = new Blob([dataStr], {type: 'application/json'});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `restaurant_backup_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('📥 Backup downloaded! Keep this file safe.');
  }

  function importData(e) {
    let file = e.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = function(event) {
      try {
        let imported = JSON.parse(event.target.result);
        if(confirm('This will REPLACE all current data. Are you sure?')) {
          appData = imported;
          saveData();
          location.reload();
          toast('📤 Data restored successfully!');
        }
      } catch(err) {
        toast('❌ Invalid backup file!');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ========== DATE FILTER ==========
  function setupDateFilter() {
    document.getElementById('filterDateFrom').value = appData.dateFilter.from || '';
    document.getElementById('filterDateTo').value = appData.dateFilter.to || '';
    updateFilterStatus();
    
    document.getElementById('applyDateFilter').addEventListener('click', () => {
      appData.dateFilter.from = document.getElementById('filterDateFrom').value;
      appData.dateFilter.to = document.getElementById('filterDateTo').value;
      saveData();
      updateFilterStatus();
      // Re-render current section
      let activeSection = document.querySelector('.section-panel.active');
      if(activeSection) renderSectionContent(activeSection.id);
      toast('🔍 Date filter applied!');
    });
    
    document.getElementById('clearDateFilter').addEventListener('click', () => {
      appData.dateFilter = { from: '', to: '' };
      document.getElementById('filterDateFrom').value = '';
      document.getElementById('filterDateTo').value = '';
      saveData();
      updateFilterStatus();
      let activeSection = document.querySelector('.section-panel.active');
      if(activeSection) renderSectionContent(activeSection.id);
      toast('✖ Date filter cleared!');
    });
  }

  function updateFilterStatus() {
    let status = document.getElementById('filterStatus');
    if(appData.dateFilter.from || appData.dateFilter.to) {
      status.textContent = `📅 Filter: ${appData.dateFilter.from || '...'} → ${appData.dateFilter.to || '...'}`;
      status.style.color = 'var(--accent)';
    } else {
      status.textContent = '📅 Showing all dates';
      status.style.color = 'var(--muted)';
    }
  }

  // ========== LOGIN / LOGOUT ==========
  function attemptLogin(username, password) {
    let user = appData.users.find(u => u.username === username && u.password === password);
    if(user) {
      appData.currentUser = user;
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('portalShell').hidden = false;
      document.getElementById('currentUserName').textContent = user.name;
      document.getElementById('currentUserRole').textContent = user.role;
      renderNavigation();
      switchSection('overview');
    } else {
      toast('❌ Invalid credentials!');
    }
  }

  function logout() {
    appData.currentUser = null;
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('portalShell').hidden = true;
  }

  // ========== INITIALIZATION ==========
  window.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Login form
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      let fd = new FormData(e.target);
      attemptLogin(fd.get('username'), fd.get('password'));
    });
    
    // Logout
    document.getElementById('logoutButton').addEventListener('click', logout);
    
    // Theme
    document.getElementById('themeSelect').addEventListener('change', (e) => {
      document.body.className = e.target.value;
      appData.theme = e.target.value;
      saveData();
    });
    document.body.className = appData.theme || 'fresh';
    
    // Print
    document.getElementById('printCurrent').addEventListener('click', () => window.print());
    
    // Export/Import buttons in sidebar
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', importData);
    
    // Date filter
    setupDateFilter();
    
    // Clock
    setInterval(() => {
      let el = document.getElementById('pageDate');
      if(el) el.textContent = new Date().toLocaleString();
    }, 1000);
    
    // Initialize UI
    if(appData.currentUser) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('portalShell').hidden = false;
      document.getElementById('currentUserName').textContent = appData.currentUser.name;
      document.getElementById('currentUserRole').textContent = appData.currentUser.role;
      renderNavigation();
      switchSection('overview');
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('portalShell').hidden = true;
    }
  });
})();