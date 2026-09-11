const API_URL = window.API;

// ==========================================
// AUTHENTICATION & NAVIGATION LOGIC
// ==========================================

async function handleAction(action) {
    const user = document.getElementById('userInput')?.value;
    if (!user) return showModal("REQUIRED", "Please enter your Identity Code.", "error");

    const body = { action: action, user: user, token: window.API_TOKEN };

    if (action === 'login') {
        const pass = document.getElementById('passInput')?.value;
        if (!pass) return showModal("REQUIRED", "Please enter your Access Key.", "error");
        body.pass = pass;
    } 
    else if (action === 'updatePassword') {
        const newUserInput = document.getElementById('newUserInput')?.value;
        body.newUser = newUserInput ? newUserInput : user; 

        const newPass = document.getElementById('newPassInput')?.value;
        if (!newPass) return showModal("REQUIRED", "Please enter a new password.", "error");
        
        body.newPass = newPass;
        body.rowIndex = window.pendingRowIndex;
    }

    if (typeof showSeaWaveLoader === 'function') showSeaWaveLoader("AUTHORIZING...");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify(body)
        });

        const textResponse = await response.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            console.error("Non-JSON response from server:", textResponse);
            throw new Error("Server returned an invalid format.");
        }

        if (data.success || data.status === "REQUIRE_UPDATE") {
            const status = data.status ? data.status.toUpperCase() : "";

            if (status === "ACTIVE" || status === "SUCCESS" || action === 'updatePassword') {
                // Save your true user identity and client name distinctly
                window.sessionUser = body.newUser || user; // e.g., 'ERT'
                window.sessionClient = data.clientName || ""; // e.g., 'MW ADMIN'
                window.sessionIsAdmin = !!data.isAdmin;
                localStorage.setItem('sessionClient', window.sessionClient);
                localStorage.setItem('sessionIsAdmin', window.sessionIsAdmin ? '1' : '0');
                
                // Track & Log login activity upon successful login
                if (typeof handleUserLoginSuccess === 'function') {
                    // Pass BOTH the login username (right-side greeting) and the
                    // client/department name from USERDB col D (left-side title).
                    handleUserLoginSuccess(window.sessionUser, window.sessionClient);
                } else {
                    // Pass BOTH clientName (left) and user/username (right) explicitly
                    showDashboard(data.clientName, body.user);
                }

                if (action === 'updatePassword') showModal("SECURED", "Account updated successfully.", "success");
            } 
            else if (status === "REQUIRE_UPDATE") {
                window.pendingRowIndex = data.rowIndex;
                document.getElementById('cardInner')?.classList.add('flipped');
            } 
            else if (status === "LOCKED" || status === "INACTIVE") {
                showModal("RESTRICTED", data.message || "Account is locked.", "lock");
            } 
            else {
                showDashboard(data.clientName, body.user);
            }
        } else {
            showModal("ACCESS DENIED", data.message || "Invalid credentials.", "error");
        }
    } catch (error) {
        console.error("Fetch error:", error);
        showModal("CONNECTION LOST", "Failed to reach server. Check deployment URL.", "error");
    } finally {
        if (typeof hideSeaWaveLoader === 'function') hideSeaWaveLoader();
    }
}

function showDashboard(clientName, userName) {
    const authContainer = document.getElementById('authContainer');
    const dashboard = document.getElementById('dashboard');
    if (authContainer) authContainer.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';
    
    // 1. LEFT SIDE: STRICTLY uses the Client Name
    const clientHeader = document.getElementById('clientHeader');
    if (clientHeader) clientHeader.innerText = (clientName || window.sessionClient || "DASHBOARD").toUpperCase() + " DASHBOARD";
    
    const hour = new Date().getHours();
    let greeting = "GOOD EVENING";
    if (hour < 12) greeting = "GOOD MORNING";
    else if (hour < 18) greeting = "GOOD AFTERNOON";
    
    // 2. RIGHT SIDE: STRICTLY uses your User Identity (Never the client name)
    const activeUser = userName || window.sessionUser || document.getElementById('userInput')?.value || "ADMIN";
    const formattedGreeting = `${greeting}, ${activeUser.toUpperCase()}`;
    
    const displayUser = document.getElementById('displayUsername');
    if (displayUser) displayUser.innerText = formattedGreeting;
}

function showModal(title, message, type) {
    const modal = document.getElementById('statusModal');
    if (!modal) return;
    
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    if (modalTitle) modalTitle.innerText = title;
    if (modalMessage) modalMessage.innerText = message;
    
    let iconHtml = '<i class="fa-solid fa-circle-xmark" style="color:#ff4444; font-size:3rem;"></i>';
    if (type === 'success') iconHtml = '<i class="fa-solid fa-circle-check" style="color:#00C851; font-size:3rem;"></i>';
    if (type === 'lock') iconHtml = '<i class="fa-solid fa-lock" style="color:#ffbb33; font-size:3rem;"></i>';
    
    const iconContainer = document.getElementById('modalIconContainer');
    if (iconContainer) iconContainer.innerHTML = iconHtml;
    
    modal.style.display = 'flex';
}

function logoutSystem() {
    // Record the logout in LOGIN_LOGS before wiping the session. We use
    // sendBeacon (falls back to a fire-and-forget fetch with keepalive)
    // so the request is still delivered even though we reload/navigate
    // away immediately afterward.
    const user = window.sessionUser || loggedInUser || localStorage.getItem("activeUser") || "";
    if (user && window.API) {
        const payload = JSON.stringify({
            action: "logout",
            user: user,
            client: window.sessionClient || "",
            token: window.API_TOKEN
        });
        try {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(window.API, new Blob([payload], { type: 'text/plain;charset=UTF-8' }));
            } else {
                fetch(window.API, { method: "POST", body: payload, keepalive: true });
            }
        } catch (err) {
            console.error("[LOGIN_LOGS] Failed to log logout:", err);
        }
    }

    localStorage.removeItem('activeUser');
    localStorage.removeItem('sessionClient');
    localStorage.removeItem('sessionIsAdmin');
    localStorage.removeItem('cached_area_outlets');
    window.location.reload();
}

// ==========================================
// MODAL CONTROLS & MODULE ROUTING
// ==========================================

function openModulesModal() {
    openModalAndLog('modulesModal', 'Opened Modules Modal');
}

function closeModulesModal() {
    const modal = document.getElementById('modulesModal');
    if (modal) modal.style.display = 'none';
}

function selectModuleFromModal(moduleName) {
    closeModulesModal();
    openModule(moduleName);
}

function openModule(moduleName) {
    const defaultView = document.getElementById('defaultWelcomeView');
    if (defaultView) defaultView.style.display = 'none';

    const views = document.querySelectorAll('.module-view');
    views.forEach(view => view.style.display = 'none');

    const targetView = document.getElementById('mod-' + moduleName);
    if (targetView) targetView.style.display = 'block';

    switch(moduleName) {
        case 'REPORT':
            loadReportModuleCode(targetView);
            break;
        case 'REQUEST_AND_RELEASED_FORM':
            loadRequestAndReleasedFormModuleCode(targetView);
            break;
        case 'TRANSFER_FORM':
            loadTransferFormModuleCode(targetView);
            break;
        case 'PULLOUT_FORM':
            loadPulloutFormModuleCode(targetView);
            break;
        case 'INCOMING':
            loadIncomingModuleCode(targetView);
            break;
        default:
            console.warn("Unknown module identifier:", moduleName);
    }
}

function printTransferForm() {
    const printableArea = document.getElementById('printableTransferForm');
    if (!printableArea) {
        showModal("PRINT ERROR", "Transfer form area not found.", "error");
        return;
    }
    window.print();
}

// ==========================================
// LOGIN & MODAL AUDIT LOGGING UTILITIES
// ==========================================

/**
 * Global variable or session tracker for the logged-in user
 */
let loggedInUser = "";

/**
 * Opens the target modal and sends the timestamp log to LOGIN_LOGS.
 * @param {string} modalId - The HTML ID of the modal element to display.
 * @param {string} modalTitle - Descriptive name of the modal for logging purposes.
 */
async function openModalAndLog(modalId, modalTitle) {
  // 1. Display the requested modal UI
  const modalElement = document.getElementById(modalId);
  if (modalElement) {
    modalElement.style.display = "block";
  }

  // 2. Extract current active user
  const user = window.sessionUser || loggedInUser || localStorage.getItem("activeUser") || "Unknown User";
  const actionDescription = modalTitle || "Opened Login / Modules Modal";

  // 3. Send via standard fetch to your web app deployment URL
  try {
    const response = await fetch(window.API, {
      method: "POST",
      body: JSON.stringify({
        action: "recordModalLogin",
        user: user,
        modalName: actionDescription,
        token: window.API_TOKEN
      })
    });
    const result = await response.json();
    if (result.success) {
      console.log(`[LOGIN_LOGS] Entry created for ${user}`);
    }
  } catch (err) {
    console.error("[LOGIN_LOGS] Failed to log modal action:", err);
  }
}

/**
 * Records a LOGIN_LOGS entry (with timestamp + department/client) whenever
 * one of the report buttons (INVENTORY, REQUEST & RELEASED HISTORY,
 * TRANSFER HISTORY, PULL OUT HISTORY) is clicked.
 * @param {string} label - descriptive action label for the LOGIN_LOGS "Action" column
 * @param {string} [departmentOverride] - optional explicit department/client to log
 */
async function logButtonClick(label, departmentOverride) {
  const scope = getSessionScope();
  const user = window.sessionUser || loggedInUser || localStorage.getItem("activeUser") || "Unknown User";
  const department = departmentOverride || scope.client || "";

  try {
    const response = await fetch(window.API, {
      method: "POST",
      body: JSON.stringify({
        action: "recordModalLogin",
        user: user,
        client: department,
        modalName: label,
        token: window.API_TOKEN
      })
    });
    const result = await response.json();
    if (result.success) {
      console.log(`[LOGIN_LOGS] Button click logged for ${user}: ${label}`);
    }
  } catch (err) {
    console.error("[LOGIN_LOGS] Failed to log button click:", err);
  }
}

/**
 * Hooking into your Login / Modules Modal trigger
 * @param {string} username - the user's login/identity code (RIGHT side greeting)
 * @param {string} clientName - USERDB col D value for this user (LEFT side title)
 */
function handleUserLoginSuccess(username, clientName) {
  // Save user context
  loggedInUser = username;
  window.sessionUser = username;
  window.sessionClient = clientName || window.sessionClient || "";
  localStorage.setItem("activeUser", username);
  localStorage.setItem("sessionClient", window.sessionClient);

  // Render dashboard — LEFT: client/department title fetched from USERDB col D,
  // RIGHT: strictly the user's own login name. These must never be swapped.
  showDashboard(window.sessionClient, username);

  // Open modal and log timestamp
  openModalAndLog("modulesModal", "User Login & Modules Overlay Opened");
}

// ==========================================
// ALERT POPUPS & TABLE UTILITIES
// ==========================================

let targetInputToFocus = null;

function showCustomAlert(message, inputElement = null) {
    targetInputToFocus = inputElement;
    const msgEl = document.getElementById('customAlertMessage');
    if (msgEl) msgEl.innerText = message;
    
    const alertModal = document.getElementById('customAlertModal');
    if (alertModal) alertModal.style.display = 'flex';
}

function closeCustomAlert() {
    const alertModal = document.getElementById('customAlertModal');
    if (alertModal) alertModal.style.display = 'none';
    
    if (targetInputToFocus) {
        targetInputToFocus.focus();
        targetInputToFocus = null;
    }
}

function clearTableData() {
    const activeModule = document.querySelector('.module-view[style*="display: block"]');
    if (activeModule) {
        const tableBody = activeModule.querySelector('#transferTableBody, #pulloutTableBody');
        if (tableBody) tableBody.innerHTML = '';
    }
}

// ==========================================
// AUTOMATIC SAVE AND PRINT HANDLERS
// ==========================================

async function triggerPrintForm() {
    const transferMod = document.getElementById('mod-TRANSFER_FORM');
    const reqRelMod = document.getElementById('mod-REQUEST_AND_RELEASED_FORM');

    const isTransferModule = transferMod && transferMod.style.display !== 'none';
    const isReqRelModule = reqRelMod && reqRelMod.style.display !== 'none';

    if (isTransferModule) {
        await triggerPrintTransferForm();
    } else if (isReqRelModule) {
        await triggerPrintRequestAndReleasedForm();
    } else {
        await triggerPrintPulloutForm();
    }
}

async function triggerPrintTransferForm() {
    const container = document.getElementById('mod-TRANSFER_FORM');
    const outgoingInput = container?.querySelector('#outletSearch');
    const incomingInput = container?.querySelector('#incomingOutletSearch');
    const dateInput = container?.querySelector('#formattedDateDisplay');

    const outgoingValue = outgoingInput ? outgoingInput.value.trim() : '';
    const incomingValue = incomingInput ? incomingInput.value.trim() : '';
    const formDate = dateInput ? dateInput.value.trim() : '';

    if (!outgoingValue) return showCustomAlert('Please select or type an OUTGOING DEPARTMENT before printing.', outgoingInput);
    if (!incomingValue) return showCustomAlert('Please select or type an INCOMING DEPARTMENT before printing.', incomingInput);

    const tableBody = container?.querySelector('#transferTableBody');
    const rows = tableBody ? tableBody.querySelectorAll('tr') : [];

    if (rows.length === 0) return showCustomAlert('Please add at least one product before printing.');

    const rowsToSave = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return;

        const getCellText = (idx) => cells[idx] ? cells[idx].innerText.trim() : '';
        const getInputValue = (idx) => {
            const input = cells[idx] ? cells[idx].querySelector('input') : null;
            return input ? input.value.trim() : '';
        };

        // The RECEIVED INFORMATION block (K:N — EXP DATE, QTY RELEASED, UOM,
        // REMARKS) is no longer collected on this form; it now gets filled in
        // later from the INCOMING > TRANSFER FORM screen. We still write 4
        // blank placeholders for those columns so INCOMING DEPARTMENT (O),
        // DATE (P) and the RECEIVED status flag (Q) keep landing in the same
        // sheet columns the rest of the app already expects.
        rowsToSave.push([
            outgoingValue,                                   // A - outgoing dept
            getCellText(0), getCellText(1), getCellText(2),  // B,C,D - SKU/DESC/UOM
            getCellText(3),                                  // E - EXP DATE
            getCellText(4), getCellText(5),                  // F,G - ON HAND / TOTAL ON HAND
            getCellText(6), getCellText(7),                  // H,I - COST / SRP
            getInputValue(8),                                // J - TRANSFER QTY
            '', '', '', '',                                  // K,L,M,N - (filled later on receipt)
            incomingValue,                                    // O - incoming dept
            formDate                                          // P - date
            // Q is intentionally left untouched/blank — the INCOMING >
            // TRANSFER FORM "RECEIVED" button marks it once fulfilled.
        ]);
    });

    if (typeof showSeaWaveLoader === 'function') showSeaWaveLoader("SAVING DATA...");

    try {
        const response = await fetch(window.API, {
            method: "POST",
            body: JSON.stringify({ action: "saveTransferData", sheetName: "TRANSFER", rows: rowsToSave, token: window.API_TOKEN })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error || result.message || "Failed to save data.");

        window.print();
        clearTableData();
    } catch (error) {
        console.error("Save Error:", error);
        showCustomAlert("Error saving record: " + error.message);
    } finally {
        if (typeof hideSeaWaveLoader === 'function') hideSeaWaveLoader();
    }
}

