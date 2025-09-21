// static/js/prefs.js
// Frontend logic for the preference copier view.

const PREF_ITEMS = [
    {
        id: 'char_cfg',
        label: 'Char.cfg',
        path: 'Char.cfg',
        type: 'file',
        defaultChecked: true,
        description: 'Core character metadata and configuration. Copy to preserve character-specific UI state.'
    },
    {
        id: 'prefs_xml',
        label: 'Prefs.xml',
        path: 'Prefs.xml',
        type: 'file',
        defaultChecked: true,
        description: 'Primary interface layout file – window positions, columns, and many UI toggles.'
    },
    {
        id: 'chat_folder',
        label: 'Chat/ (all)',
        path: 'Chat',
        type: 'directory',
        defaultChecked: true,
        description: 'Chat windows, filters, and color settings. Copying preserves chat layout across characters.'
    },
    {
        id: 'containers_bank',
        label: 'Containers/Bank.xml',
        path: 'Containers/Bank.xml',
        type: 'file',
        defaultChecked: true,
        description: 'Bank window layout including backpack arrangement.'
    },
    {
        id: 'containers_inventory',
        label: 'Containers/Inventory.xml',
        path: 'Containers/Inventory.xml',
        type: 'file',
        defaultChecked: true,
        description: 'Inventory window layout and item arrangement.'
    },
    {
        id: 'containers_shortcut',
        label: 'Containers/ShortcutBar*.xml',
        path: 'Containers/ShortcutBar*.xml',
        type: 'glob',
        defaultChecked: true,
        description: 'Hotbar locations and contents. Recommended when copying between similar professions; back up first if unsure.'
    },
    {
        id: 'dockareas_dock',
        label: 'DockAreas/DockArea*.xml',
        path: 'DockAreas/DockArea*.xml',
        type: 'glob',
        defaultChecked: true,
        description: 'Docked window placements across all AO dock areas.'
    },
    {
        id: 'dockareas_planet',
        label: 'DockAreas/PlanetMapViewConfig.xml',
        path: 'DockAreas/PlanetMapViewConfig.xml',
        type: 'file',
        defaultChecked: true,
        description: 'Planet map UI position and zoom state.'
    },
    {
        id: 'dockareas_rollup',
        label: 'DockAreas/RollupArea.xml',
        path: 'DockAreas/RollupArea.xml',
        type: 'file',
        defaultChecked: true,
        description: 'Rollup module order and expanded/collapsed state.'
    },
    {
        id: 'disabled_tips',
        label: 'DisabledTipsMap.xml',
        path: 'DisabledTipsMap.xml',
        type: 'file',
        defaultChecked: false,
        description: 'Records dismissed tutorial popups. Optional to copy.'
    },
    {
        id: 'icon_positions',
        label: 'IconPositions.bin',
        path: 'IconPositions.bin',
        type: 'file',
        defaultChecked: false,
        description: 'Binary icon placement data (hotbars, HUD icons). Copy if you want identical positioning.'
    },
    {
        id: 'ignore_list',
        label: 'IgnoreList.bin',
        path: 'IgnoreList.bin',
        type: 'file',
        defaultChecked: false,
        description: 'Ignored players list. Optional and potentially sensitive.'
    },
    {
        id: 'references_bin',
        label: 'References.bin',
        path: 'References.bin',
        type: 'file',
        defaultChecked: false,
        description: 'Internal reference cache. Usually safe to copy but optional.'
    },
    {
        id: 'text_macro',
        label: 'TextMacro.bin',
        path: 'TextMacro.bin',
        type: 'file',
        defaultChecked: false,
        description: 'Chat macros and quick text bindings.'
    }
];

let appSettings = {
    gameFolder: '',
    dllFolder: '',
    accounts: [],
    autoCycle: false,
    prefsRoot: ''
};

const prefsState = {
    selectedSource: null,
    selectedTargets: new Map()
};

