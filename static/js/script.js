// static/js/script.js
// This script handles all the frontend logic: UI rendering,
// managing application state, local storage, file operations,
// and communication with the Flask backend.

// --- Global Application State ---
let appSettings = {
    gameFolder: "", // Default empty, user will input
    dllFolder: "",  // Default empty, user will input
    accounts: [],   // Array to store account objects
    autoCycle: false // Whether to auto-cycle characters
};

// --- DOM Elements ---
const gameFolderInput = document.getElementById('gameFolder');
const dllFolderInput = document.getElementById('dllFolder');
const accountsContainer = document.getElementById('accountsContainer');
const addAccountBtn = document.getElementById('addAccountBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const launchBtn = document.getElementById('launchBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const saveBatBtn = document.getElementById('saveBatBtn');
const loadConfigFileInput = document.getElementById('loadConfigFile');
const messageBox = document.getElementById('messageBox');

// --- Helper Functions ---

/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {'success'|'error'|'info'|'warning'} type - The type of message for styling.
 */
function showMessage(message, type) {
    messageBox.textContent = message;
    messageBox.className = `mt-8 p-4 rounded-lg text-center ${type === 'success' ? 'message-success' : type === 'error' ? 'message-error' : type === 'info' ? 'message-info' : 'message-warning'}`;
    messageBox.classList.remove('hidden');
    // Hide message after a few seconds
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 5000);
}

/**
 * Saves the current appSettings to browser's local storage.
 */
function saveSettingsToLocalStorage() {
    localStorage.setItem('aoLauncherSettings', JSON.stringify(appSettings));
}

/**
 * Loads settings from browser's local storage.
 */
function loadSettingsFromLocalStorage() {
    const storedSettings = localStorage.getItem('aoLauncherSettings');
    if (storedSettings) {
        try {
            const parsedSettings = JSON.parse(storedSettings);
            // Merge loaded settings, ensuring 'accounts' is an array
            appSettings.gameFolder = parsedSettings.gameFolder || "";
            appSettings.dllFolder = parsedSettings.dllFolder || "";
            appSettings.autoCycle = parsedSettings.autoCycle || false;
            if (Array.isArray(parsedSettings.accounts)) {
                // Data migration: ensure character IDs are numbers for backwards compatibility
                parsedSettings.accounts.forEach(account => {
                    if (account.characters && Array.isArray(account.characters)) {
                        account.characters.forEach(char => {
                            if (typeof char.id === 'string') char.id = parseInt(char.id, 10);
                        });
                    }
                });
                appSettings.accounts = parsedSettings.accounts;
            } else {
                appSettings.accounts = [];
            }
            console.log("Settings loaded from local storage:", appSettings);
        } catch (e) {
            console.error("Error parsing settings from local storage:", e);
            showMessage("Error loading settings from local storage. Data might be corrupt.", "error");
        }
    }
}

/**
 * Renders the UI based on the current appSettings.
 * Clears existing content and rebuilds the accounts and characters display.
 */