async function triggerPrintPulloutForm() {
    const container = document.getElementById('mod-PULLOUT_FORM');
    const outgoingInput = container?.querySelector('#outletSearch');
    const incomingInput = container?.querySelector('#incomingOutletSearch');
    const dateInput = container?.querySelector('#formattedDateDisplay');

    const outgoingValue = outgoingInput ? outgoingInput.value.trim() : '';
    const incomingValue = incomingInput ? incomingInput.value.trim() : '';
    const formDate = dateInput ? dateInput.value.trim() : '';

    if (!outgoingValue) return showCustomAlert('Please select or type an OUTGOING DEPARTMENT before printing.', outgoingInput);
    if (!incomingValue) return showCustomAlert('Please select or type an INCOMING DEPARTMENT before printing.', incomingInput);

    const tableBody = container?.querySelector('#pulloutTableBody') || container?.querySelector('#transferTableBody');
    const rows = tableBody ? tableBody.querySelectorAll('tr') : [];

    if (rows.length === 0) return showCustomAlert('Please add at least one product before printing.');

    // Retrieve active logged-in user and client account details
    const displayUserElement = document.getElementById('displayUsername');
    let activeUsername = window.sessionUser || loggedInUser || localStorage.getItem("activeUser") || "";
    if (!activeUsername && displayUserElement) {
        const fullGreeting = displayUserElement.innerText || "";
        activeUsername = fullGreeting.replace(/GOOD (MORNING|AFTERNOON|EVENING),\s*/i, "").trim();
    }

    const clientHeaderElement = document.getElementById('clientHeader');
    let activeClientName = clientHeaderElement ? clientHeaderElement.innerText.replace(/\s*SYSTEM\s*$/i, "").trim() : "";

    const rowsToSave = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return;

        const getCellText = (idx) => cells[idx] ? cells[idx].innerText.trim() : '';
        const getInputValue = (idx) => {
            const input = cells[idx] ? cells[idx].querySelector('input') : null;
            return input ? input.value.trim() : '';
        };

        // OUT/EXIT INFORMATION (K:N) and RETURN INFORMATION (O:R) are no
        // longer collected on this form — they're filled in later from the
        // INCOMING > PULL OUT / GATE PASS FORM screen. Blank placeholders
        // keep INCOMING DEPARTMENT (S), DATE (T) and the RECEIVED status
        // flag (U) landing in the same sheet columns as before.
        rowsToSave.push([
            outgoingValue,                                   // A - outgoing dept
            getCellText(0), getCellText(1), getCellText(2),  // B,C,D - SKU/DESC/UOM
            getCellText(3),                                  // E - EXP DATE
            getCellText(4), getCellText(5),                  // F,G - ON HAND / TOTAL ON HAND
            getCellText(6), getCellText(7),                  // H,I - COST / SRP
            getInputValue(8),                                // J - TRANSFER QTY
            '', '', '', '',                                  // K,L,M,N - OUT/EXIT info (filled later)
            '', '', '', '',                                  // O,P,Q,R - RETURN info (filled later)
            incomingValue,                                    // S - incoming dept
            formDate                                          // T - date
            // U is intentionally left untouched/blank — the INCOMING >
            // PULL OUT / GATE PASS FORM "RECEIVED" button marks it once fulfilled.
        ]);
    });

    if (typeof showSeaWaveLoader === 'function') showSeaWaveLoader("SAVING DATA...");

    try {
        const response = await fetch(window.API, {
            method: "POST",
            body: JSON.stringify({
                action: "savePulloutData",
                sheetName: "RTV",
                username: activeUsername || "N/A",
                clientAccount: activeClientName || "N/A",
                rows: rowsToSave,
                token: window.API_TOKEN
            })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message || "Failed to save data.");

        window.print();
        clearTableData();
    } catch (error) {
        console.error("Save Error:", error);
        showCustomAlert("Error saving record: " + error.message);
    } finally {
        if (typeof hideSeaWaveLoader === 'function') hideSeaWaveLoader();
    }
}

async function triggerPrintRequestAndReleasedForm() {
    const container = document.getElementById('mod-REQUEST_AND_RELEASED_FORM');
    const outgoingInput = container?.querySelector('#outletSearch');
    const incomingInput = container?.querySelector('#incomingOutletSearch');
    const dateInput = container?.querySelector('#formattedDateDisplay');

    const outgoingValue = outgoingInput ? outgoingInput.value.trim() : '';
    const incomingValue = incomingInput ? incomingInput.value.trim() : '';
    const formDate = dateInput ? dateInput.value.trim() : '';

    if (!outgoingValue) return showCustomAlert('Please select or type an OUTGOING DEPARTMENT before printing.', outgoingInput);
    if (!incomingValue) return showCustomAlert('Please select or type an INCOMING DEPARTMENT before printing.', incomingInput);

    const tableBody = container?.querySelector('#transferTableBody') || container?.querySelector('#pulloutTableBody');
    const rows = tableBody ? tableBody.querySelectorAll('tr') : [];

    if (rows.length === 0) return showCustomAlert('Please add at least one product before printing.');

    const rowsToSave = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 10) return;

        const getCellText = (idx) => cells[idx] ? cells[idx].innerText.trim() : '';
        const getInputValue = (idx) => {
            const input = cells[idx] ? cells[idx].querySelector('input') : null;
            return input ? input.value.trim() : '';
        };

        // RELEASED INFORMATION (K:N) and RECEIVED INFORMATION (O:R) are no
        // longer collected on this form — they're filled in later from the
        // INCOMING > REQUEST AND RELEASED FORM screen. Blank placeholders
        // keep INCOMING DEPARTMENT (S), DATE (T) and the RECEIVED status
        // flag (U) landing in the same sheet columns as before.
        rowsToSave.push([
            outgoingValue,                                   // A - outgoing/requesting dept
            getCellText(0), getCellText(1), getCellText(2),  // B,C,D - SKU/DESC/UOM
            getCellText(3),                                  // E - EXP DATE
            getCellText(4), getCellText(5),                  // F,G - ON HAND / TOTAL ON HAND
            getCellText(6), getCellText(7),                  // H,I - COST / SRP
            getInputValue(8),                                // J - REQUESTED/TRANSFER QTY
            '', '', '', '',                                  // K,L,M,N - RELEASED info (filled later)
            '', '', '', '',                                  // O,P,Q,R - RECEIVED info (filled later)
            incomingValue,                                    // S - incoming dept
            formDate                                          // T - date
            // U is intentionally left untouched/blank — the INCOMING >
            // REQUEST AND RELEASED FORM "RECEIVED" button marks it once fulfilled.
        ]);
    });

    if (typeof showSeaWaveLoader === 'function') showSeaWaveLoader("SAVING DATA...");

    try {
        const response = await fetch(window.API, {
            method: "POST",
            body: JSON.stringify({ action: "saveRequestData", sheetName: "REQUEST", rows: rowsToSave, token: window.API_TOKEN })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.message || "Failed to save data.");

        window.print();
        clearTableData();
    } catch (error) {
        console.error("Save Error:", error);
        showCustomAlert("Error saving record: " + error.message);
    } finally {
        if (typeof hideSeaWaveLoader === 'function') hideSeaWaveLoader();
    }
}

// ==========================================
// REPORT MODULE LOADERS & INVENTORY VIEWS
// ==========================================

async function loadReportModuleCode(container) {
    if (!container) return;
    try {
        container.innerHTML = `
            <div style="width: 100%; height: 100%; padding: 25px; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch;">
                <div style="margin-bottom: 35px; border-bottom: 1px solid rgba(0, 0, 0, 0.2); padding-bottom: 15px; position: relative;">
                    <h2 style="color: #111; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 1.3rem; letter-spacing: 2px; font-weight: 700;">
                        <i class="fa-solid fa-chart-line" style="margin-right: 10px; color: #111;"></i>REPORTS SYSTEM
                    </h2>
                    <div style="position: absolute; top: -5px; right: 0; z-index: 10;">
                        <button onclick="closeReportModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close">
                            <a href="#" class="menu-item" style="font-size: 1rem;"><i class="fa-solid fa-house"></i> Home</a>
                        </button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; gap: 20px; margin: auto 0;">
                    <div style="display: flex; justify-content: center; gap: 20px; width: 100%; max-width: 800px;">
                        <button class="nav-icon-btn" onclick="selectReportCategory('INVENTORY')" style="flex: 1 1 0px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-boxes-stacked" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">INVENTORY</span>
                        </button>

                        <button class="nav-icon-btn" onclick="selectReportCategory('REQUEST_RELEASED')" style="flex: 1 1 0px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-file-invoice" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">REQUEST & RELEASED HISTORY</span>
                        </button>
                    </div>

                    <div style="display: flex; justify-content: center; gap: 20px; width: 100%; max-width: 800px;">
                        <button class="nav-icon-btn" onclick="selectReportCategory('TRANSFER')" style="flex: 1 1 0px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-right-left" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">TRANSFER HISTORY</span>
                        </button>

                        <button class="nav-icon-btn" onclick="selectReportCategory('PULL_OUT')" style="flex: 1 1 0px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-file-arrow-down" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">PULL OUT HISTORY</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="padding: 20px; color: red;">Error loading report module.</p>`;
    }
}

function closeReportModal() {
    const reportView = document.getElementById('mod-REPORT');
    const welcomeView = document.getElementById('defaultWelcomeView');

    if (reportView) reportView.style.display = 'none';
    if (welcomeView) welcomeView.style.display = 'flex';
}

function selectReportCategory(category) {
    if (category === 'INVENTORY') {
        logButtonClick('INVENTORY_BUTTON_CLICKED');
        openInventoryModal();
    } else if (HISTORY_CONFIGS[category]) {
        const logLabel = (HISTORY_CONFIGS[category].title || category).toUpperCase().replace(/\s+/g, '_') + '_BUTTON_CLICKED';
        logButtonClick(logLabel);
        openHistoryModal(category);
    } else {
        console.warn("Unknown report category:", category);
    }
}

// ==========================================
// SESSION SCOPE (client/admin) — resolves who's allowed to see what
// ==========================================
function getSessionScope() {
    const client = String(window.sessionClient || localStorage.getItem('sessionClient') || '').trim();
    const rawAdmin = (window.sessionIsAdmin !== undefined)
        ? window.sessionIsAdmin
        : (localStorage.getItem('sessionIsAdmin') === '1');
    const isAdmin = rawAdmin === true || rawAdmin === 'true' || rawAdmin === 1 || rawAdmin === '1';
    return { client, isAdmin };
}

