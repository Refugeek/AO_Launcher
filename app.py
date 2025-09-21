# app.py
# This is the Python Flask backend server that will handle requests from the browser
# and execute the local terminal commands.

import subprocess
import os
import logging
import platform
import shutil
from datetime import datetime
from glob import glob

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS # Required for cross-origin requests if you run frontend from different origin

# Platform-specific imports for window management
if platform.system() == 'Windows':
    import win32gui
    import win32con
    import win32api

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
# Enable CORS for development. In a production scenario, you might want to restrict this.
CORS(app)

PREFERENCE_ITEMS = {
    "charCfg": {"label": "Char.cfg", "path": "Char.cfg", "type": "file"},
    "prefsXml": {"label": "Prefs.xml", "path": "Prefs.xml", "type": "file"},
    "chatFolder": {"label": "Chat folder", "path": "Chat", "type": "folder"},
    "containersBank": {"label": "Containers/Bank.xml", "path": os.path.join("Containers", "Bank.xml"), "type": "file"},
    "containersInventory": {"label": "Containers/Inventory.xml", "path": os.path.join("Containers", "Inventory.xml"), "type": "file"},
    "containersShortcutBars": {
        "label": "Containers/ShortcutBar*.xml",
        "path": os.path.join("Containers", "ShortcutBar*.xml"),
        "type": "glob"
    },
    "dockAreasLayouts": {
        "label": "DockAreas/DockArea*.xml",
        "path": os.path.join("DockAreas", "DockArea*.xml"),
        "type": "glob"
    },
    "dockAreasMap": {
        "label": "DockAreas/PlanetMapViewConfig.xml",
        "path": os.path.join("DockAreas", "PlanetMapViewConfig.xml"),
        "type": "file"
    },
    "dockAreasRollup": {
        "label": "DockAreas/RollupArea.xml",
        "path": os.path.join("DockAreas", "RollupArea.xml"),
        "type": "file"
    },
    "disabledTips": {"label": "DisabledTipsMap.xml", "path": "DisabledTipsMap.xml", "type": "file"},
    "iconPositionsBin": {"label": "IconPositions.bin", "path": "IconPositions.bin", "type": "file"},
    "ignoreListBin": {"label": "IgnoreList.bin", "path": "IgnoreList.bin", "type": "file"},
    "referencesBin": {"label": "References.bin", "path": "References.bin", "type": "file"},
    "textMacroBin": {"label": "TextMacro.bin", "path": "TextMacro.bin", "type": "file"}
}


def _ensure_char_folder_name(character_id: str) -> str:
    """Return the directory name for a character ID (ensure it is prefixed with 'Char')."""
    char_str = str(character_id)
    if char_str.lower().startswith("char"):
        return char_str
    return f"Char{char_str}"


def _get_character_prefs_path(base_path: str, account_name: str, character_id: str) -> str:
    """Build the absolute path to a character's preference directory."""
    if not base_path or not account_name or character_id is None:
        return ""
    folder_name = _ensure_char_folder_name(character_id)
    return os.path.join(base_path, account_name, folder_name)


def _backup_preference_item(target_dir: str, backup_root: str, item_def: dict) -> bool:
    """Create a backup copy of the requested item if it exists in the target directory."""
    if not backup_root:
        return False

    os.makedirs(backup_root, exist_ok=True)

    if item_def["type"] == "file":
        source_path = os.path.join(target_dir, item_def["path"])
        if os.path.isfile(source_path):
            backup_path = os.path.join(backup_root, item_def["path"])
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            shutil.copy2(source_path, backup_path)
            return True
        return False

    if item_def["type"] == "folder":
        source_dir = os.path.join(target_dir, item_def["path"])
        if os.path.isdir(source_dir):
            backup_dir = os.path.join(backup_root, item_def["path"])
            if os.path.isdir(backup_dir):
                shutil.rmtree(backup_dir)
            shutil.copytree(source_dir, backup_dir)
            return True
        return False

    if item_def["type"] == "glob":
        pattern = os.path.join(target_dir, item_def["path"])
        matches = [match for match in glob(pattern, recursive=True) if os.path.isfile(match)]
        copied_any = False
        for match in matches:
            relative = os.path.relpath(match, target_dir)
            backup_path = os.path.join(backup_root, relative)
            os.makedirs(os.path.dirname(backup_path), exist_ok=True)
            shutil.copy2(match, backup_path)
            copied_any = True
        return copied_any

    return False