function renderUI() {
    // Update path inputs and controls
    gameFolderInput.value = appSettings.gameFolder;
    dllFolderInput.value = appSettings.dllFolder;
    const autoCycleCheckbox = document.getElementById('autoCycleCheckbox');
    autoCycleCheckbox.checked = appSettings.autoCycle;
    
    // Handle Return key on Auto-cycle checkbox
    autoCycleCheckbox.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();  // Prevent default form submission
            document.getElementById('launchBtn').click();  // Trigger launch button click
        }
    });

    // Clear existing accounts
    accountsContainer.innerHTML = '';

    if (appSettings.accounts.length === 0) {
        accountsContainer.innerHTML = '<p class="text-center text-gray-400 col-span-full">No accounts added yet. Click "Add New Account" to get started!</p>';
        return;
    }

    // Sort accounts alphabetically by name. This modifies the array in place,
    // ensuring consistency in display, state, and saved configuration.
    appSettings.accounts.sort((a, b) => a.name.localeCompare(b.name));

    // Render each account
    appSettings.accounts.forEach((account, accIndex) => {
        // For consistency, also sort characters within each account by name.
        account.characters.sort((a, b) => a.name.localeCompare(b.name));

        // Check if account has any selected characters
        const hasSelectedChar = account.characters.some(char => char.selected);
        
        const accountCard = document.createElement('div');
        accountCard.className = `account-card${hasSelectedChar ? '' : ' no-selected-char'}`;
        accountCard.innerHTML = `
            <div class="flex justify-between items-center mb-1">
                <h3 class="text-m font-semibold text-blue-200">${account.name}</h3>
                <div class="flex space-x-2">
                    <button class="add-char-btn bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 uppercase" data-acc-index="${accIndex}">Add</button>
                    <button class="edit-password-btn bg-yellow-600 hover:bg-yellow-700 text-white text-sm py-1 px-3 rounded-md transition duration-300 ease-in-out transform hover:scale-105 uppercase" data-acc-index="${accIndex}">Edit PWD</button>
                    <button class="remove-account-btn bg-red-600 hover:bg-red-700 text-white text-sm py-1 px-3 rounded-md transition duration-300 ease-in-out transform hover:scale-105 uppercase" data-acc-index="${accIndex}">X</button>
                </div>
            </div>
            <div class="characters-list mb-0">
                ${account.characters.length === 0 ? '<p class="text-gray-400 text-sm">No characters yet.</p>' : ''}
                ${account.characters.map((char, charIndex) => `
                    <div class="character-item flex items-center mb-1 p-1 rounded-md ${char.selected ? 'selected' : ''}">
                        <input type="checkbox" class="character-checkbox mr-2"
                               data-acc-index="${accIndex}" data-char-index="${charIndex}"
                               ${char.selected ? 'checked' : ''}>
                        <div class="flex-grow">
                            <span class="text-sm text-gray-100">${char.name} (ID: ${char.id})</span>
                            <span class="character-comment" data-acc-index="${accIndex}" data-char-index="${charIndex}">${char.comment || ''}</span>
                        </div>
                        <button class="remove-char-btn flex-shrink-0 bg-red-500 hover:bg-red-600 text-white text-xs py-0.5 px-2 rounded-sm transition duration-300 ease-in-out transform hover:scale-105 uppercase"
                                data-acc-index="${accIndex}" data-char-index="${charIndex}">X</button>
                    </div>
                `).join('')}
            </div>
        `;
        accountsContainer.appendChild(accountCard);
    });

    // Attach event listeners to newly created elements
    attachEventListeners();
}

/**
 * Attaches event listeners to dynamically created elements.
 * This needs to be called after every renderUI call.
 */
