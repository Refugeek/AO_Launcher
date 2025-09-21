// static/js/preferences.js
// Handles the character preference copy UI and communication with the backend.

const PREFERENCE_ITEMS = [
    {
        id: 'charCfg',
        label: 'Char.cfg',
        description: 'Core character configuration file. Copy to preserve metadata and character-specific settings.',
        defaultChecked: true,
        category: 'recommended'
    },
    {
        id: 'prefsXml',
        label: 'Prefs.xml',
        description: 'Primary UI layout and preference file. Copy to keep window layouts, sorting, and toggles.',
        defaultChecked: true,
        category: 'recommended'
    },
    {
        id: 'chatFolder',
        label: 'Chat/',
        description: 'Entire chat configuration folder, including window layouts, channels, and color schemes.',
        defaultChecked: true,
        category: 'recommended'
    },
    {
        id: 'containersBank',
        label: 'Containers/Bank.xml',
        description: 'Bank window layout. Copy to restore how backpacks are arranged inside the bank.',
        defaultChecked: true,
        category: 'recommended'
    },
    {
        id: 'containersInventory',
        label: 'Containers/Inventory.xml',
        description: 'Inventory window organization and layout.',
        defaultChecked: true,
        category: 'recommended'
    },
    {
        id: 'containersShortcutBars',
        label: 'Containers/ShortcutBar*.xml',
        description: 'Shortcut bar positions and contents. Copy with caution when professions differ.',
        defaultChecked: false,
        category: 'optional'
    },
    {
        id: 'dockAreasLayouts',
        label: 'DockAreas/DockArea*.xml',
        description: 'Docked window definitions. Copy to keep toolbars and docked UI modules in place.',
        defaultChecked: true,
        category: 'recommended'
    },
    {
        id: 'dockAreasMap',
        label: 'DockAreas/PlanetMapViewConfig.xml',
        description: 'Planet map configuration including window placement and zoom state.',
        defaultChecked: true
    },
    {
        id: 'dockAreasRollup',
        label: 'DockAreas/RollupArea.xml',
        description: 'Roll-up window states—what is expanded or collapsed.',
        defaultChecked: true,
        category: 'optional'
    },
    {
        id: 'disabledTips',
        label: 'DisabledTipsMap.xml',
        description: 'Tracks which tutorial tips were dismissed. Optional quality-of-life preference.',
        defaultChecked: true,
        category: 'optional'
    },
    {
        id: 'iconPositionsBin',
        label: 'IconPositions.bin',
        description: 'Binary icon placement data (hotbars, HUD icons). Copy if you want identical positioning.',
        defaultChecked: true
    },
    {
        id: 'ignoreListBin',
        label: 'IgnoreList.bin',
        description: 'Ignored players list. Optional and potentially sensitive.',
        defaultChecked: true
    },
    {
        id: 'referencesBin',
        label: 'References.bin',
        description: 'Internal reference cache. Usually safe to copy but optional.',
        defaultChecked: false
    },
    {
        id: 'textMacroBin',
        label: 'TextMacro.bin',
        description: 'Chat macros and quick text bindings.',
        defaultChecked: false
    }
];

const PREF_SOURCE_STORAGE_KEY = 'aoLauncherPrefSourceCharacter';

const prefsBasePathInput = document.getElementById('prefsBasePath');
const savePrefsBasePathBtn = document.getElementById('savePrefsBasePathBtn');
const sourceCharacterSelect = document.getElementById('sourceCharacter');
const preferenceItemsContainer = document.getElementById('preferenceItems');
const targetAccountsContainer = document.getElementById('targetAccountsContainer');
const selectAllTargetsBtn = document.getElementById('selectAllTargets');
const clearAllTargetsBtn = document.getElementById('clearAllTargets');
const copyBtn = document.getElementById('copyBtn');
const copyWithBackupBtn = document.getElementById('copyWithBackupBtn');
const prefsMessageBox = document.getElementById('prefsMessageBox');

let messageTimeoutHandle = null;

const defaultSettings = {
    gameFolder: '',
    dllFolder: '',
    autoCycle: false,
    prefsBasePath: '',
    accounts: []
};

let appSettings = loadSettingsFromLocalStorage();
let characterLookup = new Map();
let sourceCharacterKey = localStorage.getItem(PREF_SOURCE_STORAGE_KEY) || '';
let selectedTargets = new Set();

