const { app, BrowserWindow, ipcMain, screen, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// 保持对窗口对象的全局引用，避免JavaScript对象被垃圾回收时窗口关闭
let mainWindow;
// 设置窗口的引用
let settingsWindow = null;
// 拖动状态标志
let isDragging = false;
// 鼠标在窗口内的偏移
let dragOffset = { x: 0, y: 0 };
// 托盘对象的引用
let tray = null;
// 用户设置
let userSettings = {};
// 设置文件路径
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// 添加后面要用到的导入和窗口引用
let modernSettingsWindow = null;

// 添加主页窗口引用
let homeWindow = null;

// 从配置文件加载设置
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (error) {
    console.error('加载设置时出错:', error);
  }
  
  // 返回默认设置
  return {
    autoStart: false,
    alwaysOnTop: true,
    clickThrough: false,
    notification: true,
    sound: true,
    volume: 50,
    theme: 'light',
    skin: '默认',
    position: { x: null, y: null }
  };
}

// 保存用户设置
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(userSettings, null, 2), 'utf8');
    // 应用设置到应用程序
    applySettings();
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

// 应用设置到应用程序
function applySettings() {
  if (!mainWindow) return;
  
  // 设置置顶状态
  mainWindow.setAlwaysOnTop(userSettings.alwaysOnTop);
  
  // 设置点击穿透
  if (userSettings.clickThrough) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
  
  // 设置开机自启动
  app.setLoginItemSettings({
    openAtLogin: userSettings.autoStart
  });
  
  // 通知渲染进程更新设置
  if (mainWindow.webContents) {
    mainWindow.webContents.send('settings-updated', userSettings);
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: 'rgba(0,0,0,0)',
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Windows 11特殊处理
  if (process.platform === 'win32') {
    mainWindow.setBackgroundColor('#00000000');
  }

  // 加载应用的index.html
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  
  // 开发环境下打开开发者工具
  // mainWindow.webContents.openDevTools();
  
  // 设置窗口始终在最上层
  mainWindow.setAlwaysOnTop(true);
  
  // 初始位置设置在右下角
  mainWindow.setPosition(width - 300, height - 300);

  // 替换为隐藏窗口而不是完全关闭
  mainWindow.on('close', function (event) {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });
  
  // 禁用窗口菜单
  mainWindow.setMenu(null);
  
  // 设置窗口为点击穿透 - 只在图像区域捕获点击
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  
  // 监听渲染进程的ready-to-show事件，用于首次加载后的设置
  mainWindow.webContents.on('did-finish-load', () => {
    // 短暂延时，确保所有元素已渲染
    setTimeout(() => {
      // 确保由渲染进程决定何时启用点击穿透
      mainWindow.webContents.send('initialize-interaction');
      // 应用用户设置
      applySettings();
    }, 500);
  });
  
  // 创建托盘图标
  createTray();
}

// 创建设置窗口
function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  
  // 获取主显示器尺寸
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // 固定窗口大小
  const windowWidth = 480;
  const windowHeight = 580;
  
  settingsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow,
    modal: false,
    frame: false,
    show: false,
    backgroundColor: '#f5f7fa',
    useContentSize: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: true
    },
    // 设置窗口样式，这样会使用系统默认的窗口拖动而不是自定义的
    titleBarStyle: 'hidden',
    // 在Windows上启用无边框窗口拖动
    titleBarOverlay: false
  });
  
  // 禁用窗口阴影以避免拖动时的闪烁
  settingsWindow.setHasShadow(false);
  
  // 居中显示
  settingsWindow.setBounds({
    x: Math.round(width / 2 - windowWidth / 2),
    y: Math.round(height / 2 - windowHeight / 2),
    width: windowWidth,
    height: windowHeight
  });
  
  settingsWindow.loadFile(path.join(__dirname, 'renderer/settings.html'));
  
  // 监听窗口准备就绪事件
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });
  
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// 添加创建现代设置窗口的函数
function createModernSettingsWindow() {
  if (modernSettingsWindow) {
    modernSettingsWindow.focus();
    return;
  }
  
  // 获取主显示器尺寸
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // 设置窗口宽高
  const windowWidth = 900;
  const windowHeight = 600;
  
  modernSettingsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 500,
    frame: false, // 无边框
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });
  
  // 窗口居中
  modernSettingsWindow.setPosition(
    Math.round(width / 2 - windowWidth / 2),
    Math.round(height / 2 - windowHeight / 2)
  );
  
  // 加载新界面
  modernSettingsWindow.loadFile(path.join(__dirname, 'renderer/modern-settings.html'));
  
  // 开发环境下打开开发者工具
  // modernSettingsWindow.webContents.openDevTools();
  
  modernSettingsWindow.on('closed', () => {
    modernSettingsWindow = null;
  });
}