const prefsRootInput = document.getElementById('prefsRootInput');
const sourceSelect = document.getElementById('sourceCharacterSelect');
const fileOptionsContainer = document.getElementById('fileOptionsContainer');
const targetsContainer = document.getElementById('targetsContainer');
const selectAllBtn = document.getElementById('selectAllTargetsBtn');
const clearTargetsBtn = document.getElementById('clearTargetsBtn');
const copyBtn = document.getElementById('copyBtn');
const copyWithBackupBtn = document.getElementById('copyWithBackupBtn');
const messageBox = document.getElementById('prefsMessageBox');

function showMessage(message, type = 'info') {
    messageBox.textContent = message;
    const baseClasses = 'mt-6 p-4 rounded-lg text-center';
    const typeClass = type === 'success'
        ? 'message-success'
        : type === 'error'
            ? 'message-error'
            : type === 'warning'
                ? 'message-warning'
                : 'message-info';
    messageBox.className = `${baseClasses} ${typeClass}`;
    messageBox.classList.remove('hidden');
}

function hideMessage() {
    messageBox.classList.add('hidden');
}

function saveSettingsToLocalStorage() {
    localStorage.setItem('aoLauncherSettings', JSON.stringify(appSettings));
}

function loadSettingsFromLocalStorage() {
    const storedSettings = localStorage.getItem('aoLauncherSettings');
    if (!storedSettings) return;

    try {
        const parsed = JSON.parse(storedSettings);
        appSettings.gameFolder = parsed.gameFolder || '';
        appSettings.dllFolder = parsed.dllFolder || '';
        appSettings.autoCycle = parsed.autoCycle || false;
        appSettings.prefsRoot = parsed.prefsRoot || '';
        if (Array.isArray(parsed.accounts)) {
            appSettings.accounts = parsed.accounts;
        }
    } catch (err) {
        console.error('Failed to parse launcher settings', err);
        showMessage('Could not load saved launcher data. Reconfigure accounts on the main page.', 'error');
    }
}

function formatCharacterLabel(account, character) {
    return `${character.name} — ${account.name} (ID: ${character.id})`;
}

function populateSourceDropdown() {
    const previous = sourceSelect.value;
    sourceSelect.innerHTML = '<option value="">Select a source character...</option>';

    if (!appSettings.accounts.length) {
        sourceSelect.disabled = true;
        return;
    }

    sourceSelect.disabled = false;
    const sortedAccounts = [...appSettings.accounts].sort((a, b) => a.name.localeCompare(b.name));

    sortedAccounts.forEach(account => {
        if (!Array.isArray(account.characters)) return;
        const sortedChars = [...account.characters].sort((a, b) => a.name.localeCompare(b.name));
        sortedChars.forEach(char => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ accountName: account.name, characterId: char.id });
            option.textContent = formatCharacterLabel(account, char);
            sourceSelect.appendChild(option);
        });
    });

    if (previous) {
        const stillExists = Array.from(sourceSelect.options).some(opt => opt.value === previous);
        if (stillExists) {
            sourceSelect.value = previous;
            prefsState.selectedSource = JSON.parse(previous);
        }
    }
}

function renderFileOptions() {
    fileOptionsContainer.innerHTML = '';
    PREF_ITEMS.forEach(item => {
        const wrapper = document.createElement('label');
        wrapper.className = 'flex items-start space-x-2 bg-[#0a1118] border border-[#1a4d4d] rounded-lg p-3 hover:border-[#2a5d5d] transition';
        wrapper.title = item.description;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'mt-1 pref-item-checkbox accent-[#4dd0d0]';
        checkbox.dataset.itemId = item.id;
        checkbox.dataset.path = item.path;
        checkbox.dataset.type = item.type;
        checkbox.dataset.label = item.label;
        checkbox.checked = item.defaultChecked;

        const textContainer = document.createElement('div');
        textContainer.innerHTML = `<span class="font-semibold text-sm text-[#4dd0d0]">${item.label}</span><p class="text-xs text-gray-400 mt-1">${item.description}</p>`;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(textContainer);
        fileOptionsContainer.appendChild(wrapper);
    });
}

