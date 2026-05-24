import { app, BrowserWindow, shell, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc/handlers'
import { initDatabase } from './db'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1a1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // Allow loading local file:// images
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function buildMenu(mainWindow: BrowserWindow): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Veloce',
      submenu: [
        { label: 'About Veloce', role: 'about' },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => {
          mainWindow.webContents.send('open-preferences')
        }},
        { type: 'separator' },
        { label: 'Quit', role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'Open Folder...', accelerator: 'CmdOrCtrl+O', click: async () => {
          const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
          })
          if (!result.canceled && result.filePaths[0]) {
            mainWindow.webContents.send('open-folder', result.filePaths[0])
          }
        }},
        { type: 'separator' },
        { label: 'Show in Finder', accelerator: 'CmdOrCtrl+R', click: () => {
          mainWindow.webContents.send('show-in-finder')
        }}
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Contact Sheet', accelerator: 'CmdOrCtrl+1', click: () => {
          mainWindow.webContents.send('set-view', 'contact-sheet')
        }},
        { label: 'Loupe', accelerator: 'CmdOrCtrl+2', click: () => {
          mainWindow.webContents.send('set-view', 'loupe')
        }},
        { type: 'separator' },
        { label: 'Larger Thumbnails', accelerator: 'CmdOrCtrl+Plus', click: () => {
          mainWindow.webContents.send('zoom-thumbnails', 1)
        }},
        { label: 'Smaller Thumbnails', accelerator: 'CmdOrCtrl+-', click: () => {
          mainWindow.webContents.send('zoom-thumbnails', -1)
        }},
        { type: 'separator' },
        { label: 'Toggle Metadata Panel', accelerator: 'CmdOrCtrl+M', click: () => {
          mainWindow.webContents.send('toggle-panel', 'metadata')
        }},
        { label: 'Toggle AI Panel', accelerator: 'CmdOrCtrl+I', click: () => {
          mainWindow.webContents.send('toggle-panel', 'ai')
        }},
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Photo',
      submenu: [
        { label: 'Pick', accelerator: 'P', click: () => {
          mainWindow.webContents.send('photo-action', 'pick')
        }},
        { label: 'Reject', accelerator: 'X', click: () => {
          mainWindow.webContents.send('photo-action', 'reject')
        }},
        { label: 'Unflag', accelerator: 'U', click: () => {
          mainWindow.webContents.send('photo-action', 'unflag')
        }},
        { type: 'separator' },
        { label: '1 Star', accelerator: '1', click: () => {
          mainWindow.webContents.send('photo-action', 'rate-1')
        }},
        { label: '2 Stars', accelerator: '2', click: () => {
          mainWindow.webContents.send('photo-action', 'rate-2')
        }},
        { label: '3 Stars', accelerator: '3', click: () => {
          mainWindow.webContents.send('photo-action', 'rate-3')
        }},
        { label: '4 Stars', accelerator: '4', click: () => {
          mainWindow.webContents.send('photo-action', 'rate-4')
        }},
        { label: '5 Stars', accelerator: '5', click: () => {
          mainWindow.webContents.send('photo-action', 'rate-5')
        }},
        { label: 'Remove Rating', accelerator: '0', click: () => {
          mainWindow.webContents.send('photo-action', 'rate-0')
        }}
      ]
    },
    {
      label: 'AI',
      submenu: [
        { label: 'Analyze Selected Photos', accelerator: 'CmdOrCtrl+Shift+A', click: () => {
          mainWindow.webContents.send('ai-action', 'analyze-selected')
        }},
        { label: 'Analyze All Photos', click: () => {
          mainWindow.webContents.send('ai-action', 'analyze-all')
        }},
        { label: 'Auto-Apply AI Recommendations', click: () => {
          mainWindow.webContents.send('ai-action', 'auto-apply')
        }}
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Select All Photos', accelerator: 'CmdOrCtrl+A', click: () => {
          mainWindow.webContents.send('select-all')
        }}
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.veloce.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDatabase()
  registerAllHandlers(ipcMain)

  const mainWindow = createWindow()
  buildMenu(mainWindow)

  // Auto-open folder from CLI arg or env var (useful for testing)
  const autoFolder = process.argv.find(a => a.startsWith('--folder='))?.slice(9) || process.env.VELOCE_OPEN_FOLDER
  if (autoFolder) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => mainWindow.webContents.send('open-folder', autoFolder), 500)
    })
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