async function fetchInventoryByDepartment() {
    const deptInput = document.getElementById('inventoryDepartmentSearch');
    const scope = getSessionScope();

    // Non-admins can't widen scope by editing the field — always use their
    // own client. The input is also locked read-only in openInventoryModal,
    // this is just a second guard in case it's ever called some other way.
    const selectedDept = scope.isAdmin
        ? (deptInput ? deptInput.value.trim() : '')
        : scope.client;

    const tableBody = document.getElementById('inventoryTableBody');

    if (!selectedDept) {
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: #888; padding: 40px; font-size: 1rem;">
                        ${scope.isAdmin ? 'Select a department above to display inventory logs.' : 'No client is associated with your account. Contact an admin.'}
                    </td>
                </tr>`;
        }
        return;
    }

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: #00dbff; padding: 40px; font-size: 1rem;">
                    <i class="fa-solid fa-spinner fa-spin" style="margin-right: 10px;"></i>Loading inventory for ${escapeHtml(selectedDept)}...
                </td>
            </tr>`;
    }

    try {
        if (!window.API) throw new Error("window.API is undefined.");

        const username = window.sessionUser || localStorage.getItem('activeUser') || '';
        const url = `${window.API}?action=getScopedInventory&user=${encodeURIComponent(username)}&department=${encodeURIComponent(selectedDept)}&token=${encodeURIComponent(window.API_TOKEN)}`;
        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: #ff4d4d; padding: 40px; font-size: 1rem;">
                        ${escapeHtml(result.error || 'Failed to load inventory.')}
                    </td>
                </tr>`;
            return;
        }

        // The server resolves the actual department used (important for
        // non-admins, whose scope may differ from what's in the input).
        // Only apply this correction if the field still holds exactly what
        // we requested — if the user kept typing while this was in flight,
        // overwriting now would silently erase what they just typed.
        if (deptInput && result.department && deptInput.value.trim() === selectedDept && selectedDept !== result.department) {
            deptInput.value = result.department;
        }

        let rawData = result.data || [];

        // LOCATION (col Z / index 25) is what the department filter dropdown
        // above is matched against. The server already scopes the sheet by
        // department name; this further restricts rows to the ones whose
        // LOCATION cell matches the selected department text.
        const deptFilterValue = selectedDept.trim().toLowerCase();
        if (deptFilterValue) {
            rawData = rawData.filter(row => {
                const location = row[25] ? String(row[25]).trim().toLowerCase() : '';
                return !location || location === deptFilterValue;
            });
        }

        window.currentFetchedRows = rawData;

        // Automatic near-expiry checker — silently scans the newly loaded
        // department data and only pops the modal if something qualifies.
        if (typeof checkAndShowNearExpiryModal === 'function') {
            checkAndShowNearExpiryModal();
        }
window.currentFetchedRows = rawData;

        // Check for expired items and trigger popup alert
        if (typeof checkAndShowExpiredAlert === 'function') {
            checkAndShowExpiredAlert(rawData);
        }
        if (!rawData || rawData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: #ff4d4d; padding: 40px; font-size: 1rem;">
                        No inventory records found for ${escapeHtml(selectedDept)}.
                    </td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = '';
        rawData.forEach((row, index) => {
            // Column mapping (0-indexed from column A of the department sheet).
            // Updated after a column was deleted from the sheet, which shifted
            // DESCRIPTION one left and everything from TOTAL ONHAND onward one right:
            // B=SKU CODE, C=PRODUCT DESCRIPTION, E=UOM, F=COST, G=SRP,
            // X=EXPIRATION DATE, Y=QTY ONHAND, U=TOTAL ONHAND, Z=LOCATION
            const sku = row[1] || '';
            const desc = row[2] || '';
            const uom = row[4] || '-';
            const cost = row[5] !== undefined ? row[5] : '-';
            const srp = row[6] !== undefined ? row[6] : '-';
            const expDate = formatExpirationDate(row[23]) || '-';
            const qtyOnHand = row[24] !== undefined ? row[24] : 0;
            const totalOnHand = row[20] !== undefined ? row[20] : 0;
            const location = row[25] || '-';

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            tr.innerHTML = `
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); font-weight: bold; color: #00dbff;">${escapeHtml(sku)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05);">${escapeHtml(desc)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: center;">${escapeHtml(uom)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: center;">${escapeHtml(cost)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: center;">${escapeHtml(srp)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: center;">${escapeHtml(expDate)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: center;">${escapeHtml(qtyOnHand)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: center; font-weight: bold; color: #00ff88;">${escapeHtml(totalOnHand)}</td>
                <td style="padding: 10px; border-right: 1px solid rgba(255,255,255,0.05);">${escapeHtml(location)}</td>
                <td style="padding: 10px; text-align: center;">
                    <button onclick="viewItemDetails('${escapeHtml(sku)}', ${index})" style="background: rgba(0, 219, 255, 0.2); border: 1px solid #00dbff; color: #00dbff; padding: 5px 12px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 0.75rem;">
                        <i class="fa-solid fa-eye"></i> VIEW
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        if (typeof filterInventoryTable === 'function') {
            filterInventoryTable();
        }

    } catch (err) {
        console.error("Error fetching inventory by department:", err);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: #ff4d4d; padding: 40px; font-size: 1rem;">
                        Failed to load data for ${escapeHtml(selectedDept)}. Check connection or API URL.
                    </td>
                </tr>`;
        }
    }
}

function filterInventoryTable() {
    const searchInput = document.getElementById('skuSearchInput');
    const searchKeyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;

    const rows = tableBody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('td');
        if (cells.length < 10) continue;

        const skuText = (cells[0]?.textContent || '').toLowerCase();
        const descText = (cells[1]?.textContent || '').toLowerCase();

        const matchesSearch = (searchKeyword === '' || skuText.includes(searchKeyword) || descText.includes(searchKeyword));
        row.style.display = matchesSearch ? '' : 'none';
    }
}

window.openInventoryModal = function() {
    let modal = document.getElementById('inventoryModal');
    
    if (!modal) {
        const modalHTML = `
            <div id="inventoryModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: center;">
                <div style="background: rgba(18, 24, 38, 0.98); border: 1.5px solid rgba(0, 219, 255, 0.4); box-shadow: 0 0 25px rgba(0, 219, 255, 0.2); border-radius: 0; padding: 30px; width: 100vw; height: 100vh; color: #fff; text-align: left; font-family: 'Roboto Mono', monospace; position: relative; display: flex; flex-direction: column; box-sizing: border-box;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 219, 255, 0.3); padding-bottom: 15px; margin-bottom: 20px;">
                        <h2 style="color: #00dbff; margin: 0; letter-spacing: 2px; font-size: 1.5rem;">
                            <i class="fa-solid fa-boxes-stacked" style="margin-right: 12px;"></i>INVENTORY REPORT
                        </h2>
                        <button onclick="window.closeInventoryModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close">
                            &times;
                        </button>
                    </div>

                    <div style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; align-items: flex-end;">
                        <div style="flex: 1; min-width: 250px;">
                            <label style="display: block; font-size: 0.8rem; color: #00dbff; margin-bottom: 8px; font-weight: bold;">SELECT DEPARTMENT</label>
                            <input type="text" id="inventoryDepartmentSearch" list="outletList" placeholder="Type or select department..." style="width: 100%; padding: 12px; border-radius: 6px; border: 1px solid rgba(0, 219, 255, 0.4); background: rgba(0, 0, 0, 0.5); color: #fff; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; outline: none;">
                            <datalist id="outletList"></datalist>
                        </div>

                        <div style="flex: 1; min-width: 250px;">
                            <label style="display: block; font-size: 0.8rem; color: #00dbff; margin-bottom: 8px; font-weight: bold;">SEARCH SKU / ITEM DESCRIPTION</label>
                            <input type="text" id="skuSearchInput" onkeyup="filterInventoryTable()" placeholder="Search SKU code or item description..." style="width: 100%; padding: 12px; border-radius: 6px; border: 1px solid rgba(0, 219, 255, 0.4); background: rgba(0, 0, 0, 0.5); color: #fff; font-family: inherit; font-size: 0.9rem; box-sizing: border-box; outline: none;">
                        </div>

                        <button id="refreshInventoryBtn" onclick="refreshInventoryTable()" style="padding: 12px 20px; background: rgba(0, 219, 255, 0.2); border: 1px solid #00dbff; color: #00dbff; font-family: inherit; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; height: 43px; transition: all 0.2s ease;">
                            <i class="fa-solid fa-rotate-right"></i> REFRESH
                        </button>
                    </div>

                    <div id="inventoryModalContent" style="flex: 1; overflow-y: auto; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(0, 219, 255, 0.2); border-radius: 8px; padding: 0; position: relative;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #fff;">
                            <thead>
                                <tr style="color: #00dbff;">
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: left;">SKU CODE</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: left;">PRODUCT DESCRIPTION</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">UOM</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">COST</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">SRP</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">EXPIRATION DATE</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">QTY ONHAND</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">TOTAL ONHAND</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: left;">LOCATION</th>
                                    <th style="position: sticky; top: 0; z-index: 2; background: #0c101a; padding: 12px 10px; border: 1px solid rgba(0, 219, 255, 0.3); border-bottom: 2px solid #00dbff; text-align: center;">VIEW</th>
                                </tr>
                            </thead>
                            <tbody id="inventoryTableBody">
                                <tr>
                                    <td colspan="10" style="text-align: center; color: #888; padding: 40px; font-size: 1rem; border: 1px solid rgba(255, 255, 255, 0.1);">
                                        Select a department above to display inventory logs.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                </div>

            <div id="reloadProgressModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); z-index: 10002; justify-content: center; align-items: center;">
                <div style="background: #0c101a; border: 1.5px solid #00dbff; border-radius: 8px; padding: 25px 30px; width: 320px; text-align: center; color: #fff; font-family: 'Roboto Mono', monospace;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00dbff; margin-bottom: 15px;"></i>
                    <div style="font-size: 0.9rem; font-weight: bold; color: #00dbff; margin-bottom: 10px;">RELOADING TABLE DATA...</div>
                    <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; border: 1px solid rgba(0, 219, 255, 0.3);">
                        <div id="reloadProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00dbff, #00ff88); transition: width 0.2s ease;"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        const deptInput = document.getElementById('inventoryDepartmentSearch');
        if (deptInput) {
            deptInput.addEventListener('change', fetchInventoryByDepartment);
            // Debounced — firing a fetch on every keystroke is what caused
            // the race condition where a slow, stale response would land
            // after the user had already typed further and clobber the field.
            let deptInputDebounceTimer = null;
            deptInput.addEventListener('input', () => {
                clearTimeout(deptInputDebounceTimer);
                deptInputDebounceTimer = setTimeout(fetchInventoryByDepartment, 350);
            });
        }
    } else {
        modal.style.display = 'flex';
    }

    if (typeof loadOutletFilterFromConfig === 'function') {
        loadOutletFilterFromConfig();
    }

    // Lock the department field to the logged-in user's own client unless
    // they're an admin — this is a UX convenience only; the server enforces
    // the real restriction regardless of what this field contains.
    const scope = getSessionScope();
    const deptInputEl = document.getElementById('inventoryDepartmentSearch');
    if (deptInputEl) {
        if (scope.isAdmin) {
            deptInputEl.readOnly = false;
            deptInputEl.placeholder = "Type or select department...";
        } else {
            deptInputEl.value = scope.client || '';
            deptInputEl.readOnly = true;
            deptInputEl.placeholder = scope.client ? '' : 'No client on this account';
            deptInputEl.style.cursor = 'not-allowed';
            deptInputEl.style.opacity = '0.8';
        }
        if (deptInputEl.value.trim()) {
            fetchInventoryByDepartment();
        }
    }
};

async function refreshInventoryTable() {
    const deptInput = document.getElementById('inventoryDepartmentSearch');
    const selectedDept = deptInput ? deptInput.value.trim() : '';

    if (!selectedDept) {
        if (typeof showModal === 'function') showModal("NOTICE", "Please select a department first.", "lock");
        return;
    }

    const reloadModal = document.getElementById('reloadProgressModal');
    const reloadBar = document.getElementById('reloadProgressBar');

    if (reloadModal) reloadModal.style.display = 'flex';
    if (reloadBar) reloadBar.style.width = '0%';

    let progress = 0;
    const interval = setInterval(() => {
        if (progress < 85) {
            progress += 15;
            if (reloadBar) reloadBar.style.width = progress + '%';
        }
    }, 100);

    try {
        await fetchInventoryByDepartment();
        clearInterval(interval);
        if (reloadBar) reloadBar.style.width = '100%';
        await new Promise(r => setTimeout(r, 200));
    } catch (err) {
        clearInterval(interval);
        console.error(err);
    } finally {
        if (reloadModal) reloadModal.style.display = 'none';
        if (reloadBar) reloadBar.style.width = '0%';
    }
}

// ==========================================
// ITEM DRAWER & UPDATE HANDLERS
// ==========================================

/**
 * Converts a raw sheet date value (ISO string, M/D/YYYY, "June 1, 2026", etc.)
 * into the yyyy-mm-dd format required by <input type="date">.
 */
function parseToDateInputValue(rawDateVal) {
    const rawDateStr = rawDateVal ? String(rawDateVal).trim() : '';
    if (!rawDateStr) return '';

    if (rawDateStr.includes('T')) {
        return rawDateStr.split('T')[0];
    }
    if (rawDateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return rawDateStr;
    }
    if (rawDateStr.includes('/')) {
        const parts = rawDateStr.split('/');
        if (parts.length === 3) {
            const month = parts[0].padStart(2, '0');
            const day = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            return `${year}-${month}-${day}`;
        }
    }
    const d = new Date(rawDateStr);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return '';
}

function viewItemDetails(skuCode, rowIdx) {
    let drawer = document.getElementById('itemDrawer');
    let overlay = document.getElementById('drawerOverlay');

    if (!drawer) {
        const overlayHTML = `<div id="drawerOverlay" style="display: none; position: fixed; top: 20px; left: 0; bottom: 20px; width: 100vw; max-height: calc(100vh - 40px); overflow-y: auto; height: auto; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(5px); z-index: 10000; transition: opacity 0.3s ease;"></div>`;

        const drawerStyles = `
        <style id="itemDrawerStyles">
            #itemDrawer { scrollbar-width: thin; scrollbar-color: rgba(0,219,255,0.35) transparent; }
            #itemDrawer *, #itemDrawer *::before, #itemDrawer *::after { box-sizing: border-box; }
            #itemDrawer .dw-form::-webkit-scrollbar { width: 6px; }
            #itemDrawer .dw-form::-webkit-scrollbar-track { background: transparent; }
            #itemDrawer .dw-form::-webkit-scrollbar-thumb { background: rgba(0, 219, 255, 0.25); border-radius: 10px; }
            #itemDrawer .dw-form::-webkit-scrollbar-thumb:hover { background: rgba(0, 219, 255, 0.45); }

            #itemDrawer .dw-input {
                width: 100%; padding: 11px 12px; border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.03);
                color: #eef6f8; font-family: inherit; font-size: 0.83rem;
                outline: none; transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
                color-scheme: dark;
            }
            #itemDrawer .dw-input:hover { border-color: rgba(0, 219, 255, 0.35); }
            #itemDrawer .dw-input:focus {
                border-color: #00dbff; background: rgba(0, 219, 255, 0.06);
                box-shadow: 0 0 0 3px rgba(0, 219, 255, 0.14);
            }
            #itemDrawer .dw-input[readonly] {
                border-color: rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02);
                color: #6f7a8a; cursor: not-allowed;
            }
            #itemDrawer .dw-input[readonly]:hover { border-color: rgba(255, 255, 255, 0.08); }
            #itemDrawer textarea.dw-input { resize: none; line-height: 1.4; }

            /* Category dropdown: force both the closed box and the open
               options list to render as black background / white text. */
            #itemDrawer select#drawerAdjCategory {
                color-scheme: dark;
                background: #000000 !important;
                color: #ffffff !important;
            }
            #itemDrawer select#drawerAdjCategory option {
                background: #000000;
                color: #ffffff;
            }

            #itemDrawer .dw-label {
                display: flex; align-items: center; gap: 6px;
                font-size: 0.68rem; letter-spacing: 0.6px; color: #7d8ba0;
                margin-bottom: 6px; font-weight: 600; text-transform: uppercase;
            }
            #itemDrawer .dw-label.accent { color: #4fd8ea; }

            #itemDrawer .dw-section { margin-bottom: 26px; }
            #itemDrawer .dw-section:last-child { margin-bottom: 4px; }
            #itemDrawer .dw-section-head {
                display: flex; align-items: center; gap: 8px;
                margin-bottom: 14px; padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
            }
            #itemDrawer .dw-section-head i {
                color: #00dbff; font-size: 0.78rem; width: 16px; text-align: center;
            }
            #itemDrawer .dw-section-title {
                font-size: 0.72rem; letter-spacing: 1.2px; font-weight: 700;
                color: #cfe9ee; text-transform: uppercase;
            }
            #itemDrawer .dw-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 14px 14px;
            }
            #itemDrawer .dw-span2 { grid-column: 1 / -1; }

            #itemDrawer #closeDrawerBtn {
                width: 34px; height: 34px; border-radius: 8px;
                display: flex; align-items: center; justify-content: center;
                background: transparent; transition: background 0.15s ease, transform 0.15s ease;
            }
            #itemDrawer #closeDrawerBtn:hover { background: rgba(255, 77, 77, 0.12); transform: rotate(90deg); }

            #itemDrawer #submitUpdateBtn { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
            #itemDrawer #submitUpdateBtn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0, 219, 255, 0.3); background: #29e4ff; }
            #itemDrawer #submitUpdateBtn:active { transform: translateY(0); }
        </style>`;

        const drawerHTML = `
            <div id="itemDrawer" style="position: fixed; top: 0; right: -640px; width: 600px; height: 95%; background: linear-gradient(180deg, #0d1220 0%, #0a0e17 100%); border-left: 1px solid rgba(0, 219, 255, 0.25); box-shadow: -18px 0 40px rgba(0, 0, 0, 0.55); z-index: 10001; transition: right 0.32s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; font-family: 'Roboto Mono', monospace; color: #fff; padding: 26px 26px 22px;">
                ${drawerStyles}

                <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; margin-bottom: 22px; position: relative;">
                    <div>
                        <h3 style="color: #eef6f8; margin: 0; font-size: 1.05rem; letter-spacing: 0.4px; font-weight: 700;">
                            <i class="fa-solid fa-box-open" style="margin-right: 9px; color: #00dbff;"></i>Item Details
                        </h3>
                        <p style="margin: 6px 0 0; font-size: 0.7rem; color: #6f7a8a; letter-spacing: 0.3px;">Review and update this SKU's live inventory record</p>
                    </div>
                    <button type="button" id="closeDrawerBtn" title="Close">
                        <i class="fa-solid fa-xmark" style="color: #ff6b6b; font-size: 1.05rem;"></i>
                    </button>
                    <div style="position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: linear-gradient(90deg, rgba(0,219,255,0.5), rgba(0,219,255,0));"></div>
                </div>

                <form id="drawerUpdateForm" class="dw-form" style="flex: 1; overflow-y: auto; padding-right: 6px;">
                    <input type="hidden" id="drawerSheetRowIndex">
                    <input type="hidden" id="drawerUom">

                    <div class="dw-section">
                        <div class="dw-grid">
                            <div class="dw-span2">
                                <label class="dw-label accent">SKU Code</label>
                                <input type="text" id="drawerSkuCode" readonly class="dw-input">
                            </div>
                            <div class="dw-span2">
                                <label class="dw-label accent">Item Description</label>
                                <textarea id="drawerItemDesc" readonly rows="2" class="dw-input"></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="dw-section">
                        <div class="dw-section-head">
                            <i class="fa-solid fa-layer-group"></i>
                            <span class="dw-section-title">Expiration Batches</span>
                        </div>
                        <div class="dw-grid">
                            <div>
                                <label class="dw-label">Expiration Date (1st)</label>
                                <input type="date" id="drawerExpDate1" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Qty</label>
                                <input type="number" id="drawerQty1" min="0" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Expiration Date (2nd)</label>
                                <input type="date" id="drawerExpDate2" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Qty</label>
                                <input type="number" id="drawerQty2" min="0" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Expiration Date (3rd)</label>
                                <input type="date" id="drawerExpDate3" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Qty</label>
                                <input type="number" id="drawerQty3" min="0" class="dw-input">
                            </div>
                        </div>
                    </div>

                    <div class="dw-section">
                        <div class="dw-section-head">
                            <i class="fa-solid fa-tag"></i>
                            <span class="dw-section-title">Pricing</span>
                        </div>
                        <div class="dw-grid">
                            <div>
                                <label class="dw-label">SRP</label>
                                <input type="number" id="drawerSrp" min="0" step="0.01" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Cost</label>
                                <input type="number" id="drawerCost" min="0" step="0.01" class="dw-input">
                            </div>
                        </div>
                    </div>

                    <div class="dw-section">
                        <div class="dw-section-head">
                            <i class="fa-solid fa-truck-ramp-box"></i>
                            <span class="dw-section-title">Stock Receiving</span>
                        </div>
                        <div class="dw-grid">
                            <div>
                                <label class="dw-label">Stock Received</label>
                                <input type="number" id="drawerStockReceived" min="0" class="dw-input">
                            </div>
                            <div>
                                <label class="dw-label">Received Date</label>
                                <input type="date" id="drawerReceivedDate" class="dw-input">
                            </div>
                            <div class="dw-span2">
                                <label class="dw-label" style="color: #5b6678;">Total Available Qty</label>
                                <input type="number" id="drawerTotalAvail" readonly class="dw-input">
                            </div>
                        </div>
                    </div>

                    <div class="dw-section">
                        <div class="dw-section-head">
                            <i class="fa-solid fa-right-left"></i>
                            <span class="dw-section-title">Adjustments</span>
                        </div>
                        <div class="dw-grid">
                            <div class="dw-span2">
                                <label class="dw-label">Category</label>
                                <select id="drawerAdjCategory" class="dw-input">
                                    <option value="">Select category...</option>
                                </select>
                            </div>
                            <div>
                                <label class="dw-label">Qty</label>
                                <input type="number" id="drawerAdjQty" min="0" placeholder="Enter qty..." class="dw-input">
                            </div>
                            <div class="dw-span2">
                                <label class="dw-label">Remarks</label>
                                <textarea id="drawerAdjRemarks" rows="2" placeholder="Optional remarks..." class="dw-input"></textarea>
                            </div>
                        </div>
                    </div>
                </form>

                <div style="padding-top: 18px; border-top: 1px solid rgba(255, 255, 255, 0.07); margin-top: 6px;">
                    <div style="display: flex; justify-content: center; width: 100%;">
  <div style="display: flex; justify-content: center; width: 100%;">
  <button type="button" id="submitUpdateBtn" style="width: 40%; padding: 13px; background: #00dbff; border: none; color: #041014; font-family: inherit; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.4px; border-radius: 8px; cursor: pointer;">
    <i class="fa-solid fa-floppy-disk" style="margin-right: 8px;"></i>UPDATE INVENTORY
  </button>
</div>

                    <div id="updateProgressContainer" style="display: none; margin-top: 12px; text-align: center;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #00dbff; margin-bottom: 6px; font-weight: 600; letter-spacing: 0.4px;">
                            <span>UPDATING INVENTORY...</span>
                            <span id="updateProgressPercent">0%</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.08); border-radius: 6px; overflow: hidden; border: 1px solid rgba(0, 219, 255, 0.25);">
                            <div id="updateProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00dbff, #00ff88); transition: width 0.2s ease; box-shadow: 0 0 8px #00dbff;"></div>
                        </div>
                    </div>
                </div>
            </div>`;

        document.body.insertAdjacentHTML('beforeend', overlayHTML + drawerHTML);
        drawer = document.getElementById('itemDrawer');
        overlay = document.getElementById('drawerOverlay');

        document.getElementById('closeDrawerBtn').addEventListener('click', closeItemDrawer);
        overlay.addEventListener('click', closeItemDrawer);
        document.getElementById('submitUpdateBtn').addEventListener('click', submitItemUpdate);
    }

    const itemData = window.currentFetchedRows ? window.currentFetchedRows[rowIdx] : null;

    if (!itemData) {
        if (typeof showModal === 'function') showModal("ERROR", "Item details could not be retrieved.", "error");
        return;
    }

    document.getElementById('drawerSheetRowIndex').value = rowIdx + 8;
    document.getElementById('drawerSkuCode').value = itemData[1] || skuCode || '';
    document.getElementById('drawerItemDesc').value = itemData[2] || '';
    document.getElementById('drawerUom').value = itemData[4] || '';

    // Expiration date / qty batch tracking (cols H-M): 3 pairs, added before SRP.
    document.getElementById('drawerExpDate1').value = parseToDateInputValue(itemData[7]);
    document.getElementById('drawerQty1').value = itemData[8] !== undefined ? itemData[8] : '';
    document.getElementById('drawerExpDate2').value = parseToDateInputValue(itemData[9]);
    document.getElementById('drawerQty2').value = itemData[10] !== undefined ? itemData[10] : '';
    document.getElementById('drawerExpDate3').value = parseToDateInputValue(itemData[11]);
    document.getElementById('drawerQty3').value = itemData[12] !== undefined ? itemData[12] : '';

    document.getElementById('drawerSrp').value = itemData[6] !== undefined ? itemData[6] : '';
    document.getElementById('drawerCost').value = itemData[5] !== undefined ? itemData[5] : '';
    document.getElementById('drawerStockReceived').value = itemData[14] !== undefined ? itemData[14] : '';
    document.getElementById('drawerReceivedDate').value = parseToDateInputValue(itemData[15]);
    document.getElementById('drawerTotalAvail').value = itemData[20] !== undefined ? itemData[20] : 0;
    document.getElementById('drawerAdjCategory').value = '';
    document.getElementById('drawerAdjQty').value = '';
    document.getElementById('drawerAdjRemarks').value = '';
    loadAdjustmentCategoryOptions();

    overlay.style.display = 'block';
    setTimeout(() => {
        drawer.style.right = '0px';
    }, 10);
}

