# app.py
# This is the Python Flask backend server that will handle requests from the browser
# and execute the local terminal commands.

import subprocess
import os
import logging
import platform
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

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

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
    logger.info(f"Characters to launch: {characters_to_launch}")

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

        logger.info(f"Executing command: {' '.join(command)}")
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

if __name__ == '__main__':
    # Run the Flask app on all interfaces so it's reachable externally.
    # Set debug=False for production and secure your app appropriately.
    app.run(host='0.0.0.0', port=5000, debug=True)
