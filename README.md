# Wplace.live Map Capturer!


> English version available at [README.md](./README-en.md)





为 [wplace.live](https://wplace.live) 打造的高级区域截取与模板管理工具。

## 功能列表

- 区域截取：灵活输入坐标或粘贴分享链接，截取地图任意区域。
- 多区块合并：支持选择多个区块，合成为一张大图。
- 模板管理：常用区域可保存为模板，便于一键截取或定时批量备份。
- 定时任务：自定义间隔，自动下载所有选中模板，并可指定子文件夹保存。
- 国际化切换：界面可一键切换中英文。
- 操作日志：所有操作和错误均详细记录，便于追溯和排查。
- 错误高亮：截取过程中如有瓦片丢失，图片会高亮显示缺失区域，并记录详细日志。



![Snipaste_2025-10-06_15-14-15](./Snipaste_2025-10-06_15-18-21.png)

## 安装方法

1. 下载或拉取并解压本仓库源码。
2. 打开 Chrome/Edge/Brave/Firefox，进入 `chrome://extensions/`（Firefox 为 `about:addons`）。
3. 开启“开发者模式”（Firefox 需进入“调试模式”或临时加载，详见[官方文档](https://extensionworkshop.com/documentation/develop/temporary-install-a-debug-addon/)）。
4. 点击“加载已解压的扩展程序”，选择项目文件夹（Firefox 用“临时加载附加组件”）。
5. 访问 [wplace.live](https://wplace.live/) 即可使用。

## 浏览器兼容性

- Chrome/Edge/Brave：支持静默批量下载和子目录（需关闭浏览器“每次下载前询问保存位置”）。
- Firefox：仅支持普通文件名，每次下载都会弹出保存对话框（不支持子目录和静默下载，属浏览器限制）。
- 如遇频繁弹窗，请检查浏览器下载设置。

## 支持与反馈

如有问题或建议，欢迎在 [Issues](https://github.com/Beibeisheep/Wplace-Map-Capturer/issues) 区留言或提交 PR
