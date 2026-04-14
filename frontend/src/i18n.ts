import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

const resources = {
  en: {
    translation: {
      nav: {
        Tasks: "Tasks",
        NewTask: "New Task",
        Settings: "Settings"
      },
      common: {
        cancel: "Cancel",
        retry: "Retry",
        log: "Log",
        close: "Close",
        loading: "Loading...",
        prev: "Prev",
        next: "Next",
        remove: "Remove",
        delete: "Delete",
        success: "Success",
        failed: "Failed",
        error: "Error",
        pageOf: "{{current}} / {{total}}"
      },
      status: {
        all: "All",
        pending: "Pending",
        running: "Running",
        done: "Done",
        failed: "Failed",
        cancelled: "Cancelled"
      },
      tasks: {
        title: "Tasks",
        cancelAll: "Cancel All Running",
        loading: "Loading matrix...",
        noData: "No data present",
        emptyDescription:"Please create a task to display."
      },
      newTask: {
        title: "New Operation",
        heroDesc: "Select a storage source, assemble subtitle processing parameters, and dispatch jobs in one flow.",
        smbServer: "SMB Server",
        selectServer: "-- Select Server --",
        targetFiles: "Target Files",
        pipelineTitle: "Operation Pipeline",
        pipelineDesc: "Pick a source server first, then browse folders and mark the assets that should enter the queue.",
        profileTitle: "Processing Profile",
        profileDesc: "Define language routing, engine stack, overwrite strategy, and submission readiness before dispatch.",
        selectionTitle: "Selected Assets",
        selectionDesc: "Review the final selection before creating subtitle tasks.",
        selectionEmpty: "Not selected",
        submitHint: "Jobs will be created with the current language and engine profile.",
        selectedArgs: "{{count}} Selected",
        sourceLang: "Source Language",
        targetLang: "Target Language",
        sttEngine: "ASR Engine",
        transEngine: "Translation Engine",
        overwrite: "Overwrite existing subtitle files",
        selectedIndex: "Selected Index",
        executing: "Executing...",
        commitOps: "Commit {{count}} Operations",
        errNoFiles: "Select SMB server and at least one video file."
      },
      settings: {
        title: "System Settings",
        heroDesc: "Organize storage connections and engine credentials from a dedicated settings workspace.",
        directoryTitle: "Settings Directory",
        overview: "Overview",
        overviewTitle: "Workspace Overview",
        overviewDesc: "Keep the runtime environment, storage access, and engine credentials aligned before launching new jobs.",
        smbDesc: "Manage SMB endpoints used by task intake and media browsing.",
        sttDesc: "Tune speech-to-text engines and secret material for recognition.",
        translateDesc: "Configure translation providers, model routing, and endpoint overrides.",
        serverCount: "Servers",
        engineCount: "Engine Groups",
        connectionHint: "Configuration changes apply to upcoming tasks.",
        smbServers: "SMB Servers",
        testing: "Testing...",
        ping: "Ping",
        addServer: "Add Server",
        name: "Name",
        host: "Host",
        share: "Share",
        username: "Username",
        password: "Password",
        port: "Port",
        attachServer: "Attach Server",
        sttTitle: "STT Engine Kernel",
        commitStt: "Commit STT Config",
        transTitle: "Translation Engine Settings",
        commitTrans: "Commit Translation Config",
        confirmDel: "Confirm deletion of server index?",
        sttSaved: "STT Engine Config Saved",
        transSaved: "Translation Engine Config Saved",
        fields: {
          whisperLocal: "Whisper Local Model (tiny/base/small/medium/large)",
          openaiWhisper: "OpenAI Whisper API Key",
          deeplxEndpoint: "DeepLX Endpoint URL",
          deeplKey: "DeepL API Key",
          googleKey: "Google Translate API Key",
          openaiKey: "OpenAI API Key",
          openaiModel: "OpenAI Model (gpt-x)",
          openaiBase: "OpenAI Base URL (Optional)",
          claudeKey: "Claude API Key",
          claudeModel: "Claude Model",
          claudeBase: "Claude Base URL (Optional)"
        }
      },
      drawer: {
        title: "Task Logs #{{id}}",
        noLogs: "No logs available.",
        failedLoad: "Failed to load logs: {{msg}}"
      },
      browser: {
        back: "Back",
        loading: "Loading...",
        currentPath: "Current Path",
        folders: "Folders and Files",
        unsupported: "Non-video files are shown for reference only.",
        empty: "No matching media files in this folder.",
        failed: "Unable to load this folder."
      },
      lang: {
        auto: "Auto Detect",
        zh: "Chinese",
        en: "English",
        ja: "Japanese",
        ko: "Korean",
        fr: "French",
        de: "German"
      },
      engines: {
        whisperLocal: "Local Whisper",
        whisperApi: "OpenAI Whisper API",
        deeplx: "DeepLX",
        deepl: "DeepL API",
        google: "Google Translate",
        llm: "LLM (OpenAI/Claude)"
      }
    }
  },
  zh: {
    translation: {
      nav: {
        Tasks: "任务中心",
        NewTask: "新建任务",
        Settings: "系统设置"
      },
      common: {
        cancel: "取消",
        retry: "重试",
        log: "日志",
        close: "关闭",
        loading: "加载中...",
        prev: "上一页",
        next: "下一页",
        remove: "移除",
        delete: "删除",
        success: "成功",
        failed: "失败",
        error: "错误",
        pageOf: "{{current}} / {{total}}"
      },
      status: {
        all: "全部",
        pending: "等待中",
        running: "运行中",
        done: "已完成",
        failed: "失败",
        cancelled: "已取消"
      },
      tasks: {
        title: "任务中心",
        cancelAll: "中断所有任务",
        loading: "加载矩阵中...",
        noData: "暂无数据",
        emptyDescription:"请创建一个任务以显示"
      },
      newTask: {
        title: "新建任务",
        heroDesc: "在一个工作流中完成存储源选择、字幕处理参数配置和任务投递。",
        smbServer: "SMB 服务器",
        selectServer: "-- 选择服务器 --",
        targetFiles: "目标文件",
        pipelineTitle: "文件来源",
        pipelineDesc: "选择源服务器，浏览目录并勾选需要进入队列的媒体文件。",
        profileTitle: "处理配置",
        profileDesc: "在提交前确认语言路由、引擎组合、覆盖策略和投递状态。",
        selectionTitle: "已选文件",
        selectionDesc: "在创建字幕任务前复核最终选中的资产。",
        selectionEmpty: "暂未选择",
        submitHint: "将按照当前语言与引擎配置批量创建任务。",
        selectedArgs: "已选择 {{count}} 项",
        sourceLang: "源语言",
        targetLang: "目标语言",
        sttEngine: "ASR 引擎",
        transEngine: "翻译引擎",
        overwrite: "覆盖已有字幕文件",
        selectedIndex: "已选清单",
        executing: "执行中...",
        commitOps: "提交 {{count}} 项任务",
        errNoFiles: "请选择 SMB 服务器及至少一个视频文件"
      },
      settings: {
        title: "系统设置",
        heroDesc: "在独立设置工作区中维护存储连接和引擎凭据。",
        directoryTitle: "设置目录",
        overview: "概览",
        overviewTitle: "工作区概览",
        overviewDesc: "在新任务投递前，对齐运行环境、存储访问和引擎凭据配置。",
        smbDesc: "管理任务接入和媒体浏览使用的 SMB 端点。",
        sttDesc: "维护语音识别引擎和相关密钥材料。",
        translateDesc: "配置翻译提供方、模型路由和自定义端点。",
        serverCount: "服务器数量",
        engineCount: "引擎分组",
        connectionHint: "配置变更会作用于后续新任务。",
        smbServers: "SMB 服务器",
        testing: "测试中...",
        ping: "测试连接",
        addServer: "添加服务器",
        name: "名称",
        host: "主机地址",
        share: "共享目录",
        username: "用户名",
        password: "密码",
        port: "端口",
        attachServer: "接入服务器",
        sttTitle: "STT 引擎内核",
        commitStt: "提交 STT 配置",
        transTitle: "翻译引擎设置",
        commitTrans: "提交翻译配置",
        confirmDel: "确定删除此服务器配置？",
        sttSaved: "STT 引擎配置已保存",
        transSaved: "翻译引擎配置已保存",
        fields: {
          whisperLocal: "本地 Whisper 模型 (tiny/base/small/medium/large)",
          openaiWhisper: "OpenAI Whisper API Key",
          deeplxEndpoint: "DeepLX Endpoint URL",
          deeplKey: "DeepL API Key",
          googleKey: "Google Translate API Key",
          openaiKey: "OpenAI API Key",
          openaiModel: "OpenAI 模型 (gpt-x)",
          openaiBase: "OpenAI Base URL (可选)",
          claudeKey: "Claude API Key",
          claudeModel: "Claude 模型",
          claudeBase: "Claude Base URL (可选)"
        }
      },
      drawer: {
        title: "任务日志 #{{id}}",
        noLogs: "暂无日志。",
        failedLoad: "无法加载日志: {{msg}}"
      },
      browser: {
        back: "返回",
        loading: "加载中...",
        currentPath: "当前位置",
        folders: "目录与文件",
        unsupported: "非视频文件仅作参考展示。",
        empty: "当前目录下没有可处理的视频文件。",
        failed: "当前目录加载失败。"
      },
      lang: {
        auto: "自动检测",
        zh: "中文",
        en: "英语",
        ja: "日语",
        ko: "韩语",
        fr: "法语",
        de: "德语"
      },
      engines: {
        whisperLocal: "本地 Whisper",
        whisperApi: "OpenAI Whisper API",
        deeplx: "DeepLX",
        deepl: "DeepL 官方 API",
        google: "Google Translate",
        llm: "大语言模型 (OpenAI/Claude)"
      }
    }
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, 
    }
  })

export default i18n
