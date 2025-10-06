// background.js - Service Worker

function isFirefox() {
  // Firefox扩展环境支持browser对象
  return (
    typeof browser !== "undefined" && typeof browser.downloads !== "undefined"
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 处理文件下载请求
  if (msg && msg.action === "downloadBlob") {
    const { filename, blobData, subfolder = "" } = msg;
    // 构造下载路径
    const downloadFilename = subfolder ? `${subfolder}/${filename}` : filename;

    // 浏览器兼容处理
    let downloadOptions = {
      url: blobData,
      filename: isFirefox() ? filename : downloadFilename, // Firefox不支持子目录
      saveAs: false,
    };
    // Chromium系支持 conflictAction, Firefox 不支持
    if (!isFirefox()) {
      downloadOptions.conflictAction = "uniquify";
    }

    chrome.downloads.download(downloadOptions, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("下载失败:", chrome.runtime.lastError.message);
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
      } else {
        sendResponse({ success: true, downloadId: downloadId });
      }
    });
    return true;
  }

  // 处理定时任务状态/配置更新
  if (msg && msg.action === "saveTimerState") {
    const { config } = msg;
    chrome.alarms.clear("wpc_capture_alarm");
    if (config.autoStart && config.templateIds.length > 0) {
      chrome.alarms.create("wpc_capture_alarm", {
        delayInMinutes: 0.1,
        periodInMinutes: config.intervalMin,
      });
      console.log(`[wPC BG] 定时任务已设置, 间隔: ${config.intervalMin} 分钟`);
    } else {
      console.log("[wPC BG] 定时任务已清除/停止");
    }
    chrome.storage.local.set({ wpc_timer_config: config }, () => {
      if (chrome.runtime.lastError) {
        console.error("保存定时配置失败:", chrome.runtime.lastError.message);
      }
      sendResponse({ success: true });
    });
    return true;
  }
});

// 定时任务执行不变
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "wpc_capture_alarm") {
    console.log("[wPC BG] 收到定时器 alarm，发送执行任务请求...");
    chrome.tabs.query({ url: "https://wplace.live/*" }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(
          tab.id,
          { action: "executeTimedCapture" },
          (response) => {
            if (chrome.runtime.lastError) {
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