function clearTargetSelection() {
    prefsState.selectedTargets.clear();
}

function toggleTarget(accountName, characterId, checked) {
    const key = accountName;
    if (!prefsState.selectedTargets.has(key)) {
        prefsState.selectedTargets.set(key, new Set());
    }
    const set = prefsState.selectedTargets.get(key);
    if (checked) {
        set.add(characterId);
    } else {
        set.delete(characterId);
        if (!set.size) {
            prefsState.selectedTargets.delete(key);
        }
    }
}

function isSourceCharacter(accountName, characterId) {
    if (!prefsState.selectedSource) return false;
    return prefsState.selectedSource.accountName === accountName && Number(prefsState.selectedSource.characterId) === Number(characterId);
}

function renderTargets() {
    targetsContainer.innerHTML = '';
    if (!appSettings.accounts.length) {
        const empty = document.createElement('p');
        empty.className = 'text-gray-400 text-sm';
        empty.textContent = 'No characters found. Configure accounts on the launcher page first.';
        targetsContainer.appendChild(empty);
        return;
    }

    const sortedAccounts = [...appSettings.accounts].sort((a, b) => a.name.localeCompare(b.name));

    sortedAccounts.forEach(account => {
        const card = document.createElement('div');
        card.className = 'account-card';

        const header = document.createElement('div');
        header.className = 'flex justify-between items-center mb-2';
        header.innerHTML = `<h3 class="text-lg font-semibold text-blue-200">${account.name}</h3>`;

        const actions = document.createElement('div');
        actions.className = 'space-x-2';
        const selectAccountBtn = document.createElement('button');
        selectAccountBtn.className = 'text-xs py-1 px-3 rounded';
        selectAccountBtn.textContent = 'Select Account';
        selectAccountBtn.onclick = () => {
            if (!Array.isArray(account.characters)) return;
            account.characters.forEach(char => {
                if (isSourceCharacter(account.name, char.id)) return;
                toggleTarget(account.name, char.id, true);
            });
            renderTargets();
        };
        const clearAccountBtn = document.createElement('button');
        clearAccountBtn.className = 'text-xs py-1 px-3 rounded';
        clearAccountBtn.textContent = 'Clear Account';
        clearAccountBtn.onclick = () => {
            prefsState.selectedTargets.delete(account.name);
            renderTargets();
        };
        actions.appendChild(selectAccountBtn);
        actions.appendChild(clearAccountBtn);
        header.appendChild(actions);
        card.appendChild(header);

        const list = document.createElement('div');
        list.className = 'space-y-2';
        const chars = Array.isArray(account.characters) ? [...account.characters] : [];
        chars.sort((a, b) => a.name.localeCompare(b.name));
        chars.forEach(char => {
            const isSource = isSourceCharacter(account.name, char.id);
            const row = document.createElement('label');
            row.className = `flex items-center space-x-3 bg-[#0d1a1a] border border-[#1a4d4d] rounded px-3 py-2 ${isSource ? 'opacity-50 cursor-not-allowed' : 'hover:border-[#2a5d5d]'}`;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'accent-[#4dd0d0]';
            checkbox.disabled = isSource;
            checkbox.checked = prefsState.selectedTargets.has(account.name) && prefsState.selectedTargets.get(account.name).has(char.id);
            checkbox.onchange = () => {
                toggleTarget(account.name, char.id, checkbox.checked);
            };

            const label = document.createElement('span');
            label.className = 'text-sm text-gray-100';
            label.textContent = `${char.name} (ID: ${char.id})`;

            row.appendChild(checkbox);
            row.appendChild(label);
            list.appendChild(row);
        });

        card.appendChild(list);
        targetsContainer.appendChild(card);
    });
}