def _copy_preference_item(source_dir: str, target_dir: str, item_def: dict):
    """Copy a single preference item from source to target. Returns (copied_paths, missing_paths)."""
    copied_paths = []
    missing_paths = []

    if item_def["type"] == "file":
        source_path = os.path.join(source_dir, item_def["path"])
        if os.path.isfile(source_path):
            dest_path = os.path.join(target_dir, item_def["path"])
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(source_path, dest_path)
            copied_paths.append(item_def["path"])
        else:
            missing_paths.append(item_def["path"])
        return copied_paths, missing_paths

    if item_def["type"] == "folder":
        source_path = os.path.join(source_dir, item_def["path"])
        if os.path.isdir(source_path):
            dest_path = os.path.join(target_dir, item_def["path"])
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            if os.path.isdir(dest_path):
                shutil.rmtree(dest_path)
            shutil.copytree(source_path, dest_path)
            copied_paths.append(item_def["path"])
        else:
            missing_paths.append(item_def["path"])
        return copied_paths, missing_paths

    if item_def["type"] == "glob":
        pattern = os.path.join(source_dir, item_def["path"])
        matches = [match for match in glob(pattern, recursive=True) if os.path.isfile(match)]
        if not matches:
            missing_paths.append(item_def["path"])
            return copied_paths, missing_paths

        for match in matches:
            relative = os.path.relpath(match, source_dir)
            dest_path = os.path.join(target_dir, relative)
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            shutil.copy2(match, dest_path)
            copied_paths.append(relative)

        return copied_paths, missing_paths

    missing_paths.append(item_def.get("path", "unknown"))
    return copied_paths, missing_paths

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')


@app.route('/preferences')
def preferences():
    """Serves the character preferences management page."""
    return render_template('preferences.html')