function loadSettingsFromLocalStorage() {
    const storedSettings = localStorage.getItem('aoLauncherSettings');
    if (!storedSettings) {
        return { ...defaultSettings };
    }

    try {
        const parsed = JSON.parse(storedSettings);
        const merged = { ...defaultSettings, ...parsed };
        if (!Array.isArray(merged.accounts)) {
            merged.accounts = [];
        }
        merged.accounts = merged.accounts.map(account => ({
            ...account,
            name: account?.name || account?.accountName || '',
            characters: Array.isArray(account?.characters) ? account.characters : []
        }));
        merged.prefsBasePath = merged.prefsBasePath || '';
        return merged;
    } catch (error) {
        console.error('Failed to parse aoLauncherSettings from storage', error);
        return { ...defaultSettings };
    }
}

function saveSettingsToLocalStorage() {
    localStorage.setItem('aoLauncherSettings', JSON.stringify(appSettings));
}

function showPrefsMessage(message, type = 'info') {
    if (!prefsMessageBox) return;

    if (messageTimeoutHandle) {
        clearTimeout(messageTimeoutHandle);
    }

    const baseClass = 'mt-2 p-3 rounded-lg text-center';
    const typeClass = type === 'success'
        ? 'message-success'
        : type === 'error'
            ? 'message-error'
            : type === 'warning'
                ? 'message-warning'
                : 'message-info';

    prefsMessageBox.textContent = message;
    prefsMessageBox.className = `${baseClass} ${typeClass}`;
    prefsMessageBox.classList.remove('hidden');

    messageTimeoutHandle = setTimeout(() => {
        prefsMessageBox.classList.add('hidden');
    }, 6000);
}

function getCharacterKey(accountName, characterId) {
    return `${accountName}::${characterId}`;
}

function rebuildCharacterLookup() {
    characterLookup = new Map();

    appSettings.accounts
        .filter(acc => acc && acc.name)
        .forEach(acc => {
            acc.characters
                .filter(char => char && char.id !== undefined && char.id !== null)
                .forEach(char => {
                    const key = getCharacterKey(acc.name, char.id);
                    characterLookup.set(key, {
                        accountName: acc.name,
                        characterId: char.id,
                        characterName: char.name || `Char ${char.id}`
                    });
                });
        });

    const validKeys = new Set(characterLookup.keys());
    if (sourceCharacterKey && !validKeys.has(sourceCharacterKey)) {
        sourceCharacterKey = '';
        localStorage.removeItem(PREF_SOURCE_STORAGE_KEY);
    }

    selectedTargets = new Set(Array.from(selectedTargets).filter(key => validKeys.has(key) && key !== sourceCharacterKey));
}

function renderPreferenceItems() {
    preferenceItemsContainer.innerHTML = '';

    PREFERENCE_ITEMS.forEach(item => {
        const itemWrapper = document.createElement('label');
        itemWrapper.className = 'preference-item flex items-start gap-2 cursor-pointer';
        itemWrapper.title = item.description;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.id;
        checkbox.checked = item.defaultChecked;
        checkbox.className = 'mt-1 accent-[#4dd0d0]';

        const textContainer = document.createElement('div');
        textContainer.className = 'flex flex-col text-sm text-blue-100';

        const labelLine = document.createElement('div');
        labelLine.className = 'flex items-center gap-2';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'text-cyan-100 font-semibold';
        labelSpan.textContent = item.label;

        labelLine.appendChild(labelSpan);
        
        // Only add category badge if category is defined
        if (item.category) {
            const badge = document.createElement('span');
            badge.className = `preference-badge ${item.category === 'optional' ? 'preference-badge-optional' : 'preference-badge-recommended'}`;
            badge.textContent = item.category === 'optional' ? 'Optional' : 'Recommended';
            labelLine.appendChild(badge);
        }

        const description = document.createElement('span');
        description.className = 'text-xs opacity-80';
        description.textContent = item.description;

        textContainer.appendChild(labelLine);
        textContainer.appendChild(description);

        itemWrapper.appendChild(checkbox);
        itemWrapper.appendChild(textContainer);

        preferenceItemsContainer.appendChild(itemWrapper);
    });
}