// 在createModernSettingsWindow函数后添加创建主页窗口函数
function createHomeWindow() {
  if (homeWindow) {
    homeWindow.focus();
    return;
  }
  
  // 获取主显示器尺寸
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  // 设置窗口宽高
  const windowWidth = 900;
  const windowHeight = 600;
  
  homeWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    minWidth: 800,
    minHeight: 500,
    frame: false, // 无边框
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });
  
  // 窗口居中
  homeWindow.setPosition(
    Math.round(width / 2 - windowWidth / 2),
    Math.round(height / 2 - windowHeight / 2)
  );
  
  // 加载主页界面
  homeWindow.loadFile(path.join(__dirname, 'renderer/home.html'));
  
  // 开发环境下打开开发者工具
  // homeWindow.webContents.openDevTools();
  
  homeWindow.on('closed', () => {
    homeWindow = null;
  });
}

// 修改托盘菜单添加新设置界面选项
function createTray() {
  // 托盘图标路径，默认使用应用图标
  const iconPath = path.join(__dirname, '../assets/tray.png');
  
  // 创建托盘
  tray = new Tray(iconPath);
  tray.setToolTip('桌面宠物');
  
  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '主页', 
      click: () => {
        createHomeWindow();
      } 
    },
    { 
      label: '宠物管理', 
      click: () => {
        createModernSettingsWindow();
      } 
    },
    { 
      label: '设置', 
      click: () => {
        createSettingsWindow();
      } 
    },
    { 
      label: '显示/隐藏', 
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          // 如果窗口已被销毁，则重新创建
          createWindow();
          setTimeout(() => {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }
          }, 300);
        }
      } 
    },
    { type: 'separator' },
    { 
      label: '启用/禁用点击穿透', 
      click: () => {
        // 获取当前点击穿透状态
        const ignore = mainWindow.webContents.getLastWebPreferences().ignoreMouseEvents;
        // 切换点击穿透状态
        mainWindow.setIgnoreMouseEvents(!ignore, { forward: true });
        // 更新设置
        userSettings.clickThrough = !ignore;
        saveSettings();
        // 通知渲染进程更新交互状态
        mainWindow.webContents.send('update-interaction', !ignore);
      } 
    },
    { 
      label: '重置位置', 
      click: () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow.setPosition(width - 300, height - 300);
      } 
    },
    { 
      label: '重新加载', 
      click: () => {
        mainWindow.reload();
      } 
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: () => {
        app.isQuitting = true; // 设置退出标志
        app.quit();
      } 
    }
  ]);
  
  // 设置上下文菜单
  tray.setContextMenu(contextMenu);
  
  // 点击托盘图标打开主页窗口
  tray.on('click', () => {
    createHomeWindow();
  });
}