function handleSourceChange() {
    const value = sourceSelect.value;
    if (!value) {
        prefsState.selectedSource = null;
        renderTargets();
        return;
    }
    prefsState.selectedSource = JSON.parse(value);
    const sourceAccount = prefsState.selectedSource.accountName;
    const sourceId = Number(prefsState.selectedSource.characterId);
    const currentSelection = prefsState.selectedTargets.get(sourceAccount);
    if (currentSelection && currentSelection.has(sourceId)) {
        currentSelection.delete(sourceId);
        if (!currentSelection.size) {
            prefsState.selectedTargets.delete(sourceAccount);
        }
    }
    renderTargets();
}

function selectAllTargets() {
    clearTargetSelection();
    appSettings.accounts.forEach(account => {
        if (!Array.isArray(account.characters)) return;
        account.characters.forEach(char => {
            if (isSourceCharacter(account.name, char.id)) return;
            toggleTarget(account.name, char.id, true);
        });
    });
    renderTargets();
}

function clearAllTargets() {
    clearTargetSelection();
    renderTargets();
}

async function copyPreferences(makeBackup = false) {
    hideMessage();

    const prefsRoot = prefsRootInput.value.trim();
    if (!prefsRoot) {
        showMessage('Please provide the path to your Prefs directory.', 'warning');
        return;
    }

    if (!prefsState.selectedSource) {
        showMessage('Select a source character before copying preferences.', 'warning');
        return;
    }

    const selectedItems = Array.from(document.querySelectorAll('.pref-item-checkbox:checked')).map(input => ({
        id: input.dataset.itemId,
        label: input.dataset.label,
        path: input.dataset.path,
        type: input.dataset.type
    }));

    if (!selectedItems.length) {
        showMessage('Choose at least one file or folder to copy.', 'warning');
        return;
    }

    const targets = [];
    prefsState.selectedTargets.forEach((charIds, accountName) => {
        charIds.forEach(charId => {
            targets.push({ accountName, characterId: charId });
        });
    });

    if (!targets.length) {
        showMessage('Select at least one target character.', 'warning');
        return;
    }

    appSettings.prefsRoot = prefsRoot;
    saveSettingsToLocalStorage();

    const payload = {
        prefsRoot,
        source: prefsState.selectedSource,
        targets,
        items: selectedItems,
        makeBackup
    };

    showMessage(makeBackup ? 'Copying preferences with backups…' : 'Copying preferences…', 'info');

    try {
        const response = await fetch('/api/copy_preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            showMessage(result.message || 'Copy failed due to server error.', 'error');
            return;
        }

        let message = result.message || 'Copy completed.';
        if (result.results && result.results.length) {
            const successCount = result.results.filter(r => !(r.errors && r.errors.length)).length;
            message += ` Success for ${successCount}/${result.results.length} targets.`;
        }

        const type = result.status === 'success' ? 'success' : result.status === 'partial_success' ? 'warning' : 'info';
        showMessage(message, type);
    } catch (err) {
        console.error('Copy request failed', err);
        showMessage('Failed to contact the backend. Is the Python server running?', 'error');
    }
}

loadSettingsFromLocalStorage();
prefsRootInput.value = appSettings.prefsRoot || '';
populateSourceDropdown();
renderFileOptions();
renderTargets();

prefsRootInput.addEventListener('input', () => {
    appSettings.prefsRoot = prefsRootInput.value;
    saveSettingsToLocalStorage();
});

sourceSelect.addEventListener('change', handleSourceChange);
selectAllBtn.addEventListener('click', selectAllTargets);
clearTargetsBtn.addEventListener('click', clearAllTargets);
copyBtn.addEventListener('click', () => copyPreferences(false));
copyWithBackupBtn.addEventListener('click', () => copyPreferences(true));