function attachEventListeners() {
    // Comment click handling
    document.querySelectorAll('.character-comment').forEach(span => {
        span.onclick = (event) => {
            const accIndex = parseInt(event.target.dataset.accIndex);
            const charIndex = parseInt(event.target.dataset.charIndex);
            const currentComment = appSettings.accounts[accIndex].characters[charIndex].comment || '';
            
            // Create input field
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'character-comment-input';
            input.value = currentComment;
            
            // Replace span with input
            const parent = event.target.parentNode;
            parent.replaceChild(input, event.target);
            input.focus();
            
            // Handle input blur and enter key
            const saveComment = () => {
                const newComment = input.value.trim();
                appSettings.accounts[accIndex].characters[charIndex].comment = newComment;
                saveSettingsToLocalStorage();
                
                // Restore span with new value
                const span = document.createElement('span');
                span.className = 'character-comment';
                span.textContent = newComment;
                span.dataset.accIndex = accIndex;
                span.dataset.charIndex = charIndex;
                span.onclick = event.target.onclick;
                parent.replaceChild(span, input);
            };
            
            input.onblur = saveComment;
            input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveComment();
                }
            };
        };
    });

    // Character Checkboxes
    document.querySelectorAll('.character-checkbox').forEach(checkbox => {
        checkbox.onclick = (event) => {
            // We are manually controlling the state and re-rendering,
            // so prevent the default browser action for the checkbox immediately.
            event.preventDefault();

            const accIndex = parseInt(event.target.dataset.accIndex);
            const charIndex = parseInt(event.target.dataset.charIndex);

            if (event.ctrlKey) {
                // On Ctrl+Click, unselect all other characters and force-select only the clicked one.
                // This works even if the character was already selected.
                appSettings.accounts.forEach((acc, idx) => {
                    acc.characters.forEach((char, cidx) => {
                        char.selected = (idx === accIndex && cidx === charIndex);
                    });
                });
            } else {
                // Normal click acts like a radio button group within the account.
                // Since we prevented default, we determine the new state based on the current state.
                const isCurrentlySelected = appSettings.accounts[accIndex].characters[charIndex].selected;
                const intendedState = !isCurrentlySelected;

                appSettings.accounts[accIndex].characters.forEach((char, index) => {
                    if (index === charIndex) {
                        // Toggle the clicked character.
                        char.selected = intendedState;
                    } else if (intendedState) {
                        // If we are selecting a new character, deselect others in the same account.
                        char.selected = false;
                    }
                });
            }

            saveSettingsToLocalStorage();
            renderUI(); // Re-render to update checkbox states and styling
        };
    });

    // Add Character Buttons
    document.querySelectorAll('.add-char-btn').forEach(button => {
        button.onclick = (event) => {
            const accIndex = parseInt(event.target.dataset.accIndex);
            const charName = prompt("Enter character nickname:");
            if (!charName) return;
            const charId = prompt("Enter character ID:");
            if (!charId || isNaN(charId)) {
                showMessage("Invalid Character ID. Please enter a number.", "warning");
                return;
            }

            appSettings.accounts[accIndex].characters.push({
                name: charName,
                id: parseInt(charId, 10),
                selected: false,
                comment: ""
            });
            saveSettingsToLocalStorage();
            renderUI();
        };
    });

    // Remove Character Buttons
    document.querySelectorAll('.remove-char-btn').forEach(button => {
        button.onclick = (event) => {
            if (!confirm("Are you sure you want to remove this character?")) return;
            const accIndex = parseInt(event.target.dataset.accIndex);
            const charIndex = parseInt(event.target.dataset.charIndex);
            appSettings.accounts[accIndex].characters.splice(charIndex, 1);
            saveSettingsToLocalStorage();
            renderUI();
        };
    });

    // Remove Account Buttons
    document.querySelectorAll('.remove-account-btn').forEach(button => {
        button.onclick = (event) => {
            if (!confirm("Are you sure you want to remove this account and all its characters?")) return;
            const accIndex = parseInt(event.target.dataset.accIndex);
            appSettings.accounts.splice(accIndex, 1);
            saveSettingsToLocalStorage();
            renderUI();
        };
    });

    // Edit Password Buttons
    document.querySelectorAll('.edit-password-btn').forEach(button => {
        button.onclick = (event) => {
            const accIndex = parseInt(event.target.dataset.accIndex);
            showEditPasswordDialog(accIndex);
        };
    });
}

/**
 * Shows a dialog to edit the password for a specific account
 * @param {number} accIndex - The index of the account to edit
 */