let cachedAdjustmentCategories = null;

async function loadAdjustmentCategoryOptions() {
    const select = document.getElementById('drawerAdjCategory');
    if (!select) return;

    // Only trust the cache if it's a real, non-empty result — an empty
    // array here almost always means a previous fetch failed silently
    // (wrong sheet name, not-yet-redeployed backend, network hiccup), and
    // we don't want to lock the dropdown empty forever because of that.
    if (!cachedAdjustmentCategories || cachedAdjustmentCategories.length === 0) {
        try {
            if (!window.API) return;
            const url = `${window.API}?sheet=DD&range=A1:A&token=${encodeURIComponent(window.API_TOKEN)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success === false) {
                console.error("DD category fetch failed:", result.error || result);
                cachedAdjustmentCategories = null; // don't cache the failure — retry next time
                select.innerHTML = '<option value="">Could not load categories — try reopening</option>';
                return;
            }

            let rawData = Array.isArray(result) ? result : (result.values || result.data || []);

            const seen = new Set();
            const categories = [];
            rawData.forEach(row => {
                const val = Array.isArray(row) ? row[0] : row;
                const stringVal = val !== null && val !== undefined ? String(val).trim() : '';
                if (!stringVal) return;
                if (stringVal.toUpperCase() === 'DD' || stringVal.toUpperCase() === 'CATEGORY') return; // skip a stray header cell
                const key = stringVal.toUpperCase();
                if (seen.has(key)) return; // dedupe
                seen.add(key);
                categories.push(stringVal);
            });
            cachedAdjustmentCategories = categories;
        } catch (error) {
            console.error("Failed to load DD category list:", error);
            cachedAdjustmentCategories = null; // don't cache the failure — retry next time
            select.innerHTML = '<option value="">Could not load categories — try reopening</option>';
            return;
        }
    }

    select.innerHTML = '<option value="">Select category...</option>';
    cachedAdjustmentCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
}

function closeItemDrawer() {
    const drawer = document.getElementById('itemDrawer');
    const overlay = document.getElementById('drawerOverlay');

    if (drawer) drawer.style.right = '-640px';
    setTimeout(() => {
        if (overlay) overlay.style.display = 'none';
    }, 300);
}

async function submitItemUpdate() {
    const rowIndex = document.getElementById('drawerSheetRowIndex').value;
    const sku = document.getElementById('drawerSkuCode').value;
    const expDate1 = document.getElementById('drawerExpDate1').value;
    const qty1 = document.getElementById('drawerQty1').value;
    const expDate2 = document.getElementById('drawerExpDate2').value;
    const qty2 = document.getElementById('drawerQty2').value;
    const expDate3 = document.getElementById('drawerExpDate3').value;
    const qty3 = document.getElementById('drawerQty3').value;
    const srp = document.getElementById('drawerSrp').value;
    const cost = document.getElementById('drawerCost').value;
    const stockReceived = document.getElementById('drawerStockReceived').value;
    const receivedDate = document.getElementById('drawerReceivedDate').value;
    const adjCategory = document.getElementById('drawerAdjCategory').value;
    const adjQty = document.getElementById('drawerAdjQty').value;
    const adjRemarks = document.getElementById('drawerAdjRemarks').value;

    const deptInput = document.getElementById('inventoryDepartmentSearch');
    const sheetName = deptInput ? deptInput.value.trim() : '';

    if (!sheetName) {
        if (typeof showModal === 'function') showModal("ERROR", "No active department selected.", "error");
        return;
    }

    const submitBtn = document.getElementById('submitUpdateBtn');
    const progressContainer = document.getElementById('updateProgressContainer');
    const progressBar = document.getElementById('updateProgressBar');
    const progressPercent = document.getElementById('updateProgressPercent');

    if (submitBtn) submitBtn.style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'block';
    
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
        if (currentProgress < 90) {
            currentProgress += 10;
            if (progressBar) progressBar.style.width = `${currentProgress}%`;
            if (progressPercent) progressPercent.innerText = `${currentProgress}%`;
        }
    }, 150);

    const payload = {
        action: "updateInventoryItem",
        sheetName: sheetName,
        rowIndex: rowIndex,
        expDate1: expDate1,
        qty1: qty1,
        expDate2: expDate2,
        qty2: qty2,
        expDate3: expDate3,
        qty3: qty3,
        srp: srp,
        cost: cost,
        stockReceived: stockReceived,
        receivedDate: receivedDate,
        adjCategory: adjCategory,
        adjQty: adjQty,
        adjRemarks: adjRemarks,
        // Sent along so the backend can log a "MINUS TO INV" audit row
        // without needing another sheet lookup.
        itemDescription: document.getElementById('drawerItemDesc').value,
        itemUom: document.getElementById('drawerUom') ? document.getElementById('drawerUom').value : '',
        token: window.API_TOKEN
    };

    try {
        const response = await fetch(window.API, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        clearInterval(progressInterval);

        if (result.success) {
            if (progressBar) progressBar.style.width = '100%';
            if (progressPercent) progressPercent.innerText = '100%';

            await new Promise(r => setTimeout(r, 200));

            closeItemDrawer();

            if (typeof showModal === 'function') {
                showModal("UPDATED", `SKU ${sku} updated successfully.`, "success");
            }

            await fetchInventoryByDepartment();

        } else {
            throw new Error(result.error || "Update failed.");
        }

    } catch (err) {
        clearInterval(progressInterval);
        console.error("Error updating inventory:", err);
        if (typeof showModal === 'function') {
            showModal("ERROR", err.message || "Failed to update inventory.", "error");
        }
    } finally {
        setTimeout(() => {
            if (submitBtn) submitBtn.style.display = 'block';
            if (progressContainer) progressContainer.style.display = 'none';
            if (progressBar) progressBar.style.width = '0%';
            if (progressPercent) progressPercent.innerText = '0%';
        }, 300);
    }
}

window.closeInventoryModal = function() {
    const modal = document.getElementById('inventoryModal');
    if (modal) modal.style.display = 'none';

    const statusModal = document.getElementById('statusModal');
    if (statusModal) statusModal.style.display = 'none';
};

// ==========================================
// DATA & PRODUCT MODAL MANAGEMENT
// ==========================================

let allFetchedProducts = [];

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function openProductListModal() {
    const activeModule = document.querySelector('.module-view[style*="display: block"]');
    const outletInput = activeModule?.querySelector('#outletSearch');
    const rawOutlet = outletInput ? outletInput.value.trim() : '';

    if (!rawOutlet) {
        showCustomAlert("Please select or type an OUTGOING DEPARTMENT first.", outletInput);
        return;
    }

    const modalTitleEl = document.getElementById('productListModalTitle') 
        || document.querySelector('#productListModal h2, #productListModal h3');
    if (modalTitleEl) {
        modalTitleEl.innerText = `SELECT PRODUCT IN ${rawOutlet.toUpperCase()}`;
    }

    const modal = document.getElementById('productListModal');
    if (modal) modal.style.display = 'flex';

    const tableBody = document.getElementById('productListTableBody');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:15px; border:1px solid #000;">Loading products...</td></tr>';
    }

    try {
        if (!window.API) return;

        const selectedOutlet = rawOutlet.toLowerCase();
        // DATA sheet is a separate, narrower sheet from the per-department
        // inventory tabs — it only goes out to column I (SRP/COST are
        // optional extra columns beyond the core A-G layout).
        const url = `${window.API}?sheet=DATA&range=A1:I&token=${encodeURIComponent(window.API_TOKEN)}`;
        const response = await fetch(url);
        const result = await response.json();

        let rawData = Array.isArray(result) ? result : (result.values || result.data || []);

        // Column mapping (0-indexed from column A of the DATA sheet):
        // A=SKU CODE, B=PRODUCT DESCRIPTION, C=UOM, D=EXPIRATION DATE,
        // E=QTY ONHAND, F=TOTAL ONHAND, G=LOCATION (outlet match),
        // H=COST (optional), I=SRP (optional)
        allFetchedProducts = [];
        rawData.forEach((row, index) => {
            if (index === 0) return;
            
            let sku = Array.isArray(row) ? (row[0] || '') : '';
            let description = Array.isArray(row) ? (row[1] || '') : '';
            let uom = Array.isArray(row) ? (row[2] || '-') : '-';
            
            let rawExpDate = Array.isArray(row) ? row[3] : '';
            let expDate = formatExpirationDate(rawExpDate);

            let qtyOnhand = Array.isArray(row) ? (row[4] || '0') : '0';
            let totalOnhand = Array.isArray(row) ? (row[5] || '0') : '0';
            let outletMatch = Array.isArray(row) ? (row[6] || '') : '';
            let cost = Array.isArray(row) ? (row[7] || '0') : '0';
            let srp = Array.isArray(row) ? (row[8] || '0') : '0';

            if (String(outletMatch).trim().toLowerCase() === selectedOutlet) {
                if (sku !== '' || description !== '') {
                    allFetchedProducts.push({ sku, description, uom, expDate, qtyOnhand, totalOnhand, cost, srp });
                }
            }
        });

        renderProductTable(allFetchedProducts);

    } catch (error) {
        console.error("Failed to load products from DATA sheet:", error);
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red; padding:15px; border:1px solid #000;">Failed to load products.</td></tr>';
        }
    }
}

function filterProductList() {
    const filterInput = document.getElementById('productSearchFilter');
    const query = filterInput ? filterInput.value.trim().toLowerCase() : '';

    if (!query) {
        renderProductTable(allFetchedProducts);
        return;
    }

    const filtered = allFetchedProducts.filter(item => {
        const skuMatch = String(item.sku).toLowerCase().includes(query);
        const descMatch = String(item.description).toLowerCase().includes(query);
        return skuMatch || descMatch;
    });

    renderProductTable(filtered);
}

function formatExpirationDate(dateVal) {
    if (!dateVal || String(dateVal).trim() === '' || String(dateVal).trim().toUpperCase() === 'N/A') {
        return '';
    }

    let parsedDate;
    const strVal = String(dateVal).trim();

    if (strVal.includes('-')) {
        const parts = strVal.split('-');
        if (parts.length === 3) {
            parsedDate = new Date(parts[0], parts[1] - 1, parts[2]);
        }
    } else if (strVal.includes('/')) {
        const parts = strVal.split('/');
        if (parts.length === 3) {
            parsedDate = new Date(parts[2], parts[0] - 1, parts[1]);
        }
    } else {
        parsedDate = new Date(strVal);
    }

    if (!parsedDate || isNaN(parsedDate.getTime())) return '';

    const month = parsedDate.toLocaleString('en-US', { month: 'long' }).toUpperCase();
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const year = parsedDate.getFullYear();

    return `${month} ${day}, ${year}`;
}

function renderProductTable(products) {
    const tableBody = document.getElementById('productListTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:15px; border:1px solid #000;">No products found for this outlet.</td></tr>';
        return;
    }

    products.forEach((item) => {
        const originalIndex = allFetchedProducts.indexOf(item);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">
                <input type="checkbox" class="product-row-checkbox" data-index="${originalIndex}">
            </td>
            <td style="padding: 8px; border: 1px solid #000;">${escapeHtml(item.sku)}</td>
            <td style="padding: 8px; border: 1px solid #000;">${escapeHtml(item.description)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${escapeHtml(item.uom)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${escapeHtml(item.expDate)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${escapeHtml(item.qtyOnhand)}</td>
            <td style="padding: 8px; border: 1px solid #000; text-align: center;">${escapeHtml(item.totalOnhand)}</td>
        `;
        tableBody.appendChild(tr);
    });

    const selectAll = document.getElementById('selectAllProducts');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.onchange = function () {
            const rowCheckboxes = tableBody.querySelectorAll('.product-row-checkbox');
            rowCheckboxes.forEach(cb => cb.checked = this.checked);
        };
    }

    tableBody.querySelectorAll('.product-row-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            const allCheckboxes = tableBody.querySelectorAll('.product-row-checkbox');
            const checkedCheckboxes = tableBody.querySelectorAll('.product-row-checkbox:checked');
            if (selectAll) {
                selectAll.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
            }
        });
    });
}

