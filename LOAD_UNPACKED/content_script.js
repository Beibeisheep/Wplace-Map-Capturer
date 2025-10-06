// content_script.js - Wplace Map Capturer
(function () {
  // 防止脚本被重复注入
  if (window.__wplace_capture_injected) return;
  window.__wplace_capture_injected = true;

  // --- 常量 ---
  const TILE_SIZE = 1000; // 每个瓦片1000x1000像素
  const TILE_BASE_URL = "https://backend.wplace.live/files/s0/tiles"; // API基础URL
  const WPLACE_ZOOM_LEVEL = 11;
  const MIN_INTERVAL_MIN = 1; // 最小间隔 1 分钟
  const MAX_CONCURRENT_DOWNLOADS = 5; // 最大并发下载数

  // --- 全局状态 ---
  let g_templates = []; // 存储所有模板
  let g_activeTimer = null; // 存储当前的定时器句柄（用于显示倒计时）
  let g_timerConfig = {
    templateIds: [], // 存储多个模板ID
    intervalMin: 5, // 间隔时间（分钟）
    autoStart: false, // 是否自动启动
  };
  let g_editingTemplateId = null; // 正在编辑的模板 ID
  let g_downloadQueue = []; // 下载请求队列
  let g_activeDownloads = 0; // 当前正在处理的下载数
  let isTplTooltipClicked = false; // 模板列表帮助提示是否被点击
  let isTimerTooltipClicked = false; // 定时设置帮助提示是否被点击

  // --- 国际化 (i18n) ---
  const LANGUAGES = {
    ZH: "zh",
    EN: "en",
  };

  const DICTIONARY = {
    app_title: { zh: "Wplace地图截取器", en: "Wplace Map Capturer" },
    close: { zh: "关闭", en: "Close" },
    tab_capture: { zh: "截取", en: "Capture" },
    tab_template: { zh: "模板/定时", en: "Templates/Timer" },
    capture_desc: {
      zh: "截取画布区域并合并为一张图片下载",
      en: "Capture canvas area and merge into a single image for download",
    },
    capture_mode: { zh: "截取模式", en: "Capture Mode" },
    mode_precise: {
      zh: "精确区域截取 (tileX tileY px py)",
      en: "Precise Area Capture (tileX tileY px py)",
    },
    mode_multi: {
      zh: "多区块合并 (tileX tileY)",
      en: "Multi-Block Merge (tileX tileY)",
    },
    mode_precise_short: { zh: "精确", en: "Precise" },
    mode_multi_short: { zh: "多区块", en: "Multi-Block" },
    start_capture: { zh: "开始截取", en: "Start Capture" },

    coord_precise_label_l: {
      zh: "左上角, 输入数字坐标/(tileX tileY px py)/分享链接",
      en: "Top-Left, Please enter according to the format",
    },
    coord_precise_label: {
      zh: "右下角",
      en: "Bottom-Right",
    },
    coord_multi_label: {
      zh: "瓦片坐标范围 (tileX tileY),例如:1617 34)",
      en: "Tile Coordinate Range (tileX tileY),e.g:1617 34)",
    },

    tpl_manager: { zh: "模板管理器", en: "Template Manager" },
    new_template: { zh: "+ 新建模板", en: "+ New Template" },
    tpl_form_new_title: { zh: "新建模板", en: "New Template" },
    tpl_form_edit_title: { zh: "编辑模板", en: "Edit Template" },
    tpl_form_cancel: { zh: "取消/返回", en: "Cancel/Back" },
    tpl_name: { zh: "模板名称", en: "Template Name" },
    tpl_name_placeholder: {
      zh: "例如: 我的重要区域",
      en: "e.g.: My Important Area",
    },
    tpl_subfolder: {
      zh: "定时任务保存子目录 (可选)",
      en: "Timer Subfolder (Optional)",
    },
    tpl_subfolder_placeholder: {
      zh: "例如: template_A_captures",
      en: "e.g.: template_A_captures",
    },
    tpl_subfolder_desc: {
      zh: "此模板定时截取的图片将保存到浏览器默认下载目录下的此子目录。",
      en: "Images captured by this template will be saved to this subfolder in your default browser download directory.",
    },
    save_template: { zh: "保存模板", en: "Save Template" },

    tpl_list_title: { zh: "模板列表", en: "Template List" },
    tpl_list_help: {
      zh: "勾选左侧复选框，将该模板加入定时任务。保存子目录在模板编辑中设置。",
      en: "Check the box on the left to include this template in the timed task. Set the subfolder in template editing.",
    },
    no_template_msg: {
      zh: '暂无模板，请点击 "新建模板" 创建。',
      en: 'No templates yet, please click "New Template" to create one.',
    },

    tpl_mode_prefix: { zh: "模式", en: "Mode" },
    tpl_subfolder_prefix: { zh: "子目录", en: "Subfolder" },
    tpl_none: { zh: "(无)", en: "(None)" },

    timer_settings_title: { zh: "定时任务设置", en: "Timer Settings" },
    timer_settings_help: {
      zh: "勾选模板后，设置间隔时间，点击启动。定时任务将轮流截取所有勾选的模板。",
      en: "After checking templates, set the interval time, and click start. The timer will cycle through all checked templates.",
    },
    interval_min: { zh: "间隔时间 (分钟)", en: "Interval Time (Minutes)" },
    min_interval_desc: {
      zh: "最小间隔 ${MIN_INTERVAL_MIN} 分钟。高频次任务可能导致下载队列拥塞。",
      en: "Minimum interval is ${MIN_INTERVAL_MIN} minutes. High-frequency tasks may cause download queue congestion.",
    },
    auto_start_task: {
      zh: "页面打开时自动开始任务",
      en: "Auto-start task when page opens",
    },
    timer_toggle_start: { zh: "启动定时任务", en: "Start Timer Task" },
    timer_toggle_stop: { zh: "停止定时任务", en: "Stop Timer Task" },
    timer_status_prefix: { zh: "当前状态：", en: "Current Status: " },
    status_stopped: { zh: "未启动", en: "Stopped" },
    status_running: { zh: "运行中，下次任务在 ", en: "Running, next task in " },
    status_running_indicator: {
      zh: "定时任务运行中 (点击停止)",
      en: "Timer Running (Click to Stop)",
    },

    log_title: { zh: "日志", en: "Log" },
    author_name: { zh: "made by 贝贝羊", en: "made by Beibeisheep" },

    tpl_btn_edit: { zh: "编辑", en: "Edit" },
    tpl_btn_run_once: { zh: "截取", en: "Cut" },
    tpl_btn_delete: { zh: "删除", en: "Delete" },
    tpl_confirm_delete: {
      zh: '确定删除模板 "${name}" 吗?',
      en: 'Are you sure you want to delete template "${name}"?',
    },

    lang_btn_zh: { zh: "ZH", en: "中" },
    lang_btn_en: { zh: "En", en: "en" },

    // --- 日志消息 (Log Messages) ---
    log_lang_switched: { zh: "语言已切换到: ", en: "Language switched to: " },
    log_lang_save_fail: {
      zh: "保存语言设置失败: ",
      en: "Failed to save language setting: ",
    },
    log_tpl_deleted: { zh: "模板已删除: ", en: "Template deleted: " },
    log_tpl_saved_new: { zh: "新模板已保存: ", en: "New template saved: " },
    log_tpl_saved_edit: { zh: "模板已更新: ", en: "Template updated: " },
    log_capture_started: {
      zh: "开始截取任务...",
      en: "Starting capture task...",
    },
    tile_load_failed: {
      zh: "瓦片 ${tile} 加载失败，区域已留空",
      en: "Tile ${tile} failed to load, left blank.",
    },

    log_capture_success: {
      zh: "截取成功，文件已开始下载: ",
      en: "Capture successful, download started: ",
    },
    log_capture_error: { zh: "截取失败: ", en: "Capture failed: " },
    log_download_error: {
      zh: "下载请求失败: ",
      en: "Download request failed: ",
    },
    log_timer_started: { zh: "定时任务已启动。", en: "Timer task started." },
    log_timer_stopped: { zh: "定时任务已停止。", en: "Timer task stopped." },
    log_timer_auto_start: {
      zh: "定时任务自动启动...",
      en: "Timer task auto-starting...",
    },
    log_timer_config_saved: {
      zh: "保存定时配置。",
      en: "Saved timer config.",
    },
    log_timer_external_stop: {
      zh: "外部指示器: 定时任务已停止。",
      en: "External indicator: Timer task stopped.",
    },
    log_error_invalid_input: {
      zh: "错误：输入坐标/链接无效。",
      en: "Error: Invalid coordinate/link input.",
    },
    log_error_tpl_name_required: {
      zh: "错误：模板名称不能为空。",
      en: "Error: Template name is required.",
    },
    log_error_no_templates_selected: {
      zh: "错误：未选择任何模板进行定时任务。",
      en: "Error: No templates selected for the timer.",
    },
    log_error_capture_zero_area: {
      zh: "错误：截取区域计算失败，宽度或高度为零或负值。",
      en: "Error: Capture area calculation failed, width or height is zero or negative.",
    },
    log_error_canvas_fail: {
      zh: "错误：Canvas to Blob 失败。",
      en: "Error: Canvas to Blob failed.",
    },
    log_error_download_unknown: {
      zh: "错误：未知下载错误。",
      en: "Error: Unknown download error.",
    },
    log_error_no_coord_input: {
      zh: "错误：请按照格式输入，空格分开的坐标数字/tileX,tileY,px,py/分享链接",
      en: "Error:Please enter according to the format, space-separated numbers/tileX,tileY,px,py/Share Link",
    },
    log_error_missing_coord_fields: {
      zh: "错误：请填写所有坐标字段。",
      en: "Error: Please fill in all coordinate fields.",
    },
  };

  // 自动判断初始语言
  let g_currentLanguage = LANGUAGES.ZH;
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.includes("en")) {
    g_currentLanguage = LANGUAGES.EN;
  }

  // 翻译辅助函数
  function __(key) {
    const dict = DICTIONARY[key];
    if (!dict) {
      return key;
    }
    return dict[g_currentLanguage] || dict[LANGUAGES.ZH];
  }

  const style = document.createElement("style");
  style.textContent = `
    :root {
      --wpc-primary-color: #007bff;
      --wpc-primary-hover: #0056b3;
      --wpc-light-gray: #f8f9fa;
      --wpc-border-color: #dee2e6;
      --wpc-text-color: #212529;
      --wpc-danger-color: #dc3545;
      --wpc-success-color: #28a745;
      --wpc-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    #wpcapture_button {
      position: fixed; left: 10px; top: 220px; z-index: 2147483646;
      width: 48px; height: 48px; border-radius: 50%;
      background: #fff; color: var(--wpc-text-color);
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.2s ease-in-out;
    }
    #wpcapture_button:hover { transform: scale(1.1); box-shadow: 0 6px 16px rgba(0,0,0,0.2); }
    #wpc_running_indicator {
      position: fixed; left: 10px; top: 170px; z-index: 2147483646;
      padding: 6px 10px; border-radius: 8px;
      font-size: 12px; color: white; font-weight: bold;
      background: var(--wpc-danger-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: none;
      cursor: pointer;
    }
    #wpcapture_panel {
      position: fixed; left: 70px; top: 120px; z-index: 2147483647;
      width: 400px; max-height: calc(100vh - 140px);
      background: #ffffff; border-radius:16px;
      box-shadow: var(--wpc-shadow);
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex; flex-direction: column; gap: 16px;
      opacity: 0; visibility: hidden;
      transform: translateX(-10px);
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
      overflow-y: auto;
    }
    #wpcapture_panel.visible { opacity: 1; visibility: visible; transform: translateX(0); }
    
.wpc_header {
    /* 核心修改 1: 启用换行 */
    display: flex; 
    flex-wrap: wrap; 
    /* 保持标题和按钮组在一行时的对齐 */
    justify-content: space-between; 
    align-items: center; 
    position: relative; 
}    .wpc_header_buttons { display: flex; align-items: center; }

    #wpc_lang_toggle {
      width: 32px;
      height: 32px;
      padding: 0 5px; 
      font-size: 14px;
      font-weight: bold;
      color: var(--wpc-primary-color); 
      border: 2px solid var(--wpc-primary-color);
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 10px;
    }
    #wpc_lang_toggle:hover {
      background: var(--wpc-primary-color);
      color: white;
    }

    #wpcapture_panel h3 { margin:0; font-size:20px; color: #333; }
    #wpc_close_btn, #wpc_modal_close_btn { font-size: 24px; color: #999; cursor: pointer; transition: color 0.2s; line-height: 1; padding: 0 4px; }
    #wpc_close_btn:hover, #wpc_modal_close_btn:hover { color: #333; }
    .wpc_tab_nav { display: flex; border-bottom: 1px solid var(--wpc-border-color); margin-bottom: 10px; }
    .wpc_tab_button { padding: 10px 15px; cursor: pointer; border: none; background: transparent; color: #6c757d; font-weight: 500; transition: color 0.2s; }
    .wpc_tab_button.active { color: var(--wpc-primary-color); border-bottom: 2px solid var(--wpc-primary-color); margin-bottom: -1px; }
    .wpc_tab_content { display: none; flex-direction: column; gap: 16px; overflow-y: auto; }
    .wpc_tab_content.active { display: flex; }
    .wpc_row { display:flex; flex-direction: column; gap: 6px; }
    .wpc_row input[type="text"], .wpc_row select, .wpc_row input[type="number"] {
      width: 100%; box-sizing: border-box;
      padding: 10px; border:1px solid var(--wpc-border-color); border-radius: 8px; font-size: 14px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .wpc_row input[type="text"]:focus, .wpc_row select:focus, .wpc_row input[type="number"]:focus {
      border-color: var(--wpc-primary-color); outline: none;
      box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.15);
    }
    .wpc_button {
      padding: 12px 16px; border-radius: 8px; border: none; cursor:pointer; 
      background: var(--wpc-primary-color); color:white; font-size:15px; font-weight: 500;
      transition: background-color 0.2s; width: 100%;
    }
    .wpc_button.secondary { background: #6c757d; }
    .wpc_button.secondary:hover { background: #5a6268; }
    .wpc_button.danger { background: var(--wpc-danger-color); }
    .wpc_button.danger:hover { background: #c82333; }
.wpc_small { 
    font-size:12px; 
    color:#6c757d; 
    margin: 0 0 0 0; 
    width: 100%; 
    margin-top: 3px; 
}    .wpc_mode_label { font-weight:500; font-size: 14px; color: #495057; }
    #wpc_log { font-size:12px; color:#333; background: var(--wpc-light-gray); padding: 10px; border-radius: 8px; max-height:80px; overflow:auto; border: 1px solid var(--wpc-border-color); }
    .wpc_template_item {
      padding: 10px; border: 1px solid var(--wpc-border-color); border-radius: 8px;
      display: flex; flex-direction: column; gap: 6px; background: #fff;
    }
    .wpc_template_header { display: flex; justify-content: space-between; align-items: center; }
    .wpc_template_name { font-weight: bold; font-size: 16px; color: var(--wpc-text-color); margin-left: 5px;}
    .wpc_template_actions button { margin-left: 8px; padding: 6px 10px; font-size: 12px; width: auto; }
    .wpc_checkbox_row { display: flex; align-items: center; gap: 5px; }
    .wpc_template_timer_item { border-left: 3px solid var(--wpc-primary-color); padding-left: 10px; }

    /* 内嵌表单样式 */
    #wpc_template_form {
        border: 1px dashed var(--wpc-border-color); 
        padding: 15px; 
        border-radius: 8px;
        background: var(--wpc-light-gray);
        display: none; 
        flex-direction: column; 
        gap: 15px;
    }

    /* 帮助问号图标 */
    .wpc_help_icon {
        margin-left: 5px;
        color: var(--wpc-text-color); 
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
    }
    .wpc_title_group {
        display: flex;
        align-items: center;
        margin-bottom: 5px; 
    }
    .wpc_title_group h4 {
        margin: 0;
    }
    .wpc_title_group .wpc_small {
        margin-left: 10px;
    }

    /* --- Tooltip 样式 --- */
    .wpc_tooltip_container {
        position: relative; 
        display: inline-block;
    }
    .wpc_tooltip_text {
        visibility: hidden;
        opacity: 0;
        width: 240px; 
        background-color: #333;
        color: #fff;
        text-align: left;
        border-radius: 6px;
        padding: 10px;
        position: absolute;
        z-index: 2147483647; 
        bottom: 125%; 
        left: 10; 
        margin-left: -15px; 
        font-size: 12px;
        line-height: 1.4;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: opacity 0.2s ease, visibility 0.2s ease;
    }
    .wpc_tooltip_text::after {
        content: "";
        position: absolute;
        top: 100%;
        left: 30px; 
        margin-left: -5px;
        border-width: 5px;
        border-style: solid;
        border-color: #333 transparent transparent transparent;
    }
    .wpc_tooltip_text.visible {
        visibility: visible;
        opacity: 1;
    }
    
    /* --- 自定义滚动条样式 (变细) --- */
    #wpcapture_panel::-webkit-scrollbar {
        width: 6px; 
        background: transparent;
    }
    #wpcapture_panel::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2); 
        border-radius: 3px;
    }
    #wpcapture_panel::-webkit-scrollbar-thumb:hover {
        background-color: rgba(0, 0, 0, 0.4); 
    }

    /* 针对日志区域 */
    #wpc_log::-webkit-scrollbar {
        width: 6px; 
        background: transparent;
    }
    #wpc_log::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
    }
    #wpc_log::-webkit-scrollbar-thumb:hover {
        background-color: rgba(0, 0, 0, 0.4); 
    }

    /* --- 作者链接样式 (Req 2) --- */
    .wpc_author_link_container {
        padding-top: 5px;
        margin-top: 5px;
        border-top: 1px dashed var(--wpc-border-color);
        text-align: right;
    }
    #wpc_author_link {
        font-size: 12px;
        color: #6c757d;
        text-decoration: none;
        transition: color 0.2s;
    }
    #wpc_author_link:hover {
        color: var(--wpc-primary-color);
        text-decoration: underline;
    }
            .wpc_nice_btn {
      border: none;
      outline: none;
      border-radius: 999px;
      background: #f4f6f8;
      color: #2d3748;
      padding: 8px 22px;
      font-size: 16px;
      margin-right: 10px;
      font-weight: 500;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      display: inline-block;
    }
    .wpc_nice_btn:hover {
      background: #e2e8f0;
    }
    .wpc_nice_btn-delete {
      background: #f4f6f8;
      color: #2d3748;
    }
    .wpc_nice_btn-delete.confirm {
      background: #e25555;
      color: #fff;
    }
    .wpc_nice_btn-delete.confirm:hover {
      background: #d73737;
    }
    .wpc_nice_btn-circle {
      border-radius: 50%;
      padding: 0;
      width: 36px;
      height: 36px;
      background: #f4f6f8;
      color: #2d3748;
      font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .wpc_nice_btn-circle:hover {
      background: #e2e8f0;
    }
  `;
  document.head.appendChild(style);

  // --- UI 结构初始化 ---
  const btn = document.createElement("div");
  btn.id = "wpcapture_button";
  btn.title = "Wplace Map Capturer";
  btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>`;
  document.body.appendChild(btn);

  const indicator = document.createElement("div");
  indicator.id = "wpc_running_indicator";
  indicator.textContent = __("status_running_indicator");
  document.body.appendChild(indicator);

  const panel = document.createElement("div");
  panel.id = "wpcapture_panel";
  panel.innerHTML = `
<div class="wpc_header">
    <h3 data-i18n="app_title">Wplace地图截取器</h3>

    <div class="wpc_header_buttons">
        <button id="wpc_lang_toggle" title="切换语言"></button>
        <span id="wpc_close_btn" data-i18n-title="close" title="关闭">&times;</span>
    </div>

    <p class="wpc_small" data-i18n="capture_desc">截取画布区域并合并为一张图片下载</p>

</div>
    <div class="wpc_tab_nav">
        <button class="wpc_tab_button active" data-tab="capture" data-i18n="tab_capture">截取</button>
        <button class="wpc_tab_button" data-tab="template" data-i18n="tab_template">模板/定时</button>
    </div>
    
    <div id="wpc_tab_capture" class="wpc_tab_content active">
        
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="capture_mode">截取模式</label>
          <select id="wpc_capture_mode">
            <option value="precise" selected data-i18n="mode_precise">精确区域截取 (tileX tileY px py)</option>
            <option value="multi" data-i18n="mode_multi">多区块合并 (tileX tileY)</option>
          </select>
        </div>

        <div id="wpc_capture_coord_area" style="display: flex; flex-direction: column; gap: 16px;">
        </div>

        <button class="wpc_button" id="wpc_execute" data-i18n="start_capture">开始截取</button>
    </div>

    <div id="wpc_tab_template" class="wpc_tab_content">
        
        <div class="wpc_title_group">
            <h4 data-i18n="tpl_manager">模板管理器</h4>
            <button class="wpc_button secondary" id="wpc_create_new_template" style="width: auto; padding: 8px 12px; font-size: 14px; margin-left: 10px;" data-i18n="new_template">+ 新建模板</button>
        </div>
        
        <div id="wpc_template_form">
            <div class="wpc_header">
                <h4 id="wpc_form_title" style="margin: 0;" data-i18n="tpl_form_new_title">新建模板</h4>
                <button class="wpc_button secondary" id="wpc_form_cancel_btn" style="width: auto; padding: 4px 8px; font-size: 12px;" data-i18n="tpl_form_cancel">取消/返回</button>
            </div>
            <div class="wpc_row">
                <label class="wpc_mode_label" data-i18n="tpl_name">模板名称</label>
                <input type="text" id="wpc_tpl_name" data-i18n-placeholder="tpl_name_placeholder" placeholder="例如: 我的重要区域" />
            </div>
            <div class="wpc_row">
                <label class="wpc_mode_label" data-i18n="capture_mode">截取模式</label>
                <select id="wpc_tpl_mode">
                <option value="precise" selected data-i18n="mode_precise">精确区域截取 (tileX tileY px py)</option>
                <option value="multi" data-i18n="mode_multi">多区块合并 (tileX tileY)</option>
                </select>
            </div>
            <div id="wpc_tpl_coord_area">
            </div>
            
            <div class="wpc_row">
                <label class="wpc_mode_label" data-i18n="tpl_subfolder">定时任务保存子目录 (可选)</label>
                <input type="text" id="wpc_tpl_subfolder" data-i18n-placeholder="tpl_subfolder_placeholder" placeholder="例如: template_A_captures" />
                <p class="wpc_small" data-i18n="tpl_subfolder_desc">此模板定时截取的图片将保存到浏览器默认下载目录下的此子目录。</p>
            </div>

            <button class="wpc_button" id="wpc_tpl_save_btn" data-i18n="save_template">保存模板</button>
        </div>
        
        <div id="wpc_template_list_container"> 
            
            <div class="wpc_title_group" style="margin-bottom: 5px;">
                <h4 style="margin: 0;" data-i18n="tpl_list_title">模板列表</h4>
                <div class="wpc_tooltip_container">
                    <span class="wpc_help_icon" id="tpl_list_help_icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12" y2="17"></line>
                        </svg>
                    </span>
                    <div id="tpl_list_tooltip" class="wpc_tooltip_text" data-i18n="tpl_list_help"></div>
                </div>
            </div>

            <div id="wpc_template_list" style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-right: 5px;">
                <p class="wpc_small" id="wpc_no_template_msg" data-i18n="no_template_msg">暂无模板，请点击 "新建模板" 创建。</p>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--wpc-border-color); margin: 15px 0 5px 0;">
            
            <div class="wpc_title_group">
                <h4 data-i18n="timer_settings_title">定时任务设置</h4>
                <div class="wpc_tooltip_container">
                    <span class="wpc_help_icon" id="timer_settings_help_icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12" y2="17"></line>
                        </svg>
                    </span>
                    <div id="timer_settings_tooltip" class="wpc_tooltip_text" data-i18n="timer_settings_help"></div>
                </div>
            </div>

            <div class="wpc_row">
                <label class="wpc_mode_label" data-i18n="interval_min">间隔时间 (分钟)</label>
                <input type="number" id="wpc_interval_min" min="${MIN_INTERVAL_MIN}" value="5" />
                <p class="wpc_small" id="wpc_min_interval_desc">最小间隔 ${MIN_INTERVAL_MIN} 分钟。高频次任务可能导致下载队列拥塞。</p>
            </div>

            <div class="wpc_checkbox_row">
                <input type="checkbox" id="wpc_auto_start_checkbox" />
                <label for="wpc_auto_start_checkbox" class="wpc_mode_label" style="margin: 0;" data-i18n="auto_start_task">页面打开时自动开始任务</label>
            </div>

            <button class="wpc_button" id="wpc_timer_toggle" data-i18n="timer_toggle_start">启动定时任务</button>
            <p class="wpc_small" id="wpc_timer_status" data-i18n-prefix="timer_status_prefix" data-i18n="status_stopped">当前状态：未启动</p>
        </div> 
    </div>

    <div id="wpc_log_container" style="display:flex; flex-direction: column; gap: 6px;">
        <div class="wpc_mode_label" data-i18n="log_title">日志</div>
        <div id="wpc_log"></div>
    </div>
    
    <div class="wpc_author_link_container">
        <a id="wpc_author_link" href="https://github.com/Beibeisheep" target="_blank"></a>
    </div>
  `;
  document.body.appendChild(panel);

  // --- 获取 DOM 元素 ---
  const logEl = panel.querySelector("#wpc_log");
  const captureModeSelect = panel.querySelector("#wpc_capture_mode");
  const captureCoordArea = panel.querySelector("#wpc_capture_coord_area");
  const executeCaptureBtn = panel.querySelector("#wpc_execute");
  const langToggleBtn = panel.querySelector("#wpc_lang_toggle");
  const closeBtn = panel.querySelector("#wpc_close_btn");
  const captureButton = document.getElementById("wpcapture_button");
  const createNewTemplateBtn = panel.querySelector("#wpc_create_new_template");
  const templateListContainer = panel.querySelector(
    "#wpc_template_list_container"
  );
  const templateListEl = panel.querySelector("#wpc_template_list");
  const noTemplateMsg = panel.querySelector("#wpc_no_template_msg");
  const timerToggleBtn = panel.querySelector("#wpc_timer_toggle");
  const timerStatusEl = panel.querySelector("#wpc_timer_status");
  const intervalInput = panel.querySelector("#wpc_interval_min");
  const autoStartCheckbox = panel.querySelector("#wpc_auto_start_checkbox");
  const runningIndicator = document.getElementById("wpc_running_indicator");
  const templateForm = panel.querySelector("#wpc_template_form");
  const formTitle = panel.querySelector("#wpc_form_title");
  const tplNameInput = panel.querySelector("#wpc_tpl_name");
  const tplModeSelect = panel.querySelector("#wpc_tpl_mode");
  const tplCoordArea = panel.querySelector("#wpc_tpl_coord_area");
  const tplSubfolderInput = panel.querySelector("#wpc_tpl_subfolder");
  const tplSaveBtn = panel.querySelector("#wpc_tpl_save_btn");
  const tplCancelBtn = panel.querySelector("#wpc_form_cancel_btn");
  const authorLink = panel.querySelector("#wpc_author_link");
  const tplListHelpIcon = panel.querySelector("#tpl_list_help_icon");
  const tplListTooltip = panel.querySelector("#tpl_list_tooltip");
  const timerSettingsHelpIcon = panel.querySelector(
    "#timer_settings_help_icon"
  );
  const timerSettingsTooltip = panel.querySelector("#timer_settings_tooltip");

  function log(msg) {
    const maxLogLines = 20;
    const timeLocale = g_currentLanguage === LANGUAGES.EN ? "en-US" : "zh-CN";
    const now = new Date().toLocaleTimeString(timeLocale, {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const logEntry = `[${now}] ${msg}`;
    if (logEl) {
      const currentLog = logEl.innerHTML
        .split("<br>")
        .filter((line) => line.trim() !== "");
      currentLog.push(logEntry);
      if (currentLog.length > maxLogLines) {
        currentLog.splice(0, currentLog.length - maxLogLines);
      }
      logEl.innerHTML = currentLog.join("<br>");
      logEl.scrollTop = logEl.scrollHeight;
    }
    console.log(`[wPC] ${logEntry}`);
  }

  function parseShareUrl(url) {
    try {
      const u = new URL(url);
      const lat = parseFloat(u.searchParams.get("lat"));
      const lng = parseFloat(u.searchParams.get("lng"));
      if (!isNaN(lat) && !isNaN(lng)) {
        const n = Math.pow(2, WPLACE_ZOOM_LEVEL);
        const latRad = (lat * Math.PI) / 180;
        const absPx = ((lng + 180) / 360) * n * TILE_SIZE;
        const absPy =
          ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
            2) *
          n *
          TILE_SIZE;
        return {
          tileX: Math.floor(absPx / TILE_SIZE),
          tileY: Math.floor(absPy / TILE_SIZE),
          px: Math.max(0, Math.round(absPx % TILE_SIZE)),
          py: Math.max(0, Math.round(absPy % TILE_SIZE)),
        };
      }
      const parts = u.hash
        .substring(1)
        .split("/")
        .filter((p) => p.length > 0);
      if (parts.length === 5) {
        return {
          tileX: parseInt(parts[1], 10),
          tileY: parseInt(parts[2], 10),
          px: parseInt(parts[3], 10),
          py: parseInt(parts[4], 10),
        };
      }
    } catch (e) {}
    return null;
  }

  function parseCoordInput(input) {
    const str = input.trim();
    if (/https?:\/\//.test(str)) {
      const geo = parseShareUrl(str);
      if (geo) return [geo.tileX, geo.tileY, geo.px, geo.py];
    }
    const parts = str.split(/[,;\s]+/);
    const coords = parts
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !isNaN(n));
    return coords;
  }

  function getTargetArea(mode, tlInput, brInput) {
    let tl_coords, br_coords;
    const linkInfo = parseShareUrl(tlInput);
    if (linkInfo) {
      tl_coords = [linkInfo.tileX, linkInfo.tileY, linkInfo.px, linkInfo.py];
    } else {
      tl_coords = parseCoordInput(tlInput);
    }
    br_coords = parseCoordInput(brInput);
    if (mode === "precise") {
      if (tl_coords.length < 4 || br_coords.length < 4) {
        log(__("log_error_no_coord_input"));
        return null;
      }
      return {
        mode: "precise",
        tl: {
          tileX: tl_coords[0],
          tileY: tl_coords[1],
          px: tl_coords[2],
          py: tl_coords[3],
        },
        br: {
          tileX: br_coords[0],
          tileY: br_coords[1],
          px: br_coords[2],
          py: br_coords[3],
        },
      };
    } else {
      if (tl_coords.length < 2 || br_coords.length < 2) {
        log(__("log_error_invalid_input"));
        return null;
      }
      const minX = Math.min(tl_coords[0], br_coords[0]);
      const minY = Math.min(tl_coords[1], br_coords[1]);
      const maxX = Math.max(tl_coords[0], br_coords[0]);
      const maxY = Math.max(tl_coords[1], br_coords[1]);
      return {
        mode: "multi",
        tl: {
          tileX: minX,
          tileY: minY,
          px: 0,
          py: 0,
        },
        br: {
          tileX: maxX,
          tileY: maxY,
          px: TILE_SIZE - 1,
          py: TILE_SIZE - 1,
        },
      };
    }
  }

  // --- 核心下载/截取逻辑 ---
  function fetchTile(tileX, tileY) {
    const url = `${TILE_BASE_URL}/${tileX}/${tileY}.png`;
    return fetch(url, { cache: "no-store" })
      .then((resp) => {
        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
        return resp.blob();
      })
      .then((blob) => URL.createObjectURL(blob));
  }

  function processQueue() {
    if (
      g_activeDownloads >= MAX_CONCURRENT_DOWNLOADS ||
      g_downloadQueue.length === 0
    ) {
      return;
    }
    const task = g_downloadQueue.shift();
    g_activeDownloads++;
    if (typeof task === "function") {
      task().finally(() => {
        g_activeDownloads--;
        processQueue();
      });
    }
  }

  function requestDownload(blob, filename, subfolder) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        chrome.runtime.sendMessage(
          {
            action: "downloadBlob",
            filename: filename,
            blobData: reader.result,
            subfolder: subfolder || "",
          },
          (response) => {
            if (chrome.runtime.lastError) {
              log(__("log_download_error") + chrome.runtime.lastError.message);
              return reject(chrome.runtime.lastError);
            }
            if (!response.success) {
              log(
                __("log_download_error") +
                  (response.error || __("log_error_download_unknown"))
              );
              return reject(
                new Error(response.error || __("log_error_download_unknown"))
              );
            }
            log(__("log_capture_success") + filename);
            resolve(response.downloadId);
          }
        );
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // --- 修正版核心截取逻辑（异步等待图片加载）---
  async function tileCapture(template, isTimed = false) {
    log(__("log_capture_started"));
    const area = template
      ? template.area
      : getTargetArea(
          captureModeSelect.value,
          panel.querySelector("#wpc_tl_coord_input").value,
          panel.querySelector("#wpc_br_coord_input").value
        );
    if (!area) return;
    const { tl, br } = area;
    const startTileX = tl.tileX;
    const endTileX = br.tileX;
    const startTileY = tl.tileY;
    const endTileY = br.tileY;
    const outputWidthPx =
      (endTileX - startTileX) * TILE_SIZE + br.px - tl.px + 1;
    const outputHeightPx =
      (endTileY - startTileY) * TILE_SIZE + br.py - tl.py + 1;
    if (outputWidthPx <= 0 || outputHeightPx <= 0) {
      log(__("log_error_capture_zero_area"));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = outputWidthPx;
    canvas.height = outputHeightPx;
    const ctx = canvas.getContext("2d");

    // 1. 下载所有瓦片
    const tilePromises = [];
    const tileUrls = {};
    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        tilePromises.push(
          fetchTile(tileX, tileY)
            .then((url) => {
              tileUrls[`${tileX},${tileY}`] = url;
            })
            .catch((e) => {
              console.warn(`Tile ${tileX},${tileY} fetch failed:`, e);
              tileUrls[`${tileX},${tileY}`] = null;
            })
        );
      }
    }
    await Promise.all(tilePromises);

    // 2. 拼接瓦片并处理失败区域
    for (let tileY = startTileY; tileY <= endTileY; tileY++) {
      for (let tileX = startTileX; tileX <= endTileX; tileX++) {
        const url = tileUrls[`${tileX},${tileY}`];

        // 计算在最终图像中的目标位置和裁剪区域
        let sx = 0,
          sy = 0,
          sw = TILE_SIZE,
          sh = TILE_SIZE;
        let dx = (tileX - startTileX) * TILE_SIZE - tl.px;
        let dy = (tileY - startTileY) * TILE_SIZE - tl.py;
        let dw = TILE_SIZE,
          dh = TILE_SIZE;
        if (tileX === startTileX && tl.px > 0) {
          sx = tl.px;
          sw -= tl.px;
          dx = 0;
          dw = TILE_SIZE - tl.px;
        }
        if (tileY === startTileY && tl.py > 0) {
          sy = tl.py;
          sh -= tl.py;
          dy = 0;
          dh = TILE_SIZE - tl.py;
        }
        if (tileX === endTileX && br.px < TILE_SIZE - 1) {
          sw = br.px + 1 - sx;
          dw = sw;
        }
        if (tileY === endTileY && br.py < TILE_SIZE - 1) {
          sh = br.py + 1 - sy;
          dh = sh;
        }

        // --- 失败瓦片高亮 ---
        if (!url) {
          ctx.save();
          ctx.fillStyle = "#fdd";
          ctx.fillRect(dx, dy, dw, dh);
          ctx.strokeStyle = "#e25555";
          ctx.lineWidth = 2;
          ctx.strokeRect(dx, dy, dw, dh);
          ctx.restore();
          log(
            `[警告] ${__("tpl_mode_prefix") || "模式"}: ` +
              __("tile_load_failed")
              ? __("tile_load_failed").replace("${tile}", `${tileX},${tileY}`)
              : `瓦片 ${tileX},${tileY} 加载失败，区域已留空`
          );
          continue;
        }

        // --- 正常瓦片 ---
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
        try {
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        } catch (e) {
          console.error("Error drawing image:", e);
        }
        URL.revokeObjectURL(url);
      }
    }

    // 3. 下载
    const now = new Date();
    const dateTime = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const modeName = template ? template.name : area.mode;
    const filename = `${modeName}_${dateTime}.png`;
    const subfolder = isTimed ? (template ? template.subfolder : "") : "";

    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          log(__("log_error_canvas_fail"));
          return resolve(false);
        }
        try {
          await requestDownload(blob, filename, subfolder);
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      }, "image/png");
    });
  }
  // --- 模板优雅删除按钮渲染 ---
  function renderTemplateList() {
    templateListEl.innerHTML = "";
    if (g_templates.length === 0) {
      noTemplateMsg.style.display = "block";
      return;
    }
    noTemplateMsg.style.display = "none";
    g_templates.forEach((tpl) => {
      const isTimerSelected = g_timerConfig.templateIds
        .map(String)
        .includes(tpl.id.toString());
      const modeName =
        tpl.area.mode === "precise"
          ? __("mode_precise_short")
          : __("mode_multi_short");
      const subfolderText = tpl.subfolder || __("tpl_none");
      const templateEl = document.createElement("div");
      templateEl.className =
        "wpc_template_item" +
        (isTimerSelected ? " wpc_template_timer_item" : "");
      templateEl.innerHTML = `
        <div class="wpc_template_header">
          <div class="wpc_checkbox_row">
            <input type="checkbox" id="tpl_checkbox_${
              tpl.id
            }" data-template-id="${tpl.id}" ${isTimerSelected ? "checked" : ""}>
            <label for="tpl_checkbox_${tpl.id}" class="wpc_template_name">${
        tpl.name
      }</label>
          </div>
          <div class="wpc_template_actions">
            <button class="wpc_nice_btn" data-action="export">${__(
              "export"
            )}</button>
            <button class="wpc_nice_btn wpc_nice_btn-delete" data-action="delete" data-id="${
              tpl.id
            }">${__("delete")}</button>
            <button class="wpc_nice_btn wpc_nice_btn-circle" data-action="close">&times;</button>
          </div>
        </div>
        <p class="wpc_small">
          <span data-i18n="tpl_mode_prefix">${__(
            "tpl_mode_prefix"
          )}</span>: ${modeName} | 
          <span data-i18n="tpl_subfolder_prefix">${__(
            "tpl_subfolder_prefix"
          )}</span>: ${subfolderText}
        </p>
      `;
      // 绑定事件（其余如 export/close 按钮自己实现）
      templateEl
        .querySelector(`input[type="checkbox"]`)
        .addEventListener("change", updateTimerSelection);
      templateListEl.appendChild(templateEl);
    });
    updateTimerStatusDisplay();
  }

  // --- 优雅删除按钮二次确认逻辑 ---
  templateListEl.addEventListener("click", function (e) {
    const btn = e.target.closest(".wpc_nice_btn-delete");
    if (!btn) return;

    // 二次确认逻辑
    if (!btn.classList.contains("confirm")) {
      // 第一次点击，进入确认态
      btn.textContent = __("are_you_sure");
      btn.classList.add("confirm");
      // 3秒后自动取消
      btn._wpcTimeout = setTimeout(() => {
        btn.textContent = __("delete");
        btn.classList.remove("confirm");
      }, 3000);
    } else {
      // 第二次点击，执行删除
      clearTimeout(btn._wpcTimeout);
      btn.textContent = __("deleting");
      btn.disabled = true;
      // 执行你的删除逻辑
      deleteTemplate(
        btn.dataset.id,
        btn.closest(".wpc_template_item").querySelector(".wpc_template_name")
          .textContent
      );
    }
    e.stopPropagation();
  });

  // 其它地方点击时自动取消确认
  document.addEventListener(
    "click",
    function (e) {
      document
        .querySelectorAll(".wpc_nice_btn-delete.confirm")
        .forEach((btn) => {
          if (!btn.contains(e.target)) {
            btn.textContent = __("delete");
            btn.classList.remove("confirm");
            if (btn._wpcTimeout) clearTimeout(btn._wpcTimeout);
          }
        });
    },
    true
  );
  // --- 立即执行截取 ---
  async function executeCapture() {
    executeCaptureBtn.disabled = true;
    await tileCapture(null, false);
    executeCaptureBtn.disabled = false;
  }

  // --- 定时器逻辑 ---

  function updateTimerStatusDisplay() {
    const isRunning =
      g_timerConfig.autoStart && g_timerConfig.templateIds.length > 0;
    const statusText = isRunning ? __("status_running") : __("status_stopped");

    timerStatusEl.textContent = __("timer_status_prefix") + statusText;

    timerToggleBtn.textContent = isRunning
      ? __("timer_toggle_stop")
      : __("timer_toggle_start");
    timerToggleBtn.classList.toggle("danger", isRunning);

    runningIndicator.style.display = isRunning ? "block" : "none";

    // 更新下次任务时间 (如果计时器活动)
    if (g_activeTimer) {
      clearInterval(g_activeTimer);
      g_activeTimer = null;
    }

    if (isRunning) {
      let lastTaskTime = Date.now();
      const intervalMs = g_timerConfig.intervalMin * 60 * 1000;

      const updateCountdown = () => {
        const now = Date.now();
        const nextTaskTime = lastTaskTime + intervalMs;
        const remainingMs = Math.max(0, nextTaskTime - now);

        const totalSeconds = Math.round(remainingMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        timerStatusEl.textContent =
          __("timer_status_prefix") +
          __("status_running") +
          `${minutes}m ${seconds}s`;
        if (remainingMs === 0) {
          lastTaskTime = Date.now();
        }
      };

      updateCountdown();
      g_activeTimer = setInterval(updateCountdown, 1000);
    }
  }

  // 启动定时任务
  function startTimer() {
    const intervalMin = parseInt(intervalInput.value, 10);
    const selectedTemplateIds = g_templates
      .filter((tpl) => panel.querySelector(`#tpl_checkbox_${tpl.id}`)?.checked)
      .map((tpl) => tpl.id);

    if (selectedTemplateIds.length === 0) {
      log(__("log_error_no_templates_selected"));
      return;
    }

    if (intervalMin < MIN_INTERVAL_MIN) {
      intervalInput.value = MIN_INTERVAL_MIN;
      log(__("log_timer_interval_change") + `${MIN_INTERVAL_MIN} 分钟`);
    }

    g_timerConfig.templateIds = selectedTemplateIds;
    g_timerConfig.intervalMin = intervalMin;
    g_timerConfig.autoStart = true;

    saveTimerConfig(true);
    log(__("log_timer_started"));
  }

  // 停止定时任务
  function stopTimer() {
    g_timerConfig.autoStart = false;
    saveTimerConfig(false);
    log(__("log_timer_stopped"));
  }

  // 接收来自 background.js 的定时任务执行请求
  async function executeTimedCapture() {
    if (!g_timerConfig.autoStart || g_timerConfig.templateIds.length === 0) {
      return;
    }

    log("收到执行定时任务请求...");
    // 按照模板 ID 顺序轮流执行任务
    for (const id of g_timerConfig.templateIds) {
      const template = g_templates.find((tpl) => tpl.id === id);
      if (template) {
        // 将截取任务加入下载队列
        const task = () => tileCapture(template, true);
        g_downloadQueue.push(task);
      }
    }
    processQueue(); // 启动/恢复队列处理
  }

  // --- 模板管理逻辑 ---

  function renderTemplateFormCoordInputs(mode, currentTemplate) {
    tplCoordArea.innerHTML = "";
    const isPrecise = mode === "precise";

    if (isPrecise) {
      tplCoordArea.innerHTML = `
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="coord_precise_label_l">${__(
            "coord_precise_label_l"
          )}</label>
          <input type="text" id="wpc_tpl_tl_coord_input" placeholder="space-separated num/(tileX,.../Share Link" />
        </div>
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="coord_precise_label">${__(
            "coord_precise_label"
          )}</label>
          <input type="text" id="wpc_tpl_br_coord_input" placeholder="space-separated num/(tileX,.../Share Link" />
        </div>
      `;
      if (currentTemplate) {
        const tl = currentTemplate.area.tl;
        const br = currentTemplate.area.br;
        panel.querySelector(
          "#wpc_tpl_tl_coord_input"
        ).value = `${tl.tileX},${tl.tileY},${tl.px},${tl.py}`;
        panel.querySelector(
          "#wpc_tpl_br_coord_input"
        ).value = `${br.tileX},${br.tileY},${br.px},${br.py}`;
      }
    } else {
      tplCoordArea.innerHTML = `
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="coord_multi_label">${__(
            "coord_multi_label"
          )}</label>
          <input type="text" id="wpc_tpl_multi_tl_input" placeholder="Start tileX,tileY (e.g. 10,20)" />
          <input type="text" id="wpc_tpl_multi_br_input" placeholder="End tileX,tileY (e.g. 15,25)" />
        </div>
      `;
      if (currentTemplate) {
        const tl = currentTemplate.area.tl;
        const br = currentTemplate.area.br;
        panel.querySelector(
          "#wpc_tpl_multi_tl_input"
        ).value = `${tl.tileX},${tl.tileY}`;
        panel.querySelector(
          "#wpc_tpl_multi_br_input"
        ).value = `${br.tileX},${br.tileY}`;
      }
    }
    // 重新应用翻译
    applyI18n();
  }

  function toggleTemplateForm(show, template = null) {
    if (show) {
      g_editingTemplateId = template ? template.id : null;
      templateListContainer.style.display = "none";
      templateForm.style.display = "flex";

      formTitle.textContent = template
        ? __("tpl_form_edit_title")
        : __("tpl_form_new_title");
      tplNameInput.value = template ? template.name : "";
      tplModeSelect.value = template ? template.area.mode : "precise";
      tplSubfolderInput.value = template ? template.subfolder : "";

      renderTemplateFormCoordInputs(tplModeSelect.value, template);
    } else {
      templateListContainer.style.display = "block";
      templateForm.style.display = "none";
      g_editingTemplateId = null;
    }
  }

  function renderTemplateList() {
    templateListEl.innerHTML = "";
    if (g_templates.length === 0) {
      noTemplateMsg.style.display = "block";
      return;
    }
    noTemplateMsg.style.display = "none";
    g_templates.forEach((tpl) => {
      const isTimerSelected = g_timerConfig.templateIds
        .map(String)
        .includes(tpl.id.toString());
      const modeName =
        tpl.area.mode === "precise"
          ? __("mode_precise_short")
          : __("mode_multi_short");
      const subfolderText = tpl.subfolder || __("tpl_none");
      const templateEl = document.createElement("div");
      templateEl.className =
        "wpc_template_item" +
        (isTimerSelected ? " wpc_template_timer_item" : "");
      templateEl.innerHTML = `
        <div class="wpc_template_header">
          <div class="wpc_checkbox_row">
            <input type="checkbox" id="tpl_checkbox_${
              tpl.id
            }" data-template-id="${tpl.id}" ${isTimerSelected ? "checked" : ""}>
            <label for="tpl_checkbox_${tpl.id}" class="wpc_template_name">${
        tpl.name
      }</label>
          </div>
          <div class="wpc_template_actions">
            <button class="wpc_button secondary" data-action="run" data-id="${
              tpl.id
            }" data-i18n="tpl_btn_run_once">${__("tpl_btn_run_once")}</button>
            <button class="wpc_button secondary" data-action="edit" data-id="${
              tpl.id
            }" data-i18n="tpl_btn_edit">${__("tpl_btn_edit")}</button>
            <button class="wpc_button danger" data-action="delete" data-id="${
              tpl.id
            }" data-i18n="tpl_btn_delete">${__("tpl_btn_delete")}</button>
          </div>
        </div>
        <p class="wpc_small">
          <span data-i18n="tpl_mode_prefix">${__(
            "tpl_mode_prefix"
          )}</span>: ${modeName} | 
          <span data-i18n="tpl_subfolder_prefix">${__(
            "tpl_subfolder_prefix"
          )}</span>: ${subfolderText}
        </p>
      `;
      templateEl
        .querySelector(`input[type="checkbox"]`)
        .addEventListener("change", updateTimerSelection);
      templateEl
        .querySelector(`button[data-action="run"]`)
        .addEventListener("click", () => tileCapture(tpl, false));
      templateEl
        .querySelector(`button[data-action="edit"]`)
        .addEventListener("click", () => editTemplate(tpl.id));
      templateEl
        .querySelector(`button[data-action="delete"]`)
        .addEventListener("click", () => deleteTemplate(tpl.id, tpl.name));
      templateListEl.appendChild(templateEl);
    });
    updateTimerStatusDisplay();
  }

  function updateTimerSelection() {
    g_timerConfig.templateIds = Array.from(
      panel.querySelectorAll(
        '#wpc_template_list input[type="checkbox"]:checked'
      )
    ).map((cb) => cb.dataset.templateId.toString());
    if (g_timerConfig.autoStart) {
      saveTimerConfig(true);
    }
    renderTemplateList();
  }

  function saveTemplate() {
    const name = tplNameInput.value.trim();
    const mode = tplModeSelect.value;
    const subfolder = tplSubfolderInput.value.trim();

    if (!name) {
      log(__("log_error_tpl_name_required"));
      return;
    }

    let tlInput, brInput;
    if (mode === "precise") {
      tlInput = panel.querySelector("#wpc_tpl_tl_coord_input").value;
      brInput = panel.querySelector("#wpc_tpl_br_coord_input").value;
    } else {
      tlInput = panel.querySelector("#wpc_tpl_multi_tl_input").value;
      brInput = panel.querySelector("#wpc_tpl_multi_br_input").value;
    }

    const area = getTargetArea(mode, tlInput, brInput);
    if (!area) return; // 错误已记录

    if (g_editingTemplateId !== null) {
      // 编辑现有模板
      const index = g_templates.findIndex((t) => t.id === g_editingTemplateId);
      if (index !== -1) {
        g_templates[index] = {
          ...g_templates[index],
          name: name,
          area: area,
          subfolder: subfolder,
        };
        log(__("log_tpl_saved_edit") + name);
      }
    } else {
      // 新建模板
      const newId = Date.now(); // 保证唯一且永不重复

      const newTemplate = {
        id: newId,
        name: name,
        area: area,
        subfolder: subfolder,
      };
      g_templates.push(newTemplate);
      log(__("log_tpl_saved_new") + name);
    }

    saveTemplates();
    renderTemplateList();
    toggleTemplateForm(false);
  }

  function editTemplate(id) {
    id = id.toString();
    const template = g_templates.find((t) => t.id.toString() === id);
    if (template) {
      toggleTemplateForm(true, template);
    }
  }

  function deleteTemplate(id, name) {
    id = id.toString();
    g_templates = g_templates.filter((t) => t.id.toString() !== id);
    const indexInTimer = g_timerConfig.templateIds
      .map((tid) => tid.toString())
      .indexOf(id);
    if (indexInTimer > -1) {
      g_timerConfig.templateIds.splice(indexInTimer, 1);
      if (g_timerConfig.autoStart) {
        saveTimerConfig(true);
      }
    }
    saveTemplates();
    renderTemplateList();
    log(__("log_tpl_deleted") + name);
  }

  // --- 数据持久化 ---
  function loadTemplates() {
    chrome.storage.local.get("wpc_templates", (result) => {
      if (result.wpc_templates) {
        g_templates = result.wpc_templates;
      }
      renderTemplateList();
    });
  }

  function saveTemplates() {
    chrome.storage.local.set({ wpc_templates: g_templates }, () => {
      if (chrome.runtime.lastError) {
        console.error("保存模板失败:", chrome.runtime.lastError.message);
      }
    });
  }

  function loadTimerConfig() {
    chrome.storage.local.get("wpc_timer_config", (result) => {
      if (result.wpc_timer_config) {
        g_timerConfig = result.wpc_timer_config;
      }

      // 更新 UI 状态
      intervalInput.value = g_timerConfig.intervalMin;
      autoStartCheckbox.checked = g_timerConfig.autoStart;

      // 根据配置初始化定时器状态
      updateTimerStatusDisplay();

      // 自动启动逻辑
      if (g_timerConfig.autoStart && g_timerConfig.templateIds.length > 0) {
        log(__("log_timer_auto_start"));
      }
    });
  }

  function saveTimerConfig(autoStart) {
    g_timerConfig.intervalMin = parseInt(intervalInput.value, 10);
    g_timerConfig.autoStart = autoStart;

    // 更新 background.js 的 alarm 状态
    chrome.runtime.sendMessage(
      { action: "saveTimerState", config: g_timerConfig },
      (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          console.error(
            "保存定时器状态到 Service Worker 失败:",
            chrome.runtime.lastError?.message || response?.error
          );
        } else {
          // 成功保存，在 content script 中更新状态显示
          updateTimerStatusDisplay();
          log(__("log_timer_config_saved"));
        }
      }
    );
  }

  function loadLanguageSetting(callback) {
    chrome.storage.local.get("wpc_language", (result) => {
      if (result.wpc_language) {
        g_currentLanguage = result.wpc_language;
      }
      callback();
    });
  }

  function saveLanguageSetting(lang) {
    chrome.storage.local.set({ wpc_language: lang }, () => {
      if (chrome.runtime.lastError) {
        log(__("log_lang_save_fail") + chrome.runtime.lastError.message);
      }
    });
  }

  // --- UI 渲染/国际化/事件 ---
  function applyI18n() {
    panel.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      el.textContent = __(key);
    });

    panel.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      el.placeholder = __(key);
    });

    panel.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      el.title = __(key);
    });

    // 翻译特定元素内容
    panel.querySelector("#wpc_min_interval_desc").textContent = __(
      "min_interval_desc"
    ).replace("${MIN_INTERVAL_MIN}", MIN_INTERVAL_MIN);

    // Req 2: 更新作者链接
    authorLink.textContent = __("author_name");
  }

  function updateLangToggleBtn() {
    langToggleBtn.textContent =
      g_currentLanguage === LANGUAGES.ZH
        ? __("lang_btn_en")
        : __("lang_btn_zh");
    langToggleBtn.title =
      g_currentLanguage === LANGUAGES.ZH ? "Switch to English" : "切换到中文";
  }

  function toggleLanguage() {
    g_currentLanguage =
      g_currentLanguage === LANGUAGES.ZH ? LANGUAGES.EN : LANGUAGES.ZH;

    // Req 4: 清空日志
    if (logEl) logEl.innerHTML = "";

    saveLanguageSetting(g_currentLanguage);
    applyI18n();
    updateLangToggleBtn();
    renderCaptureCoordInputs();
    renderTemplateFormCoordInputs(
      tplModeSelect.value,
      g_templates.find((t) => t.id === g_editingTemplateId)
    );
    renderTemplateList();

    log(
      __("log_lang_switched") +
        (g_currentLanguage === LANGUAGES.ZH ? "中文" : "English")
    );
  }

  function renderCaptureCoordInputs() {
    captureCoordArea.innerHTML = "";

    const mode = captureModeSelect.value;
    const isPrecise = mode === "precise";

    if (isPrecise) {
      captureCoordArea.innerHTML = `
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="coord_precise_label_l">${__(
            "coord_precise_label_l"
          )}</label>
          <input type="text" id="wpc_tl_coord_input" placeholder="space-separated numbers/tileX,tileY,px,py/Share Link" />
        </div>
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="coord_precise_label">${__(
            "coord_precise_label"
          )}</label>
          <input type="text" id="wpc_br_coord_input" placeholder="space-separated numbers/tileX,tileY,px,py/Share Link" />
        </div>
      `;
    } else {
      captureCoordArea.innerHTML = `
        <div class="wpc_row">
          <label class="wpc_mode_label" data-i18n="coord_multi_label">${__(
            "coord_multi_label"
          )}</label>
          <input type="text" id="wpc_multi_tl_input" placeholder="Start tileX,tileY (e.g. 10,20)" />
          <input type="text" id="wpc_multi_br_input" placeholder="End tileX,tileY (e.g. 15,25)" />
        </div>
      `;
    }
    applyI18n();
  }

  // --- 监听器设置 ---

  captureButton.addEventListener("click", () => {
    panel.classList.toggle("visible");
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.remove("visible");
  });

  panel.querySelectorAll(".wpc_tab_button").forEach((button) => {
    button.addEventListener("click", () => {
      panel
        .querySelectorAll(".wpc_tab_button")
        .forEach((btn) => btn.classList.remove("active"));
      panel
        .querySelectorAll(".wpc_tab_content")
        .forEach((content) => content.classList.remove("active"));

      button.classList.add("active");
      panel
        .querySelector(`#wpc_tab_${button.dataset.tab}`)
        .classList.add("active");
    });
  });

  langToggleBtn.addEventListener("click", toggleLanguage);

  captureModeSelect.addEventListener("change", renderCaptureCoordInputs);
  executeCaptureBtn.addEventListener("click", executeCapture);

  createNewTemplateBtn.addEventListener("click", () =>
    toggleTemplateForm(true, null)
  );
  tplCancelBtn.addEventListener("click", () => toggleTemplateForm(false));
  tplSaveBtn.addEventListener("click", saveTemplate);
  tplModeSelect.addEventListener("change", () =>
    renderTemplateFormCoordInputs(
      tplModeSelect.value,
      g_templates.find((t) => t.id === g_editingTemplateId)
    )
  );

  timerToggleBtn.addEventListener("click", () => {
    if (g_timerConfig.autoStart) {
      stopTimer();
    } else {
      startTimer();
    }
  });

  intervalInput.addEventListener("change", () => {
    if (parseInt(intervalInput.value, 10) < MIN_INTERVAL_MIN) {
      intervalInput.value = MIN_INTERVAL_MIN;
    }
    if (g_timerConfig.autoStart) {
      saveTimerConfig(true);
    }
  });

  autoStartCheckbox.addEventListener("change", () => {
    g_timerConfig.autoStart = autoStartCheckbox.checked;
    saveTimerConfig(g_timerConfig.autoStart);
  });

  runningIndicator.addEventListener("click", () => {
    if (g_timerConfig.autoStart) {
      stopTimer();
      renderTemplateList();
      log(__("log_timer_external_stop"));
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "executeTimedCapture") {
      executeTimedCapture();
      sendResponse({ success: true });
      return true;
    }
  });

  // Tooltip 事件绑定
  if (tplListHelpIcon && tplListTooltip) {
    tplListHelpIcon.addEventListener("mouseover", () => {
      if (!isTplTooltipClicked) {
        tplListTooltip.classList.add("visible");
      }
    });
    tplListHelpIcon.addEventListener("mouseout", () => {
      if (!isTplTooltipClicked) {
        tplListTooltip.classList.remove("visible");
      }
    });
    tplListHelpIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      isTplTooltipClicked = !isTplTooltipClicked;
      tplListTooltip.classList.toggle("visible", isTplTooltipClicked);
    });
  }

  if (timerSettingsHelpIcon && timerSettingsTooltip) {
    timerSettingsHelpIcon.addEventListener("mouseover", () => {
      if (!isTimerTooltipClicked) {
        timerSettingsTooltip.classList.add("visible");
      }
    });
    timerSettingsHelpIcon.addEventListener("mouseout", () => {
      if (!isTimerTooltipClicked) {
        timerSettingsTooltip.classList.remove("visible");
      }
    });
    timerSettingsHelpIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      isTimerTooltipClicked = !isTimerTooltipClicked;
      timerSettingsTooltip.classList.toggle("visible", isTimerTooltipClicked);
    });
  }

  // 全局点击隐藏 Tooltip
  document.addEventListener("click", (e) => {
    if (
      isTplTooltipClicked &&
      tplListHelpIcon &&
      tplListTooltip &&
      !tplListHelpIcon.contains(e.target) &&
      !tplListTooltip.contains(e.target)
    ) {
      isTplTooltipClicked = false;
      tplListTooltip.classList.remove("visible");
    }
    if (
      isTimerTooltipClicked &&
      timerSettingsHelpIcon &&
      timerSettingsTooltip &&
      !timerSettingsHelpIcon.contains(e.target) &&
      !timerSettingsTooltip.contains(e.target)
    ) {
      isTimerTooltipClicked = false;
      timerSettingsTooltip.classList.remove("visible");
    }
  });

  // --- 初始化函数 ---
  function init() {
    // 1. 语言设置：加载已保存的语言，然后应用翻译
    loadLanguageSetting(() => {
      applyI18n();
      updateLangToggleBtn();
    });

    // 2. 加载配置
    loadTimerConfig();
    loadTemplates();

    // 3. 初始化 UI 组件
    renderCaptureCoordInputs();

    // Req 4: 确保启动时日志为空
    if (logEl) logEl.innerHTML = "";
  }

  init();
})();
