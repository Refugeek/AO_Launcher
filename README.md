# AO Launcher

A vibecoded web-based launcher frontend for [AOQuickLauncher](https://gitlab.com/never-knows-best/aoquicklauncher) with some Anarchy Online window management capabilities.
Use at your own risk. Credentials are not securely stored (but neither are they if you use a AOQuickLauncher .bat file). 

## Features

- Launch multiple game instances with different characters
- Automatically check if the game is already running
- Bring existing game window to foreground (Windows only)
- Save and load launcher configurations
- Web-based interface accessible from any browser
- sets focus to "Knows Modded AO#" for injection after launching game clients

## Installation

1. Install Python 3.7 or higher

2. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

   **Note**: The `pywin32` package is required for window management on Windows. If you encounter installation issues, you can install it separately:
   ```bash
   pip install pywin32
   ```

3. Run the Flask server:
   ```bash
   python app.py
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Usage

1. Configure the game folder path (where Anarchy Online is installed)
2. Configure the DLL folder path (where AOQuickLauncher.dll is located)
3. Add your accounts and characters
4. Select characters to launch
5. Click "Launch Selected Characters"

If the game window "Knows Modded AO#" is already running, it will be brought to the foreground. Otherwise, new instances will be launched.

## Requirements

- Python 3.7+
- Flask
- Flask-CORS
- pywin32 (Windows only, for window management)
- .NET runtime (for running AOQuickLauncher.dll)

## Troubleshooting

### pywin32 Installation Issues

If you encounter issues installing pywin32, try:

1. Install using conda (if using Anaconda):
   ```bash
   conda install pywin32
   ```

2. Or download the appropriate wheel file from [PyPI](https://pypi.org/project/pywin32/#files) and install manually:
   ```bash
   pip install pywin32-306-cp39-cp39-win_amd64.whl
   ```
   (Replace with the appropriate version for your Python installation)

## Configuration

The launcher saves your configuration locally in the browser's localStorage. You can also:
- Export configuration to a JSON file
- Import configuration from a previously saved file