function renderSourceDropdown() {
    const previousValue = sourceCharacterKey;
    sourceCharacterSelect.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = 'Select a character';
    sourceCharacterSelect.appendChild(placeholderOption);

    const characters = Array.from(characterLookup.values())
        .sort((a, b) => {
            const accountCompare = a.accountName.localeCompare(b.accountName);
            if (accountCompare !== 0) return accountCompare;
            return (a.characterName || '').localeCompare(b.characterName || '');
        });

    characters.forEach(char => {
        const option = document.createElement('option');
        const key = getCharacterKey(char.accountName, char.characterId);
        option.value = key;
        option.textContent = `${char.characterName} (${char.accountName})`;
        if (key === previousValue) {
            option.selected = true;
            sourceCharacterKey = key;
        }
        sourceCharacterSelect.appendChild(option);
    });
}

function renderTargetAccounts() {
    targetAccountsContainer.innerHTML = '';

    if (!appSettings.accounts.length) {
        targetAccountsContainer.innerHTML = '<p class="text-center text-gray-400 col-span-full">Add accounts on the launcher page to manage preferences.</p>';
        return;
    }

    const accounts = [...appSettings.accounts].sort((a, b) => a.name.localeCompare(b.name));

    accounts.forEach(account => {
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card preference-account-card';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-1';

        const title = document.createElement('h3');
        title.className = 'text-m font-semibold text-blue-200';
        title.textContent = account.name;

        const controls = document.createElement('div');
        controls.className = 'flex gap-2 text-xs';

        const allBtn = document.createElement('button');
        allBtn.textContent = 'All';
        allBtn.className = 'px-2 py-1 rounded-md uppercase';
        allBtn.addEventListener('click', () => {
            setAccountSelection(account.name, true);
        });

        const noneBtn = document.createElement('button');
        noneBtn.textContent = 'None';
        noneBtn.className = 'px-2 py-1 rounded-md uppercase';
        noneBtn.addEventListener('click', () => {
            setAccountSelection(account.name, false);
        });

        controls.appendChild(allBtn);
        controls.appendChild(noneBtn);

        header.appendChild(title);
        header.appendChild(controls);

        const charactersContainer = document.createElement('div');
        charactersContainer.className = 'space-y-1';

        const characters = [...account.characters].sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            if (nameA === nameB) return String(a.id).localeCompare(String(b.id));
            return nameA.localeCompare(nameB);
        });

        if (!characters.length) {
            const empty = document.createElement('p');
            empty.className = 'text-gray-400 text-xs';
            empty.textContent = 'No characters configured.';
            charactersContainer.appendChild(empty);
        }

        characters.forEach(char => {
            const charKey = getCharacterKey(account.name, char.id);
            const isSource = charKey === sourceCharacterKey;
            const characterRow = document.createElement('div');
            characterRow.className = 'character-item preference-character-row flex items-center gap-2';
            if (isSource) {
                characterRow.classList.add('preference-character-disabled');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'character-checkbox accent-[#4dd0d0]';
            checkbox.dataset.key = charKey;
            checkbox.disabled = isSource;
            checkbox.checked = selectedTargets.has(charKey);
            checkbox.addEventListener('change', event => {
                const key = event.target.dataset.key;
                if (event.target.checked) {
                    selectedTargets.add(key);
                } else {
                    selectedTargets.delete(key);
                }
            });

            const text = document.createElement('div');
            text.className = 'flex flex-col text-sm text-gray-100';

            const nameLine = document.createElement('span');
            nameLine.textContent = char.name || `Character ${char.id}`;

            const metaLine = document.createElement('span');
            metaLine.className = 'text-xs opacity-70';
            metaLine.textContent = `ID: ${char.id}` + (isSource ? ' • Source character' : '');

            text.appendChild(nameLine);
            text.appendChild(metaLine);

            characterRow.appendChild(checkbox);
            characterRow.appendChild(text);

            charactersContainer.appendChild(characterRow);
        });

        accountCard.appendChild(header);
        accountCard.appendChild(charactersContainer);
        targetAccountsContainer.appendChild(accountCard);
    });
}

function setAccountSelection(accountName, shouldSelect) {
    const account = appSettings.accounts.find(acc => acc.name === accountName);
    if (!account) return;

    account.characters.forEach(char => {
        const key = getCharacterKey(accountName, char.id);
        if (key === sourceCharacterKey) return;
        if (shouldSelect) {
            selectedTargets.add(key);
        } else {
            selectedTargets.delete(key);
        }
    });

    renderTargetAccounts();
}

function handleSelectAllTargets() {
    characterLookup.forEach((value, key) => {
        if (key !== sourceCharacterKey) {
            selectedTargets.add(key);
        }
    });
    renderTargetAccounts();
}