function showEditPasswordDialog(accIndex) {
    const account = appSettings.accounts[accIndex];
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4';
    modalContent.innerHTML = `
        <h3 class="text-xl font-semibold text-blue-200 mb-4">Edit Password for ${account.name}</h3>
        <div class="mb-4">
            <label class="block text-sm font-bold mb-2 text-gray-300">Current Password:</label>
            <input type="password" value="********" disabled class="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-500 bg-gray-700 cursor-not-allowed">
        </div>
        <div class="mb-6">
            <label class="block text-sm font-bold mb-2 text-gray-300">New Password:</label>
            <input type="password" id="newPassword" placeholder="Enter new password" class="shadow appearance-none border rounded-lg w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline">
        </div>
        <div class="flex justify-end space-x-3">
            <button id="cancelPasswordBtn" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 uppercase">
                Cancel
            </button>
            <button id="savePasswordBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ease-in-out transform hover:scale-105 uppercase">
                Save Password
            </button>
        </div>
    `;
    
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    
    // Focus on the new password input
    const newPasswordInput = document.getElementById('newPassword');
    newPasswordInput.focus();
    
    // Handle save button click
    document.getElementById('savePasswordBtn').onclick = () => {
        const newPassword = newPasswordInput.value.trim();
        if (!newPassword) {
            showMessage("Please enter a new password.", "warning");
            return;
        }
        
        // Update the password
        appSettings.accounts[accIndex].password = newPassword;
        saveSettingsToLocalStorage();
        
        // Close modal
        document.body.removeChild(modalOverlay);
        
        showMessage(`Password updated successfully for ${account.name}!`, "success");
    };
    
    // Handle cancel button click
    document.getElementById('cancelPasswordBtn').onclick = () => {
        document.body.removeChild(modalOverlay);
    };
    
    // Handle click outside modal
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            document.body.removeChild(modalOverlay);
        }
    };
    
    // Handle Enter key in password field
    newPasswordInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            document.getElementById('savePasswordBtn').click();
        }
    };
}

// --- Event Listeners for Static Elements ---

// Update game and DLL folder paths in appSettings and local storage
gameFolderInput.oninput = () => {
    appSettings.gameFolder = gameFolderInput.value;
    saveSettingsToLocalStorage();
};

dllFolderInput.oninput = () => {
    appSettings.dllFolder = dllFolderInput.value;
    saveSettingsToLocalStorage();
};

// Clear Selection Button
clearSelectionBtn.onclick = () => {
    let selectionCleared = false;
    appSettings.accounts.forEach(account => {
        account.characters.forEach(char => {
            if (char.selected) {
                char.selected = false;
                selectionCleared = true;
            }
        });
    });

    saveSettingsToLocalStorage();
    renderUI();
    if (selectionCleared) showMessage("All character selections have been cleared.", "info");
};

// Add New Account Button
addAccountBtn.onclick = () => {
    const accName = prompt("Enter account name:");
    if (!accName) return;
    const password = prompt("Enter account password:");
    if (!password) return;

    appSettings.accounts.push({
        name: accName,
        password: password,
        characters: []
    });
    saveSettingsToLocalStorage();
    renderUI();
};