@app.route('/check_and_focus_window', methods=['POST'])
def check_and_focus_window():
    """
    Checks if a window with the title "Anarchy Online - <character>" is running
    for any character on the same account as the ones being launched.
    Returns detailed information about conflicts per character/account.
    """
    data = request.json
    all_accounts = data.get('allAccounts', [])
    selected_accounts = data.get('selectedAccounts', [])
    
    if not all_accounts or not selected_accounts:
        logger.error("No account data provided for checking")
        return jsonify({
            "status": "error",
            "message": "No account data provided",
            "conflicts": []
        }), 400
    
    if platform.system() != 'Windows':
        logger.warning("Window checking is only supported on Windows")
        return jsonify({
            "status": "unsupported",
            "message": "Window checking is only supported on Windows",
            "conflicts": []
        }), 200
    
    try:
        # Build a complete map of all character names to their account names
        char_to_account_map = {}  # Map character names to account names
        
        for account in all_accounts:
            acc_name = account.get('accountName', '')
            characters = account.get('characters', [])
            
            for char in characters:
                char_name = char.get('characterName', '')
                if acc_name and char_name:
                    char_to_account_map[char_name.lower()] = acc_name
        
        logger.info(f"Built character map with {len(char_to_account_map)} characters")
        logger.info(f"Checking for conflicts with selected accounts: {selected_accounts}")
        
        # Find all windows with "Anarchy Online - " prefix
        def enum_windows_callback(hwnd, windows_info):
            if win32gui.IsWindowVisible(hwnd):
                window_text = win32gui.GetWindowText(hwnd)
                if window_text.startswith("Anarchy Online - "):
                    # Extract character name from window title
                    character_name = window_text[len("Anarchy Online - "):]
                    windows_info.append(character_name)
            return True
        
        running_characters = []
        win32gui.EnumWindows(enum_windows_callback, running_characters)
        
        logger.info(f"Found {len(running_characters)} Anarchy Online window(s)")
        
        # Track conflicts per account
        conflicts = []
        conflicted_accounts = set()
        
        # Check each running character
        for running_char_name in running_characters:
            logger.info(f"Found running character: {running_char_name}")
            
            # Check if we can identify which account this character belongs to
            if running_char_name.lower() in char_to_account_map:
                acc_name = char_to_account_map[running_char_name.lower()]
                logger.info(f"Character '{running_char_name}' belongs to account '{acc_name}'")
                
                # Check if this account is one of the selected accounts
                if acc_name in selected_accounts:
                    conflicted_accounts.add(acc_name)
                    conflicts.append({
                        'account': acc_name,
                        'character': running_char_name,
                        'type': 'account_conflict',
                        'message': f"Character '{running_char_name}' from account '{acc_name}' is already running"
                    })
            else:
                # Unknown character - we can't determine the account
                logger.info(f"Found unknown character '{running_char_name}' - cannot determine account")
        
        # Build the response
        if conflicts:
            return jsonify({
                "status": "conflicts_found",
                "message": f"Found conflicts for {len(conflicted_accounts)} account(s)",
                "conflicts": conflicts,
                "conflictedAccounts": list(conflicted_accounts),
                "runningCharacters": running_characters
            }), 200
        else:
            # No conflicts found - safe to launch
            # We don't care about unknown characters since they can't be from our accounts
            logger.info(f"No conflicts found. {len(running_characters)} running character(s) detected but none conflict with selected accounts")
            return jsonify({
                "status": "no_conflicts",
                "message": "No conflicts detected - safe to launch",
                "conflicts": [],
                "conflictedAccounts": [],
                "runningCharacters": running_characters
            }), 200
            
    except Exception as e:
        logger.error(f"Error checking windows: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Error checking windows: {str(e)}",
            "conflicts": [],
            "conflictedAccounts": [],
            "runningCharacters": []
        }), 500

