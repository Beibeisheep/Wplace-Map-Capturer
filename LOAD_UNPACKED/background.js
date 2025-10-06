// background.js - Service Worker
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 处理文件下载请求
  if (msg && msg.action === "downloadBlob") {
    const { filename, blobData, subfolder = "" } = msg;

    // 构造下载路径：timed_captures/my_template_2025-01-01.png
    const downloadFilename = subfolder ? `${subfolder}/${filename}` : filename;

    chrome.downloads.download(
      {
        url: blobData,
        filename: downloadFilename,
        conflictAction: "uniquify", // 文件名冲突时自动重命名
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("下载失败:", chrome.runtime.lastError.message);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else {
          sendResponse({ success: true, downloadId: downloadId });
        }
      }
    );

    return true; // 异步发送响应
  }

  // 处理定时任务状态/配置更新
  if (msg && msg.action === "saveTimerState") {
    const { config } = msg;
    // 停止所有旧的 alarm
    chrome.alarms.clear("wpc_capture_alarm");

    if (config.autoStart && config.templateIds.length > 0) {
      // 创建新的 alarm
      chrome.alarms.create("wpc_capture_alarm", {
        delayInMinutes: 0.1, // 立即启动，用于首次运行
        periodInMinutes: config.intervalMin, // 间隔时间
      });
      console.log(`[wPC BG] 定时任务已设置, 间隔: ${config.intervalMin} 分钟`);
    } else {
      console.log("[wPC BG] 定时任务已清除/停止");
    }

    // 存储配置到 storage
    chrome.storage.local.set({ wpc_timer_config: config }, () => {
      if (chrome.runtime.lastError) {
        console.error("保存定时配置失败:", chrome.runtime.lastError.message);
      }
      sendResponse({ success: true });
    });
    return true;
  }
});

// 监听 alarm 事件，当定时器触发时，通知 content_script 执行任务
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "wpc_capture_alarm") {
    console.log("[wPC BG] 收到定时器 alarm，发送执行任务请求...");
    // 找到所有匹配的 tab
    chrome.tabs.query({ url: "https://wplace.live/*" }, (tabs) => {
      tabs.forEach((tab) => {
        // 向每个 tab 发送消息，要求执行定时任务
        chrome.tabs.sendMessage(
          tab.id,
          { action: "executeTimedCapture" },
          (response) => {
            if (chrome.runtime.lastError) {
              // 如果 content script 没有响应，可能是页面未加载完成
              console.warn(
                `[wPC BG] 无法向 Tab ${tab.id} 发送消息:`,
                chrome.runtime.lastError.message
              );
            }
          }
        );
      });
    });
  }
});