// 创建右键菜单
function createContextMenu() {
  return Menu.buildFromTemplate([
    { 
      label: '设置', 
      click: () => {
        createSettingsWindow();
      } 
    },
    { 
      label: '播放动画', 
      submenu: [
        { 
          label: '摇晃', 
          click: () => {
            mainWindow.webContents.send('play-animation', 'shake');
          } 
        },
        { 
          label: '弹跳', 
          click: () => {
            mainWindow.webContents.send('play-animation', 'bounce');
          } 
        },
        { 
          label: '翻转', 
          click: () => {
            mainWindow.webContents.send('play-animation', 'flip');
          } 
        },
        { 
          label: '特殊', 
          click: () => {
            mainWindow.webContents.send('play-animation', 'special');
          } 
        }
      ]
    },
    { type: 'separator' },
    { 
      label: '启用/禁用点击穿透', 
      click: () => {
        // 获取当前点击穿透状态
        const ignore = mainWindow.webContents.getLastWebPreferences().ignoreMouseEvents;
        // 切换点击穿透状态
        mainWindow.setIgnoreMouseEvents(!ignore, { forward: true });
        // 更新设置
        userSettings.clickThrough = !ignore;
        saveSettings();
        // 通知渲染进程更新交互状态
        mainWindow.webContents.send('update-interaction', !ignore);
      }
    },
    { 
      label: '重置位置', 
      click: () => {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        mainWindow.setPosition(width - 300, height - 300);
      } 
    },
    { 
      label: '隐藏', 
      click: () => {
        mainWindow.hide();
      } 
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: () => {
        app.isQuitting = true; // 设置退出标志
        app.quit();
      } 
    }
  ]);
}

// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  // 加载用户设置
  userSettings = loadSettings();
  // 创建主窗口
  createWindow();

  // 注册全局快捷键 Ctrl+Alt+P 显示/隐藏宠物
  globalShortcut.register('CommandOrControl+Alt+P', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });

  app.on('activate', function () {
    // 在macOS上，当dock图标被点击且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，用户通常希望应用在显式按下Cmd + Q前保持活动状态
  if (process.platform !== 'darwin') {
    app.isQuitting = true;
    app.quit();
  }
});

// 监听渲染进程请求暂时禁用点击穿透（用于拖动和交互）
ipcMain.on('set-ignore-mouse-events', (event, ignore) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// 监听拖动开始事件
ipcMain.on('drag-start', (event, { offsetX, offsetY }) => {
  isDragging = true;
  
  // 保存鼠标在窗口内的偏移位置
  dragOffset = { x: offsetX, y: offsetY };
  
  // 临时禁用点击穿透，允许拖动
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(false);
  }
});

// 监听拖动结束事件
ipcMain.on('drag-end', () => {
  isDragging = false;
  
  // 如果用户设置开启了点击穿透，则恢复点击穿透
  if (userSettings.clickThrough && mainWindow) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }
});

// 监听获取设置请求
ipcMain.on('get-settings', (event) => {
  event.reply('settings', userSettings);
});

// 监听保存设置请求
ipcMain.on('save-settings', (event, newSettings) => {
  userSettings = { ...userSettings, ...newSettings };
  saveSettings();
  event.reply('settings', userSettings);
});

// 监听重置设置请求
ipcMain.on('reset-settings', (event) => {
  userSettings = {
    autoStart: false,
    alwaysOnTop: true,
    clickThrough: false,
    notification: true,
    sound: true,
    volume: 50,
    theme: 'light',
    skin: '默认',
    position: { x: null, y: null }
  };
  saveSettings();
  event.reply('settings', userSettings);
});

// 监听关闭设置窗口请求
ipcMain.on('close-settings', () => {
  if (settingsWindow) {
    settingsWindow.close();
  }
});

// 监听绝对位置移动方法
ipcMain.on('move-pet-absolute', (event, { mouseX, mouseY }) => {
  if (mainWindow && isDragging) {
    // 直接将窗口位置设置为鼠标位置减去偏移量
    mainWindow.setPosition(Math.round(mouseX - dragOffset.x), Math.round(mouseY - dragOffset.y));
  }
});