@app.route('/launch', methods=['POST'])
def launch_game():
    """
    Handles the POST request to launch the game.
    It receives the game and DLL paths, and a list of characters to launch.
    """
    data = request.json
    game_folder = data.get('gameFolder')
    dll_folder = data.get('dllFolder')
    characters_to_launch = data.get('characters')

    logger.info(f"Launch request received - Game folder: {game_folder}, DLL folder: {dll_folder}")
    # Do NOT log plaintext passwords. Log only non-sensitive metadata about characters.
    try:
        safe_chars = [{'accountName': c.get('accountName'), 'characterId': c.get('characterId')} for c in (characters_to_launch or [])]
    except Exception:
        safe_chars = 'unavailable'
    logger.info(f"Characters to launch (passwords redacted): {safe_chars}")

    if not game_folder or not dll_folder or not characters_to_launch:
        logger.error("Missing required data in launch request")
        return jsonify({"status": "error", "message": "Missing required data."}), 400

    # Construct the full path to the AOQuickLauncher.dll
    dll_path = os.path.join(dll_folder, "AOQuickLauncher.dll")

    # Check if the DLL exists (optional but good practice)
    if not os.path.exists(dll_path):
        logger.error(f"DLL not found at: {dll_path}")
        return jsonify({"status": "error", "message": f"DLL not found at: {dll_path}"}), 404

    # Check if the game folder exists
    if not os.path.exists(game_folder):
        logger.error(f"Game folder not found at: {game_folder}")
        return jsonify({"status": "error", "message": f"Game folder not found at: {game_folder}"}), 404

    launched_processes = []
    errors = []

    # Set up environment variables - AOPath is required by the launcher
    env = os.environ.copy()
    env['AOPath'] = game_folder
    logger.info(f"Setting AOPath environment variable to: {game_folder}")

    for char_info in characters_to_launch:
        acc_name = char_info.get('accountName')
        password = char_info.get('password')
        char_id = char_info.get('characterId')

        if not all([acc_name, password, char_id]):
            errors.append(f"Incomplete character data for launch: {char_info}")
            continue

        # Construct the command.
        # It's crucial to properly quote arguments, especially paths with spaces.
        # We use 'dotnet' as the executable, and then the DLL path as the first argument,
        # followed by the game-specific arguments.
        command = [
            "dotnet",
            dll_path,
            acc_name,
            password,
            str(char_id) # Ensure character ID is a string
        ]

        # Avoid logging plaintext passwords. Redact the password argument for safety.
        try:
            redacted_command = list(command)
            # Expecting structure: [exe, dll_path, acc_name, password, char_id]
            if len(redacted_command) > 3:
                redacted_command[3] = '***REDACTED***'
        except Exception:
            redacted_command = ['[redacted]']

        logger.info(f"Executing command: {' '.join(redacted_command)}")
        logger.info(f"Working directory: {dll_folder}")

        try:
            # Use subprocess.Popen to run the command without waiting for it to finish.
            # This allows the server to respond immediately while the game launches.
            # cwd (current working directory) is set to the DLL folder as that's where the launcher is.
            # The AOPath environment variable tells the launcher where the game is installed.
            process = subprocess.Popen(command,
                                       cwd=dll_folder,  # Changed to dll_folder
                                       env=env,  # Pass the environment with AOPath
                                       stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE,
                                       creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0)
            
            # Try to read initial output to catch immediate errors
            # Wait a short time to see if the process fails immediately
            try:
                stdout, stderr = process.communicate(timeout=0.5)
                if process.returncode is not None and process.returncode != 0:
                    error_msg = stderr.decode('utf-8', errors='ignore') if stderr else 'Unknown error'
                    errors.append(f"Failed to launch {acc_name}/{char_id}: Process exited with code {process.returncode}. Error: {error_msg}")
                    continue
            except subprocess.TimeoutExpired:
                # This is expected - the process should continue running
                pass
            
            launched_processes.append(f"Launched {acc_name}/{char_id} (PID: {process.pid})")
            logger.info(f"Successfully launched {acc_name}/{char_id} with PID: {process.pid}")
        except Exception as e:
            error_msg = f"Failed to launch {acc_name}/{char_id}: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg, exc_info=True)

    if errors:
        logger.warning(f"Partial success - Launched: {len(launched_processes)}, Errors: {len(errors)}")
        return jsonify({
            "status": "partial_success",
            "message": "Some launches failed.",
            "launched": launched_processes,
            "errors": errors
        }), 200
    else:
        logger.info(f"All {len(launched_processes)} characters launched successfully!")
        return jsonify({
            "status": "success",
            "message": "All selected characters launched successfully!",
            "launched": launched_processes
        }), 200

@app.route('/focus_launcher_window', methods=['POST'])
def focus_launcher_window():
    """
    Focuses the "Knows Modded AO#" window after launching characters.
    """
    window_title = "Knows Modded AO#"
    
    if platform.system() != 'Windows':
        logger.warning("Window focusing is only supported on Windows")
        return jsonify({
            "status": "unsupported",
            "message": "Window focusing is only supported on Windows"
        }), 200
    
    try:
        # Find window by title
        def enum_windows_callback(hwnd, windows):
            if win32gui.IsWindowVisible(hwnd):
                window_text = win32gui.GetWindowText(hwnd)
                if window_text == window_title:
                    windows.append(hwnd)
            return True
        
        windows = []
        win32gui.EnumWindows(enum_windows_callback, windows)
        
        if windows:
            # Window found - bring it to foreground
            hwnd = windows[0]  # Take the first matching window
            
            try:
                # Show window if minimized
                if win32gui.IsIconic(hwnd):
                    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                
                # Bring window to foreground
                win32gui.SetForegroundWindow(hwnd)
            except Exception as e:
                logger.warning(f"Could not focus launcher window: {str(e)}")
                # Continue - this is not a critical error
                return jsonify({
                    "status": "partial_success",
                    "message": f"Found launcher window but could not focus it: {str(e)}"
                }), 200
            
            logger.info(f"Found and focused launcher window: {window_title}")
            return jsonify({
                "status": "success",
                "message": f"Launcher window '{window_title}' brought to foreground"
            }), 200
        else:
            logger.info(f"Launcher window not found: {window_title}")
            return jsonify({
                "status": "not_found",
                "message": f"Launcher window '{window_title}' not found"
            }), 200
            
    except Exception as e:
        logger.error(f"Error focusing launcher window: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Error focusing window: {str(e)}"
        }), 500