function addSelectedProducts() {
    const selectedCheckboxes = document.querySelectorAll('.product-row-checkbox:checked');
    if (selectedCheckboxes.length === 0) {
        showCustomAlert("Please select at least one product.");
        return;
    }

    const activeModule = document.querySelector('.module-view[style*="display: block"]');
    let tableBody = activeModule?.querySelector('#transferTableBody, #pulloutTableBody') || 
                    document.getElementById('transferTableBody') || 
                    document.getElementById('pulloutTableBody');

    if (!tableBody) return;

    selectedCheckboxes.forEach(cb => {
        const idx = cb.getAttribute('data-index');
        const item = allFetchedProducts[idx];
        if (!item) return;

        const existingRow = Array.from(tableBody.querySelectorAll('tr[data-sku]'))
            .find(r => r.getAttribute('data-sku') === item.sku);
        if (existingRow) return;

        const rowId = 'row-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

        const tdStyle = "padding: 6px 8px; border-bottom: 1px solid #e9ecef; vertical-align: middle; box-sizing: border-box;";
        const inputStyle = "width: 100%; border: none; border-radius: 6px; padding: 4px 6px; font-family: inherit; font-size: 0.78rem; outline: none; box-sizing: border-box; background: #fff;";

        const tr = document.createElement('tr');
        tr.setAttribute('data-row-id', rowId);
        tr.setAttribute('data-sku', item.sku);
        tr.style.height = "38px";

        // All three outgoing forms (REQUEST_AND_RELEASED_FORM, TRANSFER_FORM,
        // PULLOUT_FORM) now only collect the base product/qty info — the
        // former RELEASED / RECEIVED / OUT-EXIT / RETURN column groups were
        // removed and are filled in later from the matching INCOMING form.
        tr.innerHTML = `
            <td style="${tdStyle} font-weight: 600; color: #212529;">${escapeHtml(item.sku)}</td>
            <td style="${tdStyle}">${escapeHtml(item.description)}</td>
            <td style="${tdStyle} text-align: center; color: #495057;">${escapeHtml(item.uom)}</td>
            <td style="${tdStyle} text-align: center; color: #495057;">${escapeHtml(item.expDate || '-')}</td>
            <td style="${tdStyle} text-align: center;">${escapeHtml(item.qtyOnhand)}</td>
            <td style="${tdStyle} text-align: center;">${escapeHtml(item.totalOnhand)}</td>
            <td style="${tdStyle} text-align: center; color: #495057;">${escapeHtml(item.cost || '-')}</td>
            <td style="${tdStyle} text-align: center; color: #495057;">${escapeHtml(item.srp || '-')}</td>
            <td style="${tdStyle} text-align: center;">
                <input type="number" min="1" value="1" style="${inputStyle} text-align: center; font-weight: 600;">
            </td>
            <td style="${tdStyle} text-align: center;" class="no-print">
                <button type="button" onclick="removeTransferRow('${rowId}')" title="Remove Row" style="background: transparent; border: none; color: #ff4d4d; cursor: pointer; font-size: 1.2rem; font-weight: bold; line-height: 1; padding: 2px 5px;">✕</button>
            </td>
        `;

        tableBody.appendChild(tr);
    });

    closeProductListModal();
}

function removeTransferRow(rowId) {
    const rows = document.querySelectorAll(`tr[data-row-id="${rowId}"]`);
    rows.forEach(r => r.remove());
}

function closeProductListModal() {
    const modal = document.getElementById('productListModal');
    if (modal) modal.style.display = 'none';
}

function setTransferDate() {
    const todayObj = new Date();
    const formatted = todayObj.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    }).toUpperCase();
    
    const activeModule = document.querySelector('.module-view[style*="display: block"]');
    const displayField = activeModule?.querySelector('#formattedDateDisplay') || document.getElementById('formattedDateDisplay');
    if (displayField) displayField.value = formatted;
}

async function loadOutletFilterFromConfig() {
    const datalists = document.querySelectorAll('datalist#outletList');
    if (datalists.length === 0) return;

    if (window.cachedOutlets && window.cachedOutlets.length > 0) {
        populateOutletDatalist(window.cachedOutlets);
        return;
    }

    const localData = localStorage.getItem('cached_area_outlets');
    if (localData) {
        try {
            window.cachedOutlets = JSON.parse(localData);
            populateOutletDatalist(window.cachedOutlets);
            return;
        } catch (e) {
            console.warn("Failed to parse cached outlets, fetching fresh data...");
        }
    }

    try {
        if (!window.API) return;

        const url = `${window.API}?sheet=AREA&range=A1:A&token=${encodeURIComponent(window.API_TOKEN)}`;
        const response = await fetch(url);
        const result = await response.json();

        let rawData = Array.isArray(result) ? result : (result.values || result.data || []);
        let outlets = [];

        rawData.forEach(row => {
            let val = Array.isArray(row) ? row[0] : row;
            if (val !== null && val !== undefined) {
                const stringVal = String(val).trim();
                if (stringVal !== '') outlets.push(stringVal);
            }
        });

        window.cachedOutlets = outlets;
        localStorage.setItem('cached_area_outlets', JSON.stringify(outlets));
        populateOutletDatalist(outlets);

    } catch (error) {
        console.error("Failed to load outlets from AREA sheet:", error);
    }
}

function populateOutletDatalist(outlets) {
    const datalists = document.querySelectorAll('datalist#outletList');
    datalists.forEach(datalist => {
        datalist.innerHTML = '';
        outlets.forEach(outlet => {
            const option = document.createElement('option');
            option.value = outlet;
            datalist.appendChild(option);
        });
    });
}

// ==========================================
// FORM MODULE ASYNC LOADERS
// ==========================================

async function loadRequestAndReleasedFormModuleCode(container) {
    if (!container) return;
    try {
        container.innerHTML = `<p style="padding: 20px; font-family: 'Roboto Mono', monospace; color: #fff;">Loading Request and Released Form...</p>`;
        
        const response = await fetch('modules/request_and_released_form/index.html');
        if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to load file.`);
        
        const htmlContent = await response.text();
        
        container.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 98%; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 3000; box-sizing: border-box; padding: 20px 50px 20px 20px;">
                <div class="glass-card" style="position: relative; width: 100%; height:100%; max-width: none; max-height: none; overflow-y: auto; background: rgba(20, 20, 25, 0.95); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 60px; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch; box-shadow: 0 30px 60px rgba(0,0,0,0.7);">
                    <div style="position: absolute; top: 18px; right: 25px; z-index: 10; display: flex; gap: 12px; align-items: center;">
                        <button onclick="closeRequestAndReleasedFormModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="color: #111; flex: 1; display: flex; flex-direction: column;">
                        ${htmlContent}
                    </div>
                </div>
            </div>
        `;

        if (typeof loadOutletFilterFromConfig === 'function') loadOutletFilterFromConfig();
        if (typeof setTransferDate === 'function') setTransferDate();

    } catch (error) {
        console.error("Module Load Error:", error);
        container.innerHTML = `<p style="padding: 20px; color: red;">Error loading Request and Released Form module: ${error.message}</p>`;
    }
}

function closeRequestAndReleasedFormModal() {
    const defaultView = document.getElementById('defaultWelcomeView');
    if (defaultView) defaultView.style.display = 'flex';
    
    const targetView = document.getElementById('mod-REQUEST_AND_RELEASED_FORM');
    if (targetView) {
        targetView.style.display = 'none';
        targetView.innerHTML = '';
    }
}

async function loadTransferFormModuleCode(container) {
    if (!container) return;
    try {
        container.innerHTML = `<p style="padding: 20px; font-family: 'Roboto Mono', monospace; color: #fff;">Loading Transfer Form...</p>`;
        
        const response = await fetch('modules/transfer_form/index.html');
        if (!response.ok) throw new Error("Failed to load module file.");
        
        const htmlContent = await response.text();
        
        container.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 98%; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 3000; box-sizing: border-box; padding: 20px 50px 20px 20px;">
                <div class="glass-card" style="position: relative; width: 100%; height:100%; max-width: none; max-height: none; overflow-y: auto; background: rgba(20, 20, 25, 0.95); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 60px; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch; box-shadow: 0 30px 60px rgba(0,0,0,0.7);">
                    <div style="position: absolute; top: 18px; right: 25px; z-index: 10; display: flex; gap: 12px; align-items: center;">
                        <button onclick="closeTransferModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="color: #111; flex: 1; display: flex; flex-direction: column;">
                        ${htmlContent}
                    </div>
                </div>
            </div>
        `;

        if (typeof loadOutletFilterFromConfig === 'function') loadOutletFilterFromConfig();
        if (typeof setTransferDate === 'function') setTransferDate();

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="padding: 20px; color: red;">Error loading transfer form module.</p>`;
    }
}

function closeTransferModal() {
    const defaultView = document.getElementById('defaultWelcomeView');
    if (defaultView) defaultView.style.display = 'flex';
    
    const targetView = document.getElementById('mod-TRANSFER_FORM');
    if (targetView) {
        targetView.style.display = 'none';
        targetView.innerHTML = '';
    }
}

async function loadPulloutFormModuleCode(container) {
    if (!container) return;
    try {
        container.innerHTML = `<p style="padding: 20px; font-family: 'Roboto Mono', monospace; color: #fff;">Loading Pullout Form...</p>`;
        
        const response = await fetch('modules/pullout_form/index.html');
        if (!response.ok) throw new Error("Failed to load module file.");
        
        const htmlContent = await response.text();
        
        container.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100vw; height: 98%; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 3000; box-sizing: border-box; padding: 20px 50px 20px 20px;">
                <div class="glass-card" style="position: relative; width: 100%; height:100%; max-width: none; max-height: none; overflow-y: auto; background: rgba(20, 20, 25, 0.95); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 16px; padding: 60px; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch; box-shadow: 0 30px 60px rgba(0,0,0,0.7);">
                    <div style="position: absolute; top: 18px; right: 25px; z-index: 10; display: flex; gap: 12px; align-items: center;">
                        <button onclick="closePulloutModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                    <div style="color: #111; flex: 1; display: flex; flex-direction: column;">
                        ${htmlContent}
                    </div>
                </div>
            </div>
        `;

        if (typeof loadOutletFilterFromConfig === 'function') loadOutletFilterFromConfig();
        if (typeof setTransferDate === 'function') setTransferDate();

    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="padding: 20px; color: red;">Error loading pullout form module.</p>`;
    }
}

function closePulloutModal() {
    const defaultView = document.getElementById('defaultWelcomeView');
    if (defaultView) defaultView.style.display = 'flex';
    
    const targetView = document.getElementById('mod-PULLOUT_FORM');
    if (targetView) {
        targetView.style.display = 'none';
        targetView.innerHTML = '';
    }
}

// ==========================================
// HISTORY CONFIGURATION & GLOBAL STATE
// ==========================================

const HISTORY_CONFIGS = {
  RTV: {
    title: 'RTV HISTORY',
    sheet: 'RTV',
    headers: [
      'DEPARTMENT', 'SKU CODE', 'PRODUCT DESCRIPTION', 'UOM', 'EXP. DATE', 'ON HAND',
      'TOTAL ON HAND', 'COST', 'SRP', 'TRANSFER QTY', 'EXP. DATE', 'QTY RELEASED', 'UOM',
      'REMARKS', 'EXPIRATION DATE', 'QTY RETURNED', 'UOM', 'REMARKS',
      'INCOMING DEPARTMENT', 'DATE'
    ]
  },
  REQUEST_RELEASED: {
    title: 'REQUEST AND RELEASED HISTORY',
    sheet: 'REQUEST',
    headers: [
      'DEPARTMENT', 'SKU CODE', 'PRODUCT DESCRIPTION', 'UOM', 'EXP. DATE', 'ON HAND',
      'TOTAL ON HAND', 'COST', 'SRP', 'TRANSFER QTY', 'EXP. DATE', 'QTY RELEASED', 'UOM',
      'REMARKS', 'EXPIRATION DATE', 'QTY RECEIVED', 'UOM', 'REMARKS',
      'INCOMING DEPARTMENT', 'DATE'
    ]
  },
  TRANSFER: {
    title: 'TRANSFER HISTORY',
    sheet: 'TRANSFER',
    headers: [
      'DEPARTMENT', 'SKU CODE', 'PRODUCT DESCRIPTION', 'UOM', 'EXP. DATE', 'ON HAND',
      'TOTAL ON HAND', 'COST', 'SRP', 'TRANSFER QTY', 'EXP. DATE', 'QTY RELEASED', 'UOM',
      'REMARKS', 'INCOMING DEPARTMENT', 'DATE'
    ]
  },
  PULL_OUT: {
    title: 'PULLOUT HISTORY',
    sheet: 'RTV',
    headers: [
      'DEPARTMENT', 'SKU CODE', 'PRODUCT DESCRIPTION', 'UOM', 'EXP. DATE', 'ON HAND',
      'TOTAL ON HAND', 'COST', 'SRP', 'TRANSFER QTY', 'EXP. DATE', 'QTY RELEASED', 'UOM',
      'REMARKS', 'EXPIRATION DATE', 'QTY RETURNED', 'UOM', 'REMARKS',
      'INCOMING DEPARTMENT', 'DATE'
    ]
  }
};

