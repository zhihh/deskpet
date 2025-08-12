const { ipcRenderer, contextBridge, remote } = require('electron');

// 获取DOM元素
const pet = document.getElementById('pet');
const levelBadge = document.getElementById('level-badge');
const expBarContainer = document.getElementById('exp-bar-container');
const expBar = document.getElementById('exp-bar');
const expText = document.getElementById('exp-text');
const interactionButtons = document.getElementById('interaction-buttons');
const messagePopup = document.getElementById('message-popup');
const messageContent = document.querySelector('.message-content');
const closeMessage = document.querySelector('.close-message');
const expGain = document.getElementById('exp-gain');

// 状态变量
let isStatsVisible = false; // 跟踪等级和经验条是否可见

// 桌宠等级系统相关变量
let petData = {
  level: 1,
  exp: 0,
  expToNextLevel: 100,
  lastSignIn: null, // 最后签到日期
  totalInteractions: 0,
  quotesSeen: 0
};

// 名言集合
const quotes = [
  "人 累了就休息一会吧 熊抱抱你",
  "别人都是傻b，就我最聪明（读了一本哲学书之后）",
  "人，为什么一定要往高处走呢，人可以往四处走",
  "看起来5岁，脑袋也是5岁",
  "人 你幸福的话熊会比你先落泪",
  "人，快来给我讲个笑话",
  "人 不是一定要和别人玩才能让自己开心 许多事自己做的话也是很酷的 一个人看电影一个人旅游一个人吃饭都是可以的 熊会一直陪着你 人可以和熊分享你的生活",
  "尖叫！！，谁把熊吵醒了",
  "熊许愿幸福，于是熊来到人的身边。",
  "来财",
  "人，过来一下，不干什么，就过来一下",
  "人 熊不想让你难过 不要隐藏自己的泪水 它也是我们身体的一部分 想哭就可以哭出来 伪装自己并不能得到快乐 做自己才能 熊和人一样都会有好情绪和坏情绪 我们都需要发泄出来",
  "我收购人生了...看来要买个西瓜吃。",
  "人 不管发生什么都不要伤害自己 不仅爱你的人会很心疼 你的身体也会收到伤害 熊不想让你伤害自己 有什么事都可以跟熊说 熊会替你保密 但是不要在伤害自己了 熊会心疼"
];

// 互动短语集合
const interactions = [
  "人，过来一下，不干什么，就过来一下",
  "卧槽，谁把熊吵醒了",
  "人 累了就休息一会吧 熊抱抱你",
  "人，快来给我讲个笑话",
  "来财",
  "看起来5岁，脑袋也是5岁",
  "别人都是傻b，就我最聪明（读了一本哲学书之后）",
  "我收购人生了...看来要买个西瓜吃。",
  "人，为什么一定要往高处走呢，人可以往四处走",
  "熊许愿幸福，于是熊来到人的身边。"
];

// 创建一个变量来追踪鼠标是否在UI元素上
let isMouseOverUI = false;

// 初始化
function initPet() {
  console.log("初始化宠物...");
  
  // 从本地存储加载数据
  const savedData = localStorage.getItem('petData');
  if (savedData) {
    petData = JSON.parse(savedData);
    console.log("加载保存的数据:", petData);
  }
  
  // 初始状态下隐藏等级和经验条
  levelBadge.classList.add('hidden');
  expBarContainer.classList.add('hidden');
  
  // 隐藏互动按钮和所有按钮
  interactionButtons.classList.add('hidden');
  const buttons = document.querySelectorAll('.circular-button');
  buttons.forEach(button => {
    button.classList.add('hidden');
  });
  
  // 初始化隐藏消息框
  messagePopup.classList.add('hidden');
  
  // 初始化经验条
  updateLevelUI();
  
  // 获取所有互动按钮
  const signInButton = document.querySelector('.circular-button.sign-in');
  const interactButton = document.querySelector('.circular-button.interact');
  const dailyQuoteButton = document.querySelector('.circular-button.daily-quote');

  // 直接添加事件监听器，确保点击
  signInButton.addEventListener('click', handleSignIn);
  interactButton.addEventListener('click', handleInteract);
  dailyQuoteButton.addEventListener('click', handleDailyQuote);

  // 为互动按钮添加阻止冒泡
  [signInButton, interactButton, dailyQuoteButton].forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
    });
  });
  
  // 添加关闭消息按钮的事件处理
  if (closeMessage) {
    closeMessage.addEventListener('click', () => {
      messagePopup.classList.remove('show');
      setTimeout(() => {
        messagePopup.classList.add('hidden');
      }, 300);
    });
  }
  
  console.log("初始化完成");
}