@app.route('/close_running_instances', methods=['POST'])
def close_running_instances():
    """
    Closes running game instances for selected accounts by sending Alt+F4 twice.
    """
    data = request.json
    selected_accounts = data.get('selectedAccounts', [])
    all_accounts = data.get('allAccounts', [])
    
    if not selected_accounts or not all_accounts:
        return jsonify({
            "status": "error",
            "message": "No accounts specified"
        }), 400
    
    if platform.system() != 'Windows':
        return jsonify({
            "status": "unsupported",
            "message": "Window management is only supported on Windows"
        }), 200
    
    try:
        # Build a map of character names to accounts
        char_to_account = {}
        for acc_name in selected_accounts:
            for account in all_accounts:
                if account['accountName'] == acc_name:
                    for char in account['characters']:
                        char_to_account[char['characterName'].lower()] = acc_name
                    break

        # Find windows for selected accounts
        windows_to_close = {}
        def enum_windows_callback(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                window_text = win32gui.GetWindowText(hwnd)
                if window_text.startswith("Anarchy Online - "):
                    char_name = window_text[len("Anarchy Online - "):]
                    acc_name = char_to_account.get(char_name.lower())
                    if acc_name in selected_accounts:
                        windows_to_close[hwnd] = char_name
                        logger.info(f"Will close window for character {char_name} (account: {acc_name})")
            return True

        win32gui.EnumWindows(enum_windows_callback, None)
        
        closed_count = 0
        for hwnd, char_name in windows_to_close.items():
            # Send WM_CLOSE message twice with a small delay
            win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
            win32api.Sleep(100)  # Small delay between messages
            win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
            closed_count += 1
            logger.info(f"Sent close messages to window for character: {char_name}")
        
        return jsonify({
            "status": "success",
            "message": f"Closed {closed_count} game instances"
        }), 200
        
    except Exception as e:
        logger.error(f"Error closing game instances: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": f"Error closing game instances: {str(e)}"
        }), 500