// Launch Button
launchBtn.onclick = async () => {
    let selectedCharacters = [];
    const selectedAccounts = new Set(); // Track which accounts have selected characters
    
    appSettings.accounts.forEach(account => {
        account.characters.forEach(char => {
            if (char.selected) {
                selectedCharacters.push({
                    accountName: account.name,
                    password: account.password,
                    characterId: char.id
                });
                selectedAccounts.add(account.name);
            }
        });
    });

    if (selectedCharacters.length === 0) {
        showMessage("No characters selected for launch.", "warning");
        return;
    }

    if (!appSettings.gameFolder || !appSettings.dllFolder) {
        showMessage("Please specify both Game Folder and DLL Folder paths.", "error");
        return;
    }

    // First, check if the game window is already running
    showMessage("Checking for existing game instances...", "info");

    try {
        // First check which characters are currently running
        // Send complete account information for proper conflict detection
        const accountsData = appSettings.accounts.map(account => ({
            accountName: account.name,
            characters: account.characters.map(char => ({
                characterName: char.name,
                characterId: char.id
            }))
        }));
        
        const checkResponse = await fetch('/check_and_focus_window', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                allAccounts: accountsData,
                selectedAccounts: Array.from(selectedAccounts) // Need to pass selected accounts for backend validation
            })
        });

        let checkResult = await checkResponse.json();
        
        if (checkResponse.ok) {
            // If auto-cycle is enabled, handle window closing
            if (appSettings.autoCycle) {
                const runningCharacters = checkResult.runningCharacters || [];
                const accountsToClose = new Set();

                console.log("Running characters:", runningCharacters);
                console.log("Selected characters:", selectedCharacters);

                // Create a map of running characters to their accounts
                const runningCharToAccount = new Map();
                runningCharacters.forEach(runningCharName => {
                    for (const account of appSettings.accounts) {
                        if (account.characters.some(c => c.name.toLowerCase() === runningCharName.toLowerCase())) {
                            runningCharToAccount.set(runningCharName.toLowerCase(), account.name);
                            break;
                        }
                    }
                });

                // Create a map of selected character names by account
                const selectedCharNamesByAccount = new Map();
                selectedCharacters.forEach(char => {
                    // Find the actual character object to get its name
                    const account = appSettings.accounts.find(acc => acc.name === char.accountName);
                    if (account) {
                        const character = account.characters.find(c => c.id === char.characterId);
                        if (character) {
                            selectedCharNamesByAccount.set(char.accountName, character.name);
                        }
                    }
                });

                console.log("Running characters by account:", Object.fromEntries(runningCharToAccount));
                console.log("Selected character names by account:", Object.fromEntries(selectedCharNamesByAccount));

                // For each running character
                runningCharacters.forEach(runningCharName => {
                    const accountName = runningCharToAccount.get(runningCharName.toLowerCase());
                    if (!accountName) {
                        console.log(`No account found for running character: ${runningCharName}`);
                        return;
                    }

                    const selectedCharName = selectedCharNamesByAccount.get(accountName);
                    
                    if (!selectedCharName) {
                        // Account has no character selected but has one running
                        console.log(`Account ${accountName}: Closing because no character selected (running: ${runningCharName})`);
                        accountsToClose.add(accountName);
                    } else if (selectedCharName.toLowerCase() !== runningCharName.toLowerCase()) {
                        // Account has a different character selected than running
                        console.log(`Account ${accountName}: Closing because wrong character running (running: ${runningCharName}, selected: ${selectedCharName})`);
                        accountsToClose.add(accountName);
                    } else {
                        // The correct character is running
                        console.log(`Account ${accountName}: Keeping running as correct character is logged in (${runningCharName})`);
                    }
                });

                // Close windows if needed
                if (accountsToClose.size > 0) {
                    try {
                        await fetch('/close_running_instances', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                selectedAccounts: Array.from(accountsToClose),
                                allAccounts: accountsData // Pass account data for character name lookup
                            })
                        });
                        // Wait for 5 seconds after closing instances
                        await new Promise(resolve => setTimeout(resolve, 5000));

                        // Re-check for conflicts after closing windows
                        const recheckResponse = await fetch('/check_and_focus_window', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                allAccounts: accountsData,
                                selectedAccounts: Array.from(selectedAccounts) // Keep consistent with initial check
                            })
                        });
                        
                        if (!recheckResponse.ok) {
                            throw new Error('Failed to recheck window status');
                        }
                        
                        // Use the new check result after closing windows
                        const newCheckResult = await recheckResponse.json();
                        console.log("Recheck after closing windows:", newCheckResult);
                        
                        // Check if the windows we tried to close are actually closed
                        const stillRunning = newCheckResult.runningCharacters || [];
                        const failedToClose = stillRunning.filter(charName => {
                            const acc = appSettings.accounts.find(acc =>
                                acc.characters.some(c => c.name.toLowerCase() === charName.toLowerCase())
                            );
                            return acc && accountsToClose.has(acc.name);
                        });

                        if (failedToClose.length > 0) {
                            console.error("Some windows did not close:", failedToClose);
                            showMessage("Failed to close some game windows. Please close them manually.", "error");
                            return;
                        }

                        // Windows were successfully closed, proceed with launch
                        console.log("Successfully closed windows, proceeding with launch");
                        checkResult = newCheckResult; // Use the new check result that shows windows are closed
                    } catch (error) {
                        console.error("Error during window management:", error);
                        showMessage("Error managing game windows. Please try again.", "error");
                        return;
                    }
                }
            }

            // Handle different statuses using the latest check result
            console.log("Final check result before launch:", checkResult);
            switch (checkResult.status) {
                case 'conflicts_found':
                    // Some accounts have conflicts
                    const conflictedAccounts = checkResult.conflictedAccounts || [];
                    const conflicts = checkResult.conflicts || [];
                    
                    // Show detailed conflict information
                    let conflictMessage = "Cannot launch - account conflicts detected:\n\n";
                    conflicts.forEach(conflict => {
                        conflictMessage += `• ${conflict.message}\n`;
                    });
                    conflictMessage += "\nPlease close the running game instance(s) before launching new characters from the same account(s).";
                    
                    showMessage(conflictMessage, "error");
                    
                    // Filter out characters from conflicted accounts
                    const remainingCharacters = selectedCharacters.filter(char =>
                        !conflictedAccounts.includes(char.accountName)
                    );
                    
                    if (remainingCharacters.length === 0) {
                        // All selected characters have conflicts, don't proceed
                        return;
                    }
                    
                    // Some characters can still be launched
                    // Automatically proceed with launching remaining characters without confirmation
                    selectedCharacters = remainingCharacters;
                    showMessage(`Launching ${selectedCharacters.length} character(s) without conflicts...`, "info");
                    break;
                
                
                case 'no_conflicts':
                    // No conflicts, proceed normally
                    const runningCount = checkResult.runningCharacters ? checkResult.runningCharacters.length : 0;
                    if (runningCount > 0) {
                        showMessage(`No conflicts detected (${runningCount} other character(s) running). Launching...`, "info");
                    } else {
                        showMessage("No conflicts detected. Launching characters...", "info");
                    }
                    break;
                
                case 'error':
                case 'unsupported':
                    showMessage(checkResult.message, "error");
                    return;
                
                default:
                    // Unknown status
                    showMessage(`Unknown check status: ${checkResult.status}`, "warning");
                    break;
            }
        } else {
            showMessage(`Error checking for conflicts: ${checkResult.message || 'Unknown error'}`, "error");
            return;
        }
        
        // Proceed with launch for non-conflicted characters
        if (selectedCharacters.length > 0) {
            const response = await fetch('/launch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    gameFolder: appSettings.gameFolder,
                    dllFolder: appSettings.dllFolder,
                    characters: selectedCharacters
                })
            });

            const result = await response.json();

            if (response.ok) {
                if (result.status === 'success') {
                    showMessage(result.message, "success");
                    
                    // After successful launch, focus the launcher window
                    try {
                        const focusResponse = await fetch('/focus_launcher_window', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const focusResult = await focusResponse.json();
                        if (focusResponse.ok && focusResult.status === 'success') {
                            console.log("Launcher window focused successfully");
                        } else {
                            console.log("Could not focus launcher window:", focusResult.message);
                        }
                    } catch (focusError) {
                        console.error("Error focusing launcher window:", focusError);
                        // Don't show error to user as this is not critical
                    }
                } else if (result.status === 'partial_success') {
                    showMessage(`${result.message} Launched: ${result.launched.join(', ')}. Errors: ${result.errors.join(', ')}`, "warning");
                    
                    // After partial success, focus the launcher window
                    try {
                        const focusResponse = await fetch('/focus_launcher_window', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        const focusResult = await focusResponse.json();
                        if (focusResponse.ok && focusResult.status === 'success') {
                            console.log("Launcher window focused successfully");
                        } else {
                            console.log("Could not focus launcher window:", focusResult.message);
                        }
                    } catch (focusError) {
                        console.error("Error focusing launcher window:", focusError);
                    }
                }
            } else {
                showMessage(`Launch failed: ${result.message || 'Server error'}`, "error");
                console.error("Launch error response:", result);
            }
        }
    } catch (error) {
        showMessage(`Failed to connect to launcher backend: ${error.message}. Is the Python server running?`, "error");
        console.error("Fetch error:", error);
    }
};

