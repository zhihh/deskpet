// 引入electron模块
const { ipcRenderer } = require('electron');

// 窗口控制按钮
const minimizeBtn = document.getElementById('minimize-btn');
const maximizeBtn = document.getElementById('maximize-btn');
const closeBtn = document.getElementById('close-btn');

// 主题切换按钮
const themeToggle = document.getElementById('theme-toggle');

// 宠物操作元素
const petActionSelects = document.querySelectorAll('.pet-action-select');

// 窗口控制功能
if (minimizeBtn) {
  minimizeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
  });
}

if (maximizeBtn) {
  maximizeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-maximize');
  });
}

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    ipcRenderer.send('window-close');
  });
}

// 主题切换功能
let isDarkMode = false;
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
      document.body.classList.remove('dark-mode');
      themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
    // 保存主题设置
    ipcRenderer.send('save-theme-preference', isDarkMode);
  });
}

// 加载宠物数据
function loadPets() {
  ipcRenderer.send('get-pet-list');
}

// 监听主进程返回的宠物列表
ipcRenderer.on('pet-list', (event, pets) => {
  // 在实际应用中这里应该渲染宠物列表
  console.log('宠物列表:', pets);
});

// 处理宠物动作选择
petActionSelects.forEach(select => {
  select.addEventListener('change', (e) => {
    const action = e.target.value;
    const petCard = e.target.closest('.pet-card');
    const petName = petCard.querySelector('.pet-name').textContent;
    
    // 发送动作命令到主进程
    ipcRenderer.send('pet-action', { name: petName, action: action });
  });
});

// 侧边栏菜单项点击事件
const menuItems = document.querySelectorAll('.menu-item');
menuItems.forEach(item => {
  item.addEventListener('click', () => {
    // 移除之前的活动状态
    menuItems.forEach(i => i.classList.remove('active'));
    // 添加当前活动状态
    item.classList.add('active');
    
    // 可以根据点击的菜单项切换内容
    const index = Array.from(menuItems).indexOf(item);
    switch(index) {
      case 0: // 宠物管理
        // 当前页面
        break;
      case 1: // 主页
        ipcRenderer.send('navigate-to', 'home');
        break;
      case 2: // 设置
        ipcRenderer.send('navigate-to', 'settings');
        break;
      case 3: // 关于
        ipcRenderer.send('navigate-to', 'about');
        break;
    }
  });
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 加载宠物数据
  loadPets();
  
  // 加载主题偏好
  ipcRenderer.send('get-theme-preference');
});

// 接收主题偏好
ipcRenderer.on('theme-preference', (event, darkMode) => {
  if (darkMode) {
    isDarkMode = true;
    document.body.classList.add('dark-mode');
    if (themeToggle) {
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
  }
});

// 确保应用可拖动
document.addEventListener('mousedown', (e) => {
  // 排除按钮和交互元素
  if (!e.target.closest('button') && 
      !e.target.closest('select') && 
      !e.target.closest('input') &&
      !e.target.closest('.pet-card')) {
    // 通知主进程允许拖动
    ipcRenderer.send('allow-window-drag');
  }
}); 