// 更新等级UI
function updateLevelUI() {
  levelBadge.textContent = `Lv.${petData.level}`;
  
  // 计算经验百分比
  const expPercent = (petData.exp / petData.expToNextLevel) * 100;
  // 由于经验条现在是水平的，我们需要更新宽度而不是高度
  expBar.style.width = `${expPercent}%`;
  expText.textContent = `${petData.exp}/${petData.expToNextLevel}`;
  
  // 保存数据
  savePetData();
}

// 切换等级和经验条的显示状态
function toggleStats(show, force = false) {
  // force参数用来强制显示或隐藏，而不考虑当前状态
  if (force) {
    isStatsVisible = show;
  } else {
    isStatsVisible = !isStatsVisible;
  }
  
  if (isStatsVisible) {
    // 显示等级和经验条
    levelBadge.classList.remove('hidden');
    expBarContainer.classList.remove('hidden');
    setTimeout(() => {
      levelBadge.classList.add('show');
      expBarContainer.classList.add('show');
    }, 10);
  } else {
    // 隐藏等级和经验条
    levelBadge.classList.remove('show');
    expBarContainer.classList.remove('show');
    setTimeout(() => {
      levelBadge.classList.add('hidden');
      expBarContainer.classList.add('hidden');
    }, 300); // 与CSS过渡时间匹配
  }
}

// 保存数据到本地存储
function savePetData() {
  localStorage.setItem('petData', JSON.stringify(petData));
}

// 增加经验值
function addExp(amount) {
  // 创建经验获取动画
  showExpGain(amount);
  
  // 增加经验值
  petData.exp += amount;
  
  // 检查是否升级
  checkForLevelUp();
  
  // 更新UI
  updateLevelUI();
  
  // 确保显示状态
  if (!isStatsVisible) {
    toggleStats(true);
  }
}

// 显示经验获取动画
function showExpGain(amount) {
  expGain.textContent = `+${amount} 经验`;
  // 不需要调整位置，CSS已固定定位
  expGain.classList.remove('hidden');
  
  // 动画结束后隐藏
  setTimeout(() => {
    expGain.classList.add('hidden');
  }, 1500);
}

// 检查是否升级
function checkForLevelUp() {
  if (petData.exp >= petData.expToNextLevel) {
    // 升级
    petData.level++;
    petData.exp -= petData.expToNextLevel;
    
    // 随着等级提高，下一级所需经验值增加
    petData.expToNextLevel = Math.floor(petData.expToNextLevel * 1.2);
    
    // 显示升级消息
    showMessage(`恭喜！您的宠物升级了！\n现在是 ${petData.level} 级了！`);
    
    // 播放特殊动画
    playSpecialAnimation();
  }
}

// 显示消息框
function showMessage(text, type = 'normal') {
  const messagePopup = document.querySelector('#message-popup');
  const messageContent = document.querySelector('.message-content');
  
  // 清除之前的消息和定时器
  if (messagePopup._hideTimer) {
    clearTimeout(messagePopup._hideTimer);
  }
  
  // 设置消息内容
  messageContent.textContent = text;
  
  // 根据类型添加特殊样式
  messagePopup.classList.remove('love', 'normal');
  messagePopup.classList.add(type);
  
  // 直接从隐藏到显示，中间不需要过渡状态
  messagePopup.classList.remove('hidden');
  messagePopup.classList.add('show');
  
  // 设置定时器，在一段时间后隐藏消息
  messagePopup._hideTimer = setTimeout(() => {
    messagePopup.classList.remove('show');
    
    // 淡出后完全隐藏元素
    setTimeout(() => {
      messagePopup.classList.add('hidden');
    }, 700); // 与CSS动画时间匹配
  }, 3000); // 消息显示时间增加到3秒
}