@app.route('/copy_preferences', methods=['POST'])
def copy_preferences():
    """Copy selected preference files from a source character to one or more targets."""
    if platform.system() != 'Windows':
        logger.warning("Preference copying requested on unsupported platform")
        return jsonify({
            "status": "unsupported",
            "message": "Character preference copying is only supported on Windows"
        }), 200

    data = request.json or {}

    base_path = (data.get('prefsBasePath') or '').strip()
    source_info = data.get('source') or {}
    targets_info = data.get('targets') or []
    requested_items = data.get('items') or []
    create_backup = bool(data.get('createBackup'))

    if not base_path:
        return jsonify({
            "status": "error",
            "message": "Preference base path is required"
        }), 400

    if not os.path.isdir(base_path):
        return jsonify({
            "status": "error",
            "message": f"Preference base path does not exist: {base_path}"
        }), 400

    source_account = (source_info.get('accountName') or '').strip()
    source_character_id = source_info.get('characterId')

    if not source_account or source_character_id is None or source_character_id == '':
        return jsonify({
            "status": "error",
            "message": "Source account and character must be specified"
        }), 400

    if not isinstance(targets_info, list) or len(targets_info) == 0:
        return jsonify({
            "status": "error",
            "message": "At least one target character must be selected"
        }), 400

    selected_items = []
    invalid_items = []
    for item_id in requested_items:
        item_def = PREFERENCE_ITEMS.get(item_id)
        if item_def:
            selected_items.append({**item_def, "id": item_id})
        else:
            invalid_items.append(item_id)

    if not selected_items:
        return jsonify({
            "status": "error",
            "message": "No valid preference items were requested for copying"
        }), 400

    source_dir = _get_character_prefs_path(base_path, source_account, source_character_id)
    if not source_dir or not os.path.isdir(source_dir):
        return jsonify({
            "status": "error",
            "message": f"Source character preferences not found at {source_dir or 'unknown path'}"
        }), 400

    logger.info(
        "Copying preferences from %s/%s to %d target(s) with items %s",
        source_account,
        source_character_id,
        len(targets_info),
        [item['id'] for item in selected_items]
    )

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results = []
    errors = []

    source_identifier = (source_account.lower(), str(source_character_id))

    for target in targets_info:
        target_account = (target.get('accountName') or '').strip()
        target_character_id = target.get('characterId')

        if not target_account or target_character_id is None or target_character_id == '':
            error_msg = "Target account and character must be provided"
            errors.append(error_msg)
            logger.error(error_msg)
            continue

        target_identifier = (target_account.lower(), str(target_character_id))
        if target_identifier == source_identifier:
            logger.info("Skipping target identical to source: %s/%s", target_account, target_character_id)
            continue

        target_dir = _get_character_prefs_path(base_path, target_account, target_character_id)
        if not target_dir:
            error_msg = f"Unable to determine target directory for {target_account}/{target_character_id}"
            errors.append(error_msg)
            logger.error(error_msg)
            continue

        os.makedirs(target_dir, exist_ok=True)

        backup_dir = None
        backed_up_items = []
        if create_backup:
            backup_dir = os.path.join(target_dir, f"backup_{timestamp}")
            for item in selected_items:
                try:
                    if _backup_preference_item(target_dir, backup_dir, item):
                        backed_up_items.append(item["label"])
                except Exception as backup_error:
                    logger.error(
                        "Failed to back up %s for %s/%s: %s",
                        item["label"],
                        target_account,
                        target_character_id,
                        backup_error,
                        exc_info=True
                    )
                    errors.append(
                        f"Backup failed for {target_account}/{target_character_id} item {item['label']}: {backup_error}"
                    )

        copied_details = []
        missing_details = []

        for item in selected_items:
            try:
                copied_paths, missing_paths = _copy_preference_item(source_dir, target_dir, item)
                if copied_paths:
                    copied_details.append({
                        "itemId": item["id"],
                        "label": item["label"],
                        "paths": copied_paths
                    })
                if missing_paths:
                    missing_details.append({
                        "itemId": item["id"],
                        "label": item["label"],
                        "paths": missing_paths
                    })
            except Exception as copy_error:
                logger.error(
                    "Failed to copy %s from %s/%s to %s/%s: %s",
                    item["label"],
                    source_account,
                    source_character_id,
                    target_account,
                    target_character_id,
                    copy_error,
                    exc_info=True
                )
                errors.append(
                    f"Copy failed for {target_account}/{target_character_id} item {item['label']}: {copy_error}"
                )

        results.append({
            "accountName": target_account,
            "characterId": str(target_character_id),
            "copied": copied_details,
            "missing": missing_details,
            "backupDirectory": backup_dir if backed_up_items else None,
            "backedUpItems": backed_up_items
        })

    if not results and errors:
        return jsonify({
            "status": "error",
            "message": "Preference copy failed for all targets",
            "errors": errors,
            "invalidItems": invalid_items
        }), 500

    status = "success" if not errors else "partial_success"
    message = f"Copied preferences to {len(results)} character(s)."
    if errors:
        message += " Some items encountered issues."

    return jsonify({
        "status": status,
        "message": message,
        "results": results,
        "errors": errors,
        "invalidItems": invalid_items
    }), 200