// Save Config to File Button
saveConfigBtn.onclick = () => {
    const dataStr = JSON.stringify(appSettings, null, 2); // null, 2 for pretty print
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ao_launcher_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessage("Configuration saved to ao_launcher_config.json", "success");
};

// Save as .BAT File Button
saveBatBtn.onclick = async () => {
    // Get selected characters
    const selectedCharacters = [];
    
    appSettings.accounts.forEach(account => {
        account.characters.forEach(char => {
            if (char.selected) {
                selectedCharacters.push({
                    accountName: account.name,
                    password: account.password,
                    characterId: char.id,
                    characterName: char.name
                });
            }
        });
    });

    if (selectedCharacters.length === 0) {
        showMessage("No characters selected. Please select at least one character first.", "warning");
        return;
    }

    if (!appSettings.gameFolder || !appSettings.dllFolder) {
        showMessage("Please specify both Game Folder and DLL Folder paths.", "error");
        return;
    }

    // Generate filename based on selection
    let filename;
    if (selectedCharacters.length === 1) {
        filename = `AO_Launch_${selectedCharacters[0].characterName.replace(/[^a-zA-Z0-9]/g, '_')}.bat`;
    } else {
        filename = `AO_Launch_${selectedCharacters.length}_Characters.bat`;
    }
    
    // Generate .BAT file content
    let batContent = `@ECHO OFF
set AOPath=${appSettings.gameFolder}
cd /d "${appSettings.dllFolder}"
`;

    // Add launch commands for each character
    selectedCharacters.forEach((char) => {
        batContent += `\ndotnet AOQuickLauncher.dll ${char.accountName} ${char.password} ${char.characterId}`;
    });

    // Try to use File System Access API if available (Chrome/Edge)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'Batch files',
                    accept: { 'text/plain': ['.bat'] }
                }]
            });
            
            const writable = await handle.createWritable();
            await writable.write(batContent);
            await writable.close();
            
            showMessage(`Saved launch script for ${selectedCharacters.length} character(s) to ${handle.name}`, "success");
            return;
        } catch (err) {
            // User cancelled or API not supported, fall back to download
            if (err.name !== 'AbortError') {
                console.log('File System Access API failed:', err);
            }
        }
    }
    
    // Fallback: Use traditional download method
    const blob = new Blob([batContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage(`Saved launch script for ${selectedCharacters.length} character(s) as .BAT file`, "success");
};

// Load Config from File Input
loadConfigFileInput.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    if (!confirm("Loading a config file will overwrite your current settings. Are you sure?")) {
        // Clear the file input so the user can select the same file again if they change their mind
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedSettings = JSON.parse(e.target.result);
            // Basic validation for loaded structure
            if (typeof loadedSettings.gameFolder === 'string' &&
                typeof loadedSettings.dllFolder === 'string' &&
                Array.isArray(loadedSettings.accounts)) {
                // Data migration: ensure character IDs are numbers
                loadedSettings.accounts.forEach(account => {
                    if (account.characters && Array.isArray(account.characters)) {
                        account.characters.forEach(char => {
                            if (typeof char.id === 'string') char.id = parseInt(char.id, 10);
                        });
                    }
                });

                appSettings = loadedSettings;
                saveSettingsToLocalStorage(); // Save the newly loaded settings to local storage
                renderUI();
                showMessage("Configuration loaded successfully from file!", "success");
            } else {
                showMessage("Invalid config file format. Please select a valid AO Launcher JSON file.", "error");
            }
        } catch (error) {
            showMessage(`Error parsing config file: ${error.message}`, "error");
            console.error("File load error:", error);
        } finally {
            // Clear the file input to allow re-selection of the same file
            event.target.value = '';
        }
    };
    reader.onerror = () => {
        showMessage("Failed to read file.", "error");
        event.target.value = ''; // Clear input
    };
    reader.readAsText(file);
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettingsFromLocalStorage(); // Load settings on page load
    renderUI(); // Render the UI with loaded settings

    // Auto-cycle checkbox handler
    document.getElementById('autoCycleCheckbox').onchange = (event) => {
        appSettings.autoCycle = event.target.checked;
        saveSettingsToLocalStorage();
    };

    // Add Enter key handler for launching
    document.addEventListener('keydown', (event) => {
        // Check if Enter/Return key is pressed and not inside an input field
        if (event.key === 'Enter' &&
            !(event.target instanceof HTMLInputElement ||
              event.target instanceof HTMLTextAreaElement)) {
            event.preventDefault();
            launchBtn.click();
        }
    });
});
py