// 每日签到处理
function handleSignIn() {
  const today = new Date().toDateString();
  
  if (petData.lastSignIn === today) {
    showMessage("今天已经签到过了，明天再来吧！");
    return;
  }
  
  // 记录签到
  petData.lastSignIn = today;
  
  // 添加经验
  addExp(20);
  
  showMessage("签到成功！获得20点经验值。\n连续签到可以获得更多奖励哦！");
  
  // 隐藏互动按钮
  interactionButtons.classList.add('hidden');
}

// 互动处理
function handleInteract() {
  // 随机选择一个互动短语
  const randomInteraction = interactions[Math.floor(Math.random() * interactions.length)];
  
  showMessage(randomInteraction);
  
  // 增加互动次数
  petData.totalInteractions++;
  
  // 添加经验
  addExp(5);
  
  // 根据互动次数触发不同动画
  if (petData.totalInteractions % 5 === 0) {
    pet.classList.add('special');
    setTimeout(() => {
      pet.classList.remove('special');
    }, 1200);
  } else {
    const actions = ['shake', 'bounce', 'flip'];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    pet.classList.add(randomAction);
    setTimeout(() => {
      pet.classList.remove(randomAction);
    }, 1000);
  }
  
  // 隐藏互动按钮
  interactionButtons.classList.add('hidden');
}

// 熊の語録处理
function handleDailyQuote() {
  // 随机选择一条名言
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  
  showMessage(`熊の語録：\n"${randomQuote}"`);
  
  // 增加已阅读金句数
  petData.quotesSeen++;
  
  // 每阅读5条金句，奖励额外经验
  if (petData.quotesSeen % 5 === 0) {
    addExp(15);
    messageContent.textContent += "\n\n获得额外15点经验值！";
  } else {
    addExp(5);
  }
  
  // 隐藏互动按钮
  interactionButtons.classList.add('hidden');
}

// 拖动相关变量
let isDragging = false;
let lastMouseX = 0, lastMouseY = 0; // 上一次鼠标位置
let offsetX, offsetY; // 鼠标在窗口内的偏移位置
let lastMoveTime = 0; // 上次移动时间
const moveThreshold = 1; // 移动阈值（像素）
let isMouseOverPet = false; // 鼠标是否在宠物上

// 单击事件计时器
let clickTimer = null;
let isDoubleClick = false;

// 鼠标悬停显示UI元素
pet.addEventListener('mouseenter', () => {
  // 进入宠物区域时，禁用点击穿透
  isMouseOverPet = true;
  ipcRenderer.send('set-ignore-mouse-events', false);
  
  // 显示UI元素
  const interactionButtons = document.querySelector('#interaction-buttons');
  const levelBadge = document.querySelector('#level-badge');
  const expBarContainer = document.querySelector('#exp-bar-container');
  
  // 如果消息弹窗不在显示中才显示UI
  const messagePopup = document.querySelector('#message-popup');
  if (!messagePopup.classList.contains('show')) {
    // 先把元素从display:none改为可见，但保持动画初始状态
    interactionButtons.classList.remove('hidden');
    levelBadge.classList.remove('hidden');
    expBarContainer.classList.remove('hidden');
    
    // 确保所有按钮都是可见的但处于初始状态
    const buttons = document.querySelectorAll('.circular-button');
    buttons.forEach(button => {
      button.classList.remove('hidden');
    });
    
    // 立即添加show类触发动画（不需要setTimeout）
    levelBadge.classList.add('show');
    expBarContainer.classList.add('show');
    interactionButtons.classList.add('show');
    
    // 依次显示每个按钮
    buttons.forEach(button => {
      button.classList.add('show');
    });
  }
});

// 鼠标离开隐藏UI元素
pet.addEventListener('mouseleave', () => {
  // 离开宠物区域
  isMouseOverPet = false;
  
  // 延迟检查，如果鼠标也不在UI上，才隐藏UI
  setTimeout(() => {
    if (!isMouseOverPet && !isMouseOverUI) {
      hideAllUI();
    }
  }, 100);
});

// 互动按钮鼠标进入事件
interactionButtons.addEventListener('mouseenter', () => {
  // 标记鼠标在UI上
  isMouseOverUI = true;
  ipcRenderer.send('set-ignore-mouse-events', false);
});