let currentActiveCategory = '';
let cachedHistoryRows = [];
let cachedAreaList = [];

// ==========================================
// AREA LIST FETCHING & HISTORY UI
// ==========================================

async function fetchAreaList() {
  if (cachedAreaList.length > 0) return;

  try {
    const url = `${window.API}?sheet=AREA&range=A1:A&token=${encodeURIComponent(window.API_TOKEN)}`;
    const response = await fetch(url);
    const result = await response.json();

    let rawData = Array.isArray(result) ? result : (result.values || result.data || []);
    const areaSet = new Set();

    rawData.forEach(row => {
      const val = Array.isArray(row) ? row[0] : row;
      if (val && String(val).trim() && String(val).trim().toUpperCase() !== 'DEPARTMENT' && String(val).trim().toUpperCase() !== 'AREA') {
        areaSet.add(String(val).trim());
      }
    });
    cachedAreaList = Array.from(areaSet).sort();
  } catch (err) {
    console.error("Error fetching AREA list:", err);
  }
}

function openHistoryModal(categoryKey) {
  const config = HISTORY_CONFIGS[categoryKey];
  if (!config) return;

  currentActiveCategory = categoryKey;
  cachedHistoryRows = [];

  let modal = document.getElementById('historyModal');

  if (!modal) {
    const modalHTML = `
      <div id="historyModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px); z-index: 9999; justify-content: center; align-items: center;">
        <div id="historyPrintableArea" style="background: rgba(18, 24, 38, 0.98); border: 1.5px solid rgba(0, 219, 255, 0.4); box-shadow: 0 0 25px rgba(0, 219, 255, 0.2); padding: 25px; width: 95vw; height: 90vh; color: #fff; font-family: 'Roboto Mono', monospace; display: flex; flex-direction: column; box-sizing: border-box; position: relative;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0, 219, 255, 0.3); padding-bottom: 12px; margin-bottom: 15px;">
            <h2 id="historyModalTitle" style="color: #00dbff; margin: 0; font-size: 1.3rem; letter-spacing: 1px;"></h2>
            <button class="no-print" onclick="document.getElementById('historyModal').style.display='none'" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer;">&times;</button>
          </div>

          <div class="no-print" style="display: flex; gap: 15px; margin-bottom: 15px; align-items: flex-end;">
            
            <div style="display: flex; flex-direction: column; flex: 1; gap: 6px; position: relative;">
              <label for="historyDeptInput" style="color: #00dbff; font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                SELECT DEPARTMENT
              </label>
              
              <div style="position: relative; width: 100%;">
                <input type="text" id="historyDeptInput" placeholder="Type or select department..." style="width: 100%; padding: 10px 35px 10px 14px; border-radius: 4px; border: 1px solid rgba(0, 219, 255, 0.4); background: #0c101a; color: #fff; outline: none; box-sizing: border-box; font-family: inherit; font-size: 0.85rem;" autocomplete="off">
                <span id="historyDeptArrow" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #00dbff; cursor: pointer; font-size: 0.7rem; pointer-events: auto;">▼</span>
              </div>

              <div id="historyDeptMenu" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; max-height: 250px; overflow-y: auto; background: #121826; border: 1px solid #00dbff; border-radius: 4px; box-shadow: 0 8px 16px rgba(0,0,0,0.8); z-index: 10000; margin-top: 4px;"></div>
            </div>

            <div style="display: flex; flex-direction: column; flex: 1; gap: 6px;">
              <label for="historyTableSearchInput" style="color: #00dbff; font-size: 0.75rem; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                SEARCH TABLE
              </label>
              <div style="position: relative; width: 100%;">
                <input type="text" id="historyTableSearchInput" onkeyup="filterHistoryBySearchInput()" placeholder="Search any column..." style="width: 100%; padding: 10px 14px; border-radius: 4px; border: 1px solid rgba(0, 219, 255, 0.4); background: #0c101a; color: #fff; outline: none; box-sizing: border-box; font-family: inherit; font-size: 0.85rem;" autocomplete="off">
              </div>
            </div>

            <button id="historyRefreshBtn" style="padding: 10px 20px; background: rgba(0, 219, 255, 0.15); border: 1px solid #00dbff; color: #00dbff; font-weight: bold; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px; height: 40px;">
              <i class="fa-solid fa-rotate-right"></i> REFRESH
            </button>
            
            <button id="historyPrintBtn" onclick="window.print()" style="padding: 10px 20px; background: rgba(0, 255, 136, 0.2); border: 1px solid #00ff88; color: #00ff88; font-weight: bold; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px; height: 40px;">
              <i class="fa-solid fa-print"></i> PRINT
            </button>
          </div>

          <div style="flex: 1; overflow: auto; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(0, 0, 0, 0.4);">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; white-space: nowrap;">
              <thead id="historyTableHead" style="position: sticky; top: 0; background: rgba(18, 24, 38, 1); color: #00dbff;"></thead>
              <tbody id="historyTableBody"></tbody>
            </table>
          </div>

        </div>
      </div>

      <div id="historyProgressModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); z-index: 10002; justify-content: center; align-items: center;">
        <div style="background: #0c101a; border: 1.5px solid #00dbff; border-radius: 8px; padding: 25px 30px; width: 320px; text-align: center; color: #fff; font-family: 'Roboto Mono', monospace;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00dbff; margin-bottom: 15px;"></i>
          <div id="historyProgressText" style="font-size: 0.9rem; font-weight: bold; color: #00dbff; margin-bottom: 10px;">RELOADING TABLE DATA...</div>
          <div style="width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; border: 1px solid rgba(0, 219, 255, 0.3);">
            <div id="historyProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00dbff, #00ff88); transition: width 0.2s ease;"></div>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('historyModal');
  }

  document.getElementById('historyModalTitle').textContent = config.title;
  
  const headerHTML = `<tr>${config.headers.map(h => {
    const align = (h === 'DEPARTMENT' || h === 'SKU CODE' || h === 'PRODUCT DESCRIPTION' || h === 'INCOMING DEPARTMENT') ? 'left' : 'center';
    return `<th style="padding: 10px; border: 1px solid rgba(0,219,255,0.2); text-align: ${align};">${h}</th>`;
  }).join('')}</tr>`;
  
  document.getElementById('historyTableHead').innerHTML = headerHTML;

  const deptInput = document.getElementById('historyDeptInput');
  const deptMenu = document.getElementById('historyDeptMenu');
  const deptArrow = document.getElementById('historyDeptArrow');
  const searchInput = document.getElementById('historyTableSearchInput');

  const scope = getSessionScope();

  if (searchInput) searchInput.value = '';

  if (deptInput) {
    if (scope.isAdmin) {
      deptInput.value = '';
      deptInput.readOnly = false;
      deptInput.placeholder = 'Type or select department...';
      deptInput.style.cursor = 'text';
      deptInput.style.opacity = '1';
      deptInput.onfocus = () => {
        // Clear the field on focus so the admin can search fresh — instead
        // of having to manually delete the previously selected department
        // before picking a different one.
        deptInput.value = '';
        renderDropdownMenu('');
      };
      deptInput.oninput = () => {
        renderDropdownMenu(deptInput.value);
        filterHistoryByInput();
      };
    } else {
      // Non-admins are locked to their own client — this is UX only,
      // the server ignores/overrides this value for non-admins regardless.
      deptInput.value = scope.client || '';
      deptInput.readOnly = true;
      deptInput.placeholder = scope.client ? '' : 'No client on this account';
      deptInput.style.cursor = 'not-allowed';
      deptInput.style.opacity = '0.8';
      deptInput.onfocus = null;
      deptInput.oninput = null;
    }
  }

  if (deptArrow) {
    deptArrow.style.display = scope.isAdmin ? '' : 'none';
    deptArrow.onclick = (e) => {
      e.stopPropagation();
      if (deptMenu.style.display === 'block') {
        deptMenu.style.display = 'none';
      } else {
        deptInput.focus();
        deptInput.value = '';
        renderDropdownMenu('');
      }
    };
  }

  document.onclick = (e) => {
    if (!e.target.closest('#historyDeptInput') && !e.target.closest('#historyDeptMenu') && !e.target.closest('#historyDeptArrow')) {
      if (deptMenu) deptMenu.style.display = 'none';
    }
  };

  const refreshBtn = document.getElementById('historyRefreshBtn');
  if (refreshBtn) {
    refreshBtn.onclick = () => {
      if (deptInput) deptInput.value = scope.isAdmin ? '' : (scope.client || '');
      if (searchInput) searchInput.value = '';
      fetchHistoryData(true);
    };
  }

  modal.style.display = 'flex';
  
  fetchAreaList();
  fetchHistoryData(true);
}

function renderDropdownMenu(filterText = '') {
  const menu = document.getElementById('historyDeptMenu');
  if (!menu) return;

  const searchTerm = filterText.trim().toLowerCase();
  const filtered = cachedAreaList.filter(item => item.toLowerCase().includes(searchTerm));

  if (filtered.length === 0) {
    menu.innerHTML = `<div style="padding: 10px 14px; color: #ff4d4d; font-size: 0.8rem;">No matching departments</div>`;
  } else {
    menu.innerHTML = filtered.map(item => `
      <div class="dept-item" data-value="${escapeHtml(item)}" style="padding: 10px 14px; color: #fff; font-size: 0.8rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); text-transform: uppercase;">
        ${escapeHtml(item)}
      </div>
    `).join('');

    menu.querySelectorAll('.dept-item').forEach(el => {
      el.onmouseenter = () => el.style.background = 'rgba(0, 219, 255, 0.2)';
      el.onmouseleave = () => el.style.background = 'transparent';
      el.onclick = () => {
        const selectedVal = el.getAttribute('data-value');
        const deptInput = document.getElementById('historyDeptInput');
        if (deptInput) deptInput.value = selectedVal;
        menu.style.display = 'none';
        filterHistoryByInput();
      };
    });
  }

  menu.style.display = 'block';
}

async function fetchHistoryData(forceRefresh = false) {
  const config = HISTORY_CONFIGS[currentActiveCategory];
  if (!config) return;

  const tableBody = document.getElementById('historyTableBody');
  const colCount = config.headers.length;
  const scope = getSessionScope();
  const deptInput = document.getElementById('historyDeptInput');

  // Non-admin users are permanently scoped to their own client.
  // This is a frontend guard; the Apps Script backend is the authoritative guard.
  const selectedDept = scope.isAdmin
    ? (deptInput?.value.trim() || '')
    : scope.client;

  if (deptInput && !scope.isAdmin && deptInput.value.trim() !== scope.client) {
    deptInput.value = scope.client;
  }

  const progressModal = document.getElementById('historyProgressModal');
  const progressBar = document.getElementById('historyProgressBar');
  if (progressModal) progressModal.style.display = 'flex';
  if (progressBar) progressBar.style.width = '0%';

  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 85) {
      progress += 15;
      if (progressBar) progressBar.style.width = progress + '%';
    }
  }, 100);

  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 30px; color: #00dbff;">Loading records...</td></tr>`;
  }

  try {
    const username = window.sessionUser || localStorage.getItem('activeUser') || '';
    const url = `${window.API}?action=getFilteredHistory&sheet=${encodeURIComponent(config.sheet)}&department=${encodeURIComponent(selectedDept)}&user=${encodeURIComponent(username)}&token=${encodeURIComponent(window.API_TOKEN)}`;
    const response = await fetch(url);
    const result = await response.json();

    clearInterval(interval);
    if (progressBar) progressBar.style.width = '100%';
    await new Promise(r => setTimeout(r, 200));

    if (!result.success || !result.data || result.data.length === 0) {
      cachedHistoryRows = [];
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 30px; color: #ff4d4d;">No records found${selectedDept ? ' for ' + escapeHtml(selectedDept) : ''}.</td></tr>`;
      }
      return;
    }

    cachedHistoryRows = result.data;
    renderHistoryRows(cachedHistoryRows, config.headers);

  } catch (err) {
    clearInterval(interval);
    console.error("Error fetching history data:", err);
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; padding: 30px; color: #ff4d4d;">Failed to retrieve history data.</td></tr>`;
    }
  } finally {
    if (progressModal) progressModal.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
  }
}

function filterHistoryByInput() {
  const config = HISTORY_CONFIGS[currentActiveCategory];
  if (!config || !cachedHistoryRows || cachedHistoryRows.length === 0) return;

  const scope = getSessionScope();
  const deptInput = document.getElementById('historyDeptInput');
  const searchTerm = scope.isAdmin
    ? (deptInput?.value.trim().toLowerCase() || '')
    : scope.client.toLowerCase();

  if (deptInput && !scope.isAdmin) {
    deptInput.value = scope.client;
  }

  const filtered = cachedHistoryRows.filter(row => {
    if (!searchTerm) return true;

    const outgoingDept = row[0] ? String(row[0]).trim().toLowerCase() : '';
    const incomingDept = row[row.length - 2] ? String(row[row.length - 2]).trim().toLowerCase() : '';

    // Exact client matching. A transfer/history record is visible when the
    // user's client is either the outgoing OR incoming department.
    return outgoingDept === searchTerm || incomingDept === searchTerm;
  });

  renderHistoryRows(filtered, config.headers);
}

function filterHistoryBySearchInput() {
  const query = document.getElementById('historyTableSearchInput')?.value.trim().toLowerCase() || '';
  const config = HISTORY_CONFIGS[currentActiveCategory];
  if (!config || !cachedHistoryRows || cachedHistoryRows.length === 0) return;

  if (!query) {
    filterHistoryByInput();
    return;
  }

  const scope = getSessionScope();
  const client = scope.client.toLowerCase();

  const filtered = cachedHistoryRows.filter(row => {
    // Backend already scopes non-admins. Keep a second client check here so
    // cached data cannot be widened by frontend manipulation.
    if (!scope.isAdmin) {
      const outgoingDept = row[0] ? String(row[0]).trim().toLowerCase() : '';
      const incomingDept = row[row.length - 2] ? String(row[row.length - 2]).trim().toLowerCase() : '';
      if (!client || (outgoingDept !== client && incomingDept !== client)) return false;
    }
    return row.some(cell => String(cell || '').toLowerCase().includes(query));
  });

  renderHistoryRows(filtered, config.headers);
}

