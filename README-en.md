# Wplace.live Map Capturer

> 🇨🇳 [中文说明请点这里](./README.md)

An advanced area capture and template management tool for [wplace.live](https://wplace.live).

## Features

- Area capture: Capture any region on the wplace.live map by entering coordinates or pasting share links

- Multi-block merging: Merge multiple map tiles into a single large image
  
- Template management: Save commonly used regions as templates for quick one-click capture or scheduled backups
  
- Scheduled tasks: Automatically download all selected templates at custom intervals, with support for subfolders
    
- Action log: All actions and errors are logged in a built-in log view for reference and troubleshooting
  
- Error highlighting: Missing or failed tiles are highlighted in the output image, and detailed logs are recorded

![Snipaste_2025-10-06_15-14-15](./Snipaste_2025-10-06_15-18-58.png)

## Installation

1. Download and unzip the repository.
2. Open Chrome/Edge/Brave/Firefox and go to `chrome://extensions/` (or `about:addons` in Firefox).
3. Enable "Developer mode" (or "Debug mode" in Firefox).
4. Click "Load unpacked" and select the project folder (in Firefox, use [this guide](https://extensionworkshop.com/documentation/develop/temporary-install-a-debug-addon/)).
5. Visit [wplace.live](https://wplace.live/) to use the extension.

## Browser Compatibility

- Chrome/Edge/Brave: Support silent batch download and subfolders (as long as "Ask where to save each file" is **disabled** in browser settings).
- Firefox: Only supports flat filename, every download triggers the save dialog (subfolders and silent mode are not supported due to browser limitations).
- If you get repeated save dialogs, check your browser's download settings.

## Support & Feedback

If you have questions, suggestions, or want to contribute, please open an [Issue](https://github.com/Beibeisheep/Wplace-Map-Capturer/issues) or submit a Pull Request