// 互动按钮鼠标离开事件
interactionButtons.addEventListener('mouseleave', () => {
  // 标记鼠标不在UI上
  isMouseOverUI = false;
  
  // 延迟检查，如果鼠标既不在宠物上也不在UI上，才隐藏UI
  setTimeout(() => {
    if (!isMouseOverPet && !isMouseOverUI) {
      hideAllUI();
    }
  }, 100);
});

// 提取隐藏UI的逻辑为单独函数
function hideAllUI() {
  const interactionButtons = document.querySelector('#interaction-buttons');
  const levelBadge = document.querySelector('#level-badge');
  const expBarContainer = document.querySelector('#exp-bar-container');
  const messagePopup = document.querySelector('#message-popup');
  
  // 如果没有显示消息弹窗，才恢复点击穿透
  if (messagePopup.classList.contains('hidden')) {
    if (!isDragging) {
      ipcRenderer.send('set-ignore-mouse-events', true);
    }
    
    // 移除所有元素的显示类
    interactionButtons.classList.remove('show');
    levelBadge.classList.remove('show');
    expBarContainer.classList.remove('show');
    
    // 隐藏所有按钮
    const buttons = document.querySelectorAll('.circular-button');
    buttons.forEach(button => {
      button.classList.remove('show');
    });
    
    // 延迟后完全隐藏
    setTimeout(() => {
      interactionButtons.classList.add('hidden');
      levelBadge.classList.add('hidden');
      expBarContainer.classList.add('hidden');
      
      buttons.forEach(button => {
        button.classList.add('hidden');
      });
    }, 700); // 延长时间以匹配动画时长
  }
}

// 鼠标按下事件
pet.addEventListener('mousedown', (e) => {
  // 只处理左键点击的拖动
  if (e.button !== 0) return;
  
  e.preventDefault(); // 防止默认行为
  isDragging = true;
  
  // 记录鼠标在窗口内的点击位置
  offsetX = e.clientX;
  offsetY = e.clientY;
  
  // 记录当前鼠标屏幕位置
  lastMouseX = e.screenX;
  lastMouseY = e.screenY;
  lastMoveTime = Date.now();
  
  pet.style.cursor = 'grabbing';
  
  // 通知主进程开始拖动，并传递偏移量
  ipcRenderer.send('drag-start', { offsetX, offsetY });
});

// 鼠标移动事件
document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  
  // 计算鼠标移动距离
  const deltaX = e.screenX - lastMouseX;
  const deltaY = e.screenY - lastMouseY;
  
  // 检查是否移动超过阈值，并且最小时间间隔
  const now = Date.now();
  const timeDelta = now - lastMoveTime;
  
  if ((Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) && timeDelta > 16) {
    // 更新上次移动时间
    lastMoveTime = now;
    
    // 更新上次鼠标位置
    lastMouseX = e.screenX;
    lastMouseY = e.screenY;
    
    // 直接发送鼠标的绝对位置给主进程
    ipcRenderer.send('move-pet-absolute', {
      mouseX: e.screenX,
      mouseY: e.screenY
    });
  }
});

// 鼠标释放事件
document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    pet.style.cursor = 'grab';
    
    // 通知主进程结束拖动
    ipcRenderer.send('drag-end');
    
    // 如果鼠标不在宠物上，恢复点击穿透
    if (!isMouseOverPet && messagePopup.classList.contains('hidden')) {
      ipcRenderer.send('set-ignore-mouse-events', true);
    }
  }
});

// 确保鼠标离开窗口时也能正确处理拖动结束
document.addEventListener('mouseleave', () => {
  if (isDragging) {
    isDragging = false;
    pet.style.cursor = 'grab';
    
    // 通知主进程结束拖动
    ipcRenderer.send('drag-end');
  }
});

// 右键菜单
pet.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  ipcRenderer.send('show-context-menu');
});

// 双击事件 - 可以触发特殊动画
pet.addEventListener('dblclick', () => {
  // 标记为双击，防止单击事件触发
  isDoubleClick = true;
  
  // 发送双击事件给主进程
  ipcRenderer.send('pet-dblclick');
  
  // 播放特殊动画
  playSpecialAnimation();
  
  // 如果互动按钮已显示，则隐藏（防止冲突）
  if (!interactionButtons.classList.contains('hidden')) {
    interactionButtons.classList.add('hidden');
  }
  
  // 给予少量经验
  addExp(3); // 增加一点经验，因为主进程已经会处理好感度
});