function renderHistoryRows(rows, headers) {
  const tableBody = document.getElementById('historyTableBody');
  if (!tableBody) return;

  if (!rows || rows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="${headers.length}" style="text-align: center; padding: 30px; color: #ff4d4d;">No matching records found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows.map(row => {
    return `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
      ${headers.map((h, i) => {
        const val = row[i] !== undefined && row[i] !== null ? row[i] : '';
        const align = (h === 'DEPARTMENT' || h === 'SKU CODE' || h === 'PRODUCT DESCRIPTION' || h === 'INCOMING DEPARTMENT') ? 'left' : 'center';
        return `<td style="padding: 8px 10px; border-right: 1px solid rgba(255,255,255,0.05); text-align: ${align};">${escapeHtml(val)}</td>`;
      }).join('')}
    </tr>`;
  }).join('');
}

// --- NEAR EXPIRY MODAL SCRIPT ADDITIONS ---

/**
 * Silent checker — call this after inventory data loads for a department.
 * Scans the already-scoped rows for column Z <= 90 (near-expiry condition).
 * Only opens the modal when there's actually something to show; otherwise
 * it does nothing so the user isn't interrupted on a clean department.
 */
function checkAndShowNearExpiryModal() {
    let modal = document.getElementById('nearExpiryModal');

    if (!modal) {
        const modalHTML = `
            <style id="nearExpiryModalStyles">
                @keyframes nearExpiryBlink {
                    0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(255, 77, 77, 0.5); }
                    50% { opacity: 0.45; text-shadow: 0 0 2px rgba(255, 77, 77, 0); }
                }
                #nearExpiryModal .blink-alert { animation: nearExpiryBlink 1.1s ease-in-out infinite; }
            </style>
            <div id="nearExpiryModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); z-index: 10500; justify-content: center; align-items: center;">
                <div style="background: linear-gradient(180deg, #1a0d0d 0%, #120a0a 100%); border: 1px solid rgba(255, 77, 77, 0.35); box-shadow: 0 20px 50px rgba(0,0,0,0.6); border-radius: 10px; padding: 24px; width: 92vw; max-width: 760px; max-height: 80vh; color: #fff; font-family: 'Roboto Mono', monospace; display: flex; flex-direction: column; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255, 77, 77, 0.25); padding-bottom: 14px; margin-bottom: 16px;">
                        <div>
                            <h3 class="blink-alert" style="color: #ff4444; margin: 0; font-size: 1.1rem; letter-spacing: 1px;">
                                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 10px;"></i>NEAR EXPIRY ALERT
                            </h3>
                            <p id="nearExpiryModalSubtitle" style="margin: 6px 0 0; font-size: 0.72rem; color: #b89a9a;">Items in this department meeting the near-expiry condition (col AA &le; 90)</p>
                        </div>
                        <button type="button" onclick="closeNearExpiryModal()" style="background: transparent; border: none; color: #ff8888; font-size: 1.6rem; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem;">
                            <thead>
                                <tr style="color: #ff8888;">
                                    <th style="position: sticky; top: 0; background: #1a0d0d; padding: 10px; border: 1px solid rgba(255,68,68,0.2); text-align: left;">SKU CODE</th>
                                    <th style="position: sticky; top: 0; background: #1a0d0d; padding: 10px; border: 1px solid rgba(255,68,68,0.2); text-align: left;">PRODUCT DESCRIPTION</th>
                                    <th style="position: sticky; top: 0; background: #1a0d0d; padding: 10px; border: 1px solid rgba(255,68,68,0.2); text-align: center;">EXPIRATION DATE</th>
                                    <th style="position: sticky; top: 0; background: #1a0d0d; padding: 10px; border: 1px solid rgba(255,68,68,0.2); text-align: center;">QTY</th>
                                </tr>
                            </thead>
                            <tbody id="nearExpiryTableBody"></tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('nearExpiryModal');
    }

    const tableBody = document.getElementById('nearExpiryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    const rows = window.currentFetchedRows || [];
    let matchCount = 0;

    console.log(`[Near Expiry Check] Scanning ${rows.length} row(s). Sample col AA values:`, rows.slice(0, 5).map(r => r[26]));

    rows.forEach(row => {
        // Column AA is index 26 (was Z/25 before a column was deleted from
        // the department sheet, which shifted this formula column right by one)
        const rawZ = row[26];

        // Skip blank/empty/whitespace-only values
        if (rawZ === undefined || rawZ === null || String(rawZ).trim() === '') {
            return;
        }

        const colZVal = Number(rawZ);

        // Condition: Numeric value <= 90
        if (!isNaN(colZVal) && colZVal <= 90) {
            matchCount++;
            const sku = row[1] || ''; // Col B
            const desc = row[2] || ''; // Col C
            const expDate = formatExpirationDate(row[23]) || row[23] || '-'; // Col X
            const qty = row[24] !== undefined ? row[24] : '0'; // Col Y (Qty onhand)

            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            tr.innerHTML = `
                <td style="padding: 10px; border: 1px solid rgba(255, 68, 68, 0.2); font-weight: bold; color: #ff8888;">${escapeHtml(sku)}</td>
                <td style="padding: 10px; border: 1px solid rgba(255, 68, 68, 0.2);">${escapeHtml(desc)}</td>
                <td style="padding: 10px; border: 1px solid rgba(255, 68, 68, 0.2); text-align: center;">${escapeHtml(expDate)}</td>
                <td style="padding: 10px; border: 1px solid rgba(255, 68, 68, 0.2); text-align: center; font-weight: bold;">${escapeHtml(qty)}</td>
            `;
            tableBody.appendChild(tr);
        }
    });

    console.log(`[Near Expiry Check] Match count: ${matchCount}`);
    if (matchCount > 0) {
        const subtitle = document.getElementById('nearExpiryModalSubtitle');
        if (subtitle) subtitle.textContent = `${matchCount} item${matchCount === 1 ? '' : 's'} in this department are near-expiry`;
        modal.style.display = 'flex';
    } else {
        closeNearExpiryModal();
    }
}

function closeNearExpiryModal() {
    const modal = document.getElementById('nearExpiryModal');
    if (modal) modal.style.display = 'none';

    if (typeof checkAndShowStockAvailabilityModal === 'function') {
        checkAndShowStockAvailabilityModal();
    }
}

// --- STOCK AVAILABILITY MODAL SCRIPT ADDITIONS ---

function checkAndShowStockAvailabilityModal() {
    let modal = document.getElementById('stockAvailabilityModal');

    if (!modal) {
        const modalHTML = `
            <div id="stockAvailabilityModal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(6px); z-index: 10500; justify-content: center; align-items: center;">
                <div style="background: linear-gradient(180deg, #12161f 0%, #0a0e17 100%); border: 1px solid rgba(0, 219, 255, 0.25); box-shadow: 0 20px 50px rgba(0,0,0,0.6); border-radius: 10px; padding: 24px; width: 92vw; max-width: 900px; max-height: 82vh; color: #fff; font-family: 'Roboto Mono', monospace; display: flex; flex-direction: column; box-sizing: border-box;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(0, 219, 255, 0.2); padding-bottom: 14px; margin-bottom: 16px;">
                        <div>
                            <h3 style="color: #00dbff; margin: 0; font-size: 1.1rem; letter-spacing: 1px;">
                                <i class="fa-solid fa-boxes-stacked" style="margin-right: 10px;"></i>STOCK AVAILABILITY
                            </h3>
                            <p style="margin: 6px 0 0; font-size: 0.72rem; color: #7d8ba0;">Items flagged Critical, Low in Stock, or Out of Stock in this department</p>
                        </div>
                        <button type="button" onclick="closeStockAvailabilityModal()" style="background: transparent; border: none; color: #8fd6ff; font-size: 1.6rem; cursor: pointer; line-height: 1; padding: 0 4px;">&times;</button>
                    </div>
                    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">

                        <div id="stockSection-critical">
                            <h4 style="color: #ff4444; font-size: 0.78rem; letter-spacing: 1px; margin: 0 0 8px; display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-triangle-exclamation"></i>CRITICAL STOCK
                            </h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                                <thead>
                                    <tr style="color: #ff8888;">
                                        <th style="padding: 8px; border: 1px solid rgba(255,68,68,0.2); text-align: left;">SKU CODE</th>
                                        <th style="padding: 8px; border: 1px solid rgba(255,68,68,0.2); text-align: left;">ITEM DESCRIPTION</th>
                                        <th style="padding: 8px; border: 1px solid rgba(255,68,68,0.2); text-align: center;">TOTAL QTY ONHAND</th>
                                    </tr>
                                </thead>
                                <tbody id="stockTableBody-critical"></tbody>
                            </table>
                        </div>

                        <div id="stockSection-low">
                            <h4 style="color: #ffcc00; font-size: 0.78rem; letter-spacing: 1px; margin: 0 0 8px; display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-triangle-exclamation"></i>LOW IN STOCK
                            </h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                                <thead>
                                    <tr style="color: #ffe066;">
                                        <th style="padding: 8px; border: 1px solid rgba(255,204,0,0.2); text-align: left;">SKU CODE</th>
                                        <th style="padding: 8px; border: 1px solid rgba(255,204,0,0.2); text-align: left;">ITEM DESCRIPTION</th>
                                        <th style="padding: 8px; border: 1px solid rgba(255,204,0,0.2); text-align: center;">TOTAL QTY ONHAND</th>
                                    </tr>
                                </thead>
                                <tbody id="stockTableBody-low"></tbody>
                            </table>
                        </div>

                        <div id="stockSection-out">
                            <h4 style="color: #ff6b6b; font-size: 0.78rem; letter-spacing: 1px; margin: 0 0 8px; display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-ban"></i>OUT OF STOCK
                            </h4>
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                                <thead>
                                    <tr style="color: #ff9999;">
                                        <th style="padding: 8px; border: 1px solid rgba(255,50,50,0.25); text-align: left;">SKU CODE</th>
                                        <th style="padding: 8px; border: 1px solid rgba(255,50,50,0.25); text-align: left;">ITEM DESCRIPTION</th>
                                        <th style="padding: 8px; border: 1px solid rgba(255,50,50,0.25); text-align: center;">TOTAL QTY ONHAND</th>
                                    </tr>
                                </thead>
                                <tbody id="stockTableBody-out"></tbody>
                            </table>
                        </div>

                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('stockAvailabilityModal');
    }

    const rows = window.currentFetchedRows || [];
    const buckets = { critical: [], low: [], out: [] };

    rows.forEach(row => {
        // Column AB is index 27 (was AA/26 before a column was deleted from
        // the department sheet, which shifted this formula column right by one)
        const status = row[27] ? String(row[27]).trim().toUpperCase() : '';
        if (status === 'CRITICAL') buckets.critical.push(row);
        else if (status === 'LOW IN STOCK') buckets.low.push(row);
        else if (status === 'OUT OF STOCK') buckets.out.push(row);
    });

    const renderBucket = (key, items) => {
        const tbody = document.getElementById(`stockTableBody-${key}`);
        const section = document.getElementById(`stockSection-${key}`);
        if (!tbody || !section) return;

        if (items.length === 0) {
            section.style.display = 'none';
            tbody.innerHTML = '';
            return;
        }

        section.style.display = 'block';
        tbody.innerHTML = items.map(row => {
            const sku = row[1] || ''; // Col B
            const desc = row[2] || ''; // Col C
            const qty = row[20] !== undefined ? row[20] : 0; // Col U
            return `<tr>
                <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.08); font-weight: bold;">${escapeHtml(sku)}</td>
                <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.08);">${escapeHtml(desc)}</td>
                <td style="padding: 8px; border: 1px solid rgba(255,255,255,0.08); text-align: center;">${escapeHtml(qty)}</td>
            </tr>`;
        }).join('');
    };

    renderBucket('critical', buckets.critical);
    renderBucket('low', buckets.low);
    renderBucket('out', buckets.out);

    const totalCount = buckets.critical.length + buckets.low.length + buckets.out.length;
    console.log(`[Stock Availability Check] Critical: ${buckets.critical.length}, Low: ${buckets.low.length}, Out: ${buckets.out.length}`);

    if (totalCount > 0) {
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

function closeStockAvailabilityModal() {
    const modal = document.getElementById('stockAvailabilityModal');
    if (modal) modal.style.display = 'none';
}



/**
 * Scans inventory rows for expired products and triggers the alert popup.
 * @param {Array} rows - The fetched inventory rows array
 */
function checkAndShowExpiredAlert(rows) {
    const data = rows || window.currentFetchedRows || [];
    if (!data || data.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredItems = [];

    data.forEach(row => {
        const sku = row[1] || 'N/A';
        const desc = row[2] || 'N/A';
        const qty = row[24] !== undefined && row[24] !== '' ? row[24] : 0; // Col Y
        const expDateStr = row[23] || ''; // Col X
        const status = row[26] ? String(row[26]).toUpperCase() : ''; // Col AA

        let isExpired = false;

        // Check if explicit STATUS column indicates expired
        if (status.includes('EXPIRED')) {
            isExpired = true;
        } else if (expDateStr) {
            // Check if expiration date is before today
            const parsedDate = new Date(expDateStr);
            if (!isNaN(parsedDate.getTime()) && parsedDate < today) {
                isExpired = true;
            }
        }

        if (isExpired) {
            expiredItems.push({
                sku: sku,
                desc: desc,
                qty: qty,
                expDate: formatExpirationDate(expDateStr) || expDateStr || 'N/A'
            });
        }
    });

    if (expiredItems.length > 0) {
        showExpiredPopup(expiredItems);
    }
}

/**
 * Creates and opens the expired items warning modal.
 * @param {Array} expiredItems - Array of expired item objects
 */
function showExpiredPopup(expiredItems) {
    let modal = document.getElementById('expiredAlertModal');
    
    if (!modal) {
        const modalHTML = `
            <style id="expiredAlertModalStyles">
                @keyframes expiredAlertBlink {
                    0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(255, 77, 77, 0.5); }
                    50% { opacity: 0.45; text-shadow: 0 0 2px rgba(255, 77, 77, 0); }
                }
                #expiredAlertModal .blink-alert { animation: expiredAlertBlink 1.1s ease-in-out infinite; }
            </style>
            <div id="expiredAlertModal" style="display: flex; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(6px); z-index: 10005; justify-content: center; align-items: center;">
                <div style="background: #121826; border: 1.5px solid #ff4d4d; box-shadow: 0 0 30px rgba(255, 77, 77, 0.35); border-radius: 10px; padding: 25px; width: 90%; max-width: 650px; max-height: 80vh; color: #fff; font-family: 'Roboto Mono', monospace; display: flex; flex-direction: column; box-sizing: border-box;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 77, 77, 0.3); padding-bottom: 12px; margin-bottom: 15px;">
                        <h3 class="blink-alert" style="color: #ff4d4d; margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; letter-spacing: 1px;">
                            <i class="fa-solid fa-triangle-exclamation"></i> EXPIRED ITEMS DETECTED
                        </h3>
                        <button onclick="closeExpiredAlertModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.6rem; cursor: pointer; line-height: 1;">&times;</button>
                    </div>

                    <p id="expiredAlertSummary" style="font-size: 0.85rem; color: #ff9999; margin-bottom: 15px; font-weight: bold;"></p>

                    <div style="flex: 1; overflow-y: auto; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 77, 77, 0.2); border-radius: 6px; padding: 0;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; color: #fff;">
                            <thead>
                                <tr style="color: #ff4d4d; background: rgba(255, 77, 77, 0.1);">
                                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid rgba(255, 77, 77, 0.3);">SKU CODE</th>
                                    <th style="padding: 10px; text-align: left; border-bottom: 1px solid rgba(255, 77, 77, 0.3);">PRODUCT DESCRIPTION</th>
                                    <th style="padding: 10px; text-align: center; border-bottom: 1px solid rgba(255, 77, 77, 0.3);">QTY</th>
                                    <th style="padding: 10px; text-align: center; border-bottom: 1px solid rgba(255, 77, 77, 0.3);">EXP. DATE</th>
                                </tr>
                            </thead>
                            <tbody id="expiredTableBody"></tbody>
                        </table>
                    </div>

                
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('expiredAlertModal');
    }

    const summaryEl = document.getElementById('expiredAlertSummary');
    if (summaryEl) {
        summaryEl.innerText = `Attention: ${expiredItems.length} expired item(s) found in this department.`;
    }

    const tableBody = document.getElementById('expiredTableBody');
    if (tableBody) {
        tableBody.innerHTML = '';
        expiredItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
            tr.innerHTML = `
                <td style="padding: 8px 10px; color: #ff4d4d; font-weight: bold;">${escapeHtml(item.sku)}</td>
                <td style="padding: 8px 10px;">${escapeHtml(item.desc)}</td>
                <td style="padding: 8px 10px; text-align: center;">${escapeHtml(item.qty)}</td>
                <td style="padding: 8px 10px; text-align: center; color: #ff9999;">${escapeHtml(item.expDate)}</td>
            `;
            tableBody.appendChild(tr);
        });
    }

    modal.style.display = 'flex';
}

function closeExpiredAlertModal() {
    const modal = document.getElementById('expiredAlertModal');
    if (modal) modal.style.display = 'none';
}
// ==========================================
// INCOMING MODULE — receiving side of REQUEST/TRANSFER/PULLOUT
// Reads pending (not-yet-received) rows straight out of the REQUEST,
// TRANSFER and RTV sheets and lets the receiving department confirm
// them, writing the exp. date + qty back into the sheet and flagging
// the row RECEIVED so it drops out of future fetches.
// ==========================================

const INCOMING_CONFIGS = {
    REQUEST: {
        sheet: 'REQUEST',
        title: 'INCOMING REQUEST AND RELEASED FORM',
        qtyLabel: 'TRANSFER QTY',
        // Column letters below refer to the REQUEST sheet layout:
        // A dept | B-I product/cost/srp | J transfer qty |
        // K-N released info | O-R received info | S incoming dept | T date | U status
        incomingCol: 'S',
        dateCol: 'T',
        statusCol: 'U',
        writeBackStartCol: 'O',   // RECEIVED INFORMATION block
        writeBackLabel: 'QTY RECEIVED'
    },
    TRANSFER: {
        sheet: 'TRANSFER',
        title: 'INCOMING TRANSFER FORM',
        qtyLabel: 'TRANSFER QTY',
        // A dept | B-I product/cost/srp | J transfer qty |
        // K-N received info | O incoming dept | P date | Q status
        incomingCol: 'O',
        dateCol: 'P',
        statusCol: 'Q',
        writeBackStartCol: 'K',   // RECEIVED INFORMATION block (only block on TRANSFER)
        writeBackLabel: 'QTY RELEASED'
    },
    PULLOUT: {
        sheet: 'RTV',
        title: 'INCOMING PULL OUT / GATE PASS FORM',
        qtyLabel: 'TRANSFER QTY',
        // A dept | B-I product/cost/srp | J transfer qty |
        // K-N out/exit info | O-R return info | S incoming dept | T date | U status
        incomingCol: 'S',
        dateCol: 'T',
        statusCol: 'U',
        writeBackStartCol: 'O',   // RETURN INFORMATION block
        writeBackLabel: 'QTY RETURNED'
    }
};

let activeIncomingKey = '';
let incomingFetchedRows = [];

async function loadIncomingModuleCode(container) {
    if (!container) return;
    try {
        container.innerHTML = `
            <div style="width: 100%; height: 100%; padding: 25px; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch;">
                <div style="margin-bottom: 35px; border-bottom: 1px solid rgba(0, 0, 0, 0.2); padding-bottom: 15px; position: relative;">
                    <h2 style="color: #111; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 1.3rem; letter-spacing: 2px; font-weight: 700;">
                        <i class="fa-solid fa-truck-ramp-box" style="margin-right: 10px; color: #111;"></i>INCOMING FORMS
                    </h2>
                    <div style="position: absolute; top: -5px; right: 0; z-index: 10;">
                        <button onclick="closeIncomingModal()" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Close">
                            <i class="fa-solid fa-circle-xmark"></i>
                        </button>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; gap: 20px; margin: auto 0;">
                    <div style="display: flex; justify-content: center; gap: 20px; width: 100%; max-width: 900px; flex-wrap: wrap;">
                        <button class="nav-icon-btn" onclick="selectIncomingCategory('REQUEST')" style="flex: 1 1 0px; min-width: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-file-invoice" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">INCOMING REQUEST &amp; RELEASED FORM</span>
                        </button>

                        <button class="nav-icon-btn" onclick="selectIncomingCategory('TRANSFER')" style="flex: 1 1 0px; min-width: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-right-left" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">INCOMING TRANSFER FORM</span>
                        </button>

                        <button class="nav-icon-btn" onclick="selectIncomingCategory('PULLOUT')" style="flex: 1 1 0px; min-width: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 15px 10px; min-height: 110px; border-radius: 12px; cursor: pointer; background: rgba(144, 168, 168, 0.35); border: 1.5px solid rgba(0, 0, 0, 0.4); color: #111; backdrop-filter: blur(10px); transition: all 0.3s ease;">
                            <i class="fa-solid fa-file-arrow-down" style="font-size: 1.8rem; color: #111;"></i>
                            <span style="font-family: 'Roboto Mono', monospace; font-size: 0.8rem; font-weight: 700; text-align: center; letter-spacing: 1px;">INCOMING PULL OUT / GATE PASS FORM</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p style="padding: 20px; color: red;">Error loading incoming module.</p>`;
    }
}

function closeIncomingModal() {
    const incomingView = document.getElementById('mod-INCOMING');
    const welcomeView = document.getElementById('defaultWelcomeView');
    if (incomingView) incomingView.style.display = 'none';
    if (welcomeView) welcomeView.style.display = 'flex';
    activeIncomingKey = '';
    incomingFetchedRows = [];
}

function selectIncomingCategory(categoryKey) {
    const cfg = INCOMING_CONFIGS[categoryKey];
    if (!cfg) return;

    logButtonClick('INCOMING_' + categoryKey + '_BUTTON_CLICKED');
    activeIncomingKey = categoryKey;
    incomingFetchedRows = [];

    const container = document.getElementById('mod-INCOMING');
    if (!container) return;

    container.innerHTML = `
        <div style="width: 100%; height: 100%; padding: 25px; box-sizing: border-box; display: flex; flex-direction: column; align-items: stretch;">

            <div style="margin-bottom: 25px; border-bottom: 1px solid rgba(0, 0, 0, 0.2); padding-bottom: 15px; position: relative;">
                <h2 style="color: #111; margin: 0; font-family: 'Roboto Mono', monospace; font-size: 1.2rem; letter-spacing: 2px; font-weight: 700;">
                    <i class="fa-solid fa-truck-ramp-box" style="margin-right: 10px; color: #111;"></i>${escapeHtml(cfg.title)}
                </h2>
                <div style="position: absolute; top: -5px; right: 0; z-index: 10;">
                    <button onclick="loadIncomingModuleCode(document.getElementById('mod-INCOMING'))" style="background: transparent; border: none; color: #ff4d4d; font-size: 1.8rem; cursor: pointer; padding: 5px; line-height: 1; display: flex; align-items: center; justify-content: center;" title="Back">
                        <i class="fa-solid fa-circle-xmark"></i>
                    </button>
                </div>
            </div>

            <!-- Filter Row -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 0.85rem; gap: 15px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 20px; flex: 1; min-width: 500px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 240px;">
                        <span style="font-weight: bold; color: #111; text-transform: uppercase; white-space: nowrap;">SELECT DEPARTMENT:</span>
                        <input type="text" id="incSelectDept" placeholder="Type to search outlet..." style="padding: 6px 10px; background: #fff; border: 1px solid #000; border-radius: 4px; color: #000; font-family: inherit; outline: none; flex: 1;" list="outletList">
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 240px;">
                        <span style="font-weight: bold; color: #111; text-transform: uppercase; white-space: nowrap;">INCOMING DEPARTMENT:</span>
                        <input type="text" id="incIncomingDept" placeholder="Type to search outlet..." value="${escapeHtml(window.sessionClient || '')}" style="padding: 6px 10px; background: #fff; border: 1px solid #000; border-radius: 4px; color: #000; font-family: inherit; outline: none; flex: 1;" list="outletList">
                    </div>
                    <datalist id="outletList"></datalist>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-weight: bold; color: #111; text-transform: uppercase;">DATE:</span>
                    <input type="text" id="formattedDateDisplay" readonly style="padding: 6px 10px; background: #f4f4f4; border: 1px solid #000; border-radius: 4px; color: #000; font-family: inherit; outline: none; width: 170px; text-align: center; font-weight: bold;">
                </div>
                <button type="button" onclick="fetchIncomingRows()" style="padding: 8px 16px; background: #111; color: #fff; border: none; border-radius: 4px; font-family: inherit; font-size: 0.75rem; cursor: pointer; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-magnifying-glass"></i> FETCH
                </button>
            </div>

            <!-- Results Table -->
            <div style="flex: 1; display: flex; flex-direction: column; gap: 10px; margin-top: 10px; min-height: 0;">
                <div style="max-height: 480px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem; text-align: left; background: #fff;">
                        <thead>
                            <tr style="background: #111; color: #fff; position: sticky; top: 0; z-index: 2;">
                                <th style="padding: 10px 8px; width: 40px; text-align: center;">
                                    <input type="checkbox" id="incSelectAll" onclick="toggleSelectAllIncoming(this)">
                                </th>
                                <th style="padding: 10px 8px; font-weight: 600; width: 110px;">SKU CODE</th>
                                <th style="padding: 10px 8px; font-weight: 600;">PRODUCT DESCRIPTION</th>
                                <th style="padding: 10px 8px; font-weight: 600; text-align: center; width: 60px;">UOM</th>
                                <th style="padding: 10px 8px; font-weight: 600; text-align: center; width: 160px;">EXP. DATE</th>
                                <th style="padding: 10px 8px; font-weight: 600; text-align: center; width: 100px;">${escapeHtml(cfg.qtyLabel)}</th>
                            </tr>
                        </thead>
                        <tbody id="incomingTableBody">
                            <tr><td colspan="6" style="padding: 20px; text-align: center; color: #888;">Select departments and click FETCH to load pending items.</td></tr>
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                    <button type="button" onclick="submitIncomingReceived()" style="padding: 8px 20px; background: #28a745; color: #fff; border: none; border-radius: 4px; font-family: inherit; font-size: 0.8rem; cursor: pointer; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-check"></i> RECEIVED
                    </button>
                </div>
            </div>
        </div>
    `;

    if (typeof loadOutletFilterFromConfig === 'function') loadOutletFilterFromConfig();
    if (typeof setTransferDate === 'function') setTransferDate();
}

function toggleSelectAllIncoming(checkbox) {
    document.querySelectorAll('.incoming-row-checkbox').forEach(cb => { cb.checked = checkbox.checked; });
}

async function fetchIncomingRows() {
    const cfg = INCOMING_CONFIGS[activeIncomingKey];
    if (!cfg) return;

    const container = document.getElementById('mod-INCOMING');
    const selectDept = container?.querySelector('#incSelectDept')?.value.trim() || '';
    const incomingDept = container?.querySelector('#incIncomingDept')?.value.trim() || '';
    const formDate = container?.querySelector('#formattedDateDisplay')?.value.trim() || '';
    const tableBody = document.getElementById('incomingTableBody');

    if (!selectDept) return showCustomAlert('Please select a SELECT DEPARTMENT.');
    if (!incomingDept) return showCustomAlert('Please select an INCOMING DEPARTMENT.');

    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #888;">Loading...</td></tr>`;
    if (typeof showSeaWaveLoader === 'function') showSeaWaveLoader("FETCHING...");

    try {
        const url = `${window.API}?action=getIncomingPending&sheet=${encodeURIComponent(cfg.sheet)}`
            + `&selectDept=${encodeURIComponent(selectDept)}`
            + `&incomingDept=${encodeURIComponent(incomingDept)}`
            + `&date=${encodeURIComponent(formDate)}`
            + `&user=${encodeURIComponent(window.sessionUser || '')}`
            + `&token=${encodeURIComponent(window.API_TOKEN)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) throw new Error(result.error || "Failed to fetch pending items.");

        incomingFetchedRows = Array.isArray(result.data) ? result.data : [];
        renderIncomingRows(incomingFetchedRows, cfg);
    } catch (error) {
        console.error("Fetch Incoming Error:", error);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #d9534f;">Error: ${escapeHtml(error.message)}</td></tr>`;
    } finally {
        if (typeof hideSeaWaveLoader === 'function') hideSeaWaveLoader();
    }
}

function renderIncomingRows(rows, cfg) {
    const tableBody = document.getElementById('incomingTableBody');
    if (!tableBody) return;

    if (!rows || rows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: #888;">No pending items found for that selection.</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';
    rows.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.style.height = "38px";
        tr.innerHTML = `
            <td style="padding: 6px 8px; border-bottom: 1px solid #e9ecef; text-align: center;">
                <input type="checkbox" class="incoming-row-checkbox" data-index="${idx}">
            </td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e9ecef; font-weight: 600; color: #212529;">${escapeHtml(item.sku)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e9ecef;">${escapeHtml(item.description)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e9ecef; text-align: center; color: #495057;">${escapeHtml(item.uom)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e9ecef; text-align: center;">
                <input type="date" class="incoming-exp-date" style="width: 100%; border: 1px solid #ccc; border-radius: 6px; padding: 4px 6px; font-family: inherit; font-size: 0.78rem; outline: none; box-sizing: border-box;">
            </td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e9ecef; text-align: center; font-weight: 600;">${escapeHtml(item.qty)}</td>
        `;
        tableBody.appendChild(tr);
    });
}

async function submitIncomingReceived() {
    const cfg = INCOMING_CONFIGS[activeIncomingKey];
    if (!cfg) return;

    const rowsEls = Array.from(document.querySelectorAll('#incomingTableBody tr'));
    const checked = Array.from(document.querySelectorAll('.incoming-row-checkbox:checked'));

    if (checked.length === 0) return showCustomAlert('Please select at least one item to mark as RECEIVED.');

    if (typeof showSeaWaveLoader === 'function') showSeaWaveLoader("SAVING...");

    try {
        const requests = checked.map(cb => {
            const idx = Number(cb.getAttribute('data-index'));
            const item = incomingFetchedRows[idx];
            const tr = cb.closest('tr');
            const expDateInput = tr ? tr.querySelector('.incoming-exp-date') : null;
            const expDate = expDateInput ? expDateInput.value : '';

            return fetch(window.API, {
                method: "POST",
                body: JSON.stringify({
                    action: "markIncomingReceived",
                    sheetName: cfg.sheet,
                    rowIndex: item.rowIndex,
                    expDate: expDate,
                    qty: item.qty,
                    uom: item.uom,
                    user: window.sessionUser || '',
                    token: window.API_TOKEN
                })
            }).then(r => r.json());
        });

        const results = await Promise.all(requests);
        const failed = results.filter(r => !r.success);

        if (failed.length > 0) {
            throw new Error(failed[0].error || failed[0].message || "Some items failed to save.");
        }

        showModal("RECEIVED", "Selected items were marked as received.", "success");
        fetchIncomingRows();
    } catch (error) {
        console.error("Mark Received Error:", error);
        showCustomAlert("Error saving record: " + error.message);
    } finally {
        if (typeof hideSeaWaveLoader === 'function') hideSeaWaveLoader();
    }
}