// 显示上下文菜单
ipcMain.on('show-context-menu', (event) => {
  if (mainWindow) {
    // 临时禁用点击穿透，允许菜单交互
    mainWindow.setIgnoreMouseEvents(false);
    
    const menu = createContextMenu();
    menu.popup({ 
      window: mainWindow,
      callback: () => {
        // 菜单关闭后恢复点击穿透
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    });
  }
});

// 处理双击事件
ipcMain.on('pet-dblclick', () => {
  // 可以在这里处理双击事件，比如播放声音
  console.log('Pet was double clicked!');
});

// 监听设置窗口拖动请求
ipcMain.on('move-settings-window', (event, { mouseX, mouseY, startX, startY }) => {
  if (settingsWindow) {
    // 采用绝对位置计算，而不是相对移动
    settingsWindow.setBounds({
      x: mouseX - startX,
      y: mouseY - startY,
      width: settingsWindow.getBounds().width,
      height: settingsWindow.getBounds().height
    });
  }
});

// 添加以下IPC处理程序
// 窗口控制
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.minimize();
  }
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    // 如果是主窗口，隐藏它而不是关闭
    if (win === mainWindow) {
      win.hide();
    } else {
      // 其他窗口正常关闭
      win.close();
    }
  }
});

// 允许窗口拖动
ipcMain.on('allow-window-drag', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.setMovable(true);
  }
});

// 宠物数据处理
ipcMain.on('get-pet-list', (event) => {
  // 这里应该从数据源获取宠物列表
  const pets = [
    {
      id: 1,
      name: '自嘲熊',
      level: 5,
      mood: 'happy',
      skin: '默认'
    }
  ];
  event.reply('pet-list', pets);
});

ipcMain.on('pet-action', (event, data) => {
  // 处理宠物动作
  console.log(`宠物 ${data.name} 执行动作: ${data.action}`);
  // 在这里添加代码处理宠物动作
});

ipcMain.on('remove-pet', (event, petName) => {
  // 处理宠物删除
  console.log(`删除宠物: ${petName}`);
  // 在这里添加代码处理宠物删除
});

ipcMain.on('open-add-pet-dialog', (event) => {
  // 打开添加宠物对话框
  console.log('打开添加宠物对话框');
  // 在这里添加代码处理添加宠物
});

// 主题偏好处理
let themePreference = {
  darkMode: false
};

ipcMain.on('save-theme-preference', (event, darkMode) => {
  themePreference.darkMode = darkMode;
  // 在实际应用中应该保存到文件或数据库
});

ipcMain.on('get-theme-preference', (event) => {
  event.reply('theme-preference', themePreference.darkMode);
});

// 导航处理
ipcMain.on('navigate-to', (event, target) => {
  const currentWindow = BrowserWindow.fromWebContents(event.sender);
  
  if (currentWindow) {
    currentWindow.hide();
  }
  
  switch(target) {
    case 'home':
      createHomeWindow();
      break;
    case 'settings':
      createModernSettingsWindow();
      break;
    case 'pets':
      // 暂未实现
      createHomeWindow();
      break;
    case 'about':
      // 暂未实现
      createHomeWindow();
      break;
    default:
      createHomeWindow();
  }
});

// 宠物状态处理
ipcMain.on('get-pet-status', (event) => {
  // 模拟宠物数据，实际应用中应从数据库获取
  const status = {
    name: '自嘲熊',
    level: 5,
    exp: 75,
    maxExp: 100,
    mood: 'happy'
  };
  
  event.reply('pet-status', status);
});

// 监听宠物互动事件
ipcMain.on('pet-interaction', (event, action) => {
  console.log(`宠物互动: ${action}`);
  // 实际应用中这里会更新宠物状态并持久化
});

// 任务完成处理
ipcMain.on('task-completed', (event, data) => {
  console.log(`任务完成，获得 ${data.exp} 经验值`);
  // 实际应用中这里会更新宠物经验并持久化
});

// 应用即将退出时注销快捷键
app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll();
}); 