// 特殊动画
function playSpecialAnimation() {
  // 移除现有的动画类
  pet.classList.remove('shake', 'bounce', 'flip', 'special');
  
  // 添加特殊动画类
  pet.classList.add('special');
  
  // 动画结束后移除类
  setTimeout(() => {
    pet.classList.remove('special');
  }, 1200);
}

// 添加宠物行为（简单动画效果）
let randomMovementTimer = null;

function randomMovement() {
  // 如果正在拖动或显示互动按钮，不执行随机动作
  if (isDragging || !interactionButtons.classList.contains('hidden') || !messagePopup.classList.contains('hidden')) {
    randomMovementTimer = setTimeout(randomMovement, 2000);
    return;
  }
  
  // 随机选择一个动作
  const actions = ['shake', 'bounce', 'flip'];
  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  
  // 添加动作类
  pet.classList.add(randomAction);
  
  // 一段时间后移除动作类
  setTimeout(() => {
    pet.classList.remove(randomAction);
  }, 1000);
  
  // 设置下一次随机动作的时间
  const nextActionTime = 5000 + Math.random() * 10000; // 5-15秒之间
  randomMovementTimer = setTimeout(randomMovement, nextActionTime);
}

// 清理定时器的函数
function cleanupTimers() {
  if (randomMovementTimer) {
    clearTimeout(randomMovementTimer);
    randomMovementTimer = null;
  }
}

// 监听来自主进程的消息
ipcRenderer.on('play-animation', (event, animation) => {
  // 移除现有的动画类
  pet.classList.remove('shake', 'bounce', 'flip', 'special');
  
  // 添加指定的动画类
  if (animation) {
    pet.classList.add(animation);
    
    // 动画结束后移除类
    setTimeout(() => {
      pet.classList.remove(animation);
    }, 1000);
  }
});

// 监听交互状态更新
ipcRenderer.on('update-interaction', (event, ignoreMouseEvents) => {
  if (ignoreMouseEvents) {
    console.log('点击穿透已启用');
  } else {
    console.log('点击穿透已禁用');
  }
});

// 监听设置更新
ipcRenderer.on('settings-updated', (event, settings) => {
  console.log('设置已更新:', settings);
  
  // 如果皮肤设置发生变化，更新宠物外观
  if (settings.skin) {
    updatePetSkin(settings.skin);
  }
});

// 更新宠物皮肤
function updatePetSkin(skinName) {
  const pet = document.getElementById('pet');
  if (!pet) return;
  
  // 根据皮肤名称设置对应的图片
  let imagePath = '';
  switch (skinName) {
    case 'デフォルトの熊':
    case '默认':
      imagePath = '../../assets/pet.png';
      break;
    case 'ランニングの熊':
    case '奔跑':
      imagePath = '../../assets/自嘲熊run.gif';
      break;
    case 'ワークの熊':
    case '工作':
      imagePath = '../../assets/自嘲熊work.gif';
      break;
    case 'おはようの熊':
    case '睡醒':
      imagePath = '../../assets/自嘲熊睡醒.gif';
      break;
    default:
      imagePath = '../../assets/pet.png';
      break;
  }
  
  // 更新背景图片
  pet.style.backgroundImage = `url('${imagePath}')`;
  console.log(`宠物皮肤已更新为: ${skinName}, 图片路径: ${imagePath}`);
}

// 初始化宠物
initPet();

// 监听皮肤更新消息
ipcRenderer.on('update-skin', (event, skinName) => {
  console.log('收到皮肤更新消息:', skinName);
  updatePetSkin(skinName);
});

// 监听好感度增加消息
ipcRenderer.on('add-affection', (event, amount) => {
  // 这里可以添加好感度处理逻辑
  console.log('好感度增加:', amount);
});

// 监听爱心消息
ipcRenderer.on('show-love-message', (event, message) => {
  showMessage(message, 'love');
});

// 启动随机行为
setTimeout(randomMovement, 5000);

// 在窗口关闭时清理资源
window.addEventListener('beforeunload', () => {
  cleanupTimers();
});