@app.route('/delete_shortcutbar_settings', methods=['POST'])
def delete_shortcutbar_settings():
    """Delete shortcutbar settings for selected characters."""
    if platform.system() != 'Windows':
        logger.warning("Shortcutbar deletion requested on unsupported platform")
        return jsonify({
            "status": "unsupported",
            "message": "Shortcutbar deletion is only supported on Windows"
        }), 200

    data = request.json or {}

    base_path = (data.get('prefsBasePath') or '').strip()
    targets_info = data.get('targets') or []
    create_backup = bool(data.get('createBackup'))

    if not base_path:
        return jsonify({
            "status": "error",
            "message": "Preference base path is required"
        }), 400

    if not os.path.isdir(base_path):
        return jsonify({
            "status": "error",
            "message": f"Preference base path does not exist: {base_path}"
        }), 400

    if not isinstance(targets_info, list) or len(targets_info) == 0:
        return jsonify({
            "status": "error",
            "message": "At least one character must be selected"
        }), 400

    logger.info(
        "Deleting shortcutbar settings for %d target(s)",
        len(targets_info)
    )

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    results = []
    errors = []

    for target in targets_info:
        target_account = (target.get('accountName') or '').strip()
        target_character_id = target.get('characterId')

        if not target_account or target_character_id is None or target_character_id == '':
            error_msg = "Target account and character must be provided"
            errors.append(error_msg)
            logger.error(error_msg)
            continue

        target_dir = _get_character_prefs_path(base_path, target_account, target_character_id)
        if not target_dir:
            error_msg = f"Unable to determine target directory for {target_account}/{target_character_id}"
            errors.append(error_msg)
            logger.error(error_msg)
            continue

        if not os.path.isdir(target_dir):
            error_msg = f"Target character preferences not found at {target_dir}"
            errors.append(error_msg)
            logger.error(error_msg)
            continue

        # Setup backup if requested
        backup_dir = None
        if create_backup:
            backup_root = os.path.join(
                target_dir,
                f"Backup_{timestamp}"
            )
            os.makedirs(backup_root, exist_ok=True)
            backup_dir = backup_root

        try:
            # Find all shortcutbar files
            shortcut_path_pattern = os.path.join(target_dir, "Containers", "ShortcutBar*.xml")
            shortcut_files = glob(shortcut_path_pattern)
            
            if not shortcut_files:
                logger.info(f"No shortcutbar files found for {target_account}/{target_character_id}")
                results.append({
                    "accountName": target_account,
                    "characterId": target_character_id,
                    "status": "success",
                    "message": "No shortcutbar files found"
                })
                continue
                
            for file_path in shortcut_files:
                # Backup file if requested
                if backup_dir:
                    rel_path = os.path.relpath(file_path, target_dir)
                    backup_path = os.path.join(backup_dir, rel_path)
                    os.makedirs(os.path.dirname(backup_path), exist_ok=True)
                    shutil.copy2(file_path, backup_path)
                    
                # Delete the file
                os.remove(file_path)
                
            results.append({
                "accountName": target_account,
                "characterId": target_character_id,
                "status": "success",
                "message": f"Deleted {len(shortcut_files)} shortcutbar files" + 
                          (f" with backup in {os.path.basename(backup_dir)}" if backup_dir else "")
            })
            
        except Exception as e:
            error_msg = f"Error deleting shortcutbar settings for {target_account}/{target_character_id}: {str(e)}"
            errors.append(error_msg)
            logger.exception(error_msg)
            results.append({
                "accountName": target_account,
                "characterId": target_character_id,
                "status": "error",
                "message": f"Error: {str(e)}"
            })

    status = "success"
    message = f"Successfully deleted shortcutbar settings for {len(results)} characters"
    
    if len(errors) > 0:
        status = "partial_success" if len(results) > 0 else "error"
        message = f"Encountered {len(errors)} errors while deleting shortcutbar settings"

    return jsonify({
        "status": status,
        "message": message,
        "results": results,
        "errors": errors
    })


if __name__ == '__main__':
    # Run the Flask app on all interfaces so it's reachable externally.
    # Set debug=False for production and secure your app appropriately.
    app.run(host='0.0.0.0', port=5000, debug=True)