function handleClearAllTargets() {
    selectedTargets.clear();
    renderTargetAccounts();
}

function getSelectedPreferenceItems() {
    const checked = preferenceItemsContainer.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checked).map(input => input.value);
}

function buildTargetPayload() {
    const targets = [];
    selectedTargets.forEach(key => {
        const entry = characterLookup.get(key);
        if (entry) {
            targets.push({
                accountName: entry.accountName,
                characterId: entry.characterId
            });
        }
    });
    return targets;
}

function getSourcePayload() {
    if (!sourceCharacterKey) return null;
    const entry = characterLookup.get(sourceCharacterKey);
    if (!entry) return null;
    return {
        accountName: entry.accountName,
        characterId: entry.characterId
    };
}

async function handleCopyPreferences(createBackup) {
    const basePath = prefsBasePathInput.value.trim();
    if (!basePath) {
        showPrefsMessage('Please set the path to your Prefs directory first.', 'error');
        return;
    }

    if (appSettings.prefsBasePath !== basePath) {
        appSettings.prefsBasePath = basePath;
        saveSettingsToLocalStorage();
    }

    const source = getSourcePayload();
    if (!source) {
        showPrefsMessage('Select the character you want to copy preferences from.', 'error');
        return;
    }

    const items = getSelectedPreferenceItems();
    if (!items.length) {
        showPrefsMessage('Select at least one preference file or folder to copy.', 'warning');
        return;
    }

    const targets = buildTargetPayload();
    if (!targets.length) {
        showPrefsMessage('Choose at least one target character to receive the preferences.', 'warning');
        return;
    }

    const payload = {
        prefsBasePath: basePath,
        source,
        targets,
        items,
        createBackup
    };

    copyBtn.disabled = true;
    copyWithBackupBtn.disabled = true;
    showPrefsMessage('Copying preferences…', 'info');

    try {
        const response = await fetch('/copy_preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log('Preference copy result', result);

        if (!response.ok || result.status === 'error') {
            const message = result.message || 'Copy failed.';
            showPrefsMessage(message, 'error');
            return;
        }

        if (result.status === 'unsupported') {
            showPrefsMessage(result.message || 'Preference copying is only supported on Windows.', 'warning');
            return;
        }

        const message = result.message || (createBackup ? 'Preferences copied with backups.' : 'Preferences copied.');
        const type = result.status === 'partial_success' ? 'warning' : 'success';
        const detailedMessage = result.errors && result.errors.length
            ? `${message} ${result.errors[0]}`
            : message;
        showPrefsMessage(detailedMessage, type);
    } catch (error) {
        console.error('Error copying preferences', error);
        showPrefsMessage('An unexpected error occurred while copying preferences.', 'error');
    } finally {
        copyBtn.disabled = false;
        copyWithBackupBtn.disabled = false;
    }
}

function initialiseEventHandlers() {
    savePrefsBasePathBtn.addEventListener('click', () => {
        const path = prefsBasePathInput.value.trim();
        appSettings.prefsBasePath = path;
        saveSettingsToLocalStorage();
        if (path) {
            showPrefsMessage('Preference base path saved.', 'success');
        } else {
            showPrefsMessage('Preference base path cleared.', 'info');
        }
    });

    prefsBasePathInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            savePrefsBasePathBtn.click();
        }
    });

    sourceCharacterSelect.addEventListener('change', event => {
        sourceCharacterKey = event.target.value || '';
        if (sourceCharacterKey) {
            localStorage.setItem(PREF_SOURCE_STORAGE_KEY, sourceCharacterKey);
            selectedTargets.delete(sourceCharacterKey);
        } else {
            localStorage.removeItem(PREF_SOURCE_STORAGE_KEY);
        }
        renderTargetAccounts();
    });

    selectAllTargetsBtn.addEventListener('click', handleSelectAllTargets);
    clearAllTargetsBtn.addEventListener('click', handleClearAllTargets);

    copyBtn.addEventListener('click', () => handleCopyPreferences(false));
    copyWithBackupBtn.addEventListener('click', () => handleCopyPreferences(true));
}

function initialise() {
    prefsBasePathInput.value = appSettings.prefsBasePath || '';
    rebuildCharacterLookup();
    renderPreferenceItems();
    renderSourceDropdown();
    renderTargetAccounts();
    initialiseEventHandlers();
}

initialise();