function createPet(petData) {
  const petContainer = document.createElement('div');
  petContainer.className = 'pet-container';
  
  // 创建宠物显示
  const pet = document.createElement('div');
  pet.className = 'pet';
  pet.style.left = '50%';
  pet.style.top = '50%';
  pet.style.transform = 'translate(-50%, -50%)';
  
  // 等级徽章
  const levelBadge = document.createElement('div');
  levelBadge.className = 'level-badge';
  levelBadge.textContent = petData.level || 1;
  
  // 经验条
  const expBarContainer = document.createElement('div');
  expBarContainer.className = 'exp-bar-container';
  
  const expBar = document.createElement('div');
  expBar.className = 'exp-bar';
  expBar.style.width = `${(petData.exp / petData.maxExp) * 100}%`;
  expBarContainer.appendChild(expBar);
  
  // 交互按钮
  const interactionButtons = document.createElement('div');
  interactionButtons.className = 'interaction-buttons';
  
  // 喂食按钮
  const feedButton = createInteractionButton('feed', '🍖');
  
  // 玩耍按钮
  const playButton = createInteractionButton('play', '🎾');
  
  // 清洁按钮
  const cleanButton = createInteractionButton('clean', '🧹');
  
  // 将按钮添加到交互按钮容器
  interactionButtons.appendChild(feedButton);
  interactionButtons.appendChild(playButton);
  interactionButtons.appendChild(cleanButton);
  
  // 消息弹窗
  const messagePopup = document.createElement('div');
  messagePopup.className = 'message-popup hidden';
  
  // 添加所有元素到宠物容器
  petContainer.appendChild(pet);
  petContainer.appendChild(levelBadge);
  petContainer.appendChild(expBarContainer);
  petContainer.appendChild(interactionButtons);
  petContainer.appendChild(messagePopup);
  
  // 点击宠物显示/隐藏交互按钮
  let buttonsVisible = false;
  let levelVisible = false;
  
  pet.addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    
    if (!buttonsVisible) {
      // 显示按钮，使用延迟创建动画序列
      interactionButtons.classList.add('show');
      setTimeout(() => {
        feedButton.classList.add('show');
      }, 50);
      setTimeout(() => {
        playButton.classList.add('show');
      }, 100);
      setTimeout(() => {
        cleanButton.classList.add('show');
      }, 150);
      
      buttonsVisible = true;
    } else {
      // 隐藏按钮，按相反顺序
      cleanButton.classList.remove('show');
      setTimeout(() => {
        playButton.classList.remove('show');
      }, 50);
      setTimeout(() => {
        feedButton.classList.remove('show');
      }, 100);
      setTimeout(() => {
        interactionButtons.classList.remove('show');
      }, 200);
      
      buttonsVisible = false;
    }
    
    // 切换等级和经验条的显示状态
    if (!levelVisible) {
      levelBadge.classList.add('show');
      expBarContainer.classList.add('show');
      levelVisible = true;
    } else {
      levelBadge.classList.remove('show');
      expBarContainer.classList.remove('show');
      levelVisible = false;
    }
  });
  
  // 点击文档其他地方时隐藏按钮
  document.addEventListener('click', () => {
    if (buttonsVisible) {
      // 隐藏按钮，按相反顺序
      cleanButton.classList.remove('show');
      setTimeout(() => {
        playButton.classList.remove('show');
      }, 50);
      setTimeout(() => {
        feedButton.classList.remove('show');
      }, 100);
      setTimeout(() => {
        interactionButtons.classList.remove('show');
      }, 200);
      
      buttonsVisible = false;
    }
    
    if (levelVisible) {
      levelBadge.classList.remove('show');
      expBarContainer.classList.remove('show');
      levelVisible = false;
    }
  });
  
  // 防止文档点击事件隐藏按钮
  petContainer.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  return petContainer;
}

function createInteractionButton(type, emoji) {
  const button = document.createElement('div');
  button.className = 'interaction-button';
  button.dataset.type = type;
  button.textContent = emoji;
  
  button.addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    
    // 根据按钮类型处理交互
    switch (type) {
      case 'feed':
        showMessage('宠物吃饱了！');
        break;
      case 'play':
        showMessage('宠物很开心！');
        break;
      case 'clean':
        showMessage('宠物很干净！');
        break;
    }
  });
  
  return button;
} 