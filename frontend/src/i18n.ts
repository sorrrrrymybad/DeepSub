import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

const resources = {
  en: {
    translation: {
      nav: {
        Tasks: "Tasks",
        NewTask: "New Task",
        Settings: "Settings",
        History: "History"
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
        noData: "No data present"
      },
      newTask: {
        title: "New Operation",
        smbServer: "SMB Server",
        selectServer: "-- Select Server --",
        targetFiles: "Target Files",
        selectedArgs: "{{count}} Selected",
        sourceLang: "Source Language",
        targetLang: "Target Language",
        sttEngine: "STT Engine",
        transEngine: "Translation Engine",
        overwrite: "Overwrite Existing SRT",
        selectedIndex: "Selected Index",
        executing: "Executing...",
        commitOps: "Commit {{count}} Operations",
        errNoFiles: "Select SMB server and at least one video file."
      },
      settings: {
        title: "System Settings",
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
      history: {
        title: "History Log",
        loading: "Loading history records...",
        noData: "No history found"
      },
      drawer: {
        title: "Task Logs #{{id}}",
        noLogs: "No logs available.",
        failedLoad: "Failed to load logs: {{msg}}"
      },
      browser: {
        back: "Back",
        loading: "Loading..."
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
        Settings: "系统设置",
        History: "历史记录"
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
        cancelAll: "取消所有运行中",
        loading: "加载矩阵中...",
        noData: "暂无数据"
      },
      newTask: {
        title: "新建作业",
        smbServer: "SMB 服务器",
        selectServer: "-- 选择服务器 --",
        targetFiles: "目标文件",
        selectedArgs: "已选择 {{count}} 项",
        sourceLang: "源语言",
        targetLang: "目标语言",
        sttEngine: "STT 引擎",
        transEngine: "翻译引擎",
        overwrite: "覆盖已有 SRT",
        selectedIndex: "已选清单",
        executing: "执行中...",
        commitOps: "提交 {{count}} 项任务",
        errNoFiles: "请选择 SMB 服务器及至少一个视频文件"
      },
      settings: {
        title: "系统设置",
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
      history: {
        title: "历史记录",
        loading: "加载历史记录中...",
        noData: "暂无历史记录"
      },
      drawer: {
        title: "任务日志 #{{id}}",
        noLogs: "暂无日志。",
        failedLoad: "无法加载日志: {{msg}}"
      },
      browser: {
        back: "返回",
        loading: "加载中..."
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
